import { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Feather } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import * as Crypto from 'expo-crypto';
import { format } from 'date-fns';
import { supabase } from '@/lib/supabase';
import { Colors } from '@/lib/constants';
import {
  requestPermissions,
  scheduleDueDateReminders,
} from '@/lib/notifications';
import {
  GOAL_ATTACHMENT_BUCKET,
  formatFileSize,
  goalAttachmentPath,
  inferReminderPreset,
  reminderForPreset,
  validateGoalAttachment,
  type GoalReminderPreset,
} from '@/lib/goals/details';
import {
  enqueueGoalAttachmentCleanup,
  flushGoalAttachmentCleanup,
} from '@/lib/goals/attachment-cleanup';

export type GoalDetailRecord = {
  id: string;
  content: string;
  notes: string | null;
  due_at: string | null;
  reminder_at: string | null;
};

type GoalMilestone = {
  id: string;
  content: string;
  position: number;
  due_at: string | null;
  completed_at: string | null;
};

type GoalAttachment = {
  id: string;
  storage_path: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
};

type Props = {
  visible: boolean;
  goal: GoalDetailRecord | null;
  userId: string | null;
  onClose: () => void;
  onDelete: () => Promise<boolean>;
  onUpdated: (goal: GoalDetailRecord) => void;
  onStartFocus?: () => void;
};

const REMINDER_OPTIONS: { id: GoalReminderPreset; label: string }[] = [
  { id: 'off', label: 'Off' },
  { id: 'day-before', label: '1 day before' },
  { id: 'hour-before', label: '1 hour before' },
  { id: 'at-time', label: 'At due time' },
];

function mimeTypeFor(name: string, provided: string | null | undefined): string {
  if (provided) return provided;
  const extension = name.toLowerCase().split('.').pop();
  return extension === 'pdf'
    ? 'application/pdf'
    : extension === 'docx'
      ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      : extension === 'jpg' || extension === 'jpeg'
        ? 'image/jpeg'
        : extension === 'png'
          ? 'image/png'
          : extension === 'txt'
            ? 'text/plain'
            : 'application/octet-stream';
}

export function GoalDetailModal({ visible, goal, userId, onClose, onDelete, onUpdated, onStartFocus }: Props) {
  const activeGoalKeyRef = useRef<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const savedDraftRef = useRef({ notes: '', dueAt: null as string | null, reminderPreset: 'off' as GoalReminderPreset });
  const [notes, setNotes] = useState('');
  const [dueAt, setDueAt] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [reminderPreset, setReminderPreset] = useState<GoalReminderPreset>('off');
  const [milestones, setMilestones] = useState<GoalMilestone[]>([]);
  const [attachments, setAttachments] = useState<GoalAttachment[]>([]);
  const [milestoneInput, setMilestoneInput] = useState('');
  const [milestoneDueAt, setMilestoneDueAt] = useState<Date | null>(null);
  const [showMilestoneDuePicker, setShowMilestoneDuePicker] = useState(false);
  const [editingMilestoneDueId, setEditingMilestoneDueId] = useState<string | null>(null);
  const [editingMilestoneDueAt, setEditingMilestoneDueAt] = useState<Date | null>(null);
  const [updatingMilestoneDueId, setUpdatingMilestoneDueId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [addingMilestone, setAddingMilestone] = useState(false);
  const [milestoneMutationCount, setMilestoneMutationCount] = useState(0);
  const [deletingGoal, setDeletingGoal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [attachmentMutationCount, setAttachmentMutationCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [notesOpen, setNotesOpen] = useState(false);
  const [filesOpen, setFilesOpen] = useState(false);
  const [reduceMotionEnabled, setReduceMotionEnabled] = useState(false);

  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) setReduceMotionEnabled(enabled);
    });
    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReduceMotionEnabled
    );
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (error) AccessibilityInfo.announceForAccessibility(error);
  }, [error]);

  const loadDetails = async (goalId: string, ownerId: string, requestKey: string) => {
    setLoading(true);
    setError(null);
    const [milestonesResult, attachmentsResult] = await Promise.all([
      supabase
        .from('goal_milestones')
        .select('id, content, position, due_at, completed_at')
        .eq('goal_id', goalId)
        .eq('user_id', ownerId)
        .order('position', { ascending: true }),
      supabase
        .from('goal_attachments')
        .select('id, storage_path, file_name, mime_type, size_bytes')
        .eq('goal_id', goalId)
        .eq('user_id', ownerId)
        .order('created_at', { ascending: true }),
    ]);
    if (activeGoalKeyRef.current !== requestKey) return;
    if (milestonesResult.error || attachmentsResult.error) {
      setError('Could not load goal details.');
    } else {
      setMilestones((milestonesResult.data ?? []) as GoalMilestone[]);
      setAttachments((attachmentsResult.data ?? []) as GoalAttachment[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (!visible || !goal || !userId) {
      activeGoalKeyRef.current = null;
      setNotes('');
      setDueAt(null);
      setReminderPreset('off');
      setMilestones([]);
      setAttachments([]);
      setMilestoneInput('');
      setMilestoneDueAt(null);
      setShowMilestoneDuePicker(false);
      setEditingMilestoneDueId(null);
      setEditingMilestoneDueAt(null);
      setUpdatingMilestoneDueId(null);
      setError(null);
      setLoading(false);
      setNotesOpen(false);
      setFilesOpen(false);
      return;
    }
    const requestKey = `${userId}:${goal.id}`;
    const initialNotes = goal.notes ?? '';
    const initialDueAt = goal.due_at ? new Date(goal.due_at) : null;
    const initialReminderPreset = inferReminderPreset(goal.due_at, goal.reminder_at);
    activeGoalKeyRef.current = requestKey;
    savedDraftRef.current = {
      notes: initialNotes,
      dueAt: initialDueAt?.toISOString() ?? null,
      reminderPreset: initialReminderPreset,
    };
    setNotes(initialNotes);
    setDueAt(initialDueAt);
    setReminderPreset(initialReminderPreset);
    setMilestones([]);
    setAttachments([]);
    setMilestoneInput('');
    setMilestoneDueAt(null);
    setShowMilestoneDuePicker(false);
    setEditingMilestoneDueId(null);
    setEditingMilestoneDueAt(null);
    setUpdatingMilestoneDueId(null);
    setShowDatePicker(false);
    setNotesOpen(Boolean(initialNotes.trim()));
    setFilesOpen(false);
    void flushGoalAttachmentCleanup(userId)
      .then((remaining) => {
        if (remaining.length > 0) {
          console.warn('Goal attachment cleanup is still pending.');
        }
      })
      .catch(() => {
        console.warn('Goal attachment cleanup could not run yet.');
      });
    void loadDetails(goal.id, userId, requestKey);
    return () => {
      if (activeGoalKeyRef.current === requestKey) activeGoalKeyRef.current = null;
    };
    // Reload only when the modal opens for a goal.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, goal?.id, userId]);

  const hasUnsavedChanges = () => (
    notes.trim() !== savedDraftRef.current.notes.trim()
    || (dueAt?.toISOString() ?? null) !== savedDraftRef.current.dueAt
    || reminderPreset !== savedDraftRef.current.reminderPreset
    || milestoneInput.trim().length > 0
    || milestoneDueAt !== null
    || editingMilestoneDueId !== null
  );

  const mutationInProgress =
    saving
    || deletingGoal
    || addingMilestone
    || uploading
    || attachmentMutationCount > 0
    || Boolean(updatingMilestoneDueId)
    || milestoneMutationCount > 0;

  const requestClose = () => {
    if (mutationInProgress) return;
    if (!hasUnsavedChanges()) {
      onClose();
      return;
    }
    Alert.alert(
      'Discard unsaved changes?',
      'Your notes, timing, or unadded milestone have not been saved.',
      [
        { text: 'Keep editing', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: onClose },
      ]
    );
  };

  const requestStartFocus = () => {
    if (!onStartFocus || mutationInProgress) return;
    if (!hasUnsavedChanges()) {
      onStartFocus();
      return;
    }
    Alert.alert(
      'Discard changes and start focus?',
      'Your notes, timing, or unadded milestone have not been saved.',
      [
        { text: 'Keep editing', style: 'cancel' },
        { text: 'Discard and focus', style: 'destructive', onPress: onStartFocus },
      ]
    );
  };

  if (!goal) return null;

  const saveDetails = async () => {
    if (!userId || mutationInProgress) return;
    const dueAtIso = dueAt?.toISOString() ?? null;
    const reminderAt = reminderForPreset(dueAtIso, reminderPreset);
    if (reminderAt && new Date(reminderAt).getTime() <= Date.now()) {
      setError('Choose a reminder time that has not passed.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      let data: GoalDetailRecord | null = null;
      let updateFailed = false;
      try {
        const result = await supabase
          .from('goals')
          .update({
            notes: notes.trim() || null,
            due_at: dueAtIso,
            reminder_at: reminderAt,
          } as any)
          .eq('id', goal.id)
          .eq('user_id', userId)
          .select('id, content, notes, due_at, reminder_at')
          .single();
        data = result.data as GoalDetailRecord | null;
        updateFailed = Boolean(result.error);
      } catch {
        updateFailed = true;
      }
      if (updateFailed || !data) {
        setError('Could not save these details.');
        return;
      }
      const savedGoal = data;
      const savedNotes = savedGoal.notes ?? '';
      setNotes((current) => current === notes ? savedNotes : current);
      onUpdated(savedGoal);
      savedDraftRef.current = {
        notes: savedNotes,
        dueAt: savedGoal.due_at,
        reminderPreset: inferReminderPreset(savedGoal.due_at, savedGoal.reminder_at),
      };
      try {
        if (reminderAt && !(await requestPermissions())) {
          setError('Details saved. Allow notifications in Settings to receive this reminder.');
          await scheduleDueDateReminders();
          return;
        }
        await scheduleDueDateReminders();
        AccessibilityInfo.announceForAccessibility('Goal details saved.');
      } catch {
        setError('Details saved, but the reminder could not be scheduled. Try again in Settings.');
      }
    } finally {
      setSaving(false);
    }
  };

  const addMilestone = async () => {
    if (!userId || mutationInProgress) return;
    const content = milestoneInput.trim().replace(/\s+/g, ' ');
    if (!content || addingMilestone) return;
    if (milestoneDueAt && milestoneDueAt.getTime() <= Date.now()) {
      setError('Choose a milestone due date that has not passed.');
      return;
    }
    if (milestones.some((item) => item.content.trim().toLocaleLowerCase() === content.toLocaleLowerCase())) {
      setError('That milestone is already on this goal.');
      return;
    }
    setAddingMilestone(true);
    const position = milestones.reduce((max, item) => Math.max(max, item.position), -1) + 1;
    const { data, error: insertError } = await supabase
      .from('goal_milestones')
      .insert({
        goal_id: goal.id,
        user_id: userId,
        content,
        position,
        due_at: milestoneDueAt?.toISOString() ?? null,
      } as any)
      .select('id, content, position, due_at, completed_at')
      .single();
    if (insertError || !data) {
      setError('Could not add that milestone.');
      const requestKey = `${userId}:${goal.id}`;
      await loadDetails(goal.id, userId, requestKey);
      setAddingMilestone(false);
      return;
    }
    setMilestones((current) => [...current, data as GoalMilestone]);
    setMilestoneInput('');
    setMilestoneDueAt(null);
    setShowMilestoneDuePicker(false);
    setAddingMilestone(false);
    AccessibilityInfo.announceForAccessibility('Milestone added.');
  };

  const beginMilestoneDueEdit = (milestone: GoalMilestone) => {
    if (updatingMilestoneDueId) return;
    setEditingMilestoneDueId(milestone.id);
    setEditingMilestoneDueAt(
      milestone.due_at
        ? new Date(milestone.due_at)
        : new Date(Date.now() + 60 * 60 * 1000)
    );
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 120);
  };

  const saveMilestoneDueDate = async (milestone: GoalMilestone, value: Date | null) => {
    if (!userId || mutationInProgress) return;
    if (value && value.getTime() <= Date.now()) {
      setError('Choose a milestone due date that has not passed.');
      return;
    }
    const dueAtIso = value?.toISOString() ?? null;
    setUpdatingMilestoneDueId(milestone.id);
    setError(null);
    setMilestoneMutationCount((count) => count + 1);
    try {
      const { error: updateError } = await supabase
        .from('goal_milestones')
        .update({ due_at: dueAtIso, updated_at: new Date().toISOString() } as any)
        .eq('id', milestone.id)
        .eq('user_id', userId);
      if (updateError) {
        setError('Could not update that milestone due date.');
      } else {
        setMilestones((current) => current.map((item) =>
          item.id === milestone.id ? { ...item, due_at: dueAtIso } : item
        ));
        if (editingMilestoneDueId === milestone.id) {
          setEditingMilestoneDueId(null);
          setEditingMilestoneDueAt(null);
        }
        AccessibilityInfo.announceForAccessibility(
          value ? 'Milestone due date saved.' : 'Milestone due date cleared.'
        );
      }
    } finally {
      setUpdatingMilestoneDueId(null);
      setMilestoneMutationCount((count) => Math.max(0, count - 1));
    }
  };

  const confirmDeleteGoal = () => {
    if (mutationInProgress) return;
    Alert.alert(
      'Delete goal?',
      'This permanently deletes the goal and its milestones. Attached files will no longer appear in the goal, but storage cleanup may finish later.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            if (mutationInProgress) return;
            setDeletingGoal(true);
            void onDelete()
              .then((deleted) => {
                if (!deleted) setError('Could not delete that goal. Please try again.');
              })
              .catch(() => setError('Could not delete that goal. Please try again.'))
              .finally(() => setDeletingGoal(false));
          },
        },
      ]
    );
  };

  const toggleMilestone = async (milestone: GoalMilestone) => {
    if (!userId || mutationInProgress) return;
    const completedAt = milestone.completed_at ? null : new Date().toISOString();
    setMilestoneMutationCount((count) => count + 1);
    try {
      const { error: updateError } = await supabase
        .from('goal_milestones')
        .update({ completed_at: completedAt, updated_at: new Date().toISOString() } as any)
        .eq('id', milestone.id)
        .eq('user_id', userId);
      if (updateError) {
        setError('Could not update that milestone.');
        return;
      }
      setMilestones((current) => current.map((item) =>
        item.id === milestone.id ? { ...item, completed_at: completedAt } : item
      ));
    } finally {
      setMilestoneMutationCount((count) => Math.max(0, count - 1));
    }
  };

  const deleteMilestone = async (id: string) => {
    if (!userId || mutationInProgress) return;
    setMilestoneMutationCount((count) => count + 1);
    try {
      const { error: deleteError } = await supabase
        .from('goal_milestones')
        .delete()
        .eq('id', id)
        .eq('user_id', userId);
      if (deleteError) {
        setError('Could not delete that milestone.');
        return;
      }
      setMilestones((current) => current.filter((item) => item.id !== id));
    } finally {
      setMilestoneMutationCount((count) => Math.max(0, count - 1));
    }
  };

  const pickAttachment = async () => {
    if (!userId || mutationInProgress) return;
    let result: DocumentPicker.DocumentPickerResult;
    try {
      result = await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: true,
        multiple: false,
        type: [
          'application/pdf',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'image/jpeg',
          'image/png',
          'text/plain',
        ],
      });
    } catch {
      setError('Could not open the file picker.');
      return;
    }
    if (result.canceled) return;
    const asset = result.assets[0];
    if (!asset) return;
    const selectedFile = new File(asset.uri);
    const size = asset.size ?? selectedFile.size;
    const type = mimeTypeFor(asset.name, asset.mimeType);
    const validationError = validateGoalAttachment({
      name: asset.name,
      type,
      size,
    });
    if (validationError) {
      setError(validationError);
      return;
    }

    setUploading(true);
    setError(null);
    const storagePath = goalAttachmentPath(
      userId,
      goal.id,
      asset.name,
      Crypto.randomUUID()
    );
    try {
      const bytes = await selectedFile.arrayBuffer();
      const { error: uploadError } = await supabase.storage
        .from(GOAL_ATTACHMENT_BUCKET)
        .upload(storagePath, bytes, { contentType: type, upsert: false });
      if (uploadError) throw uploadError;

      const { data, error: metadataError } = await supabase
        .from('goal_attachments')
        .insert({
          goal_id: goal.id,
          user_id: userId,
          storage_path: storagePath,
          file_name: asset.name.slice(0, 255),
          mime_type: type,
          size_bytes: size || bytes.byteLength,
        } as any)
        .select('id, storage_path, file_name, mime_type, size_bytes')
        .single();
      if (metadataError || !data) {
        const { error: cleanupError } = await supabase.storage
          .from(GOAL_ATTACHMENT_BUCKET)
          .remove([storagePath]);
        if (cleanupError) {
          await enqueueGoalAttachmentCleanup(userId, [storagePath]);
        }
        throw metadataError ?? new Error('Attachment metadata was not saved.');
      }
      setAttachments((current) => [...current, data as GoalAttachment]);
    } catch {
      setError('Could not attach that file.');
    } finally {
      setUploading(false);
    }
  };

  const openAttachment = async (attachment: GoalAttachment) => {
    try {
      const { data, error: signedUrlError } = await supabase.storage
        .from(GOAL_ATTACHMENT_BUCKET)
        .createSignedUrl(attachment.storage_path, 60);
      if (signedUrlError || !data?.signedUrl) throw signedUrlError;
      await Linking.openURL(data.signedUrl);
    } catch {
      setError('Could not open that file.');
    }
  };

  const deleteAttachment = (attachment: GoalAttachment) => {
    if (!userId || mutationInProgress) return;
    Alert.alert('Delete file?', attachment.file_name, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            setAttachmentMutationCount((count) => count + 1);
            try {
              const { error: metadataError } = await supabase
                .from('goal_attachments')
                .delete()
                .eq('id', attachment.id)
                .eq('user_id', userId);
              if (metadataError) {
                setError('Could not delete that file.');
                return;
              }
              setAttachments((current) => current.filter((item) => item.id !== attachment.id));
              const { error: storageError } = await supabase.storage
                .from(GOAL_ATTACHMENT_BUCKET)
                .remove([attachment.storage_path]);
              if (storageError) {
                await enqueueGoalAttachmentCleanup(userId, [attachment.storage_path]);
                setError('The file was removed from this goal, but storage cleanup is still pending.');
              }
            } finally {
              setAttachmentMutationCount((count) => Math.max(0, count - 1));
            }
          })();
        },
      },
    ]);
  };

  const completedMilestones = milestones.filter((item) => item.completed_at).length;

  return (
    <Modal
      visible={visible}
      animationType={reduceMotionEnabled ? 'none' : 'slide'}
      presentationStyle="pageSheet"
      onRequestClose={requestClose}
    >
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>GOAL DETAILS</Text>
            <Text accessibilityRole="header" style={styles.title}>{goal.content}</Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Delete goal"
              accessibilityHint="Asks for confirmation before deleting"
              accessibilityState={{ disabled: mutationInProgress }}
              disabled={mutationInProgress}
              onPress={confirmDeleteGoal}
              style={[styles.headerButton, mutationInProgress && styles.controlDisabled]}
            >
              {deletingGoal ? <ActivityIndicator color={Colors.danger} /> : <Feather name="trash-2" size={19} color={Colors.danger} />}
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Close goal details"
              accessibilityState={{ disabled: mutationInProgress }}
              disabled={mutationInProgress}
              onPress={requestClose}
              style={[styles.headerButton, mutationInProgress && styles.controlDisabled]}
            >
              <Feather name="x" size={22} color={Colors.text} />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView
          ref={scrollRef}
          style={styles.scroller}
          contentContainerStyle={styles.content}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
        >
          {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}

          {onStartFocus ? (
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={`Focus on ${goal.content}`}
              onPress={requestStartFocus}
              style={styles.focusButton}
            >
              <Feather name="clock" size={18} color={Colors.card} />
              <Text style={styles.focusButtonText}>Focus on this goal</Text>
            </TouchableOpacity>
          ) : null}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Due date</Text>
            <TouchableOpacity accessibilityRole="button" onPress={() => setShowDatePicker((current) => !current)} style={styles.dateButton}>
              <Text style={styles.dateButtonText}>{dueAt ? format(dueAt, 'MMM d, yyyy · h:mm a') : 'Add due date'}</Text>
              <Feather
                name={showDatePicker ? 'chevron-up' : 'chevron-down'}
                size={18}
                color={Colors.textSecondary}
              />
            </TouchableOpacity>
            {showDatePicker ? (
              <DateTimePicker
                value={dueAt ?? new Date(Date.now() + 60 * 60 * 1000)}
                mode="datetime"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                minimumDate={new Date()}
                onChange={(_event, date) => {
                  if (date) setDueAt(date);
                  if (Platform.OS !== 'ios') setShowDatePicker(false);
                }}
              />
            ) : null}
            {dueAt ? (
              <TouchableOpacity accessibilityRole="button" accessibilityLabel="Clear due date" onPress={() => { setDueAt(null); setReminderPreset('off'); setShowDatePicker(false); }} style={styles.clearButton}>
                <Text style={styles.clearLink}>Clear due date</Text>
              </TouchableOpacity>
            ) : null}
            <Text style={[styles.fieldLabel, { marginTop: 16 }]}>Reminder</Text>
            <View style={styles.chipRow}>
              {REMINDER_OPTIONS.map((option) => (
                <TouchableOpacity
                  key={option.id}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: reminderPreset === option.id, disabled: !dueAt && option.id !== 'off' }}
                  disabled={!dueAt && option.id !== 'off'}
                  onPress={() => setReminderPreset(option.id)}
                  style={[styles.chip, reminderPreset === option.id && styles.chipActive, !dueAt && option.id !== 'off' && styles.chipDisabled]}
                >
                  <Text style={[styles.chipText, reminderPreset === option.id && styles.chipTextActive]}>{option.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityState={{ expanded: notesOpen }}
              accessibilityLabel="Notes"
              onPress={() => setNotesOpen((current) => !current)}
              style={styles.disclosureHeading}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.sectionTitle}>Notes</Text>
                <Text style={styles.sectionSummary}>{notes.trim() ? 'Private notes added' : 'Optional'}</Text>
              </View>
              <Feather name={notesOpen ? 'chevron-up' : 'chevron-down'} size={18} color={Colors.textSecondary} />
            </TouchableOpacity>
            {notesOpen ? (
              <>
                <Text style={styles.count}>{notes.length}/5000</Text>
                <TextInput accessibilityLabel="Goal notes" style={styles.notesInput} multiline value={notes} onChangeText={(value) => setNotes(value.slice(0, 5000))} placeholder="Add context, links, or what success looks like…" placeholderTextColor={Colors.textSecondary} textAlignVertical="top" />
              </>
            ) : null}
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeadingRow}>
              <Text style={styles.sectionTitle}>Milestones</Text>
              {milestones.length > 0 ? <Text style={styles.count}>{completedMilestones}/{milestones.length}</Text> : null}
            </View>
            <View style={styles.addRow}>
              <TextInput style={styles.addInput} value={milestoneInput} onChangeText={(value) => setMilestoneInput(value.slice(0, 500))} onSubmitEditing={() => void addMilestone()} placeholder="Add the next step…" placeholderTextColor={Colors.textSecondary} />
              <TouchableOpacity accessibilityRole="button" accessibilityLabel="Add milestone" disabled={!milestoneInput.trim() || addingMilestone} onPress={() => void addMilestone()} style={[styles.addButton, (!milestoneInput.trim() || addingMilestone) && styles.chipDisabled]}>{addingMilestone ? <ActivityIndicator color="#fff" /> : <Feather name="plus" size={21} color="#fff" />}</TouchableOpacity>
            </View>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={milestoneDueAt ? `Milestone due ${format(milestoneDueAt, 'MMMM d, yyyy, h:mm a')}` : 'Add milestone due date'}
              onPress={() => {
                setShowMilestoneDuePicker((current) => {
                  const next = !current;
                  if (next) {
                    if (!milestoneDueAt) {
                      setMilestoneDueAt(new Date(Date.now() + 60 * 60 * 1000));
                    }
                    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 120);
                  }
                  return next;
                });
              }}
              style={styles.milestoneDraftDate}
            >
              <Feather name="calendar" size={16} color={Colors.primary} />
              <Text style={styles.milestoneDateText}>{milestoneDueAt ? format(milestoneDueAt, 'MMM d, yyyy · h:mm a') : 'Add due date'}</Text>
              <Feather name={showMilestoneDuePicker ? 'chevron-up' : 'chevron-down'} size={16} color={Colors.textSecondary} />
            </TouchableOpacity>
            {showMilestoneDuePicker ? (
              <DateTimePicker
                value={milestoneDueAt ?? new Date(Date.now() + 60 * 60 * 1000)}
                mode="datetime"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                minimumDate={new Date()}
                onChange={(_event, date) => {
                  if (date) setMilestoneDueAt(date);
                  if (Platform.OS !== 'ios') setShowMilestoneDuePicker(false);
                }}
              />
            ) : null}
            {milestoneDueAt ? (
              <TouchableOpacity accessibilityRole="button" accessibilityLabel="Clear milestone due date" onPress={() => { setMilestoneDueAt(null); setShowMilestoneDuePicker(false); }} style={styles.clearButton}>
                <Text style={styles.clearLink}>Clear milestone due date</Text>
              </TouchableOpacity>
            ) : null}
            {loading ? <ActivityIndicator color={Colors.primary} /> : milestones.length === 0 ? <Text style={styles.empty}>Break this goal into small, finishable steps.</Text> : milestones.map((milestone) => (
              <View key={milestone.id} style={styles.milestoneCard}>
                <View style={styles.milestoneRow}>
                  <TouchableOpacity accessibilityRole="checkbox" accessibilityState={{ checked: Boolean(milestone.completed_at) }} accessibilityLabel={`${milestone.completed_at ? 'Mark incomplete' : 'Complete'}: ${milestone.content}`} hitSlop={10} onPress={() => void toggleMilestone(milestone)} style={[styles.checkbox, milestone.completed_at && styles.checkboxDone]}>{milestone.completed_at ? <Feather name="check" size={15} color="#fff" /> : null}</TouchableOpacity>
                  <View style={styles.milestoneCopy}>
                    <Text style={[styles.itemText, milestone.completed_at && styles.itemDone]}>{milestone.content}</Text>
                    <View style={styles.milestoneDateRow}>
                      <TouchableOpacity
                        accessibilityRole="button"
                        accessibilityLabel={milestone.due_at ? `Edit due date for ${milestone.content}` : `Add due date for ${milestone.content}`}
                        onPress={() => beginMilestoneDueEdit(milestone)}
                        style={styles.milestoneDateButton}
                      >
                        <Feather name="calendar" size={14} color={Colors.primary} />
                        <Text style={styles.milestoneDateText}>{milestone.due_at ? format(new Date(milestone.due_at), 'MMM d, yyyy · h:mm a') : 'Add due date'}</Text>
                      </TouchableOpacity>
                      {milestone.due_at ? (
                        <TouchableOpacity
                          accessibilityRole="button"
                          accessibilityLabel={`Clear due date for ${milestone.content}`}
                          disabled={Boolean(updatingMilestoneDueId)}
                          onPress={() => void saveMilestoneDueDate(milestone, null)}
                          style={styles.milestoneDateClearButton}
                        >
                          <Feather name="x" size={15} color={Colors.textSecondary} />
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  </View>
                  <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Delete milestone: ${milestone.content}`} onPress={() => void deleteMilestone(milestone.id)} style={styles.deleteButton}><Feather name="trash-2" size={18} color="#b91c1c" /></TouchableOpacity>
                </View>
                {editingMilestoneDueId === milestone.id && editingMilestoneDueAt ? (
                  <View style={styles.milestoneDateEditor}>
                    <DateTimePicker
                      value={editingMilestoneDueAt}
                      mode="datetime"
                      display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                      minimumDate={new Date()}
                      onChange={(event, date) => {
                        if (event.type === 'dismissed') {
                          setEditingMilestoneDueId(null);
                          setEditingMilestoneDueAt(null);
                          return;
                        }
                        if (!date) return;
                        setEditingMilestoneDueAt(date);
                        if (Platform.OS !== 'ios') void saveMilestoneDueDate(milestone, date);
                      }}
                    />
                    {Platform.OS === 'ios' ? (
                      <View style={styles.milestoneDateActions}>
                        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Cancel milestone due date edit" disabled={Boolean(updatingMilestoneDueId)} onPress={() => { setEditingMilestoneDueId(null); setEditingMilestoneDueAt(null); }} style={styles.dateActionButton}><Text style={styles.secondaryActionText}>Cancel</Text></TouchableOpacity>
                        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Save milestone due date" disabled={Boolean(updatingMilestoneDueId)} onPress={() => void saveMilestoneDueDate(milestone, editingMilestoneDueAt)} style={styles.dateSaveButton}>{updatingMilestoneDueId === milestone.id ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.dateSaveText}>Save date</Text>}</TouchableOpacity>
                      </View>
                    ) : null}
                  </View>
                ) : null}
              </View>
            ))}
          </View>

          <View style={styles.section}>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityState={{ expanded: filesOpen }}
              accessibilityLabel="Files"
              onPress={() => setFilesOpen((current) => !current)}
              style={styles.disclosureHeading}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.sectionTitle}>Files</Text>
                <Text style={styles.sectionSummary}>{attachments.length > 0 ? `${attachments.length} attached` : 'Optional'}</Text>
              </View>
              <Feather name={filesOpen ? 'chevron-up' : 'chevron-down'} size={18} color={Colors.textSecondary} />
            </TouchableOpacity>
            {filesOpen ? <>
            <View style={styles.sectionHeadingRow}>
              <Text style={styles.sectionSummary}>PDF, DOCX, image, or text</Text>
              <TouchableOpacity accessibilityRole="button" accessibilityLabel="Add file" disabled={uploading} onPress={() => void pickAttachment()} style={styles.fileButton}>{uploading ? <ActivityIndicator size="small" color={Colors.primary} /> : <><Feather name="paperclip" size={15} color={Colors.primary} /><Text style={styles.fileButtonText}>Add file</Text></>}</TouchableOpacity>
            </View>
            <Text style={styles.filePrivacy}>Files stay with this profile. Partners and AI services do not receive them.</Text>
            {attachments.length === 0 ? <Text style={styles.empty}>Up to 6 MB.</Text> : attachments.map((attachment) => (
              <View key={attachment.id} style={styles.itemRow}>
                <Feather name="file-text" size={20} color={Colors.primary} />
                <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Open file: ${attachment.file_name}`} style={styles.itemText} onPress={() => void openAttachment(attachment)}>
                  <Text numberOfLines={1} style={styles.fileName}>{attachment.file_name}</Text>
                  <Text style={styles.fileSize}>{formatFileSize(attachment.size_bytes)}</Text>
                </TouchableOpacity>
                <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Delete file: ${attachment.file_name}`} onPress={() => deleteAttachment(attachment)} style={styles.deleteButton}><Feather name="trash-2" size={18} color="#b91c1c" /></TouchableOpacity>
              </View>
            ))}
            </> : null}
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityState={{ disabled: saving || deletingGoal, busy: saving }}
            disabled={saving || deletingGoal}
            onPress={() => void saveDetails()}
            style={[styles.saveButton, (saving || deletingGoal) && styles.controlDisabled]}
          >
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveButtonText}>Save changes</Text>}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroller: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'flex-start', borderBottomWidth: 1, borderColor: Colors.border, paddingHorizontal: 20, paddingVertical: 16, backgroundColor: Colors.card },
  headerCopy: { flex: 1, paddingRight: 12 },
  eyebrow: { color: Colors.primary, fontSize: 11, fontWeight: '800', letterSpacing: 1.2 },
  title: { color: Colors.text, fontSize: 20, fontWeight: '700', lineHeight: 27, marginTop: 4 },
  headerActions: { flexDirection: 'row', gap: 4 },
  headerButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.background },
  content: { padding: 16, gap: 14, paddingBottom: 48 },
  error: { color: '#991b1b', backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fecaca', borderRadius: 12, padding: 12, fontSize: 13 },
  focusButton: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 13, backgroundColor: Colors.primary },
  focusButtonText: { color: Colors.card, fontSize: 15, fontWeight: '700' },
  section: { backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border, borderRadius: 16, padding: 16 },
  sectionTitle: { color: Colors.text, fontSize: 17, fontWeight: '700' },
  sectionSummary: { color: Colors.textSecondary, fontSize: 12, marginTop: 3 },
  disclosureHeading: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionHeadingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  count: { color: Colors.textSecondary, fontSize: 12 },
  dateButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: Colors.border, borderRadius: 12, padding: 13, marginTop: 12 },
  dateButtonText: { color: Colors.text, fontSize: 15, fontWeight: '600' },
  clearButton: { minHeight: 44, alignSelf: 'flex-start', justifyContent: 'center' },
  clearLink: { color: '#b45309', fontSize: 13, fontWeight: '600' },
  fieldLabel: { color: Colors.text, fontSize: 14, fontWeight: '600' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 9 },
  chip: { minHeight: 44, justifyContent: 'center', borderWidth: 1, borderColor: Colors.border, borderRadius: 22, paddingHorizontal: 12, paddingVertical: 8 },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipDisabled: { opacity: 0.4 },
  chipText: { color: Colors.text, fontSize: 12, fontWeight: '600' },
  chipTextActive: { color: '#fff' },
  notesInput: { minHeight: 120, borderWidth: 1, borderColor: Colors.border, borderRadius: 12, padding: 12, color: Colors.text, fontSize: 14, lineHeight: 21, backgroundColor: Colors.background },
  addRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  addInput: { flex: 1, borderWidth: 1, borderColor: Colors.border, borderRadius: 12, paddingHorizontal: 12, color: Colors.text, backgroundColor: Colors.background },
  addButton: { width: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: Colors.primary },
  milestoneDraftDate: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', marginBottom: 8 },
  empty: { color: Colors.textSecondary, fontSize: 13, lineHeight: 19 },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderTopWidth: 1, borderColor: Colors.border, paddingVertical: 11 },
  milestoneCard: { borderTopWidth: 1, borderColor: Colors.border, paddingVertical: 7 },
  milestoneRow: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 10 },
  milestoneCopy: { flex: 1, minWidth: 0 },
  milestoneDateRow: { minHeight: 44, flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start' },
  milestoneDateButton: { minHeight: 34, flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', marginTop: 2 },
  milestoneDateClearButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  milestoneDateText: { flexShrink: 1, color: Colors.primary, fontSize: 12, fontWeight: '600' },
  milestoneDateEditor: { borderTopWidth: 1, borderColor: Colors.border, paddingTop: 8 },
  milestoneDateActions: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 8 },
  dateActionButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 10 },
  secondaryActionText: { color: Colors.textSecondary, fontSize: 13, fontWeight: '700' },
  dateSaveButton: { minWidth: 96, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: Colors.primary, paddingHorizontal: 14 },
  dateSaveText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  checkbox: { width: 25, height: 25, borderRadius: 13, borderWidth: 1, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
  checkboxDone: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  itemText: { flex: 1, color: Colors.text, fontSize: 14, lineHeight: 20 },
  itemDone: { color: Colors.textSecondary, textDecorationLine: 'line-through' },
  deleteButton: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  fileButton: { minWidth: 82, minHeight: 44, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: Colors.background, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 10 },
  fileButtonText: { color: Colors.primary, fontSize: 13, fontWeight: '700' },
  filePrivacy: { color: Colors.textSecondary, fontSize: 12, lineHeight: 17, marginBottom: 10 },
  fileName: { color: Colors.text, fontSize: 14, fontWeight: '600' },
  fileSize: { color: Colors.textSecondary, fontSize: 11, marginTop: 2 },
  footer: { borderTopWidth: 1, borderColor: Colors.border, padding: 16, paddingBottom: Platform.OS === 'ios' ? 28 : 16, backgroundColor: Colors.card },
  deleteGoalButton: { minWidth: 70, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  deleteGoalButtonText: { color: '#b91c1c', fontSize: 14, fontWeight: '700' },
  secondaryButton: { flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.border, borderRadius: 13 },
  secondaryButtonText: { color: Colors.text, fontSize: 15, fontWeight: '700' },
  saveButton: { minHeight: 48, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.primary, borderRadius: 13 },
  saveButtonText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  controlDisabled: { opacity: 0.45 },
});
