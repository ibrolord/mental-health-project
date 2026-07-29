'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import {
  Archive,
  Bell,
  Check,
  ChevronRight,
  Flame,
  Gift,
  HeartHandshake,
  Layers3,
  Plus,
  RotateCcw,
  Trophy,
} from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { DismissibleNotice } from '@/components/dismissible-notice';
import { HabitIcon } from '@/components/habit-icon';
import { PushNotificationSettings } from '@/components/push-notification-settings';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import {
  HABIT_CATEGORIES,
  ROUTINE_TEMPLATES,
  createHabitDedupeKey,
  habitMomentum,
  isRewardUnlocked,
  type HabitCategory,
  type HabitDraft,
  type HabitType,
  type RoutineSlot,
} from '@/lib/wellbeing/habits';
import {
  accountabilityDaysForPreset,
  accountabilityPresetForDays,
  type AccountabilityPreset,
} from '@/lib/wellbeing/habit-accountability';

type Habit = {
  id: string;
  name: string;
  description: string | null;
  streak_count: number;
  habit_type: HabitType;
  category: HabitCategory;
  icon: string;
  cue: string;
  tiny_step: string;
  routine_slot: RoutineSlot;
  reward: string;
  reward_target: number;
  best_streak: number;
  total_completions: number;
  dedupe_key: string | null;
  accountability_enabled: boolean;
  accountability_days: number[];
  accountability_timezone: string;
  accountability_share_streak: boolean;
};

type Reminder = {
  id: string;
  habit_id: string | null;
  local_time: string | null;
  days_of_week: number[];
  enabled: boolean;
};

type View = 'today' | 'routines' | 'create';
type DayPreset = 'daily' | 'weekdays' | 'weekends';

const SLOT_ORDER: RoutineSlot[] = ['morning', 'afternoon', 'evening', 'anytime'];
const HABIT_SELECT_COLUMNS =
  'id, name, description, streak_count, habit_type, category, icon, cue, tiny_step, routine_slot, reward, reward_target, best_streak, total_completions, dedupe_key, accountability_enabled, accountability_days, accountability_timezone, accountability_share_streak';
const SLOT_LABELS: Record<RoutineSlot, string> = {
  morning: 'Morning',
  afternoon: 'Afternoon',
  evening: 'Night',
  anytime: 'Anytime',
};
const DAY_PRESETS: Record<DayPreset, number[]> = {
  daily: [0, 1, 2, 3, 4, 5, 6],
  weekdays: [1, 2, 3, 4, 5],
  weekends: [0, 6],
};
const WEEKDAY_OPTIONS = [
  ['0', 'Sunday'],
  ['1', 'Monday'],
  ['2', 'Tuesday'],
  ['3', 'Wednesday'],
  ['4', 'Thursday'],
  ['5', 'Friday'],
  ['6', 'Saturday'],
] as const;

const EMPTY_DRAFT: HabitDraft = {
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

function reminderPreset(days: number[]): DayPreset {
  const key = JSON.stringify([...days].sort());
  return (
    (Object.entries(DAY_PRESETS).find(
      ([, presetDays]) => JSON.stringify(presetDays) === key
    )?.[0] as DayPreset | undefined) ?? 'daily'
  );
}

export default function HabitsPage() {
  const { user, isAnonymous, loading: authLoading } = useAuth();
  const [view, setView] = useState<View>('today');
  const [habits, setHabits] = useState<Habit[]>([]);
  const [logs, setLogs] = useState<Record<string, boolean>>({});
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [draft, setDraft] = useState<HabitDraft>(EMPTY_DRAFT);
  const [librarySourceTitle, setLibrarySourceTitle] = useState('');
  const [busyHabitIds, setBusyHabitIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [installingTemplate, setInstallingTemplate] = useState('');
  const [reminderHabitId, setReminderHabitId] = useState('');
  const [reminderTime, setReminderTime] = useState('09:00');
  const [reminderDays, setReminderDays] = useState<DayPreset>('daily');
  const [accountabilityHabitId, setAccountabilityHabitId] = useState('');
  const [accountabilityEnabled, setAccountabilityEnabled] = useState(false);
  const [accountabilityDays, setAccountabilityDays] =
    useState<AccountabilityPreset>('daily');
  const [accountabilityWeekday, setAccountabilityWeekday] = useState(1);
  const [accountabilityShareStreak, setAccountabilityShareStreak] =
    useState(true);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const addInFlightRef = useRef(false);
  const appliedLibraryActionRef = useRef(false);

  const loadHabits = async () => {
    if (!user) return;
    setError('');
    const { data, error: habitsError } = await supabase
      .from('habits')
      .select(HABIT_SELECT_COLUMNS)
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('created_at', { ascending: true });
    if (habitsError) {
      setError(habitsError.message);
      return;
    }

    const loadedHabits = (data ?? []) as Habit[];
    setHabits(loadedHabits);
    if (loadedHabits.length === 0) {
      setLogs({});
      setReminders([]);
      return;
    }

    const habitIds = loadedHabits.map((habit) => habit.id);
    const today = format(new Date(), 'yyyy-MM-dd');
    const [logsResult, remindersResult] = await Promise.all([
      supabase
        .from('habit_logs')
        .select('habit_id, completed')
        .in('habit_id', habitIds)
        .eq('log_date', today),
      supabase
        .from('wellbeing_reminders')
        .select('id, habit_id, local_time, days_of_week, enabled')
        .eq('user_id', user.id)
        .in('habit_id', habitIds),
    ]);
    if (logsResult.error || remindersResult.error) {
      setError(logsResult.error?.message ?? remindersResult.error?.message ?? '');
      return;
    }

    setLogs(
      Object.fromEntries(
        (logsResult.data ?? []).map((log) => [log.habit_id, log.completed])
      )
    );
    setReminders((remindersResult.data ?? []) as Reminder[]);
  };

  useEffect(() => {
    if (!authLoading && user) void loadHabits();
    // loadHabits is intentionally tied only to the authenticated owner.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user?.id]);

  useEffect(() => {
    if (appliedLibraryActionRef.current || typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('source') !== 'library') return;
    const name = params.get('name')?.trim().slice(0, 160) ?? '';
    if (!name) return;

    appliedLibraryActionRef.current = true;
    setDraft((current) => ({
      ...current,
      name,
      description: params.get('description')?.trim().slice(0, 500) ?? '',
    }));
    setLibrarySourceTitle(
      params.get('itemTitle')?.slice(0, 200) ??
        params.get('bookTitle')?.slice(0, 200) ??
        'the library'
    );
    setView('create');
    window.history.replaceState({}, '', window.location.pathname);
  }, []);

  const setBusy = (habitId: string, busy: boolean) => {
    setBusyHabitIds((current) => {
      const next = new Set(current);
      if (busy) next.add(habitId);
      else next.delete(habitId);
      return next;
    });
  };

  const toggleHabit = async (habit: Habit) => {
    if (busyHabitIds.has(habit.id)) return;
    setBusy(habit.id, true);
    setError('');
    const nextCompleted = !(logs[habit.id] ?? false);
    const today = format(new Date(), 'yyyy-MM-dd');

    const { error: logError } = await supabase.from('habit_logs').upsert(
      {
        habit_id: habit.id,
        completed: nextCompleted,
        log_date: today,
      },
      { onConflict: 'habit_id,log_date' }
    );
    if (logError) {
      setError(logError.message);
      setBusy(habit.id, false);
      return;
    }

    setLogs((current) => ({ ...current, [habit.id]: nextCompleted }));
    const { data: updated } = await supabase
      .from('habits')
      .select('streak_count, best_streak, total_completions')
      .eq('id', habit.id)
      .single();
    if (updated) {
      setHabits((current) =>
        current.map((item) => (item.id === habit.id ? { ...item, ...updated } : item))
      );
    }
    setBusy(habit.id, false);
  };

  const addHabit = async () => {
    if (!user || !draft.name.trim() || addInFlightRef.current) return;
    addInFlightRef.current = true;
    setSaving(true);
    setError('');
    setStatus('');

    const category = HABIT_CATEGORIES.find((item) => item.id === draft.category);
    const payload = {
      user_id: user.id,
      session_id: null,
      name: draft.name.trim().slice(0, 160),
      description: draft.description.trim().slice(0, 500) || null,
      frequency: 'daily',
      habit_type: draft.habitType,
      category: draft.category,
      icon: category?.icon ?? draft.icon,
      cue: draft.cue.trim().slice(0, 240),
      tiny_step: draft.tinyStep.trim().slice(0, 240),
      routine_slot: draft.routineSlot,
      reward: draft.reward.trim().slice(0, 240),
      reward_target: Math.max(1, Math.min(365, draft.rewardTarget)),
      dedupe_key: createHabitDedupeKey(draft.name, draft.routineSlot),
    };
    const { data: insertedHabit, error: insertError } = await supabase
      .from('habits')
      .insert(payload)
      .select(HABIT_SELECT_COLUMNS)
      .single();
    if (insertError) {
      setError(
        insertError.code === '23505'
          ? 'That habit is already active in this routine.'
          : insertError.message
      );
    } else {
      const createdHabit = insertedHabit as Habit;
      setHabits((current) =>
        current.some((habit) => habit.id === createdHabit.id)
          ? current
          : [...current, createdHabit]
      );
      setLogs((current) => ({ ...current, [createdHabit.id]: false }));
      setDraft(EMPTY_DRAFT);
      setLibrarySourceTitle('');
      setStatus('Habit added. Start with the smallest version on a difficult day.');
      setView('today');
    }
    setSaving(false);
    addInFlightRef.current = false;
  };

  const installRoutine = async (templateId: string) => {
    if (!user || installingTemplate) return;
    const template = ROUTINE_TEMPLATES.find((item) => item.id === templateId);
    if (!template) return;
    setInstallingTemplate(templateId);
    setError('');
    setStatus('');
    let added = 0;
    let existing = 0;
    const insertedHabits: Habit[] = [];

    for (const item of template.items) {
      const { data: insertedHabit, error: insertError } = await supabase
        .from('habits')
        .insert({
          user_id: user.id,
          session_id: null,
          name: item.name,
          description: item.description,
          frequency: 'daily',
          habit_type: item.habitType,
          category: item.category,
          icon: item.icon,
          cue: item.cue,
          tiny_step: item.tinyStep,
          routine_slot: item.routineSlot,
          reward: item.reward,
          reward_target: item.rewardTarget,
          dedupe_key: createHabitDedupeKey(item.name, item.routineSlot),
        })
        .select(HABIT_SELECT_COLUMNS)
        .single();
      if (!insertError && insertedHabit) {
        insertedHabits.push(insertedHabit as Habit);
        added += 1;
      } else if (insertError?.code === '23505') existing += 1;
      else {
        setError(insertError?.message ?? 'The habit could not be added.');
        break;
      }
    }

    if (insertedHabits.length > 0) {
      setHabits((current) => {
        const existingIds = new Set(current.map((habit) => habit.id));
        return [
          ...current,
          ...insertedHabits.filter((habit) => !existingIds.has(habit.id)),
        ];
      });
      setLogs((current) => ({
        ...current,
        ...Object.fromEntries(insertedHabits.map((habit) => [habit.id, false])),
      }));
    }
    setStatus(
      `${added} step${added === 1 ? '' : 's'} added${
        existing ? `; ${existing} already in your routine` : ''
      }.`
    );
    setInstallingTemplate('');
    if (added > 0) setView('today');
  };

  const archiveHabit = async (habitId: string) => {
    setBusy(habitId, true);
    setError('');
    const reminder = reminders.find((item) => item.habit_id === habitId);
    if (reminder) {
      const { error: reminderError } = await supabase
        .from('wellbeing_reminders')
        .delete()
        .eq('id', reminder.id);
      if (reminderError) {
        setError(
          `The habit was not archived because its reminder could not be removed: ${reminderError.message}`
        );
        setBusy(habitId, false);
        return;
      }
    }
    const { error: archiveError } = await supabase
      .from('habits')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', habitId);
    if (archiveError) setError(archiveError.message);
    else {
      setHabits((current) => current.filter((habit) => habit.id !== habitId));
      setReminders((current) =>
        current.filter((item) => item.habit_id !== habitId)
      );
      setStatus('Habit archived. Its history remains in your export.');
    }
    setBusy(habitId, false);
  };

  const openReminder = (habitId: string) => {
    const existing = reminders.find((reminder) => reminder.habit_id === habitId);
    setReminderHabitId((current) => (current === habitId ? '' : habitId));
    if (existing?.local_time) setReminderTime(existing.local_time.slice(0, 5));
    if (existing) setReminderDays(reminderPreset(existing.days_of_week));
    setAccountabilityHabitId('');
  };

  const openAccountability = (habit: Habit) => {
    const nextOpen = accountabilityHabitId !== habit.id;
    setAccountabilityHabitId(nextOpen ? habit.id : '');
    setReminderHabitId('');
    if (!nextOpen) return;
    setAccountabilityEnabled(habit.accountability_enabled);
    setAccountabilityDays(
      accountabilityPresetForDays(habit.accountability_days)
    );
    setAccountabilityWeekday(habit.accountability_days[0] ?? 1);
    setAccountabilityShareStreak(habit.accountability_share_streak);
  };

  const saveAccountability = async (habit: Habit) => {
    if (!user || isAnonymous) return;
    setBusy(habit.id, true);
    setError('');
    const days = accountabilityDaysForPreset(
      accountabilityDays,
      accountabilityWeekday
    );
    const update = {
      accountability_enabled: accountabilityEnabled,
      accountability_days: days,
      accountability_timezone:
        Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      accountability_share_streak:
        accountabilityEnabled && accountabilityShareStreak,
      updated_at: new Date().toISOString(),
    };
    const { error: updateError } = await supabase
      .from('habits')
      .update(update)
      .eq('id', habit.id);
    if (updateError) {
      setError('Accountability settings could not be saved.');
    } else {
      setHabits((current) =>
        current.map((item) =>
          item.id === habit.id ? { ...item, ...update } : item
        )
      );
      setAccountabilityHabitId('');
      setStatus(
        accountabilityEnabled
          ? 'Accountability check-ins are on.'
          : 'Accountability sharing is off for this habit.'
      );
    }
    setBusy(habit.id, false);
  };

  const saveReminder = async (habit: Habit) => {
    if (!user) return;
    setBusy(habit.id, true);
    setError('');
    const existing = reminders.find((reminder) => reminder.habit_id === habit.id);
    const payload = {
      user_id: user.id,
      habit_id: habit.id,
      kind: 'habit' as const,
      label: habit.name.slice(0, 160),
      route: '/habits',
      enabled: true,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      days_of_week: DAY_PRESETS[reminderDays],
      local_time: reminderTime,
      scheduled_at: null,
      updated_at: new Date().toISOString(),
    };
    const result = existing
      ? await supabase.from('wellbeing_reminders').update(payload).eq('id', existing.id)
      : await supabase.from('wellbeing_reminders').insert(payload);
    if (result.error) {
      setError(
        result.error.code === '23505'
          ? 'That habit already has a reminder. Reload and update the existing reminder.'
          : 'The reminder could not be saved. Please try again.'
      );
    } else {
      setStatus('Reminder saved. Enable background reminders on this device to receive it.');
      setReminderHabitId('');
      await loadHabits();
    }
    setBusy(habit.id, false);
  };

  const removeReminder = async (habit: Habit) => {
    const existing = reminders.find((reminder) => reminder.habit_id === habit.id);
    if (!existing) return;
    setBusy(habit.id, true);
    const { error: removeError } = await supabase
      .from('wellbeing_reminders')
      .delete()
      .eq('id', existing.id);
    if (removeError) setError(removeError.message);
    else {
      setReminders((current) => current.filter((item) => item.id !== existing.id));
      setReminderHabitId('');
      setStatus('Reminder removed.');
    }
    setBusy(habit.id, false);
  };

  const completedToday = habits.filter((habit) => logs[habit.id]).length;
  const totals = habits.reduce(
    (summary, habit) => ({
      completions: summary.completions + habit.total_completions,
      current: Math.max(summary.current, habit.streak_count),
      best: Math.max(summary.best, habit.best_streak),
    }),
    { completions: 0, current: 0, best: 0 }
  );
  const momentum = habitMomentum(totals.completions, totals.current, totals.best);

  return (
    <main className="px-4 py-8 md:px-8 md:py-12">
      <div className="mx-auto max-w-5xl">
        <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              <Flame className="h-3.5 w-3.5" aria-hidden="true" />
              Habits & routines
            </div>
            <h1 className="font-display text-4xl font-medium leading-[1.05] tracking-[-0.02em] text-foreground md:text-5xl">
              Build a system that survives a hard day.
            </h1>
            <p className="mt-4 max-w-xl text-base leading-relaxed text-muted-foreground">
              Use a clear cue, a tiny version, and repetition.
            </p>
          </div>
          <Button onClick={() => setView('create')} className="w-full sm:w-auto">
            <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
            New habit
          </Button>
        </header>

        <nav
          aria-label="Habit views"
          className="mt-8 grid grid-cols-3 rounded-2xl border border-border bg-card p-1"
        >
          {(
            [
              ['today', 'Today'],
              ['routines', 'Templates'],
              ['create', 'Create'],
            ] as Array<[View, string]>
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setView(id)}
              className={cn(
                'rounded-xl px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                view === id
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
              )}
            >
              {label}
            </button>
          ))}
        </nav>

        <div className="mt-4 flex flex-wrap gap-2 text-xs">
          <Link
            href="/focus"
            className="rounded-full border border-border bg-card px-3 py-1.5 text-muted-foreground hover:text-foreground"
          >
            Lock In focus
          </Link>
          <Link
            href="/mind-games"
            className="rounded-full border border-border bg-card px-3 py-1.5 text-muted-foreground hover:text-foreground"
          >
            Offline mind games
          </Link>
          <Link
            href="/planner"
            className="rounded-full border border-border bg-card px-3 py-1.5 text-muted-foreground hover:text-foreground"
          >
            Life planner
          </Link>
        </div>

        {(error || status) && (
          <div
            role={error ? 'alert' : 'status'}
            className={cn(
              'mt-5 rounded-xl border px-4 py-3 text-sm',
              error
                ? 'border-destructive/25 bg-destructive/5 text-destructive'
                : 'border-border bg-secondary text-foreground'
            )}
          >
            {error || status}
          </div>
        )}

        {view === 'today' && (
          <>
            <section className="mt-6 grid gap-3 md:grid-cols-[1.2fr_0.8fr]">
              <div className="app-panel p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                      Today
                    </p>
                    <p className="mt-1 font-display text-3xl text-foreground">
                      {completedToday}/{habits.length || 0}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Partial effort counts when it meets your tiny version.
                    </p>
                  </div>
                  <Check className="h-6 w-6 text-accent" aria-hidden="true" />
                </div>
                <div className="mt-4 h-2 overflow-hidden rounded-full bg-secondary">
                  <div
                    className="h-full rounded-full bg-accent transition-[width]"
                    style={{
                      width: `${
                        habits.length ? (completedToday / habits.length) * 100 : 0
                      }%`,
                    }}
                  />
                </div>
              </div>

              <div className="app-panel p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                      Momentum level
                    </p>
                    <p className="mt-1 font-display text-3xl text-foreground">
                      {momentum.level}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {momentum.xp} XP from showing up.
                    </p>
                  </div>
                  <Trophy className="h-6 w-6 text-accent" aria-hidden="true" />
                </div>
                <div className="mt-4 h-2 overflow-hidden rounded-full bg-secondary">
                  <div
                    className="h-full rounded-full bg-primary transition-[width]"
                    style={{ width: `${momentum.levelProgress}%` }}
                  />
                </div>
              </div>
            </section>

            {habits.length === 0 ? (
              <section className="app-panel mt-5 py-12 text-center">
                <Layers3 className="mx-auto h-7 w-7 text-muted-foreground" aria-hidden="true" />
                <h2 className="mt-4 font-display text-2xl text-foreground">
                  Start with one repeatable step.
                </h2>
                <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
                  Pick a template or create one.
                </p>
                <div className="mt-5 flex justify-center gap-2">
                  <Button variant="outline" onClick={() => setView('routines')}>
                    Browse templates
                  </Button>
                  <Button onClick={() => setView('create')}>Create one</Button>
                </div>
              </section>
            ) : (
              <div className="mt-6 space-y-8">
                {SLOT_ORDER.map((slot) => {
                  const slotHabits = habits.filter(
                    (habit) => habit.routine_slot === slot
                  );
                  if (slotHabits.length === 0) return null;
                  return (
                    <section key={slot}>
                      <div className="mb-3 flex items-center justify-between">
                        <h2 className="font-display text-2xl font-medium text-foreground">
                          {SLOT_LABELS[slot]}
                        </h2>
                        <span className="text-xs text-muted-foreground">
                          {slotHabits.filter((habit) => logs[habit.id]).length}/
                          {slotHabits.length}
                        </span>
                      </div>
                      <div className="space-y-3">
                        {slotHabits.map((habit) => {
                          const complete = logs[habit.id] ?? false;
                          const reminder = reminders.find(
                            (item) => item.habit_id === habit.id
                          );
                          const rewardUnlocked = isRewardUnlocked(
                            habit.streak_count,
                            habit.reward_target,
                            habit.reward
                          );
                          return (
                            <article
                              key={habit.id}
                              className={cn(
                                'app-panel overflow-hidden transition-colors',
                                complete && 'border-primary/25 bg-secondary/55'
                              )}
                            >
                              <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
                                <button
                                  type="button"
                                  onClick={() => void toggleHabit(habit)}
                                  disabled={busyHabitIds.has(habit.id)}
                                  aria-pressed={complete}
                                  className={cn(
                                    'flex min-w-0 flex-1 items-center gap-4 rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60',
                                    complete && 'text-primary'
                                  )}
                                >
                                  <span
                                    className={cn(
                                      'grid h-11 w-11 shrink-0 place-items-center rounded-xl border',
                                      complete
                                        ? 'border-primary bg-primary text-primary-foreground'
                                        : 'border-border bg-background text-foreground'
                                    )}
                                  >
                                    {complete ? (
                                      <Check className="h-5 w-5" aria-hidden="true" />
                                    ) : (
                                      <HabitIcon name={habit.icon} />
                                    )}
                                  </span>
                                  <span className="min-w-0">
                                    <span className="flex flex-wrap items-center gap-2">
                                      <span className="font-semibold text-foreground">
                                        {habit.name}
                                      </span>
                                      {habit.habit_type === 'reduce' && (
                                        <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-accent">
                                          Reduce
                                        </span>
                                      )}
                                      {rewardUnlocked && (
                                        <span className="inline-flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[0.65rem] font-semibold text-primary-foreground">
                                          <Gift className="h-3 w-3" aria-hidden="true" />
                                          Reward ready
                                        </span>
                                      )}
                                    </span>
                                    <span className="mt-1 block text-sm leading-relaxed text-muted-foreground">
                                      {habit.tiny_step ||
                                        habit.description ||
                                        (habit.habit_type === 'reduce'
                                          ? 'Mark today when you kept your plan.'
                                          : 'Mark today when the smallest version is done.')}
                                    </span>
                                    {habit.cue && (
                                      <span className="mt-1 block text-xs text-muted-foreground">
                                        Cue: {habit.cue}
                                      </span>
                                    )}
                                  </span>
                                </button>

                                <div className="flex items-center justify-between gap-3 border-t border-border pt-3 sm:border-l sm:border-t-0 sm:pl-4 sm:pt-0">
                                  <div className="min-w-[4.5rem] text-center">
                                    <p className="font-display text-2xl text-foreground">
                                      {habit.streak_count}
                                    </p>
                                    <p className="text-[0.65rem] uppercase tracking-[0.08em] text-muted-foreground">
                                      day run
                                    </p>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => openReminder(habit.id)}
                                    aria-label={`Set reminder for ${habit.name}`}
                                    className={cn(
                                      'grid h-9 w-9 place-items-center rounded-full border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                                      reminder
                                        ? 'border-primary/30 bg-secondary text-primary'
                                        : 'border-border bg-background text-muted-foreground'
                                    )}
                                  >
                                    <Bell className="h-4 w-4" aria-hidden="true" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => openAccountability(habit)}
                                    aria-label={`Accountability settings for ${habit.name}`}
                                    className={cn(
                                      'grid h-9 w-9 place-items-center rounded-full border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                                      habit.accountability_enabled
                                        ? 'border-accent/35 bg-accent/10 text-accent'
                                        : 'border-border bg-background text-muted-foreground'
                                    )}
                                  >
                                    <HeartHandshake
                                      className="h-4 w-4"
                                      aria-hidden="true"
                                    />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => void archiveHabit(habit.id)}
                                    disabled={busyHabitIds.has(habit.id)}
                                    aria-label={`Archive ${habit.name}`}
                                    className="grid h-9 w-9 place-items-center rounded-full border border-border bg-background text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                                  >
                                    <Archive className="h-4 w-4" aria-hidden="true" />
                                  </button>
                                </div>
                              </div>

                              {rewardUnlocked && (
                                <div className="border-t border-border bg-primary px-4 py-3 text-sm text-primary-foreground">
                                  You planned this reward: <strong>{habit.reward}</strong>
                                </div>
                              )}

                              {reminderHabitId === habit.id && (
                                <div className="border-t border-border bg-background p-4">
                                  <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                                    <div>
                                      <Label htmlFor={`reminder-${habit.id}`}>Time</Label>
                                      <Input
                                        id={`reminder-${habit.id}`}
                                        type="time"
                                        value={reminderTime}
                                        onChange={(event) =>
                                          setReminderTime(event.target.value)
                                        }
                                      />
                                    </div>
                                    <div>
                                      <Label htmlFor={`days-${habit.id}`}>Days</Label>
                                      <select
                                        id={`days-${habit.id}`}
                                        value={reminderDays}
                                        onChange={(event) =>
                                          setReminderDays(event.target.value as DayPreset)
                                        }
                                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                      >
                                        <option value="daily">Every day</option>
                                        <option value="weekdays">Weekdays</option>
                                        <option value="weekends">Weekends</option>
                                      </select>
                                    </div>
                                    <Button
                                      onClick={() => void saveReminder(habit)}
                                      disabled={!reminderTime || busyHabitIds.has(habit.id)}
                                    >
                                      Save
                                    </Button>
                                  </div>
                                  {reminder && (
                                    <button
                                      type="button"
                                      onClick={() => void removeReminder(habit)}
                                      className="mt-3 text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
                                    >
                                      Remove reminder
                                    </button>
                                  )}
                                </div>
                              )}

                              {accountabilityHabitId === habit.id && (
                                <div className="border-t border-border bg-background p-4">
                                  {isAnonymous ? (
                                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                      <div>
                                        <p className="text-sm font-medium text-foreground">
                                          Add a partner
                                        </p>
                                        <p className="mt-1 text-xs text-muted-foreground">
                                          Create an account to share check-ins across devices.
                                        </p>
                                      </div>
                                      <Link
                                        href="/auth/signup"
                                        className="inline-flex min-h-10 items-center justify-center rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground"
                                      >
                                        Create account
                                      </Link>
                                    </div>
                                  ) : (
                                    <>
                                      <div className="flex items-start justify-between gap-4">
                                        <div>
                                          <p className="text-sm font-semibold text-foreground">
                                            Partner check-ins
                                          </p>
                                          <p className="mt-1 text-xs text-muted-foreground">
                                            Share completion and streak counts.
                                          </p>
                                        </div>
                                        <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-medium text-foreground">
                                          <input
                                            type="checkbox"
                                            checked={accountabilityEnabled}
                                            onChange={(event) =>
                                              setAccountabilityEnabled(
                                                event.target.checked
                                              )
                                            }
                                            className="h-4 w-4 rounded border-border accent-[hsl(var(--primary))]"
                                          />
                                          Share
                                        </label>
                                      </div>

                                      <div
                                        className={cn(
                                          'mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end',
                                          !accountabilityEnabled && 'opacity-55'
                                        )}
                                      >
                                        <div>
                                          <Label htmlFor={`checkin-days-${habit.id}`}>
                                            Check-in rhythm
                                          </Label>
                                          <select
                                            id={`checkin-days-${habit.id}`}
                                            value={accountabilityDays}
                                            disabled={!accountabilityEnabled}
                                            onChange={(event) =>
                                              setAccountabilityDays(
                                                event.target
                                                  .value as AccountabilityPreset
                                              )
                                            }
                                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed"
                                          >
                                            <option value="daily">Every day</option>
                                            <option value="weekdays">Weekdays</option>
                                            <option value="weekly">Once a week</option>
                                          </select>
                                        </div>
                                        <div>
                                          {accountabilityDays === 'weekly' ? (
                                            <>
                                              <Label
                                                htmlFor={`checkin-weekday-${habit.id}`}
                                              >
                                                Day
                                              </Label>
                                              <select
                                                id={`checkin-weekday-${habit.id}`}
                                                value={accountabilityWeekday}
                                                disabled={!accountabilityEnabled}
                                                onChange={(event) =>
                                                  setAccountabilityWeekday(
                                                    Number(event.target.value)
                                                  )
                                                }
                                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed"
                                              >
                                                {WEEKDAY_OPTIONS.map(
                                                  ([value, label]) => (
                                                    <option key={value} value={value}>
                                                      {label}
                                                    </option>
                                                  )
                                                )}
                                              </select>
                                            </>
                                          ) : (
                                            <label className="flex h-10 cursor-pointer items-center gap-2 rounded-md border border-input px-3 text-sm text-foreground">
                                              <input
                                                type="checkbox"
                                                checked={accountabilityShareStreak}
                                                disabled={!accountabilityEnabled}
                                                onChange={(event) =>
                                                  setAccountabilityShareStreak(
                                                    event.target.checked
                                                  )
                                                }
                                                className="h-4 w-4 accent-[hsl(var(--primary))]"
                                              />
                                              Share streak
                                            </label>
                                          )}
                                        </div>
                                        <Button
                                          onClick={() =>
                                            void saveAccountability(habit)
                                          }
                                          disabled={busyHabitIds.has(habit.id)}
                                        >
                                          Save
                                        </Button>
                                      </div>
                                      {accountabilityDays === 'weekly' &&
                                        accountabilityEnabled && (
                                          <label className="mt-3 inline-flex cursor-pointer items-center gap-2 text-sm text-foreground">
                                            <input
                                              type="checkbox"
                                              checked={accountabilityShareStreak}
                                              onChange={(event) =>
                                                setAccountabilityShareStreak(
                                                  event.target.checked
                                                )
                                              }
                                              className="h-4 w-4 accent-[hsl(var(--primary))]"
                                            />
                                            Share streak
                                          </label>
                                        )}
                                      <p className="mt-3 text-xs text-muted-foreground">
                                        <Link
                                          href="/partner"
                                          className="font-medium text-foreground underline underline-offset-4"
                                        >
                                          Manage partners
                                        </Link>
                                      </p>
                                    </>
                                  )}
                                </div>
                              )}
                            </article>
                          );
                        })}
                      </div>
                    </section>
                  );
                })}
              </div>
            )}

            <DismissibleNotice
              noticeKey="habit-method-v1"
              className="app-panel-quiet mt-8 p-5 pr-14"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                The method
              </p>
              <h2 className="mt-1 font-display text-xl text-foreground">
                Cue → tiny action → visible finish.
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                This adapts the practical cue and friction ideas popularized in
                <em> Atomic Habits</em>, while the research basis comes from stable-context
                repetition and implementation-intention studies. There is no universal
                21- or 66-day deadline.
              </p>
              <Link
                href="/research#habits"
                className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-foreground underline underline-offset-4"
              >
                See the evidence
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </DismissibleNotice>
          </>
        )}

        {view === 'routines' && (
          <section className="mt-6">
            <div className="grid gap-4 md:grid-cols-2">
              {ROUTINE_TEMPLATES.map((template) => (
                <article key={template.id} className="app-panel flex flex-col p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-accent">
                    {template.eyebrow}
                  </p>
                  <h2 className="mt-2 font-display text-2xl text-foreground">
                    {template.title}
                  </h2>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {template.description}
                  </p>
                  <details className="mt-4 rounded-xl border border-border bg-background p-3">
                    <summary className="cursor-pointer text-sm font-medium text-foreground">
                      {template.items.length} suggested steps
                    </summary>
                    <ul className="mt-3 space-y-2">
                      {template.items.map((item) => (
                        <li key={item.name} className="flex gap-2 text-xs text-muted-foreground">
                          <HabitIcon name={item.icon} className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                          <span>
                            <strong className="text-foreground">{item.name}</strong>
                            <span className="block">{item.tinyStep}</span>
                          </span>
                        </li>
                      ))}
                    </ul>
                    {template.caution && (
                      <p className="mt-3 border-t border-border pt-3 text-xs leading-relaxed text-muted-foreground">
                        {template.caution}
                      </p>
                    )}
                  </details>
                  <Button
                    className="mt-5"
                    onClick={() => void installRoutine(template.id)}
                    disabled={Boolean(installingTemplate)}
                  >
                    {installingTemplate === template.id
                      ? 'Adding…'
                      : 'Add this routine'}
                  </Button>
                </article>
              ))}
            </div>
            <div className="mt-6">
              <PushNotificationSettings compact />
            </div>
          </section>
        )}

        {view === 'create' && (
          <section className="app-panel mt-6 overflow-hidden">
            <div className="border-b border-border bg-primary p-5 text-primary-foreground">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary-foreground/60">
                Design the behavior
              </p>
              <h2 className="mt-1 font-display text-2xl">Make the next action obvious.</h2>
            </div>
            <div className="space-y-6 p-5 md:p-7">
              {librarySourceTitle && (
                <div className="rounded-xl border border-border bg-secondary p-4 text-sm text-foreground">
                  Suggested from {librarySourceTitle}. Review every field before saving.
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    ['build', 'Build a habit', 'Something I want to do'],
                    ['reduce', 'Reduce a habit', 'A plan I want to keep'],
                  ] as Array<[HabitType, string, string]>
                ).map(([id, title, copy]) => (
                  <button
                    key={id}
                    type="button"
                    aria-pressed={draft.habitType === id}
                    onClick={() => setDraft((current) => ({ ...current, habitType: id }))}
                    className={cn(
                      'rounded-xl border p-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      draft.habitType === id
                        ? 'border-primary bg-secondary'
                        : 'border-border bg-background'
                    )}
                  >
                    <span className="block text-sm font-semibold text-foreground">{title}</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">{copy}</span>
                  </button>
                ))}
              </div>

              <div>
                <Label htmlFor="habit-name">
                  {draft.habitType === 'reduce' ? 'Plan to keep' : 'Habit name'}
                </Label>
                <Input
                  id="habit-name"
                  value={draft.name}
                  maxLength={160}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, name: event.target.value }))
                  }
                  placeholder={
                    draft.habitType === 'reduce'
                      ? 'e.g. Keep my smoke-free plan today'
                      : 'e.g. Walk after lunch'
                  }
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor="habit-category">Category</Label>
                  <select
                    id="habit-category"
                    value={draft.category}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        category: event.target.value as HabitCategory,
                      }))
                    }
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {HABIT_CATEGORIES.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label htmlFor="habit-slot">Routine</Label>
                  <select
                    id="habit-slot"
                    value={draft.routineSlot}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        routineSlot: event.target.value as RoutineSlot,
                      }))
                    }
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {SLOT_ORDER.map((slot) => (
                      <option key={slot} value={slot}>
                        {SLOT_LABELS[slot]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <Label htmlFor="habit-cue">When will it happen?</Label>
                <Input
                  id="habit-cue"
                  value={draft.cue}
                  maxLength={240}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, cue: event.target.value }))
                  }
                  placeholder="After lunch, I will…"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Use a moment you can recognize, not a vague intention.
                </p>
              </div>

              <div>
                <Label htmlFor="habit-tiny">Smallest version</Label>
                <Input
                  id="habit-tiny"
                  value={draft.tinyStep}
                  maxLength={240}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, tinyStep: event.target.value }))
                  }
                  placeholder="Walk to the end of the block"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  This is the version that counts on a difficult day.
                </p>
              </div>

              <div>
                <Label htmlFor="habit-description">Why this matters (optional)</Label>
                <Textarea
                  id="habit-description"
                  value={draft.description}
                  maxLength={500}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      description: event.target.value,
                    }))
                  }
                  placeholder="A private reason that helps you choose the action"
                />
              </div>

              <details className="rounded-xl border border-border bg-background p-4">
                <summary className="cursor-pointer font-medium text-foreground">
                  Add a reward milestone
                </summary>
                <div className="mt-4 grid gap-4 md:grid-cols-[1fr_8rem]">
                  <div>
                    <Label htmlFor="habit-reward">Reward</Label>
                    <Input
                      id="habit-reward"
                      value={draft.reward}
                      maxLength={240}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          reward: event.target.value,
                        }))
                      }
                      placeholder="e.g. Take myself to a movie"
                    />
                  </div>
                  <div>
                    <Label htmlFor="habit-reward-target">After days</Label>
                    <Input
                      id="habit-reward-target"
                      type="number"
                      min={1}
                      max={365}
                      value={draft.rewardTarget}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          rewardTarget: Number(event.target.value),
                        }))
                      }
                    />
                  </div>
                </div>
              </details>

              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button
                  variant="outline"
                  onClick={() => {
                    setDraft(EMPTY_DRAFT);
                    setLibrarySourceTitle('');
                    setView('today');
                  }}
                >
                  <RotateCcw className="mr-2 h-4 w-4" aria-hidden="true" />
                  Cancel
                </Button>
                <Button
                  onClick={() => void addHabit()}
                  disabled={!draft.name.trim() || saving}
                >
                  {saving ? 'Saving…' : 'Add habit'}
                </Button>
              </div>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
