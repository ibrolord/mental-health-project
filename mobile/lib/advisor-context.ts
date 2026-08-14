import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { differenceInCalendarDays, format, subDays } from 'date-fns';
import { appleHealthPreference } from './apple-health-preference';
import { loadAppleHealthSnapshot } from './apple-health';
import {
  createAdvisorContextSnapshot,
  createAdvisorHealthFeatures,
  type AdvisorContext,
  type AdvisorGoal,
  type AdvisorHabit,
} from './advisor-core';
import { supabase } from './supabase';
import { dashboardPreferences } from './dashboard-preferences';
import {
  NOTIFICATIONS_KEY,
  NOTIFICATION_PREFERENCES_KEY,
  REMINDER_TIMES_KEY,
  parseStoredNotificationPreferences,
  parseStoredReminderTimes,
} from './notifications-core';
import type { MoodEmoji } from './types';

export type AdvisorContextOwner = {
  ownerKey: string | null;
  queryColumn: 'user_id' | 'session_id';
  queryValue: string | null;
  userId: string | null;
};

const HEALTH_TIMEOUT_MS = 2_000;

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Apple Health timed out')), timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

async function loadLatestMood(
  owner: AdvisorContextOwner
): Promise<AdvisorContext['mood']> {
  if (!owner.queryValue) return null;
  const result = await supabase
    .from('moods')
    .select('emoji, local_date, created_at')
    .eq(owner.queryColumn, owner.queryValue)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (result.error) throw result.error;
  if (!result.data) return null;
  return {
    emoji: result.data.emoji as MoodEmoji,
    localDate: result.data.local_date ?? result.data.created_at.slice(0, 10),
  };
}

async function loadPendingGoal(
  owner: AdvisorContextOwner
): Promise<readonly AdvisorGoal[]> {
  if (!owner.queryValue) return [];
  const result = await supabase
    .from('goals')
    .select('id, content, due_at')
    .eq(owner.queryColumn, owner.queryValue)
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(25);
  if (result.error) throw result.error;
  return (result.data ?? []).map((goal) => ({
    id: goal.id,
    title: goal.content,
    dueAt: goal.due_at,
  }));
}

async function loadIncompleteHabit(
  owner: AdvisorContextOwner,
  now: Date
): Promise<readonly AdvisorHabit[]> {
  if (!owner.userId) return [];
  const habitsResult = await supabase
    .from('habits')
    .select('id, name, tiny_step, routine_slot, streak_count')
    .eq('user_id', owner.userId)
    .eq('is_active', true)
    .order('created_at', { ascending: true });
  if (habitsResult.error) throw habitsResult.error;
  if (!habitsResult.data?.length) return [];

  const logsResult = await supabase
    .from('habit_logs')
    .select('habit_id, completed')
    .in('habit_id', habitsResult.data.map((habit) => habit.id))
    .eq('log_date', format(now, 'yyyy-MM-dd'));
  if (logsResult.error) throw logsResult.error;
  const completedIds = new Set(
    (logsResult.data ?? [])
      .filter((entry) => Boolean(entry.completed))
      .map((entry) => entry.habit_id)
  );
  return habitsResult.data
    .filter((entry) => !completedIds.has(entry.id))
    .slice(0, 3)
    .map((habit) => ({
      id: habit.id,
      name: habit.name,
      tinyStep: habit.tiny_step,
      completedToday: false,
      routineSlot: habit.routine_slot ?? 'anytime',
      streakCount: Math.max(0, habit.streak_count ?? 0),
    }));
}

async function loadNotificationContext(): Promise<AdvisorContext['notifications']> {
  const [enabled, preferencesRaw, timesRaw] = await Promise.all([
    AsyncStorage.getItem(NOTIFICATIONS_KEY),
    AsyncStorage.getItem(NOTIFICATION_PREFERENCES_KEY),
    AsyncStorage.getItem(REMINDER_TIMES_KEY),
  ]);
  const preferences = parseStoredNotificationPreferences(preferencesRaw);
  return {
    enabled: enabled === 'true',
    enabledCategories: Object.entries(preferences)
      .filter(([, active]) => active)
      .map(([category]) => category),
    reminderTimes: parseStoredReminderTimes(timesRaw),
  };
}

async function loadHabitWeek(
  owner: AdvisorContextOwner,
  habit: AdvisorHabit | null,
  now: Date
): Promise<AdvisorContext['habitWeek']> {
  if (!owner.userId || !habit) return null;

  const today = format(now, 'yyyy-MM-dd');
  const result = await supabase
    .from('habits')
    .select('created_at, habit_logs(log_date)')
    .eq('id', habit.id)
    .eq('user_id', owner.userId)
    .eq('habit_logs.completed', true)
    .gte('habit_logs.log_date', format(subDays(now, 6), 'yyyy-MM-dd'))
    .lte('habit_logs.log_date', today)
    .maybeSingle();
  if (result.error) throw result.error;
  if (!result.data) return null;

  const createdAt = new Date(result.data.created_at);
  if (!Number.isFinite(createdAt.getTime())) {
    throw new Error('Habit has an invalid created_at timestamp');
  }

  return {
    habitId: habit.id,
    completedDays: Math.min(result.data.habit_logs?.length ?? 0, 7),
    habitAgeDays: Math.max(0, differenceInCalendarDays(now, createdAt)),
  };
}

function dateWindow(now: Date, daysAgo: number): string {
  return format(subDays(now, daysAgo), 'yyyy-MM-dd');
}

async function loadCheckInTrend(
  owner: AdvisorContextOwner,
  now: Date
): Promise<AdvisorContext['checkInTrend']> {
  if (!owner.queryValue) return null;
  const result = await supabase
    .from('moods')
    .select('local_date, created_at')
    .eq(owner.queryColumn, owner.queryValue)
    .gte('local_date', dateWindow(now, 14))
    .lte('local_date', dateWindow(now, 1));
  if (result.error) throw result.error;

  const recentStart = dateWindow(now, 7);
  const recentEnd = dateWindow(now, 1);
  const previousStart = dateWindow(now, 14);
  const previousEnd = dateWindow(now, 8);
  const dates = new Set(
    (result.data ?? [])
      .map((entry) => entry.local_date ?? entry.created_at?.slice(0, 10))
      .filter((date): date is string => Boolean(date))
  );
  return {
    recentDays: [...dates].filter(
      (date) => date >= recentStart && date <= recentEnd
    ).length,
    previousDays: [...dates].filter(
      (date) => date >= previousStart && date <= previousEnd
    ).length,
  };
}

async function loadMomentumProgress(
  owner: AdvisorContextOwner,
  now: Date
): Promise<AdvisorContext['momentumProgress']> {
  if (!owner.userId) return null;
  const previousStart = dateWindow(now, 14);
  const recentStart = dateWindow(now, 7);
  const recentEnd = dateWindow(now, 1);
  const previousEnd = dateWindow(now, 8);
  const [totalResult, windowResult] = await Promise.all([
    supabase
      .from('advisor_momentum_events')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', owner.userId),
    supabase
      .from('advisor_momentum_events')
      .select('earned_on')
      .eq('user_id', owner.userId)
      .gte('earned_on', previousStart)
      .lte('earned_on', recentEnd),
  ]);
  const ledgerError = totalResult.error ?? windowResult.error;
  if (ledgerError) {
    const missingLedger = ledgerError.code === '42P01' ||
      ledgerError.code === 'PGRST205' ||
      ledgerError.message.includes('advisor_momentum_events');
    if (!missingLedger) throw ledgerError;

    // Keep momentum useful during a staged rollout. The ledger migration
    // backfills these same completed logs, so this fallback produces the same
    // XP without inventing or double-counting activity.
    const habitsResult = await supabase
      .from('habits')
      .select('id')
      .eq('user_id', owner.userId);
    if (habitsResult.error) throw habitsResult.error;
    const habitIds = (habitsResult.data ?? []).map((habit) => habit.id);
    if (habitIds.length === 0) {
      return { totalPoints: 0, recentPoints: 0, previousPoints: 0 };
    }
    const [fallbackTotal, fallbackWindow] = await Promise.all([
      supabase
        .from('habit_logs')
        .select('id', { count: 'exact', head: true })
        .in('habit_id', habitIds)
        .eq('completed', true),
      supabase
        .from('habit_logs')
        .select('log_date')
        .in('habit_id', habitIds)
        .eq('completed', true)
        .gte('log_date', previousStart)
        .lte('log_date', recentEnd),
    ]);
    if (fallbackTotal.error) throw fallbackTotal.error;
    if (fallbackWindow.error) throw fallbackWindow.error;
    const recentCompletions = (fallbackWindow.data ?? []).filter(
      (event) => event.log_date >= recentStart && event.log_date <= recentEnd
    ).length;
    const previousCompletions = (fallbackWindow.data ?? []).filter(
      (event) => event.log_date >= previousStart && event.log_date <= previousEnd
    ).length;
    return {
      totalPoints: (fallbackTotal.count ?? 0) * 10,
      recentPoints: recentCompletions * 10,
      previousPoints: previousCompletions * 10,
    };
  }
  const recentEvents = (windowResult.data ?? []).filter(
    (event) => event.earned_on >= recentStart && event.earned_on <= recentEnd
  ).length;
  const previousEvents = (windowResult.data ?? []).filter(
    (event) => event.earned_on >= previousStart && event.earned_on <= previousEnd
  ).length;
  return {
    totalPoints: (totalResult.count ?? 0) * 10,
    recentPoints: recentEvents * 10,
    previousPoints: previousEvents * 10,
  };
}

async function loadHabitTrend(
  owner: AdvisorContextOwner,
  now: Date
): Promise<AdvisorContext['habitTrend']> {
  if (!owner.userId) return null;
  const habitsResult = await supabase
    .from('habits')
    .select('id, created_at, frequency')
    .eq('user_id', owner.userId)
    .eq('is_active', true)
    .or('frequency.eq.daily,frequency.is.null');
  if (habitsResult.error) throw habitsResult.error;
  if (!habitsResult.data?.length) return null;

  // Compare two complete seven-day windows so an unfinished today never
  // counts against the current week.
  const start = dateWindow(now, 14);
  const recentStart = dateWindow(now, 7);
  const recentEnd = dateWindow(now, 1);
  const previousEnd = dateWindow(now, 8);
  const logsResult = await supabase
    .from('habit_logs')
    .select('habit_id, log_date, completed')
    .in('habit_id', habitsResult.data.map((habit) => habit.id))
    .gte('log_date', start)
    .lte('log_date', recentEnd);
  if (logsResult.error) throw logsResult.error;

  const completed = new Set(
    (logsResult.data ?? [])
      .filter((entry) => Boolean(entry.completed) && entry.log_date)
      .map((entry) => `${entry.habit_id}:${entry.log_date}`)
  );
  let recentOpportunities = 0;
  let previousOpportunities = 0;
  for (const habit of habitsResult.data) {
    const createdAt = new Date(habit.created_at ?? '');
    const createdDate = Number.isFinite(createdAt.getTime())
      ? format(createdAt, 'yyyy-MM-dd')
      : start;
    for (let daysAgo = 14; daysAgo >= 1; daysAgo -= 1) {
      const day = dateWindow(now, daysAgo);
      if (day < createdDate) continue;
      if (day >= recentStart && day <= recentEnd) recentOpportunities += 1;
      else if (day <= previousEnd) previousOpportunities += 1;
    }
  }
  let recentCompleted = 0;
  let previousCompleted = 0;
  for (const key of completed) {
    const day = key.slice(key.lastIndexOf(':') + 1);
    if (day >= recentStart && day <= recentEnd) recentCompleted += 1;
    else if (day <= previousEnd) previousCompleted += 1;
  }
  return {
    recentCompleted,
    recentOpportunities,
    previousCompleted,
    previousOpportunities,
  };
}

async function loadAuthorizedHealth(
  owner: AdvisorContextOwner
): Promise<AdvisorContext['health']> {
  if (Platform.OS !== 'ios' || !owner.userId) return null;
  if (!(await appleHealthPreference.read(owner.userId))) return null;
  const snapshot = await withTimeout(loadAppleHealthSnapshot(), HEALTH_TIMEOUT_MS);
  const health = createAdvisorHealthFeatures(snapshot);
  return health.recent.availableCategoryCount > 0
    ? health
    : null;
}

async function loadLowEnergyMode(owner: AdvisorContextOwner): Promise<boolean> {
  return owner.ownerKey
    ? dashboardPreferences.readLowEnergyMode(owner.ownerKey)
    : false;
}

export async function loadAmbientAdvisorContext(
  owner: AdvisorContextOwner,
  now = new Date()
): Promise<AdvisorContext> {
  const loadedHabitPromise = loadIncompleteHabit(owner, now);
  const habitWeekPromise = loadedHabitPromise.then((habits) =>
    loadHabitWeek(owner, habits[0] ?? null, now)
  );
  const [
    moodResult,
    goalResult,
    habitResult,
    habitWeekResult,
    habitTrendResult,
    checkInTrendResult,
    momentumResult,
    healthResult,
    lowEnergyResult,
    notificationResult,
  ] = await Promise.allSettled([
    loadLatestMood(owner),
    loadPendingGoal(owner),
    loadedHabitPromise,
    habitWeekPromise,
    loadHabitTrend(owner, now),
    loadCheckInTrend(owner, now),
    loadMomentumProgress(owner, now),
    loadAuthorizedHealth(owner),
    loadLowEnergyMode(owner),
    loadNotificationContext(),
  ]);

  return createAdvisorContextSnapshot({
    nowIso: now.toISOString(),
    intent: 'general',
    lowEnergyMode:
      lowEnergyResult.status === 'fulfilled' ? lowEnergyResult.value : false,
    mood: moodResult.status === 'fulfilled' ? moodResult.value : null,
    goals: goalResult.status === 'fulfilled' ? goalResult.value : [],
    habits: habitResult.status === 'fulfilled' ? habitResult.value : [],
    habitWeek:
      habitWeekResult.status === 'fulfilled' ? habitWeekResult.value : null,
    habitTrend:
      habitTrendResult.status === 'fulfilled' ? habitTrendResult.value : null,
    checkInTrend:
      checkInTrendResult.status === 'fulfilled' ? checkInTrendResult.value : null,
    momentumProgress:
      momentumResult.status === 'fulfilled' ? momentumResult.value : null,
    momentumAvailability: !owner.userId
      ? 'signed-out'
      : momentumResult.status === 'fulfilled'
        ? 'available'
        : 'unavailable',
    health: healthResult.status === 'fulfilled' ? healthResult.value : null,
    notifications:
      notificationResult.status === 'fulfilled' ? notificationResult.value : null,
  });
}
