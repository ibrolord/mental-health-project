import { useState, useEffect, useRef, useCallback } from 'react';
import {
  AccessibilityInfo,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useDataContext } from '@/lib/hooks/use-data-context';
import { Colors } from '@/lib/constants';
import { format } from 'date-fns';
import type { FrameworkType } from '@/lib/types';
import {
  appendUniqueGoal,
  collapseDuplicateGoals,
  createSingleFlight,
  goalCompletionFeedback,
  goalIdentityKey,
  nextGoalCompletionStatus,
} from '@/lib/goals/deduplication';
import { refreshReminders } from '@/lib/notifications';
import { GoalDetailModal, type GoalDetailRecord } from '@/components/GoalDetailModal';
import { GOAL_ATTACHMENT_BUCKET } from '@/lib/goals/details';
import { enqueueGoalAttachmentCleanup } from '@/lib/goals/attachment-cleanup';
import { AppButton, PageHeader } from '@/components/AppUI';

interface Goal extends GoalDetailRecord {
  date: string;
  status: 'pending' | 'completed' | 'cancelled';
  framework: FrameworkType;
  priority: string | null;
  eisenhower_quadrant: string | null;
  completed_at: string | null;
}

const FRAMEWORKS: { id: FrameworkType; label: string }[] = [
  { id: 'simple', label: 'Simple' },
  { id: 'eisenhower', label: 'Eisenhower' },
  { id: 'ivy_lee', label: 'Ivy Lee' },
  { id: '1-3-5', label: '1-3-5' },
  { id: 'abcde', label: 'ABCDE' },
];

const EISENHOWER_QUADRANTS = [
  { id: 'urgent-important', label: 'Do first' },
  { id: 'not-urgent-important', label: 'Schedule' },
  { id: 'urgent-not-important', label: 'Delegate' },
  { id: 'not-urgent-not-important', label: 'Let go' },
];

const PRIORITIES_135 = [
  { id: 'big', label: '1 big thing', limit: 1 },
  { id: 'medium', label: '3 medium tasks', limit: 3 },
  { id: 'small', label: '5 small tasks', limit: 5 },
];

const ABCDE_PRIORITIES = [
  { id: 'A', label: 'A - Must do' },
  { id: 'B', label: 'B - Should do' },
  { id: 'C', label: 'C - Nice to do' },
  { id: 'D', label: 'D - Delegate' },
  { id: 'E', label: 'E - Let go' },
];

function firstParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? '' : value ?? '';
}

export default function GoalsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    source?: string | string[];
    content?: string | string[];
    bookTitle?: string | string[];
  }>();
  const { context, query } = useDataContext();
  const ownerKey = query ? `${query.column}:${query.value}` : 'no-owner';
  const [framework, setFramework] = useState<FrameworkType>('simple');
  const [frameworkPickerOpen, setFrameworkPickerOpen] = useState(false);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [goalError, setGoalError] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const inputRef = useRef('');
  const inputControlRef = useRef<TextInput>(null);
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [librarySourceTitle, setLibrarySourceTitle] = useState('');
  const [statusUpdatingId, setStatusUpdatingId] = useState<string | null>(null);
  const [selectedGoal, setSelectedGoal] = useState<Goal | null>(null);
  const [goalStatusChange, setGoalStatusChange] = useState<{
    id: string;
    from: 'pending' | 'completed';
    to: 'pending' | 'completed';
    fromCompletedAt: string | null;
  } | null>(null);
  const appliedLibraryActionRef = useRef('');
  const goalIdsByKeyRef = useRef(new Map<string, string[]>());
  const runGoalInsertRef = useRef(createSingleFlight());
  const ownerGenerationRef = useRef(0);

  const updateInput = useCallback((value: string) => {
    inputRef.current = value;
    setInput(value);
  }, []);

  const submitCurrentInput = (submit: (content: string) => void) => {
    if (inputControlRef.current?.isFocused()) {
      inputControlRef.current.blur();
      setTimeout(() => submit(inputRef.current), 0);
      return;
    }
    submit(inputRef.current);
  };

  const refreshReminderContent = () => {
    void refreshReminders().catch((error) => {
      console.warn('Could not refresh local reminders after a goal change:', error);
    });
  };

  const loadGoals = useCallback(async () => {
    setGoalStatusChange(null);
    const generation = ownerGenerationRef.current;
    if (!query) {
      setSelectedGoal(null);
      setGoals([]);
      goalIdsByKeyRef.current = new Map();
      setLoading(false);
      return;
    }

    setLoading(true);
    const { data, error } = await supabase
      .from('goals')
      .select('*')
      .eq(query.column, query.value)
      .or(`status.eq.pending,and(status.eq.completed,date.eq.${format(new Date(), 'yyyy-MM-dd')})`)
      .order('created_at', { ascending: true });

    if (generation !== ownerGenerationRef.current) return;

    if (error) {
      setGoalError('Could not load your goals. Please try again.');
    } else if (data) {
      const collapsed = collapseDuplicateGoals(data as Goal[]);
      goalIdsByKeyRef.current = collapsed.idsByKey;
      setGoals(collapsed.goals);
    }
    setLoading(false);
  }, [query]);

  useEffect(() => {
    ownerGenerationRef.current += 1;
    setSelectedGoal(null);
    setGoals([]);
    setGoalError(null);
    setGoalStatusChange(null);
    goalIdsByKeyRef.current = new Map();
    setLoading(ownerKey !== 'no-owner');
  }, [ownerKey]);

  useEffect(() => {
    void loadGoals();
  }, [loadGoals]);

  useEffect(() => {
    if (goalError) AccessibilityInfo.announceForAccessibility(goalError);
  }, [goalError]);

  useEffect(() => {
    if (!goalStatusChange) return;
    AccessibilityInfo.announceForAccessibility(
      `${goalCompletionFeedback(goalStatusChange.to)} Undo is available.`
    );
  }, [goalStatusChange]);

  useEffect(() => {
    if (firstParam(params.source) !== 'library') {
      appliedLibraryActionRef.current = '';
      return;
    }

    const content = firstParam(params.content).trim().slice(0, 500);
    if (!content) {
      appliedLibraryActionRef.current = '';
      return;
    }

    const bookTitle = firstParam(params.bookTitle).slice(0, 200);
    const actionIdentity = `${content}\u0000${bookTitle}`;
    if (appliedLibraryActionRef.current === actionIdentity) return;
    appliedLibraryActionRef.current = actionIdentity;
    setFramework('simple');
    updateInput(content);
    setActiveSection('simple');
    setLibrarySourceTitle(bookTitle || 'the library');
  }, [params.bookTitle, params.content, params.source, updateInput]);

  const addGoal = async (content: string, priority?: string, quadrant?: string) => {
    const normalizedContent = content.trim().replace(/\s+/g, ' ');
    if (!normalizedContent || (!context.user_id && !context.session_id)) return false;

    setGoalError(null);
    const date = format(new Date(), 'yyyy-MM-dd');
    const identity = {
      id: 'pending',
      date,
      content: normalizedContent,
      framework,
      priority: priority || null,
      eisenhower_quadrant: quadrant || null,
    };
    const identityKey = goalIdentityKey(identity);

    const saved = await runGoalInsertRef.current(async () => {
      if (goalIdsByKeyRef.current.has(identityKey)) {
        setGoalError('That goal is already in this section.');
        return false;
      }

      setAdding(true);
      try {
        const { data, error } = await supabase
          .from('goals')
          .insert({
            ...context,
            content: normalizedContent,
            framework,
            priority: priority || null,
            eisenhower_quadrant: quadrant || null,
            date,
          } as any)
          .select()
          .single();

        if (error || !data) {
          if (error?.code === '23505') {
            await loadGoals();
            setGoalError('That goal is already in this section.');
          } else {
            setGoalError('Could not add that goal. Please try again.');
          }
          return false;
        }

        goalIdsByKeyRef.current.set(identityKey, [data.id]);
        setGoals((current) => appendUniqueGoal(current, data as Goal));
        setInput((current) => {
          if (current.trim().replace(/\s+/g, ' ') !== normalizedContent) return current;
          inputRef.current = '';
          return '';
        });
        setActiveSection(null);
        setLibrarySourceTitle('');
        refreshReminderContent();
        return true;
      } catch {
        setGoalError('Could not add that goal. Please try again.');
        return false;
      } finally {
        setAdding(false);
      }
    });

    return saved ?? false;
  };

  const updateGoalStatus = async (
    goal: Goal,
    newStatus: 'pending' | 'completed',
    completedAt = newStatus === 'completed' ? new Date().toISOString() : null
  ) => {
    if (!query) return;
    setStatusUpdatingId(goal.id);
    setGoalError(null);
    const ids = goalIdsByKeyRef.current.get(goalIdentityKey(goal)) ?? [goal.id];
    try {
      const { error } = await supabase.from('goals').update({ status: newStatus, completed_at: completedAt } as any).in('id', ids).eq(query.column, query.value);
      if (error) {
        setGoalError('Could not update that goal. Please try again.');
        return false;
      }
      setGoals((current) => current.map((item) => (item.id === goal.id ? { ...item, status: newStatus, completed_at: completedAt } : item)));
      refreshReminderContent();
      return true;
    } finally {
      setStatusUpdatingId((current) => (current === goal.id ? null : current));
    }
  };

  const toggleGoal = async (id: string) => {
    if (statusUpdatingId) return;
    const goal = goals.find((item) => item.id === id);
    if (!goal || goal.status === 'cancelled') return;
    const from = goal.status;
    const to = nextGoalCompletionStatus(from);
    const completedAt = to === 'completed' ? new Date().toISOString() : null;
    if (await updateGoalStatus(goal, to, completedAt)) {
      setGoalStatusChange({
        id,
        from,
        to,
        fromCompletedAt: goal.completed_at,
      });
    }
  };

  const undoGoalStatus = async () => {
    const change = goalStatusChange;
    if (!change || statusUpdatingId) return;
    const goal = goals.find((item) => item.id === change.id);
    if (!goal || goal.status !== change.to) {
      setGoalStatusChange(null);
      return;
    }
    if (await updateGoalStatus(goal, change.from, change.fromCompletedAt)) {
      setGoalStatusChange(null);
    }
  };

  const deleteGoal = async (id: string) => {
    if (!query) return false;
    const goal = goals.find((item) => item.id === id);
    if (!goal) return false;
    const identityKey = goalIdentityKey(goal);
    const ids = goalIdsByKeyRef.current.get(identityKey) ?? [id];
    if (context.user_id) {
      const { data: attachmentRows, error: attachmentError } = await supabase
        .from('goal_attachments')
        .select('storage_path')
        .eq('user_id', context.user_id)
        .in('goal_id', ids);
      if (attachmentError) {
        setGoalError('Could not verify this goal’s files before deleting it.');
        return false;
      }
      const paths = (attachmentRows ?? []).map((row) => row.storage_path);
      const { error } = await supabase.from('goals').delete().in('id', ids).eq(query.column, query.value);
      if (error) {
        setGoalError('Could not delete that goal. Please try again.');
        return false;
      }
      goalIdsByKeyRef.current.delete(identityKey);
      setGoals((current) => current.filter((goal) => !ids.includes(goal.id)));
      setSelectedGoal((current) => current && ids.includes(current.id) ? null : current);
      refreshReminderContent();
      if (paths.length > 0) {
        const { error: storageError } = await supabase.storage
          .from(GOAL_ATTACHMENT_BUCKET)
          .remove(paths);
        if (storageError) {
          await enqueueGoalAttachmentCleanup(context.user_id, paths);
          setGoalError('The goal was deleted, but attached file cleanup is still pending.');
        }
      }
      return true;
    }
    const { error } = await supabase.from('goals').delete().in('id', ids).eq(query.column, query.value);
    if (error) {
      setGoalError('Could not delete that goal. Please try again.');
      return false;
    }
    goalIdsByKeyRef.current.delete(identityKey);
    setGoals((current) => current.filter((goal) => !ids.includes(goal.id)));
    setSelectedGoal((current) => current && ids.includes(current.id) ? null : current);
    refreshReminderContent();
    return true;
  };

  const completed = goals.filter((g) => g.status === 'completed').length;
  const frameworkGoals = goals.filter((g) => g.framework === framework);
  const composerOpen = activeSection !== null;
  const allPrioritySlotsFilled = PRIORITIES_135.every(
    (priority) =>
      frameworkGoals.filter((goal) => goal.priority === priority.id).length >= priority.limit
  );
  const addLimitReached =
    (framework === 'simple' && frameworkGoals.length >= 3) ||
    (framework === 'ivy_lee' && frameworkGoals.length >= 6) ||
    (framework === '1-3-5' && allPrioritySlotsFilled);

  const defaultComposerSection = () => {
    if (framework === 'eisenhower') return EISENHOWER_QUADRANTS[0].id;
    if (framework === '1-3-5') {
      return PRIORITIES_135.find(
        (priority) =>
          frameworkGoals.filter((goal) => goal.priority === priority.id).length < priority.limit
      )?.id ?? PRIORITIES_135[0].id;
    }
    if (framework === 'abcde') return ABCDE_PRIORITIES[0].id;
    return framework;
  };

  const toggleComposer = () => {
    if (composerOpen) {
      setActiveSection(null);
      return;
    }
    setActiveSection(defaultComposerSection());
  };

  const submitComposer = (content: string) => {
    if (framework === 'eisenhower') {
      void addGoal(content, undefined, activeSection ?? EISENHOWER_QUADRANTS[0].id);
      return;
    }
    if (framework === '1-3-5' || framework === 'abcde') {
      void addGoal(content, activeSection ?? defaultComposerSection());
      return;
    }
    void addGoal(content);
  };

  if (loading) return <View style={s.centered}><ActivityIndicator accessibilityLabel="Loading goals" size="large" color={Colors.primary} /></View>;

  const renderGoalItem = (g: Goal, num?: number) => (
    <View key={g.id} style={[s.goalRow, g.status === 'completed' && { opacity: 0.5 }]}>
      {num !== undefined && <Text style={s.goalNum}>{num}</Text>}
      <TouchableOpacity
        accessibilityRole="checkbox"
        accessibilityLabel={`${g.status === 'completed' ? 'Mark pending' : 'Mark complete'}: ${g.content}`}
        accessibilityState={{ checked: g.status === 'completed', disabled: Boolean(statusUpdatingId) || g.status === 'cancelled' }}
        hitSlop={10}
        style={[s.checkbox, g.status === 'completed' && s.checkboxDone]}
        onPress={() => void toggleGoal(g.id)}
        disabled={Boolean(statusUpdatingId) || g.status === 'cancelled'}
      >
        {g.status === 'completed' ? <Feather name="check" size={14} color="#fffef8" /> : null}
      </TouchableOpacity>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Open details for ${g.content}`} onPress={() => setSelectedGoal(g)} style={s.goalTextButton}>
        <Text style={[s.goalText, g.status === 'completed' && s.goalTextDone]}>{g.content}</Text>
        <Text style={s.goalHint}>
          {g.due_at
            ? `Due ${format(new Date(g.due_at), 'MMM d · h:mm a')}`
            : 'Milestones, reminders and files'}
        </Text>
      </TouchableOpacity>
      <Feather accessible={false} name="chevron-right" size={18} color={Colors.textSecondary} />
    </View>
  );

  const renderAddInput = (onSubmit: (content: string) => void) => (
    <View style={s.inputRow}>
      <TextInput
        ref={inputControlRef}
        style={s.input}
        placeholder="Add task..."
        value={input}
        onChangeText={updateInput}
        onEndEditing={(event) => updateInput(event.nativeEvent.text)}
        onSubmitEditing={(event) => {
          updateInput(event.nativeEvent.text);
          if (!adding) onSubmit(event.nativeEvent.text);
        }}
        placeholderTextColor={Colors.textSecondary}
        editable={!adding}
      />
      <TouchableOpacity
        style={[s.addSmallBtn, adding && s.addSmallBtnDisabled]}
        onPress={() => submitCurrentInput(onSubmit)}
        disabled={adding || !input.trim()}
      >
        {adding ? <ActivityIndicator size="small" color="#fff" /> : <Text style={s.addSmallBtnText}>+</Text>}
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={s.container}>
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      <PageHeader
        eyebrow="Plan and progress"
        title="Goals"
        description="Make the next step small enough to start."
        action={
          <AppButton
            label={composerOpen ? 'Close' : 'Add goal'}
            icon={composerOpen ? undefined : 'plus'}
            variant={composerOpen ? 'text' : 'primary'}
            disabled={!composerOpen && addLimitReached}
            onPress={toggleComposer}
          />
        }
      />
      {librarySourceTitle ? (
        <View style={s.libraryDraft}>
          <Text style={s.libraryDraftLabel}>FROM {librarySourceTitle.toUpperCase()}</Text>
          <Text style={s.libraryDraftText}>{input}</Text>
          <Text style={s.libraryDraftHint}>Review this draft in Simple priorities before adding it.</Text>
        </View>
      ) : null}

      {goals.length >= 5 ? (
        <View style={s.viewPicker}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityState={{ expanded: frameworkPickerOpen }}
            accessibilityLabel="Change goal view"
            onPress={() => setFrameworkPickerOpen((current) => !current)}
            style={s.viewPickerHeader}
          >
            <View style={{ flex: 1 }}>
              <Text style={s.pickerLabel}>VIEW</Text>
              <Text style={s.viewPickerValue}>{FRAMEWORKS.find((item) => item.id === framework)?.label}</Text>
            </View>
            <Feather name={frameworkPickerOpen ? 'chevron-up' : 'chevron-down'} size={18} color={Colors.primary} />
          </TouchableOpacity>
          {frameworkPickerOpen ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.frameworkChoices}>
              {FRAMEWORKS.map((fw) => (
                <TouchableOpacity
                  key={fw.id}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: framework === fw.id }}
                  accessibilityLabel={`${fw.label} goal view`}
                  style={[s.fwBtn, framework === fw.id && s.fwBtnActive]}
                  onPress={() => {
                    setFramework(fw.id);
                    setActiveSection(null);
                    setFrameworkPickerOpen(false);
                  }}
                >
                  <Text style={[s.fwBtnText, framework === fw.id && s.fwBtnTextActive]}>{fw.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          ) : null}
        </View>
      ) : null}

      {goals.length > 0 && completed > 0 && (
        <View style={s.progressSummary}>
          <Text style={s.progressTitle}>Moved forward today</Text>
          <Text style={s.progressCount}>{completed} completed</Text>
        </View>
      )}

      {composerOpen ? (
        <View style={s.composer}>
          {framework === 'eisenhower' ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.composerChoices}>
              {EISENHOWER_QUADRANTS.map((section) => (
                <TouchableOpacity
                  key={section.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected: activeSection === section.id }}
                  onPress={() => setActiveSection(section.id)}
                  style={[s.composerChoice, activeSection === section.id && s.composerChoiceSelected]}
                >
                  <Text style={[s.composerChoiceText, activeSection === section.id && s.composerChoiceTextSelected]}>{section.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          ) : null}
          {framework === '1-3-5' ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.composerChoices}>
              {PRIORITIES_135.map((priority) => {
                const count = frameworkGoals.filter((goal) => goal.priority === priority.id).length;
                const disabled = count >= priority.limit;
                return (
                  <TouchableOpacity
                    key={priority.id}
                    accessibilityRole="button"
                    accessibilityState={{ selected: activeSection === priority.id, disabled }}
                    disabled={disabled}
                    onPress={() => setActiveSection(priority.id)}
                    style={[
                      s.composerChoice,
                      activeSection === priority.id && s.composerChoiceSelected,
                      disabled && s.composerChoiceDisabled,
                    ]}
                  >
                    <Text style={[s.composerChoiceText, activeSection === priority.id && s.composerChoiceTextSelected]}>{priority.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          ) : null}
          {framework === 'abcde' ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.composerChoices}>
              {ABCDE_PRIORITIES.map((priority) => (
                <TouchableOpacity
                  key={priority.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected: activeSection === priority.id }}
                  onPress={() => setActiveSection(priority.id)}
                  style={[s.composerChoice, activeSection === priority.id && s.composerChoiceSelected]}
                >
                  <Text style={[s.composerChoiceText, activeSection === priority.id && s.composerChoiceTextSelected]}>{priority.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          ) : null}
          {renderAddInput(submitComposer)}
        </View>
      ) : null}

      <View style={s.listHeading}>
        <View>
          <Text style={s.listTitle}>Active goals</Text>
          <Text style={s.listDate}>{format(new Date(), 'EEEE, MMM d')}</Text>
        </View>
        <Text style={s.frameworkLabel}>{FRAMEWORKS.find((item) => item.id === framework)?.label}</Text>
      </View>
      {goalError ? <Text accessibilityRole="alert" style={s.errorText}>{goalError}</Text> : null}
      {goalStatusChange ? (
        <View style={s.undoBanner}>
          <Text style={s.undoText}>{goalCompletionFeedback(goalStatusChange.to)}</Text>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Undo goal status change"
            onPress={() => void undoGoalStatus()}
            disabled={Boolean(statusUpdatingId)}
          >
            <Text style={s.undoAction}>Undo</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {framework === 'simple' && (
        <>
          {frameworkGoals.map((g, i) => renderGoalItem(g, i + 1))}
          {frameworkGoals.length === 0 && <Text style={s.empty}>What are your top priorities today?</Text>}
        </>
      )}

      {framework === 'eisenhower' && EISENHOWER_QUADRANTS.map((q) => {
          const list = goals.filter((g) => g.eisenhower_quadrant === q.id);
          return (
            <View key={q.id} style={s.section}>
              <Text style={s.sectionTitle}>{q.label}</Text>
              {list.map((g) => renderGoalItem(g))}
              {list.length === 0 ? <Text style={s.sectionEmpty}>No goals here</Text> : null}
            </View>
          );
      })}

      {framework === 'ivy_lee' && (
        <>
          {frameworkGoals.length >= 6 && <Text style={s.limitMsg}>You have your 6 tasks. Now focus on #1.</Text>}
          {frameworkGoals.map((g, i) => renderGoalItem(g, i + 1))}
        </>
      )}

      {framework === '1-3-5' && PRIORITIES_135.map((p) => {
          const list = frameworkGoals.filter((g) => g.priority === p.id);
          return (
            <View key={p.id} style={s.section}>
              <View style={s.sectionHeading}>
                <Text style={s.sectionTitle}>{p.label}</Text>
                <Text style={s.sectionCount}>{list.length}/{p.limit}</Text>
              </View>
              {list.map((g) => renderGoalItem(g))}
              {list.length === 0 ? <Text style={s.sectionEmpty}>No goals here</Text> : null}
            </View>
          );
      })}

      {framework === 'abcde' && ABCDE_PRIORITIES.map((priority) => {
          const list = frameworkGoals.filter((g) => g.priority === priority.id);
          return (
            <View key={priority.id} style={s.section}>
              <Text style={s.sectionTitle}>{priority.label}</Text>
              {list.map((g) => renderGoalItem(g))}
              {list.length === 0 ? <Text style={s.sectionEmpty}>No goals here</Text> : null}
            </View>
          );
      })}
    </ScrollView>
    <GoalDetailModal
      key={`${ownerKey}:${selectedGoal?.id ?? 'closed-goal-details'}`}
      visible={Boolean(selectedGoal)}
      goal={selectedGoal}
      userId={context.user_id ?? null}
      onClose={() => setSelectedGoal(null)}
      onDelete={() => deleteGoal(selectedGoal?.id ?? '')}
      onStartFocus={selectedGoal?.status === 'pending' ? () => {
        const goalId = selectedGoal.id;
        setSelectedGoal(null);
        router.push({
          pathname: '/focus',
          params: { source: 'goals', goalId },
        });
      } : undefined}
      onUpdated={(updated) => {
        setGoals((current) => current.map((item) => item.id === updated.id ? { ...item, ...updated } : item));
        setSelectedGoal((current) => current?.id === updated.id ? { ...current, ...updated } : current);
        refreshReminderContent();
      }}
    />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 16, paddingBottom: 44 },
  libraryDraft: { borderLeftWidth: 3, borderLeftColor: Colors.success, paddingLeft: 12, marginBottom: 16 },
  libraryDraftLabel: { color: Colors.success, fontSize: 10, fontWeight: '700', letterSpacing: 0.8 },
  libraryDraftText: { color: Colors.text, fontSize: 14, lineHeight: 20, fontWeight: '600', marginTop: 5 },
  libraryDraftHint: { color: Colors.textSecondary, fontSize: 11, lineHeight: 17, marginTop: 5 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  pickerLabel: { color: Colors.textSecondary, fontSize: 10, lineHeight: 14, fontWeight: '800', letterSpacing: 1.2, marginBottom: 8 },
  viewPicker: { marginBottom: 16 },
  viewPickerHeader: { minHeight: 58, flexDirection: 'row', alignItems: 'center', borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: Colors.border, paddingVertical: 8 },
  viewPickerValue: { color: Colors.text, fontSize: 15, fontWeight: '700' },
  frameworkChoices: { paddingTop: 10 },
  fwBtn: { minHeight: 44, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: Colors.border, borderRadius: 999, paddingVertical: 10, paddingHorizontal: 14, marginRight: 8, backgroundColor: Colors.card },
  fwBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  fwBtnText: { fontSize: 13, fontWeight: '600', color: Colors.text },
  fwBtnTextActive: { color: Colors.onPrimary },
  progressSummary: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 14 },
  progressTitle: { fontSize: 13, lineHeight: 18, fontWeight: '700', color: Colors.text },
  progressCount: { fontSize: 13, fontWeight: '700', color: Colors.success },
  composer: { borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: Colors.borderStrong, paddingVertical: 14, marginBottom: 18 },
  composerChoices: { gap: 8, paddingBottom: 12 },
  composerChoice: { minHeight: 40, justifyContent: 'center', borderWidth: 1, borderColor: Colors.border, borderRadius: 999, paddingHorizontal: 13, backgroundColor: Colors.card },
  composerChoiceSelected: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  composerChoiceDisabled: { opacity: 0.4 },
  composerChoiceText: { color: Colors.primary, fontSize: 12, fontWeight: '700' },
  composerChoiceTextSelected: { color: Colors.onPrimary },
  listHeading: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, paddingBottom: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.borderStrong },
  listTitle: { fontSize: 20, lineHeight: 25, fontWeight: '700', color: Colors.text },
  listDate: { color: Colors.textSecondary, fontSize: 12, marginTop: 3 },
  frameworkLabel: { color: Colors.textSecondary, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.7, paddingTop: 5 },
  section: { paddingTop: 18, marginBottom: 6 },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 7, marginBottom: 2 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: Colors.text },
  sectionCount: { fontSize: 13, color: Colors.textSecondary },
  sectionEmpty: { color: Colors.textSecondary, fontSize: 12, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border },
  inputRow: { flexDirection: 'row', gap: 8 },
  input: { flex: 1, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.borderStrong, borderRadius: 10, padding: 10, fontSize: 14, color: Colors.text },
  addSmallBtn: { backgroundColor: Colors.primary, borderRadius: 10, width: 44, justifyContent: 'center', alignItems: 'center' },
  addSmallBtnDisabled: { opacity: 0.55 },
  addSmallBtnText: { color: Colors.onPrimary, fontSize: 20, fontWeight: '600' },
  limitMsg: { color: Colors.success, fontSize: 13, marginBottom: 8 },
  goalRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 66, paddingVertical: 9, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border },
  goalNum: { fontSize: 16, fontWeight: '700', color: Colors.textSecondary, width: 20 },
  checkbox: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: Colors.border, justifyContent: 'center', alignItems: 'center' },
  checkboxDone: { backgroundColor: Colors.success, borderColor: Colors.success },
  goalTextButton: { flex: 1, minWidth: 0, paddingVertical: 4 },
  goalText: { fontSize: 15, lineHeight: 20, color: Colors.text, fontWeight: '600' },
  goalHint: { color: Colors.textSecondary, fontSize: 11, marginTop: 3 },
  goalTextDone: { textDecorationLine: 'line-through', color: Colors.textSecondary },
  empty: { textAlign: 'center', color: Colors.textSecondary, paddingVertical: 24 },
  errorText: { color: Colors.danger, fontSize: 13, marginBottom: 10 },
  undoBanner: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: Colors.successLight, paddingHorizontal: 12, marginBottom: 12 },
  undoText: { flex: 1, color: Colors.text, fontSize: 13, fontWeight: '600' },
  undoAction: { color: Colors.primary, fontSize: 13, fontWeight: '800' },
});
