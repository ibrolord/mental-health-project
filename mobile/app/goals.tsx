import { useState, useEffect, useRef, useCallback, type ComponentProps } from 'react';
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
import { AppCard, PageHeader } from '@/components/AppUI';

type FeatherName = ComponentProps<typeof Feather>['name'];

interface Goal extends GoalDetailRecord {
  date: string;
  status: 'pending' | 'completed' | 'cancelled';
  framework: FrameworkType;
  priority: string | null;
  eisenhower_quadrant: string | null;
  completed_at: string | null;
}

const FRAMEWORKS: { id: FrameworkType; label: string; icon: FeatherName }[] = [
  { id: 'simple', label: 'Simple', icon: 'list' },
  { id: 'eisenhower', label: 'Eisenhower', icon: 'grid' },
  { id: 'ivy_lee', label: 'Ivy Lee', icon: 'align-left' },
  { id: '1-3-5', label: '1-3-5', icon: 'layers' },
  { id: 'abcde', label: 'ABCDE', icon: 'filter' },
];

const EISENHOWER_QUADRANTS = [
  { id: 'urgent-important', label: 'Do first', color: '#fff0ed', icon: 'zap' as FeatherName },
  { id: 'not-urgent-important', label: 'Schedule', color: '#edf4ea', icon: 'calendar' as FeatherName },
  { id: 'urgent-not-important', label: 'Delegate', color: '#f7f3df', icon: 'users' as FeatherName },
  { id: 'not-urgent-not-important', label: 'Let go', color: '#f8f6ee', icon: 'trash-2' as FeatherName },
];

const PRIORITIES_135 = [
  { id: 'big', label: '1 big thing', limit: 1, icon: 'target' as FeatherName },
  { id: 'medium', label: '3 medium tasks', limit: 3, icon: 'layers' as FeatherName },
  { id: 'small', label: '5 small tasks', limit: 5, icon: 'list' as FeatherName },
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
        {g.due_at ? <Text style={s.goalDue}>Due {format(new Date(g.due_at), 'MMM d · h:mm a')}</Text> : null}
        <Text style={s.goalHint}>Milestones, notes, reminders, and files</Text>
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
        icon="check-circle"
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
                  onPress={() => { setFramework(fw.id); setFrameworkPickerOpen(false); }}
                >
                  <Feather name={fw.icon} size={15} color={framework === fw.id ? '#fffef8' : Colors.primary} />
                  <Text style={[s.fwBtnText, framework === fw.id && s.fwBtnTextActive]}>{fw.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          ) : null}
        </View>
      ) : null}

      {goals.length > 0 && completed > 0 && (
        <AppCard quiet style={s.progressCard}>
          <View style={s.progressRow}>
            <Text style={s.progressTitle}>Moved forward today</Text>
            <Text style={s.progressCount}>{completed}</Text>
          </View>
          <Text style={s.progressNote}>Small completed steps still count.</Text>
        </AppCard>
      )}

      <AppCard style={s.card}>
        <View style={s.cardHeading}>
          <View>
            <Text style={s.cardTitle}>Active goals</Text>
            <Text style={s.cardDate}>{format(new Date(), 'EEEE, MMM d')}</Text>
            <Text style={s.cardHint}>Tap a goal for milestones, reminders and files.</Text>
          </View>
          <View style={s.frameworkBadge}>
            <Text style={s.frameworkBadgeText}>{FRAMEWORKS.find((item) => item.id === framework)?.label}</Text>
          </View>
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
            {frameworkGoals.length < 3 && renderAddInput((content) => { void addGoal(content); })}
            {frameworkGoals.map((g, i) => renderGoalItem(g, i + 1))}
            {frameworkGoals.length === 0 && <Text style={s.empty}>What are your top priorities today?</Text>}
          </>
        )}

        {framework === 'eisenhower' && EISENHOWER_QUADRANTS.map((q) => {
          const list = goals.filter((g) => g.eisenhower_quadrant === q.id);
          return (
            <View key={q.id} style={[s.section, { backgroundColor: q.color }]}>
              <View style={s.sectionHeading}>
                <Feather name={q.icon} size={16} color={Colors.primary} />
                <Text style={s.sectionTitle}>{q.label}</Text>
              </View>
              {activeSection === q.id ? (
                <View style={s.inputRow}>
                  <TextInput ref={inputControlRef} style={s.input} placeholder="Add task..." value={input} onChangeText={updateInput} onEndEditing={(event) => updateInput(event.nativeEvent.text)} onSubmitEditing={(event) => { updateInput(event.nativeEvent.text); void addGoal(event.nativeEvent.text, undefined, q.id); }} placeholderTextColor={Colors.textSecondary} editable={!adding} autoFocus />
                  <TouchableOpacity style={[s.addSmallBtn, adding && s.addSmallBtnDisabled]} onPress={() => submitCurrentInput((content) => { void addGoal(content, undefined, q.id); })} disabled={adding || !input.trim()}>
                    {adding ? <ActivityIndicator size="small" color="#fff" /> : <Text style={s.addSmallBtnText}>+</Text>}
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity onPress={() => setActiveSection(q.id)}>
                  <Text style={s.addLink}>+ Add task</Text>
                </TouchableOpacity>
              )}
              {list.map((g) => renderGoalItem(g))}
            </View>
          );
        })}

        {framework === 'ivy_lee' && (
          <>
            {frameworkGoals.length < 6 && renderAddInput((content) => { void addGoal(content); })}
            {frameworkGoals.length >= 6 && <Text style={s.limitMsg}>✓ You have your 6 tasks. Now focus on #1!</Text>}
            {frameworkGoals.map((g, i) => renderGoalItem(g, i + 1))}
          </>
        )}

        {framework === '1-3-5' && PRIORITIES_135.map((p) => {
          const list = frameworkGoals.filter((g) => g.priority === p.id);
          const atLimit = list.length >= p.limit;
          return (
            <View key={p.id} style={s.section}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <View style={s.sectionHeading}>
                  <Feather name={p.icon} size={16} color={Colors.primary} />
                  <Text style={s.sectionTitle}>{p.label}</Text>
                </View>
                <Text style={s.sectionCount}>{list.length}/{p.limit}</Text>
              </View>
              {!atLimit && activeSection === p.id ? (
                <View style={s.inputRow}>
                  <TextInput ref={inputControlRef} style={s.input} placeholder="Add task..." value={input} onChangeText={updateInput} onEndEditing={(event) => updateInput(event.nativeEvent.text)} onSubmitEditing={(event) => { updateInput(event.nativeEvent.text); void addGoal(event.nativeEvent.text, p.id); }} placeholderTextColor={Colors.textSecondary} editable={!adding} autoFocus />
                  <TouchableOpacity style={[s.addSmallBtn, adding && s.addSmallBtnDisabled]} onPress={() => submitCurrentInput((content) => { void addGoal(content, p.id); })} disabled={adding || !input.trim()}>
                    {adding ? <ActivityIndicator size="small" color="#fff" /> : <Text style={s.addSmallBtnText}>+</Text>}
                  </TouchableOpacity>
                </View>
              ) : !atLimit ? (
                <TouchableOpacity onPress={() => setActiveSection(p.id)}>
                  <Text style={s.addLink}>+ Add task</Text>
                </TouchableOpacity>
              ) : (
                <Text style={s.limitMsg}>✓ Section complete!</Text>
              )}
              {list.map((g) => renderGoalItem(g))}
            </View>
          );
        })}

        {framework === 'abcde' && ['A', 'B', 'C', 'D', 'E'].map((p) => {
          const labels: Record<string, string> = { A: 'A — Must do', B: 'B — Should do', C: 'C — Nice to do', D: 'D — Delegate', E: 'E — Let go' };
          const list = frameworkGoals.filter((g) => g.priority === p);
          return (
            <View key={p} style={s.section}>
              <Text style={s.sectionTitle}>{labels[p]}</Text>
              {activeSection === p ? (
                <View style={s.inputRow}>
                  <TextInput ref={inputControlRef} style={s.input} placeholder="Add task..." value={input} onChangeText={updateInput} onEndEditing={(event) => updateInput(event.nativeEvent.text)} onSubmitEditing={(event) => { updateInput(event.nativeEvent.text); void addGoal(event.nativeEvent.text, p); }} placeholderTextColor={Colors.textSecondary} editable={!adding} autoFocus />
                  <TouchableOpacity style={[s.addSmallBtn, adding && s.addSmallBtnDisabled]} onPress={() => submitCurrentInput((content) => { void addGoal(content, p); })} disabled={adding || !input.trim()}>
                    {adding ? <ActivityIndicator size="small" color="#fff" /> : <Text style={s.addSmallBtnText}>+</Text>}
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity onPress={() => setActiveSection(p)}>
                  <Text style={s.addLink}>+ Add task</Text>
                </TouchableOpacity>
              )}
              {list.map((g) => renderGoalItem(g))}
            </View>
          );
        })}
      </AppCard>
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
  libraryDraft: { backgroundColor: '#ecfdf5', borderWidth: 1, borderColor: '#a7f3d0', borderRadius: 14, padding: 14, marginBottom: 14 },
  libraryDraftLabel: { color: '#047857', fontSize: 10, fontWeight: '700', letterSpacing: 0.8 },
  libraryDraftText: { color: '#064e3b', fontSize: 14, lineHeight: 20, fontWeight: '600', marginTop: 5 },
  libraryDraftHint: { color: '#065f46', fontSize: 11, lineHeight: 17, marginTop: 5 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  card: { padding: 18 },
  cardHeading: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 16 },
  cardTitle: { fontSize: 20, lineHeight: 25, fontWeight: '700', color: Colors.text },
  cardDate: { color: Colors.textSecondary, fontSize: 12, marginTop: 3 },
  cardHint: { color: Colors.textSecondary, fontSize: 11, lineHeight: 16, marginTop: 5, maxWidth: 230 },
  frameworkBadge: { borderRadius: 999, backgroundColor: Colors.primaryLight, paddingHorizontal: 10, paddingVertical: 6 },
  frameworkBadgeText: { color: Colors.primary, fontSize: 11, fontWeight: '700' },
  pickerLabel: { color: Colors.textSecondary, fontSize: 10, lineHeight: 14, fontWeight: '800', letterSpacing: 1.2, marginBottom: 8 },
  viewPicker: { marginBottom: 16 },
  viewPickerHeader: { minHeight: 58, flexDirection: 'row', alignItems: 'center', borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: Colors.border, paddingVertical: 8 },
  viewPickerValue: { color: Colors.text, fontSize: 15, fontWeight: '700' },
  frameworkChoices: { paddingTop: 10 },
  fwBtn: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 7, borderWidth: 1, borderColor: Colors.border, borderRadius: 999, paddingVertical: 10, paddingHorizontal: 14, marginRight: 8, backgroundColor: Colors.card },
  fwBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  fwBtnText: { fontSize: 13, fontWeight: '600', color: Colors.text },
  fwBtnTextActive: { color: '#fffef8' },
  progressCard: { marginBottom: 14 },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  progressTitle: { fontSize: 15, lineHeight: 20, fontWeight: '700', color: Colors.text },
  progressCount: { fontSize: 13, fontWeight: '700', color: Colors.success },
  progressBar: { height: 8, backgroundColor: Colors.border, borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: Colors.success, borderRadius: 5 },
  progressNote: { color: Colors.textSecondary, fontSize: 11, lineHeight: 16, marginTop: 8 },
  section: { backgroundColor: Colors.surfaceMuted, borderRadius: 14, padding: 14, marginBottom: 12 },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 8 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: Colors.text },
  sectionCount: { fontSize: 13, color: Colors.textSecondary },
  inputRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  input: { flex: 1, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border, borderRadius: 10, padding: 10, fontSize: 14, color: Colors.text },
  addSmallBtn: { backgroundColor: Colors.primary, borderRadius: 10, width: 40, justifyContent: 'center', alignItems: 'center' },
  addSmallBtnDisabled: { opacity: 0.55 },
  addSmallBtnText: { color: '#fff', fontSize: 20, fontWeight: '600' },
  addLink: { color: Colors.primary, fontSize: 14, fontWeight: '500', marginBottom: 8 },
  limitMsg: { color: Colors.success, fontSize: 13, marginBottom: 8 },
  goalRow: { flexDirection: 'row', alignItems: 'center', gap: 9, minHeight: 72, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border },
  goalNum: { fontSize: 16, fontWeight: '700', color: Colors.textSecondary, width: 20 },
  checkbox: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: Colors.border, justifyContent: 'center', alignItems: 'center' },
  checkboxDone: { backgroundColor: Colors.success, borderColor: Colors.success },
  goalTextButton: { flex: 1, minWidth: 0, paddingVertical: 4 },
  goalText: { fontSize: 15, lineHeight: 20, color: Colors.text, fontWeight: '600' },
  goalDue: { color: Colors.textSecondary, fontSize: 11, marginTop: 3 },
  goalHint: { color: Colors.textSecondary, fontSize: 10, marginTop: 4 },
  goalTextDone: { textDecorationLine: 'line-through', color: Colors.textSecondary },
  focusBtn: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 21, backgroundColor: Colors.primaryLight },
  empty: { textAlign: 'center', color: Colors.textSecondary, paddingVertical: 16 },
  errorText: { color: Colors.danger, fontSize: 13, marginBottom: 10 },
  undoBanner: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 11, backgroundColor: Colors.successLight, paddingHorizontal: 12, marginBottom: 12 },
  undoText: { flex: 1, color: Colors.text, fontSize: 13, fontWeight: '600' },
  undoAction: { color: Colors.primary, fontSize: 13, fontWeight: '800' },
});
