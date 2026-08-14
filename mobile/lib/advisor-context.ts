import { Platform } from 'react-native';
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
    .select('id, name, tiny_step')
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
  const habit = habitsResult.data.find((entry) => !completedIds.has(entry.id));
  return habit
    ? [{
        id: habit.id,
        name: habit.name,
        tinyStep: habit.tiny_step,
        completedToday: false,
      }]
    : [];
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
    healthResult,
    lowEnergyResult,
  ] = await Promise.allSettled([
    loadLatestMood(owner),
    loadPendingGoal(owner),
    loadedHabitPromise,
    habitWeekPromise,
    loadAuthorizedHealth(owner),
    loadLowEnergyMode(owner),
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
    health: healthResult.status === 'fulfilled' ? healthResult.value : null,
  });
}
