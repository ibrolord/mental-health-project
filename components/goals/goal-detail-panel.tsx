'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Bell,
  CalendarDays,
  Check,
  FileText,
  Loader2,
  Paperclip,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/lib/supabase/client';
import {
  GOAL_ATTACHMENT_BUCKET,
  formatFileSize,
  fromDateTimeLocalValue,
  goalAttachmentPath,
  inferReminderPreset,
  reminderForPreset,
  toDateTimeLocalValue,
  validateGoalAttachment,
  type GoalReminderPreset,
} from '@/lib/goals/details';

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
  goal: GoalDetailRecord;
  userId: string;
  onClose: () => void;
  onDelete: () => Promise<void>;
  onUpdated: (goal: GoalDetailRecord) => void;
};

const REMINDER_OPTIONS: { id: GoalReminderPreset; label: string }[] = [
  { id: 'off', label: 'Off' },
  { id: 'day-before', label: '1 day before' },
  { id: 'hour-before', label: '1 hour before' },
  { id: 'at-time', label: 'At due time' },
];

export function GoalDetailPanel({ goal, userId, onClose, onDelete, onUpdated }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const activeGoalKeyRef = useRef<string | null>(null);
  const savedDraftRef = useRef({
    notes: goal.notes ?? '',
    dueValue: toDateTimeLocalValue(goal.due_at),
    reminderPreset: inferReminderPreset(goal.due_at, goal.reminder_at),
  });
  const [notes, setNotes] = useState(goal.notes ?? '');
  const [dueValue, setDueValue] = useState(toDateTimeLocalValue(goal.due_at));
  const [reminderPreset, setReminderPreset] = useState<GoalReminderPreset>(
    inferReminderPreset(goal.due_at, goal.reminder_at)
  );
  const [milestones, setMilestones] = useState<GoalMilestone[]>([]);
  const [attachments, setAttachments] = useState<GoalAttachment[]>([]);
  const [milestoneInput, setMilestoneInput] = useState('');
  const [milestoneDueValue, setMilestoneDueValue] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [addingMilestone, setAddingMilestone] = useState(false);
  const [updatingMilestoneDueId, setUpdatingMilestoneDueId] = useState<string | null>(null);
  const [deletingGoal, setDeletingGoal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasUnsavedChanges = useCallback(() => (
    notes.trim() !== savedDraftRef.current.notes.trim()
    || dueValue !== savedDraftRef.current.dueValue
    || reminderPreset !== savedDraftRef.current.reminderPreset
    || milestoneInput.trim().length > 0
    || milestoneDueValue.length > 0
  ), [dueValue, milestoneDueValue, milestoneInput, notes, reminderPreset]);

  const requestClose = useCallback(() => {
    if (!hasUnsavedChanges() || window.confirm('Discard unsaved goal changes?')) onClose();
  }, [hasUnsavedChanges, onClose]);

  useEffect(() => {
    closeRef.current?.focus();
  }, [goal.id]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') requestClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [requestClose]);

  const loadDetails = async (goalId: string, ownerId: string, requestKey: string) => {
    setLoading(true);
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
    const requestKey = `${userId}:${goal.id}`;
    const initialNotes = goal.notes ?? '';
    const initialDueValue = toDateTimeLocalValue(goal.due_at);
    const initialReminderPreset = inferReminderPreset(goal.due_at, goal.reminder_at);
    activeGoalKeyRef.current = requestKey;
    savedDraftRef.current = {
      notes: initialNotes,
      dueValue: initialDueValue,
      reminderPreset: initialReminderPreset,
    };
    setNotes(initialNotes);
    setDueValue(initialDueValue);
    setReminderPreset(initialReminderPreset);
    setMilestones([]);
    setAttachments([]);
    setMilestoneInput('');
    setMilestoneDueValue('');
    setError(null);
    void loadDetails(goal.id, userId, requestKey);
    return () => {
      if (activeGoalKeyRef.current === requestKey) activeGoalKeyRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goal.id, userId]);

  const saveDetails = async () => {
    const dueAt = fromDateTimeLocalValue(dueValue);
    const reminderAt = reminderForPreset(dueAt, reminderPreset);
    if (
      dueAt
      && dueValue !== savedDraftRef.current.dueValue
      && new Date(dueAt).getTime() <= Date.now()
    ) {
      setError('Choose a goal due date that has not passed.');
      return;
    }
    if (reminderAt && new Date(reminderAt).getTime() <= Date.now()) {
      setError('Choose a reminder time that has not passed.');
      return;
    }
    setSaving(true);
    setError(null);
    const { data, error: updateError } = await supabase
      .from('goals')
      .update({
        notes: notes.trim() || null,
        due_at: dueAt,
        reminder_at: reminderAt,
      })
      .eq('id', goal.id)
      .eq('user_id', userId)
      .select('id, content, notes, due_at, reminder_at')
      .single();
    setSaving(false);
    if (updateError || !data) {
      setError('Could not save these details.');
      return;
    }
    const savedGoal = data as GoalDetailRecord;
    const savedDueValue = toDateTimeLocalValue(savedGoal.due_at);
    const savedReminderPreset = inferReminderPreset(savedGoal.due_at, savedGoal.reminder_at);
    savedDraftRef.current = {
      notes: savedGoal.notes ?? '',
      dueValue: savedDueValue,
      reminderPreset: savedReminderPreset,
    };
    setNotes(savedGoal.notes ?? '');
    setDueValue(savedDueValue);
    setReminderPreset(savedReminderPreset);
    onUpdated(savedGoal);
  };

  const addMilestone = async () => {
    const content = milestoneInput.trim().replace(/\s+/g, ' ');
    if (!content || addingMilestone) return;
    if (milestones.some((item) => item.content.trim().toLocaleLowerCase() === content.toLocaleLowerCase())) {
      setError('That milestone is already on this goal.');
      return;
    }
    setAddingMilestone(true);
    setError(null);
    const position = milestones.reduce((max, item) => Math.max(max, item.position), -1) + 1;
    const milestoneDueAt = fromDateTimeLocalValue(milestoneDueValue);
    if (milestoneDueValue && !milestoneDueAt) {
      setAddingMilestone(false);
      setError('Choose a valid milestone due date.');
      return;
    }
    if (milestoneDueAt && new Date(milestoneDueAt).getTime() <= Date.now()) {
      setAddingMilestone(false);
      setError('Choose a milestone due date that has not passed.');
      return;
    }
    const { data, error: insertError } = await supabase
      .from('goal_milestones')
      .insert({ goal_id: goal.id, user_id: userId, content, position, due_at: milestoneDueAt })
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
    setMilestoneDueValue('');
    setAddingMilestone(false);
  };

  const updateMilestoneDueDate = async (milestone: GoalMilestone, value: string) => {
    if (updatingMilestoneDueId) return;
    const dueAt = fromDateTimeLocalValue(value);
    if (value && !dueAt) {
      setError('Choose a valid milestone due date.');
      return;
    }
    if (dueAt && new Date(dueAt).getTime() <= Date.now()) {
      setError('Choose a milestone due date that has not passed.');
      return;
    }
    setUpdatingMilestoneDueId(milestone.id);
    setError(null);
    const { error: updateError } = await supabase
      .from('goal_milestones')
      .update({ due_at: dueAt, updated_at: new Date().toISOString() })
      .eq('id', milestone.id)
      .eq('user_id', userId);
    if (updateError) {
      setError('Could not update that milestone due date.');
    } else {
      setMilestones((current) => current.map((item) =>
        item.id === milestone.id ? { ...item, due_at: dueAt } : item
      ));
    }
    setUpdatingMilestoneDueId(null);
  };

  const confirmDeleteGoal = async () => {
    if (!window.confirm('Delete this goal and its milestones and files?')) return;
    setDeletingGoal(true);
    setError(null);
    await onDelete();
    setDeletingGoal(false);
  };

  const toggleMilestone = async (milestone: GoalMilestone) => {
    const completedAt = milestone.completed_at ? null : new Date().toISOString();
    const { error: updateError } = await supabase
      .from('goal_milestones')
      .update({ completed_at: completedAt, updated_at: new Date().toISOString() })
      .eq('id', milestone.id)
      .eq('user_id', userId);
    if (updateError) {
      setError('Could not update that milestone.');
      return;
    }
    setMilestones((current) => current.map((item) =>
      item.id === milestone.id ? { ...item, completed_at: completedAt } : item
    ));
  };

  const deleteMilestone = async (id: string) => {
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
  };

  const uploadAttachment = async (file: File) => {
    const validationError = validateGoalAttachment(file);
    if (validationError) {
      setError(validationError);
      return;
    }
    setUploading(true);
    setError(null);
    const storagePath = goalAttachmentPath(
      userId,
      goal.id,
      file.name,
      crypto.randomUUID()
    );
    const { error: uploadError } = await supabase.storage
      .from(GOAL_ATTACHMENT_BUCKET)
      .upload(storagePath, file, { contentType: file.type, upsert: false });
    if (uploadError) {
      setUploading(false);
      setError('Could not upload that file.');
      return;
    }
    const { data, error: metadataError } = await supabase
      .from('goal_attachments')
      .insert({
        goal_id: goal.id,
        user_id: userId,
        storage_path: storagePath,
        file_name: file.name.slice(0, 255),
        mime_type: file.type,
        size_bytes: file.size,
      })
      .select('id, storage_path, file_name, mime_type, size_bytes')
      .single();
    if (metadataError || !data) {
      await supabase.storage.from(GOAL_ATTACHMENT_BUCKET).remove([storagePath]);
      setUploading(false);
      setError('Could not finish attaching that file.');
      return;
    }
    setAttachments((current) => [...current, data as GoalAttachment]);
    setUploading(false);
  };

  const openAttachment = async (attachment: GoalAttachment) => {
    const { data, error: signedUrlError } = await supabase.storage
      .from(GOAL_ATTACHMENT_BUCKET)
      .createSignedUrl(attachment.storage_path, 60);
    if (signedUrlError || !data?.signedUrl) {
      setError('Could not open that file.');
      return;
    }
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
  };

  const deleteAttachment = async (attachment: GoalAttachment) => {
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
      setError('The file was removed from this goal, but storage cleanup is still pending.');
    }
  };

  const completedMilestones = milestones.filter((item) => item.completed_at).length;
  const minimumDueValue = toDateTimeLocalValue(new Date().toISOString());

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/35" onMouseDown={requestClose}>
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="goal-detail-title"
        className="h-full w-full max-w-xl overflow-y-auto bg-background shadow-2xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b bg-background/95 px-5 py-4 backdrop-blur">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Goal details</p>
            <h2 id="goal-detail-title" className="mt-1 text-xl font-semibold text-foreground">{goal.content}</h2>
          </div>
          <Button ref={closeRef} variant="ghost" size="icon" onClick={requestClose} aria-label="Close goal details">
            <X className="h-5 w-5" />
          </Button>
        </header>

        <div className="space-y-7 p-5">
          {error ? <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

          <section className="space-y-3">
            <div className="flex items-center gap-2"><CalendarDays className="h-4 w-4 text-primary" /><h3 className="font-semibold">Timing</h3></div>
            <label className="block text-sm font-medium">
              Due date and time
              <Input className="mt-2" type="datetime-local" min={minimumDueValue} value={dueValue} onChange={(event) => {
                setDueValue(event.target.value);
                if (!event.target.value) setReminderPreset('off');
              }} />
            </label>
            <div>
              <div className="mb-2 flex items-center gap-2 text-sm font-medium"><Bell className="h-4 w-4" /> Reminder</div>
              <div className="flex flex-wrap gap-2">
                {REMINDER_OPTIONS.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    disabled={!dueValue && option.id !== 'off'}
                    onClick={() => setReminderPreset(option.id)}
                    className={`rounded-full border px-3 py-1.5 text-sm transition ${reminderPreset === option.id ? 'border-primary bg-primary text-primary-foreground' : 'bg-card hover:border-primary'} disabled:cursor-not-allowed disabled:opacity-40`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </section>

          <section className="space-y-2">
            <h3 className="font-semibold">Notes</h3>
            <Textarea value={notes} onChange={(event) => setNotes(event.target.value.slice(0, 5000))} rows={5} placeholder="Add context, links, or what success looks like…" />
            <p className="text-right text-xs text-muted-foreground">{notes.length}/5000</p>
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-semibold">Milestones</h3>
              {milestones.length > 0 ? <span className="text-sm text-muted-foreground">{completedMilestones}/{milestones.length}</span> : null}
            </div>
            <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_13rem_auto]">
              <Input value={milestoneInput} onChange={(event) => setMilestoneInput(event.target.value.slice(0, 500))} onKeyDown={(event) => {
                if (event.key === 'Enter') { event.preventDefault(); void addMilestone(); }
              }} placeholder="Add the next step…" />
              <label>
                <span className="sr-only">Milestone due date and time</span>
                <Input type="datetime-local" min={minimumDueValue} value={milestoneDueValue} onChange={(event) => setMilestoneDueValue(event.target.value)} aria-label="Milestone due date and time" />
              </label>
              <Button type="button" onClick={() => void addMilestone()} disabled={!milestoneInput.trim() || addingMilestone} aria-label="Add milestone">{addingMilestone ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}</Button>
            </div>
            {loading ? <Loader2 className="h-5 w-5 animate-spin text-primary" /> : milestones.length === 0 ? (
              <p className="rounded-xl bg-secondary/50 px-3 py-3 text-sm text-muted-foreground">Break this goal into small, finishable steps.</p>
            ) : (
              <div className="space-y-2">
                {milestones.map((milestone) => (
                  <div key={milestone.id} className="flex items-start gap-3 rounded-xl border bg-card p-3">
                    <button type="button" role="checkbox" aria-checked={Boolean(milestone.completed_at)} aria-label={`${milestone.completed_at ? 'Mark incomplete' : 'Complete'}: ${milestone.content}`} onClick={() => void toggleMilestone(milestone)} className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${milestone.completed_at ? 'border-primary bg-primary text-primary-foreground' : 'border-border'}`}>
                      {milestone.completed_at ? <Check className="h-4 w-4" /> : null}
                    </button>
                    <div className="min-w-0 flex-1">
                      <span className={`block text-sm ${milestone.completed_at ? 'text-muted-foreground line-through' : ''}`}>{milestone.content}</span>
                      <label className="mt-2 block max-w-[13rem]">
                        <span className="sr-only">Due date for {milestone.content}</span>
                        <Input
                          className="h-9 text-xs"
                          type="datetime-local"
                          min={minimumDueValue}
                          value={toDateTimeLocalValue(milestone.due_at)}
                          disabled={updatingMilestoneDueId === milestone.id}
                          onChange={(event) => void updateMilestoneDueDate(milestone, event.target.value)}
                          aria-label={`Due date for ${milestone.content}`}
                        />
                      </label>
                    </div>
                    {updatingMilestoneDueId === milestone.id ? <Loader2 className="mt-1 h-4 w-4 animate-spin text-primary" aria-label="Saving milestone due date" /> : null}
                    <button type="button" onClick={() => void deleteMilestone(milestone.id)} aria-label={`Delete milestone: ${milestone.content}`} className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2"><Paperclip className="h-4 w-4 text-primary" /><h3 className="font-semibold">Files</h3></div>
              <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => fileRef.current?.click()}>
                {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />} Add file
              </Button>
              <input ref={fileRef} hidden type="file" accept=".pdf,.docx,.jpg,.jpeg,.png,.txt" onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = '';
                if (file) void uploadAttachment(file);
              }} />
            </div>
            {attachments.length === 0 ? <p className="text-sm text-muted-foreground">PDF, DOCX, image, or text. Up to 6 MB.</p> : (
              <div className="space-y-2">
                {attachments.map((attachment) => (
                  <div key={attachment.id} className="flex items-center gap-3 rounded-xl border bg-card p-3">
                    <FileText className="h-5 w-5 shrink-0 text-primary" />
                    <button type="button" onClick={() => void openAttachment(attachment)} className="min-w-0 flex-1 text-left">
                      <span className="block truncate text-sm font-medium">{attachment.file_name}</span>
                      <span className="text-xs text-muted-foreground">{formatFileSize(attachment.size_bytes)}</span>
                    </button>
                    <button type="button" onClick={() => void deleteAttachment(attachment)} aria-label={`Delete file: ${attachment.file_name}`} className="text-muted-foreground hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                  </div>
                ))}
              </div>
            )}
          </section>

          <div className="sticky bottom-0 -mx-5 flex items-center gap-2 border-t bg-background px-5 py-4">
            <Button variant="ghost" className="mr-auto text-red-700 hover:bg-red-50 hover:text-red-800" onClick={() => void confirmDeleteGoal()} disabled={deletingGoal}>
              {deletingGoal ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />} Delete goal
            </Button>
            <Button variant="outline" onClick={requestClose}>Close</Button>
            <Button onClick={() => void saveDetails()} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Save details
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
