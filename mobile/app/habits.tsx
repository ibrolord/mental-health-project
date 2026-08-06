import { useEffect, useRef, useState } from 'react';
import { Feather } from '@expo/vector-icons';
import {
  Alert,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { format } from 'date-fns';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  AppButton,
  AppCard,
  AppInput,
  AppScreen,
  ChoiceChip,
  EmptyState,
  PageHeader,
  SectionHeader,
  Stat,
  appUiStyles,
} from '@/components/AppUI';
import { useDataContext } from '@/lib/hooks/use-data-context';
import { supabase } from '@/lib/supabase';
import {
  HABIT_CATEGORIES,
  ROUTINE_TEMPLATES,
  createHabitDedupeKey,
  habitMomentum,
  isUnexpectedHabitInsertError,
  isRewardUnlocked,
  type HabitCategory,
  type HabitDraft,
  type HabitType,
  type RoutineSlot,
  type RoutineTemplate,
} from '@/lib/wellbeing/habits';
import { Colors } from '@/lib/constants';

type Habit = {
  id: string;
  user_id: string | null;
  name: string;
  description: string | null;
  habit_type: HabitType;
  category: HabitCategory;
  icon: string;
  cue: string;
  tiny_step: string;
  routine_slot: RoutineSlot;
  reward: string;
  reward_target: number;
  streak_count: number;
  best_streak: number;
  total_completions: number;
  accountability_enabled: boolean;
  accountability_days: number[];
  accountability_timezone: string;
  accountability_share_streak: boolean;
  is_active: boolean;
  created_at: string;
};

const HABIT_SELECT =
  'id, user_id, name, description, habit_type, category, icon, cue, tiny_step, routine_slot, reward, reward_target, streak_count, best_streak, total_completions, accountability_enabled, accountability_days, accountability_timezone, accountability_share_streak, is_active, created_at';

const SLOTS: { id: RoutineSlot; label: string }[] = [
  { id: 'morning', label: 'Morning' },
  { id: 'afternoon', label: 'Afternoon' },
  { id: 'evening', label: 'Night' },
  { id: 'anytime', label: 'Anytime' },
];

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function firstParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? '' : value ?? '';
}

function iconName(value: string): keyof typeof Feather.glyphMap {
  const supported: Record<string, keyof typeof Feather.glyphMap> = {
    activity: 'activity',
    'alarm-clock': 'clock',
    apple: 'heart',
    book: 'book',
    calendar: 'calendar',
    'calendar-heart': 'calendar',
    circle: 'circle',
    coffee: 'coffee',
    droplets: 'droplet',
    focus: 'target',
    home: 'home',
    moon: 'moon',
    notebook: 'edit-3',
    play: 'play',
    shield: 'shield',
    sparkles: 'star',
    target: 'target',
    timer: 'clock',
    users: 'users',
    wind: 'wind',
  };
  return supported[value] ?? 'check-circle';
}

function blankDraft(): HabitDraft {
  return {
    name: '',
    description: '',
    habitType: 'build',
    category: 'wellbeing',
    icon: 'sparkles',
    cue: '',
    tinyStep: '',
    routineSlot: 'anytime',
    reward: '',
    rewardTarget: 7,
    evidenceIds: ['habit-repetition', 'implementation-intentions'],
  };
}

export default function HabitsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    source?: string | string[];
    name?: string | string[];
    description?: string | string[];
    bookTitle?: string | string[];
    itemTitle?: string | string[];
    view?: string | string[];
    template?: string | string[];
  }>();
  const { context, authLoading } = useDataContext();
  const [habits, setHabits] = useState<Habit[]>([]);
  const [logs, setLogs] = useState<Record<string, boolean>>({});
  const [slot, setSlot] = useState<RoutineSlot | 'all'>('all');
  const [editorOpen, setEditorOpen] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [draft, setDraft] = useState<HabitDraft>(blankDraft);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [installingId, setInstallingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [sourceTitle, setSourceTitle] = useState('');
  const [selectedRoutineId, setSelectedRoutineId] = useState('');
  const ownerRef = useRef(context.user_id);
  const createRef = useRef(false);
  const appliedLibraryRef = useRef('');
  ownerRef.current = context.user_id;
  const today = format(new Date(), 'yyyy-MM-dd');

  useEffect(() => {
    if (authLoading) return;
    const ownerId = context.user_id;
    if (!ownerId) {
      setHabits([]);
      setLogs({});
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);
    setError('');
    void supabase
      .from('habits')
      .select(HABIT_SELECT)
      .eq('user_id', ownerId)
      .eq('is_active', true)
      .order('created_at', { ascending: true })
      .then(async ({ data, error: loadError }) => {
        if (!active || ownerRef.current !== ownerId) return;
        if (loadError) {
          setError('Your habits could not be loaded.');
          setHabits([]);
          setLogs({});
          setLoading(false);
          return;
        }

        const loaded = (data ?? []) as Habit[];
        setHabits(loaded);
        if (loaded.length === 0) {
          setLogs({});
          setLoading(false);
          return;
        }

        const { data: logRows, error: logError } = await supabase
          .from('habit_logs')
          .select('habit_id, completed')
          .in(
            'habit_id',
            loaded.map((habit) => habit.id)
          )
          .eq('log_date', today);
        if (!active || ownerRef.current !== ownerId) return;
        if (logError) {
          setError('Today’s habit check-ins could not be loaded.');
        } else {
          setLogs(
            Object.fromEntries(
              (logRows ?? []).map((row) => [row.habit_id, row.completed])
            )
          );
        }
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [authLoading, context.user_id, today]);

  useEffect(() => {
    if (firstParam(params.source) !== 'library') {
      appliedLibraryRef.current = '';
      return;
    }
    const routineId = firstParam(params.template).trim();
    if (
      firstParam(params.view) === 'routines' &&
      ROUTINE_TEMPLATES.some(({ id }) => id === routineId)
    ) {
      const bookTitle = (
        firstParam(params.itemTitle) || firstParam(params.bookTitle)
      )
        .trim()
        .slice(0, 200);
      const identity = `routine\u0000${routineId}\u0000${bookTitle}`;
      if (appliedLibraryRef.current === identity) return;
      appliedLibraryRef.current = identity;
      setSourceTitle(bookTitle || 'the library');
      setSelectedRoutineId(routineId);
      setTemplatesOpen(true);
      setEditorOpen(false);
      return;
    }
    const name = firstParam(params.name).trim().slice(0, 160);
    if (!name) return;
    const description = firstParam(params.description).trim().slice(0, 500);
    const bookTitle = firstParam(params.bookTitle).trim().slice(0, 200);
    const identity = `${name}\u0000${description}\u0000${bookTitle}`;
    if (appliedLibraryRef.current === identity) return;
    appliedLibraryRef.current = identity;
    setDraft((current) => ({
      ...current,
      name,
      description,
      tinyStep: description,
      category: 'wellbeing',
      icon: 'book',
    }));
    setSourceTitle(bookTitle);
    setEditorOpen(true);
  }, [
    params.bookTitle,
    params.description,
    params.itemTitle,
    params.name,
    params.source,
    params.template,
    params.view,
  ]);

  const rowForDraft = (item: HabitDraft, ownerId: string) => ({
    user_id: ownerId,
    session_id: null,
    name: item.name.trim(),
    description: item.description.trim() || null,
    frequency: 'daily',
    habit_type: item.habitType,
    category: item.category,
    icon: item.icon,
    cue: item.cue.trim(),
    tiny_step: item.tinyStep.trim(),
    routine_slot: item.routineSlot,
    reward: item.reward.trim(),
    reward_target: Math.max(1, Math.min(365, item.rewardTarget)),
    dedupe_key: createHabitDedupeKey(item.name, item.routineSlot),
    accountability_timezone:
      Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
  });

  const createHabit = async () => {
    const ownerId = context.user_id;
    if (!ownerId || !draft.name.trim() || createRef.current) return;
    createRef.current = true;
    setSaving(true);
    setError('');
    try {
      const { data, error: createError } = await supabase
        .from('habits')
        .insert(rowForDraft(draft, ownerId))
        .select(HABIT_SELECT)
        .single();
      if (ownerRef.current !== ownerId) return;
      if (createError) {
        setError(
          createError.code === '23505'
            ? 'That habit is already active in this routine.'
            : 'This habit could not be saved.'
        );
        return;
      }
      setHabits((current) => [...current, data as Habit]);
      setDraft(blankDraft());
      setSourceTitle('');
      setEditorOpen(false);
    } finally {
      createRef.current = false;
      if (ownerRef.current === ownerId) setSaving(false);
    }
  };

  const installTemplate = async (template: RoutineTemplate) => {
    const ownerId = context.user_id;
    if (!ownerId || installingId) return;
    setInstallingId(template.id);
    setError('');
    try {
      const results = await Promise.all(
        template.items.map((item) =>
          supabase
            .from('habits')
            .insert(rowForDraft(item, ownerId))
            .select(HABIT_SELECT)
            .single()
        )
      );
      if (ownerRef.current !== ownerId) return;
      const created = results
        .filter(({ data }) => Boolean(data))
        .map(({ data }) => data as Habit);
      if (created.length > 0) {
        setHabits((current) => {
          const known = new Set(current.map(({ id }) => id));
          return [...current, ...created.filter(({ id }) => !known.has(id))];
        });
      }
      const failures = results.filter(({ error }) =>
        isUnexpectedHabitInsertError(error)
      );
      if (failures.length > 0) {
        setError('Some routine items could not be added.');
      } else if (created.length === 0) {
        setError('That routine is already installed.');
      } else {
        setTemplatesOpen(false);
        setSlot(template.slot);
      }
    } finally {
      if (ownerRef.current === ownerId) setInstallingId(null);
    }
  };

  const toggleHabit = async (habit: Habit) => {
    const ownerId = context.user_id;
    if (!ownerId) return;
    const previous = Boolean(logs[habit.id]);
    const next = !previous;
    setLogs((current) => ({ ...current, [habit.id]: next }));
    setError('');
    const { error: logError } = await supabase
      .from('habit_logs')
      .upsert(
        { habit_id: habit.id, log_date: today, completed: next },
        { onConflict: 'habit_id,log_date' }
      );
    if (ownerRef.current !== ownerId) return;
    if (logError) {
      setLogs((current) => ({ ...current, [habit.id]: previous }));
      setError('That check-in was not saved.');
      return;
    }

    const { data } = await supabase
      .from('habits')
      .select(HABIT_SELECT)
      .eq('id', habit.id)
      .eq('user_id', ownerId)
      .single();
    if (ownerRef.current === ownerId && data) {
      setHabits((current) =>
        current.map((candidate) =>
          candidate.id === habit.id ? (data as Habit) : candidate
        )
      );
    }
  };

  const updateAccountability = async (
    habit: Habit,
    patch: Partial<
      Pick<
        Habit,
        | 'accountability_enabled'
        | 'accountability_days'
        | 'accountability_share_streak'
      >
    >
  ) => {
    const ownerId = context.user_id;
    if (!ownerId) return;
    const previous = habit;
    setHabits((current) =>
      current.map((candidate) =>
        candidate.id === habit.id ? { ...candidate, ...patch } : candidate
      )
    );
    const { data, error: updateError } = await supabase
      .from('habits')
      .update({
        ...patch,
        accountability_timezone:
          Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      })
      .eq('id', habit.id)
      .eq('user_id', ownerId)
      .select(HABIT_SELECT)
      .single();
    if (ownerRef.current !== ownerId) return;
    if (updateError || !data) {
      setHabits((current) =>
        current.map((candidate) =>
          candidate.id === habit.id ? previous : candidate
        )
      );
      setError('Those accountability settings were not changed.');
      return;
    }
    setHabits((current) =>
      current.map((candidate) =>
        candidate.id === habit.id ? (data as Habit) : candidate
      )
    );
  };

  const archiveHabit = (habit: Habit) => {
    const ownerId = context.user_id;
    if (!ownerId) return;
    Alert.alert('Archive habit?', 'Its history will be kept.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Archive',
        onPress: async () => {
          const { error: archiveError } = await supabase
            .from('habits')
            .update({ is_active: false })
            .eq('id', habit.id)
            .eq('user_id', ownerId);
          if (ownerRef.current !== ownerId) return;
          if (archiveError) {
            setError('That habit could not be archived.');
          } else {
            setHabits((current) =>
              current.filter((candidate) => candidate.id !== habit.id)
            );
            setLogs((current) => {
              const nextLogs = { ...current };
              delete nextLogs[habit.id];
              return nextLogs;
            });
          }
        },
      },
    ]);
  };

  const visibleHabits = habits.filter(
    (habit) => slot === 'all' || habit.routine_slot === slot
  );
  const completedToday = habits.filter((habit) => logs[habit.id]).length;
  const momentum = habitMomentum(
    habits.reduce((sum, habit) => sum + habit.total_completions, 0),
    Math.max(0, ...habits.map((habit) => habit.streak_count)),
    Math.max(0, ...habits.map((habit) => habit.best_streak))
  );

  const openBlankHabitEditor = () => {
    setDraft(blankDraft());
    setSourceTitle('');
    setSelectedRoutineId('');
    setTemplatesOpen(false);
    setEditorOpen(true);
  };

  return (
    <AppScreen>
      <PageHeader
        eyebrow="Habits and routines"
        title="Build momentum without all-or-nothing rules."
        description="Use a tiny step, a clear cue, and streaks that help you learn rather than judge yourself."
        icon="repeat"
        action={
          <AppButton
            label={editorOpen ? 'Close' : 'Add'}
            icon={editorOpen ? 'x' : 'plus'}
            variant="quiet"
            onPress={() => {
              if (editorOpen) {
                setDraft(blankDraft());
                setSourceTitle('');
                setEditorOpen(false);
              } else {
                openBlankHabitEditor();
              }
            }}
          />
        }
      />

      <AppCard style={styles.momentumCard}>
        <View style={styles.stats}>
          <Stat label="Momentum level" value={momentum.level} />
          <Stat label="Completed today" value={`${completedToday}/${habits.length}`} />
          <Stat label="Total XP" value={momentum.xp} />
        </View>
        <View style={styles.levelTrack}>
          <View
            style={[styles.levelFill, { width: `${momentum.levelProgress}%` }]}
          />
        </View>
      </AppCard>

      <View style={styles.topActions}>
        <AppButton
          label={templatesOpen ? 'Hide routines' : 'Routine templates'}
          icon="layers"
          variant="secondary"
          onPress={() => setTemplatesOpen((current) => !current)}
          style={{ flex: 1 }}
        />
        <AppButton
          label="Partners"
          icon="users"
          variant="secondary"
          onPress={() => router.push('/partner')}
        />
      </View>

      {templatesOpen ? (
        <>
          <SectionHeader
            title="Start from a routine"
            description="Install only what fits. Duplicate items are skipped."
          />
          {sourceTitle && selectedRoutineId ? (
            <AppCard style={styles.libraryRoutineNotice}>
              <Text style={styles.libraryRoutineNoticeText}>
                Suggested from {sourceTitle}. Review the sequence and install only what fits.
              </Text>
            </AppCard>
          ) : null}
          {[...ROUTINE_TEMPLATES]
            .sort(
              (left, right) =>
                Number(right.id === selectedRoutineId) -
                Number(left.id === selectedRoutineId)
            )
            .map((template) => (
            <AppCard
              key={template.id}
              style={template.id === selectedRoutineId ? styles.selectedTemplate : undefined}
            >
              <Text style={appUiStyles.label}>{template.eyebrow}</Text>
              <Text style={styles.templateTitle}>{template.title}</Text>
              <Text style={[appUiStyles.muted, { marginTop: 6 }]}>
                {template.description}
              </Text>
              <View style={styles.templateItems}>
                {template.items.map((item) => (
                  <View key={item.name} style={styles.templateItem}>
                    <Feather
                      name={iconName(item.icon)}
                      size={15}
                      color={Colors.primary}
                    />
                    <Text style={styles.templateItemText}>{item.name}</Text>
                  </View>
                ))}
              </View>
              <AppButton
                label="Install routine"
                icon="plus"
                variant="quiet"
                loading={installingId === template.id}
                disabled={Boolean(installingId)}
                onPress={() => void installTemplate(template)}
                style={{ marginTop: 14 }}
              />
            </AppCard>
          ))}
        </>
      ) : null}

      {editorOpen ? (
        <AppCard>
          <SectionHeader
            title="Create a habit"
            description={
              sourceTitle
                ? `Suggested from ${sourceTitle}. Review before saving.`
                : 'Define the smallest version that still counts.'
            }
          />
          <AppInput
            label="Habit name"
            value={draft.name}
            onChangeText={(name) =>
              setDraft((current) => ({ ...current, name }))
            }
            maxLength={160}
            placeholder="Example: Walk for five minutes"
          />
          <Text style={styles.fieldLabel}>Build or reduce</Text>
          <View style={styles.chips}>
            <ChoiceChip
              label="Build"
              selected={draft.habitType === 'build'}
              onPress={() =>
                setDraft((current) => ({ ...current, habitType: 'build' }))
              }
            />
            <ChoiceChip
              label="Reduce"
              selected={draft.habitType === 'reduce'}
              onPress={() =>
                setDraft((current) => ({ ...current, habitType: 'reduce' }))
              }
            />
          </View>
          <Text style={[styles.fieldLabel, { marginTop: 16 }]}>Routine</Text>
          <View style={styles.chips}>
            {SLOTS.map((item) => (
              <ChoiceChip
                key={item.id}
                label={item.label}
                selected={draft.routineSlot === item.id}
                onPress={() =>
                  setDraft((current) => ({
                    ...current,
                    routineSlot: item.id,
                  }))
                }
              />
            ))}
          </View>
          <Text style={[styles.fieldLabel, { marginTop: 16 }]}>Category</Text>
          <View style={styles.chips}>
            {HABIT_CATEGORIES.map((category) => (
              <ChoiceChip
                key={category.id}
                label={category.label}
                selected={draft.category === category.id}
                onPress={() =>
                  setDraft((current) => ({
                    ...current,
                    category: category.id,
                    icon: category.icon,
                  }))
                }
              />
            ))}
          </View>
          <AppInput
            label="Cue"
            value={draft.cue}
            onChangeText={(cue) =>
              setDraft((current) => ({ ...current, cue }))
            }
            maxLength={240}
            placeholder="After I..."
            style={{ marginTop: 16 }}
          />
          <AppInput
            label="Tiny step"
            value={draft.tinyStep}
            onChangeText={(tinyStep) =>
              setDraft((current) => ({ ...current, tinyStep }))
            }
            maxLength={240}
            placeholder="The version I can do on a hard day"
          />
          <AppInput
            label="Why it matters (optional)"
            value={draft.description}
            onChangeText={(description) =>
              setDraft((current) => ({ ...current, description }))
            }
            maxLength={500}
            multiline
            placeholder="A short reason"
          />
          <AppInput
            label="Reward (optional)"
            value={draft.reward}
            onChangeText={(reward) =>
              setDraft((current) => ({ ...current, reward }))
            }
            maxLength={240}
            placeholder="After a consistent streak, I will..."
          />
          {draft.reward ? (
            <AppInput
              label="Unlock after this many days"
              value={String(draft.rewardTarget)}
              onChangeText={(value) =>
                setDraft((current) => ({
                  ...current,
                  rewardTarget: Math.max(
                    1,
                    Math.min(365, Number(value) || 1)
                  ),
                }))
              }
              keyboardType="number-pad"
            />
          ) : null}
          {error ? <Text style={appUiStyles.error}>{error}</Text> : null}
          <AppButton
            label="Save habit"
            icon="check"
            loading={saving}
            disabled={!draft.name.trim() || authLoading || !context.user_id}
            onPress={() => void createHabit()}
          />
        </AppCard>
      ) : null}

      <View style={styles.slotFilters}>
        <ChoiceChip
          label="All"
          selected={slot === 'all'}
          onPress={() => setSlot('all')}
        />
        {SLOTS.map((item) => (
          <ChoiceChip
            key={item.id}
            label={item.label}
            selected={slot === item.id}
            onPress={() => setSlot(item.id)}
          />
        ))}
      </View>

      {error && !editorOpen ? (
        <Text style={[appUiStyles.error, { marginBottom: 12 }]}>{error}</Text>
      ) : null}

      {loading ? (
        <Text style={appUiStyles.muted}>Loading your habits...</Text>
      ) : visibleHabits.length === 0 ? (
        <EmptyState
          icon="repeat"
          title="No habits in this routine"
          description="Create one small habit or install a routine template."
          action={
            <AppButton
              label="Create a habit"
              icon="plus"
              onPress={openBlankHabitEditor}
            />
          }
        />
      ) : (
        visibleHabits.map((habit) => {
          const done = Boolean(logs[habit.id]);
          const rewardUnlocked = isRewardUnlocked(
            habit.streak_count,
            habit.reward_target,
            habit.reward
          );
          return (
            <AppCard
              key={habit.id}
              style={done ? styles.habitDone : undefined}
            >
              <View style={styles.habitHeader}>
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: done }}
                  accessibilityLabel={`Mark ${habit.name} ${done ? 'not done' : 'done'} today`}
                  onPress={() => void toggleHabit(habit)}
                  style={[styles.check, done && styles.checkDone]}
                >
                  {done ? (
                    <Feather name="check" size={18} color="#fffef8" />
                  ) : (
                    <Feather
                      name={iconName(habit.icon)}
                      size={18}
                      color={Colors.primary}
                    />
                  )}
                </Pressable>
                <View style={{ flex: 1 }}>
                  <Text style={styles.habitMeta}>
                    {habit.habit_type === 'reduce' ? 'Reducing' : 'Building'} ·{' '}
                    {SLOTS.find(({ id }) => id === habit.routine_slot)?.label}
                  </Text>
                  <Text style={styles.habitTitle}>{habit.name}</Text>
                </View>
                <View style={styles.streakBox}>
                  <Text style={styles.streakValue}>{habit.streak_count}</Text>
                  <Text style={styles.streakLabel}>day streak</Text>
                </View>
              </View>
              {habit.cue || habit.tiny_step ? (
                <View style={styles.habitPlan}>
                  {habit.cue ? (
                    <Text style={styles.planText}>
                      <Text style={styles.planLabel}>Cue: </Text>
                      {habit.cue}
                    </Text>
                  ) : null}
                  {habit.tiny_step ? (
                    <Text style={styles.planText}>
                      <Text style={styles.planLabel}>Tiny step: </Text>
                      {habit.tiny_step}
                    </Text>
                  ) : null}
                </View>
              ) : null}
              {habit.reward ? (
                <View
                  style={[
                    styles.reward,
                    rewardUnlocked && styles.rewardUnlocked,
                  ]}
                >
                  <Feather
                    name={rewardUnlocked ? 'gift' : 'lock'}
                    size={16}
                    color={rewardUnlocked ? Colors.success : Colors.textSecondary}
                  />
                  <Text
                    style={[
                      styles.rewardText,
                      rewardUnlocked && { color: Colors.success },
                    ]}
                  >
                    {rewardUnlocked
                      ? `Unlocked: ${habit.reward}`
                      : `${habit.reward} at ${habit.reward_target} days`}
                  </Text>
                </View>
              ) : null}

              <View style={styles.accountabilityRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.accountabilityTitle}>
                    Partner check-ins
                  </Text>
                  <Text style={appUiStyles.muted}>
                    Share scheduled/completed counts, never the habit name.
                  </Text>
                </View>
                <Switch
                  value={habit.accountability_enabled}
                  onValueChange={(enabled) =>
                    void updateAccountability(habit, {
                      accountability_enabled: enabled,
                    })
                  }
                  trackColor={{ false: Colors.border, true: Colors.sage }}
                  thumbColor="#fffef8"
                />
              </View>
              {habit.accountability_enabled ? (
                <>
                  <View style={styles.days}>
                    {DAY_LABELS.map((label, day) => {
                      const selected = habit.accountability_days.includes(day);
                      return (
                        <Pressable
                          key={`${label}-${day}`}
                          accessibilityRole="checkbox"
                          accessibilityState={{ checked: selected }}
                          accessibilityLabel={`${label} ${selected ? 'selected' : 'not selected'}`}
                          onPress={() => {
                            const nextDays = selected
                              ? habit.accountability_days.filter(
                                  (candidate) => candidate !== day
                                )
                              : [...habit.accountability_days, day].sort();
                            if (nextDays.length > 0) {
                              void updateAccountability(habit, {
                                accountability_days: nextDays,
                              });
                            }
                          }}
                          style={[
                            styles.day,
                            selected && styles.daySelected,
                          ]}
                        >
                          <Text
                            style={[
                              styles.dayText,
                              selected && styles.dayTextSelected,
                            ]}
                          >
                            {label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                  <Pressable
                    accessibilityRole="checkbox"
                    accessibilityState={{
                      checked: habit.accountability_share_streak,
                    }}
                    onPress={() =>
                      void updateAccountability(habit, {
                        accountability_share_streak:
                          !habit.accountability_share_streak,
                      })
                    }
                    style={styles.shareStreak}
                  >
                    <Feather
                      name={
                        habit.accountability_share_streak
                          ? 'check-square'
                          : 'square'
                      }
                      size={17}
                      color={Colors.primary}
                    />
                    <Text style={styles.shareStreakText}>
                      Include the streak count
                    </Text>
                  </Pressable>
                </>
              ) : null}

              <View style={styles.habitFooter}>
                <Text style={styles.history}>
                  Best {habit.best_streak} days · {habit.total_completions} total
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Archive ${habit.name}`}
                  onPress={() => archiveHabit(habit)}
                  style={styles.archiveButton}
                >
                  <Feather name="archive" size={15} color={Colors.textSecondary} />
                  <Text style={styles.archiveText}>Archive</Text>
                </Pressable>
              </View>
            </AppCard>
          );
        })
      )}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  momentumCard: { backgroundColor: Colors.primaryLight },
  stats: { flexDirection: 'row', gap: 12 },
  levelTrack: {
    height: 7,
    borderRadius: 7,
    backgroundColor: Colors.border,
    overflow: 'hidden',
    marginTop: 15,
  },
  levelFill: { height: '100%', backgroundColor: Colors.accent },
  topActions: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  libraryRoutineNotice: {
    backgroundColor: Colors.successLight,
    borderColor: Colors.success,
  },
  libraryRoutineNoticeText: {
    color: Colors.text,
    fontSize: 13,
    lineHeight: 19,
  },
  selectedTemplate: {
    borderColor: Colors.primary,
    borderWidth: 2,
  },
  templateTitle: {
    color: Colors.text,
    fontSize: 20,
    lineHeight: 25,
    fontWeight: '700',
    marginTop: 5,
  },
  templateItems: { gap: 7, marginTop: 13 },
  templateItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  templateItemText: { color: Colors.text, fontSize: 13, flex: 1 },
  fieldLabel: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  slotFilters: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
    marginBottom: 16,
  },
  habitDone: {
    backgroundColor: Colors.successLight,
    borderColor: '#b8d8c5',
  },
  habitHeader: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  check: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkDone: { backgroundColor: Colors.success, borderColor: Colors.success },
  habitMeta: {
    color: Colors.accent,
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  habitTitle: {
    color: Colors.text,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '700',
    marginTop: 3,
  },
  streakBox: { alignItems: 'center', minWidth: 60 },
  streakValue: {
    color: Colors.text,
    fontSize: 22,
    lineHeight: 25,
    fontWeight: '700',
  },
  streakLabel: { color: Colors.textSecondary, fontSize: 9 },
  habitPlan: {
    borderRadius: 12,
    backgroundColor: 'rgba(255,254,248,0.75)',
    padding: 12,
    gap: 5,
    marginTop: 13,
  },
  planText: { color: Colors.textSecondary, fontSize: 12, lineHeight: 18 },
  planLabel: { color: Colors.text, fontWeight: '700' },
  reward: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 11,
    backgroundColor: Colors.primaryLight,
    padding: 11,
    marginTop: 10,
  },
  rewardUnlocked: { backgroundColor: Colors.successLight },
  rewardText: { flex: 1, color: Colors.textSecondary, fontSize: 12 },
  accountabilityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    marginTop: 15,
    paddingTop: 14,
  },
  accountabilityTitle: { color: Colors.text, fontSize: 13, fontWeight: '700' },
  days: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 5,
    marginTop: 12,
  },
  day: {
    width: 35,
    height: 35,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.card,
  },
  daySelected: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  dayText: { color: Colors.primary, fontSize: 11, fontWeight: '700' },
  dayTextSelected: { color: '#fffef8' },
  shareStreak: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 7,
  },
  shareStreakText: { color: Colors.text, fontSize: 12 },
  habitFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginTop: 11,
  },
  history: { color: Colors.textSecondary, fontSize: 10 },
  archiveButton: { flexDirection: 'row', alignItems: 'center', gap: 5, padding: 7 },
  archiveText: { color: Colors.textSecondary, fontSize: 11 },
});
