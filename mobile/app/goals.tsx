import { useState, useEffect, useRef, useCallback } from 'react';
import {
  AccessibilityInfo,
  Alert,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useDataContext } from '@/lib/hooks/use-data-context';
import { Colors, LARGE_TEXT_SCALE } from '@/lib/constants';
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
import {
  ABCDE_PRIORITIES,
  EISENHOWER_QUADRANTS,
  GOAL_FRAMEWORKS,
  PRIORITIES_135,
  frameworkMomentumCopy,
  frameworkProgress,
} from '@/lib/goals/frameworks';
import {
  ALL_GOALS_VIEW,
  TODAY_GOALS_VIEW,
  collectGoalProjects,
  filterGoalsByProject,
  goalProjectFromView,
  goalProjectView,
  normalizeGoalProject,
  type GoalProjectView,
} from '@/lib/goals/organization';

interface Goal extends GoalDetailRecord {
  date: string;
  status: 'pending' | 'completed' | 'cancelled';
  framework: FrameworkType;
  priority: string | null;
  eisenhower_quadrant: string | null;
  completed_at: string | null;
}

function firstParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? '' : value ?? '';
}

function quadrantColor(tone: (typeof EISENHOWER_QUADRANTS)[number]['tone']): string {
  if (tone === 'danger') return Colors.danger;
  if (tone === 'accent') return Colors.orange;
  if (tone === 'primary') return Colors.success;
  return Colors.borderStrong;
}

function abcdeColor(priority: string): string {
  if (priority === 'A') return Colors.danger;
  if (priority === 'B') return Colors.orange;
  if (priority === 'C') return Colors.accent;
  if (priority === 'D') return Colors.indigo;
  return Colors.textSecondary;
}

export default function GoalsScreen() {
  const { fontScale } = useWindowDimensions();
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
  const [projectView, setProjectView] = useState<GoalProjectView>(ALL_GOALS_VIEW);
  const [draftProjects, setDraftProjects] = useState<string[]>([]);
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
  const [screenReaderEnabled, setScreenReaderEnabled] = useState(false);
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
    setProjectView(ALL_GOALS_VIEW);
    setDraftProjects([]);
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
    void AccessibilityInfo.isScreenReaderEnabled().then(setScreenReaderEnabled);
    const subscription = AccessibilityInfo.addEventListener(
      'screenReaderChanged',
      setScreenReaderEnabled
    );
    return () => subscription.remove();
  }, []);

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
    const selectedProject = goalProjectFromView(projectView);

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
            tags: selectedProject ? [selectedProject] : [],
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
        if (selectedProject) {
          setDraftProjects((current) => current.filter(
            (project) => project.toLocaleLowerCase() !== selectedProject.toLocaleLowerCase()
          ));
        }
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

  const moveGoalToQuadrant = async (quadrant: string) => {
    if (!query || !selectedGoal || selectedGoal.framework !== 'eisenhower') return false;
    if (selectedGoal.eisenhower_quadrant === quadrant) return true;
    const generation = ownerGenerationRef.current;
    const expectedColumn = query.column;
    const expectedValue = query.value;
    const identityKey = goalIdentityKey(selectedGoal);
    const ids = goalIdsByKeyRef.current.get(identityKey) ?? [selectedGoal.id];
    const destinationKey = goalIdentityKey({
      ...selectedGoal,
      eisenhower_quadrant: quadrant,
    });
    const destinationIds = goalIdsByKeyRef.current.get(destinationKey) ?? [];
    if (destinationIds.some((id) => !ids.includes(id))) {
      setGoalError('That goal is already in the selected quadrant.');
      return false;
    }

    setGoalError(null);
    const { error } = await supabase
      .from('goals')
      .update({ eisenhower_quadrant: quadrant } as any)
      .in('id', ids)
      .eq(query.column, query.value);
    if (
      generation !== ownerGenerationRef.current ||
      query.column !== expectedColumn ||
      query.value !== expectedValue
    ) {
      return false;
    }
    if (error) {
      setGoalError('Could not move that goal. Please try again.');
      return false;
    }
    setSelectedGoal(null);
    await loadGoals();
    AccessibilityInfo.announceForAccessibility('Goal moved to a new quadrant.');
    return true;
  };

  const today = format(new Date(), 'yyyy-MM-dd');
  const allFrameworkGoals = goals.filter((g) => g.framework === framework);
  const frameworkGoals = filterGoalsByProject(allFrameworkGoals, projectView, today);
  const projectOptions = collectGoalProjects(goals);
  for (const draftProject of draftProjects) {
    if (!projectOptions.some((project) => project.toLocaleLowerCase() === draftProject.toLocaleLowerCase())) {
      projectOptions.push(draftProject);
    }
  }
  const completed = frameworkGoals.filter((g) => g.status === 'completed').length;
  const progress = frameworkProgress(completed, frameworkGoals.length);
  const frameworkMeta = GOAL_FRAMEWORKS.find((item) => item.id === framework) ?? GOAL_FRAMEWORKS[0];
  const useLinearMatrix = screenReaderEnabled || fontScale >= LARGE_TEXT_SCALE;
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

  const createProjectView = () => {
    Alert.prompt(
      'New project',
      'Name a project such as School, Work, or Health.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Create',
          onPress: (value?: string) => {
            const project = normalizeGoalProject(value ?? '');
            if (!project) return;
            setDraftProjects((current) => [
              ...current.filter((item) => item.toLocaleLowerCase() !== project.toLocaleLowerCase()),
              project,
            ]);
            setProjectView(goalProjectView(project));
            setActiveSection((current) => current ?? defaultComposerSection());
            AccessibilityInfo.announceForAccessibility(`${project} project selected. Add a goal to save it.`);
          },
        },
      ],
      'plain-text'
    );
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

  const renderGoalItem = (
    g: Goal,
    options: { num?: number; compact?: boolean; letter?: string; featured?: boolean } = {}
  ) => (
    <View
      key={g.id}
      style={[
        s.goalRow,
        options.compact && s.goalRowCompact,
        options.featured && s.goalRowFeatured,
        g.status === 'completed' && s.goalRowCompleted,
      ]}
    >
      {options.num !== undefined ? (
        <Text style={[s.goalNum, options.featured && s.goalNumFeatured]}>{options.num}</Text>
      ) : null}
      {options.letter ? (
        <View style={[s.letterChip, { backgroundColor: abcdeColor(options.letter) }]}>
          <Text style={s.letterChipText}>{options.letter}</Text>
        </View>
      ) : null}
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
        <Text style={[s.goalText, options.featured && s.goalTextFeatured, g.status === 'completed' && s.goalTextDone]}>{g.content}</Text>
        {!options.compact ? (
          <Text style={s.goalHint}>
            {g.due_at
              ? `Due ${format(new Date(g.due_at), 'MMM d, yyyy · h:mm a')}`
              : 'Open to plan the next step'}
          </Text>
        ) : null}
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
            <Text style={s.viewPickerValue}>{frameworkMeta.label}</Text>
            <Text style={s.viewPickerDescription}>{frameworkMeta.description}</Text>
          </View>
          <Feather name={frameworkPickerOpen ? 'chevron-up' : 'chevron-down'} size={18} color={Colors.primary} />
        </TouchableOpacity>
        {frameworkPickerOpen ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.frameworkChoices}>
            {GOAL_FRAMEWORKS.map((fw) => (
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
                  AccessibilityInfo.announceForAccessibility(`Switched to ${fw.label} view.`);
                }}
              >
                <Text style={[s.fwBtnText, framework === fw.id && s.fwBtnTextActive]}>{fw.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        ) : null}
      </View>

      <View style={s.projectViews}>
        <View style={s.projectHeading}>
          <View>
            <Text style={s.projectTitle}>Projects</Text>
            <Text style={s.projectDescription}>Filter this goal view without changing its method.</Text>
          </View>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Create a project"
            onPress={createProjectView}
            style={s.projectAdd}
          >
            <Feather name="plus" size={16} color={Colors.primary} />
            <Text style={s.projectAddText}>Project</Text>
          </TouchableOpacity>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.projectChips}>
          {[
            { id: ALL_GOALS_VIEW as GoalProjectView, label: 'All' },
            { id: TODAY_GOALS_VIEW as GoalProjectView, label: 'Today' },
            ...projectOptions.map((project) => ({ id: goalProjectView(project), label: project })),
          ].map((option) => (
            <TouchableOpacity
              key={option.id}
              accessibilityRole="tab"
              accessibilityState={{ selected: projectView === option.id }}
              onPress={() => setProjectView(option.id)}
              style={[s.projectChip, projectView === option.id && s.projectChipActive]}
            >
              <Text style={[s.projectChipText, projectView === option.id && s.projectChipTextActive]}>{option.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {frameworkGoals.length > 0 && completed > 0 && (
        <View style={s.progressSummary}>
          <View style={s.progressCopy}>
            <Text style={s.progressTitle}>Momentum</Text>
            <Text style={s.progressCount}>{frameworkMomentumCopy(framework, completed, frameworkGoals.length)}</Text>
          </View>
          <View
            accessibilityRole="progressbar"
            accessibilityLabel={`${frameworkMeta.label} goal progress`}
            accessibilityValue={{ min: 0, max: frameworkGoals.length, now: completed }}
            style={s.progressTrack}
          >
            <View style={[s.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
          </View>
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

      <View style={[s.listHeading, useLinearMatrix && s.listHeadingStacked]}>
        <View>
          <Text style={s.listTitle}>Active goals</Text>
          <Text style={s.listDate}>{format(new Date(), 'EEEE, MMM d, yyyy')}</Text>
        </View>
        <Text style={s.frameworkLabel}>{frameworkMeta.label}</Text>
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
          {frameworkGoals.map((g, i) => renderGoalItem(g, { num: i + 1 }))}
          {frameworkGoals.length === 0 && <Text style={s.empty}>What are your top priorities today?</Text>}
        </>
      )}

      {framework === 'eisenhower' ? (
        <View style={[s.matrixGrid, useLinearMatrix && s.matrixGridLinear]}>
          {EISENHOWER_QUADRANTS.map((q) => {
            const list = frameworkGoals.filter((g) => g.eisenhower_quadrant === q.id);
            return (
              <View
                key={q.id}
                style={[
                  s.matrixCell,
                  useLinearMatrix && s.matrixCellLinear,
                  { borderTopColor: quadrantColor(q.tone) },
                ]}
              >
                <View style={s.matrixHeader}>
                  <View style={s.matrixHeaderCopy}>
                    <Text
                      accessibilityRole="header"
                      accessibilityLabel={`${q.label} quadrant, ${list.length} ${list.length === 1 ? 'goal' : 'goals'}`}
                      style={s.matrixTitle}
                    >
                      {q.label}
                    </Text>
                    <Text style={s.matrixDescription}>{q.description}</Text>
                  </View>
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel={`Add a goal to ${q.label}`}
                    onPress={() => {
                      setActiveSection(q.id);
                      AccessibilityInfo.announceForAccessibility(`Adding to ${q.label}.`);
                    }}
                    style={s.matrixAdd}
                  >
                    <Feather name="plus" size={17} color={Colors.primary} />
                  </TouchableOpacity>
                </View>
                {list.map((g) => renderGoalItem(g, { compact: !useLinearMatrix }))}
                {list.length === 0 ? <Text style={s.matrixEmpty}>Tap + to add</Text> : null}
              </View>
            );
          })}
        </View>
      ) : null}

      {framework === 'ivy_lee' && (
        <>
          <View style={s.methodNote}>
            <Text style={s.methodNoteTitle}>{frameworkGoals.length}/6 ranked</Text>
            <Text style={s.methodNoteText}>{frameworkGoals.length >= 6 ? 'Your day is set. Begin with number one.' : 'Choose up to six, then work from the top.'}</Text>
          </View>
          {frameworkGoals.map((g, i) => renderGoalItem(g, { num: i + 1, featured: i === 0 }))}
          {frameworkGoals.length === 0 ? <Text style={s.empty}>What are today’s six priorities?</Text> : null}
        </>
      )}

      {framework === '1-3-5' && PRIORITIES_135.map((p) => {
          const list = frameworkGoals.filter((g) => g.priority === p.id);
          return (
            <View key={p.id} style={[s.capacityBand, p.id === 'big' && s.capacityBandBig, p.id === 'small' && s.capacityBandSmall]}>
              <View style={s.sectionHeading}>
                <View>
                  <Text style={s.sectionTitle}>{p.label}</Text>
                  <Text style={s.bandDescription}>{p.description}</Text>
                </View>
                <View style={[s.capacityBadge, list.length >= p.limit && s.capacityBadgeFull]}>
                  <Text style={[s.sectionCount, list.length >= p.limit && s.capacityBadgeTextFull]}>{list.length}/{p.limit}</Text>
                </View>
              </View>
              {list.map((g) => renderGoalItem(g, { compact: p.id === 'small', featured: p.id === 'big' }))}
              {list.length === 0 ? <Text style={s.sectionEmpty}>{p.id === 'big' ? 'What is the one thing that matters most?' : `Add up to ${p.limit}`}</Text> : null}
            </View>
          );
      })}

      {framework === 'abcde' && ABCDE_PRIORITIES.map((priority) => {
          const list = frameworkGoals.filter((g) => g.priority === priority.id);
          return (
            <View key={priority.id} style={[s.priorityLane, { borderLeftColor: abcdeColor(priority.id) }]}>
              <View style={s.sectionHeading}>
                <View>
                  <Text style={s.sectionTitle}>{priority.label}</Text>
                  <Text style={s.bandDescription}>{priority.description}</Text>
                </View>
                <View style={[s.letterChip, { backgroundColor: abcdeColor(priority.id) }]}><Text style={s.letterChipText}>{priority.id}</Text></View>
              </View>
              {list.map((g) => renderGoalItem(g))}
              {list.length === 0 ? <Text style={s.sectionEmpty}>Nothing here yet</Text> : null}
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
      onMoveQuadrant={selectedGoal?.framework === 'eisenhower' ? moveGoalToQuadrant : undefined}
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
  viewPickerDescription: { color: Colors.textSecondary, fontSize: 12, lineHeight: 17, marginTop: 3 },
  projectViews: { marginBottom: 16 },
  projectHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 10 },
  projectTitle: { color: Colors.text, fontSize: 14, fontWeight: '800' },
  projectDescription: { color: Colors.textSecondary, fontSize: 11, lineHeight: 16, marginTop: 2 },
  projectAdd: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10 },
  projectAddText: { color: Colors.primary, fontSize: 12, fontWeight: '800' },
  projectChips: { gap: 8 },
  projectChip: { minHeight: 44, justifyContent: 'center', borderWidth: 1, borderColor: Colors.borderStrong, borderRadius: 999, paddingHorizontal: 14, backgroundColor: Colors.card },
  projectChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  projectChipText: { color: Colors.primary, fontSize: 12, fontWeight: '700' },
  projectChipTextActive: { color: Colors.onPrimary },
  frameworkChoices: { paddingTop: 10 },
  fwBtn: { minHeight: 44, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: Colors.border, borderRadius: 999, paddingVertical: 10, paddingHorizontal: 14, marginRight: 8, backgroundColor: Colors.card },
  fwBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  fwBtnText: { fontSize: 13, fontWeight: '600', color: Colors.text },
  fwBtnTextActive: { color: Colors.onPrimary },
  progressSummary: { paddingBottom: 16 },
  progressCopy: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 8 },
  progressTitle: { fontSize: 13, lineHeight: 18, fontWeight: '700', color: Colors.text },
  progressCount: { fontSize: 13, fontWeight: '700', color: Colors.success },
  progressTrack: { height: 6, borderRadius: 999, overflow: 'hidden', backgroundColor: Colors.borderTinted },
  progressFill: { height: '100%', borderRadius: 999, backgroundColor: Colors.success },
  composer: { borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: Colors.borderStrong, paddingVertical: 14, marginBottom: 18 },
  composerChoices: { gap: 8, paddingBottom: 12 },
  composerChoice: { minHeight: 40, justifyContent: 'center', borderWidth: 1, borderColor: Colors.border, borderRadius: 999, paddingHorizontal: 13, backgroundColor: Colors.card },
  composerChoiceSelected: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  composerChoiceDisabled: { opacity: 0.4 },
  composerChoiceText: { color: Colors.primary, fontSize: 12, fontWeight: '700' },
  composerChoiceTextSelected: { color: Colors.onPrimary },
  listHeading: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, paddingBottom: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.borderStrong },
  listHeadingStacked: { flexDirection: 'column', gap: 6 },
  listTitle: { fontSize: 20, lineHeight: 25, fontWeight: '700', color: Colors.text },
  listDate: { color: Colors.textSecondary, fontSize: 12, marginTop: 3 },
  frameworkLabel: { color: Colors.textSecondary, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.7, paddingTop: 5 },
  section: { paddingTop: 18, marginBottom: 6 },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 7, marginBottom: 2 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: Colors.text },
  sectionCount: { fontSize: 13, color: Colors.textSecondary },
  sectionEmpty: { color: Colors.textSecondary, fontSize: 12, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border },
  matrixGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 10, paddingTop: 12 },
  matrixGridLinear: { flexDirection: 'column' },
  matrixCell: { width: '48%', minHeight: 178, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border, borderTopWidth: 4, borderRadius: 14, padding: 10 },
  matrixCellLinear: { width: '100%', minHeight: 0 },
  matrixHeader: { minHeight: 50, flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginBottom: 4 },
  matrixHeaderCopy: { flex: 1, minWidth: 0 },
  matrixTitle: { color: Colors.text, fontSize: 15, lineHeight: 19, fontWeight: '800' },
  matrixDescription: { color: Colors.textSecondary, fontSize: 10, lineHeight: 14, marginTop: 2 },
  matrixAdd: { width: 44, height: 44, marginTop: -7, marginRight: -7, alignItems: 'center', justifyContent: 'center', borderRadius: 22, backgroundColor: Colors.primaryLight },
  matrixEmpty: { flex: 1, color: Colors.textSecondary, fontSize: 11, lineHeight: 16, paddingVertical: 14 },
  methodNote: { backgroundColor: Colors.primaryLight, borderRadius: 14, padding: 14, marginTop: 14, marginBottom: 4 },
  methodNoteTitle: { color: Colors.primary, fontSize: 14, fontWeight: '800' },
  methodNoteText: { color: Colors.textSecondary, fontSize: 12, lineHeight: 17, marginTop: 3 },
  capacityBand: { backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border, borderRadius: 14, padding: 12, marginTop: 12 },
  capacityBandBig: { borderWidth: 2, borderColor: Colors.primary, paddingVertical: 16 },
  capacityBandSmall: { backgroundColor: Colors.surfaceMuted },
  bandDescription: { color: Colors.textSecondary, fontSize: 11, lineHeight: 15, marginTop: 2 },
  capacityBadge: { minWidth: 42, minHeight: 32, borderRadius: 16, paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.surfaceParchment },
  capacityBadgeFull: { backgroundColor: Colors.success },
  capacityBadgeTextFull: { color: Colors.onPrimary },
  priorityLane: { borderLeftWidth: 4, backgroundColor: Colors.card, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, marginTop: 12 },
  inputRow: { flexDirection: 'row', gap: 8 },
  input: { flex: 1, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.borderStrong, borderRadius: 10, padding: 10, fontSize: 14, color: Colors.text },
  addSmallBtn: { backgroundColor: Colors.primary, borderRadius: 10, width: 44, justifyContent: 'center', alignItems: 'center' },
  addSmallBtnDisabled: { opacity: 0.55 },
  addSmallBtnText: { color: Colors.onPrimary, fontSize: 20, fontWeight: '600' },
  limitMsg: { color: Colors.success, fontSize: 13, marginBottom: 8 },
  goalRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 66, paddingVertical: 9, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border },
  goalRowCompact: { minHeight: 48, gap: 7, paddingVertical: 6 },
  goalRowFeatured: { minHeight: 78, paddingVertical: 12 },
  goalRowCompleted: { opacity: 0.55 },
  goalNum: { fontSize: 16, fontWeight: '700', color: Colors.textSecondary, width: 20 },
  goalNumFeatured: { width: 34, fontSize: 28, lineHeight: 32, color: Colors.primary },
  letterChip: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  letterChipText: { color: '#fffef8', fontSize: 13, fontWeight: '800' },
  checkbox: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: Colors.border, justifyContent: 'center', alignItems: 'center' },
  checkboxDone: { backgroundColor: Colors.success, borderColor: Colors.success },
  goalTextButton: { flex: 1, minWidth: 0, paddingVertical: 4 },
  goalText: { fontSize: 15, lineHeight: 20, color: Colors.text, fontWeight: '600' },
  goalTextFeatured: { fontSize: 18, lineHeight: 24, fontWeight: '800' },
  goalHint: { color: Colors.textSecondary, fontSize: 11, marginTop: 3 },
  goalTextDone: { textDecorationLine: 'line-through', color: Colors.textSecondary },
  empty: { textAlign: 'center', color: Colors.textSecondary, paddingVertical: 24 },
  errorText: { color: Colors.danger, fontSize: 13, marginBottom: 10 },
  undoBanner: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: Colors.successLight, paddingHorizontal: 12, marginBottom: 12 },
  undoText: { flex: 1, color: Colors.text, fontSize: 13, fontWeight: '600' },
  undoAction: { color: Colors.primary, fontSize: 13, fontWeight: '800' },
});
