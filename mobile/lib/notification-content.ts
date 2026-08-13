import { SOURCED_QUOTE_FALLBACKS } from './affirmations';
import { loadAffirmationCatalog } from './affirmations-client';
import {
  buildSmartReminderPlan,
  type LibraryState,
  type LifePlanItem,
  type TodayGoal,
} from './notification-content-core';
import type { ReminderSchedulePlan } from './notifications-core';
import { supabase } from './supabase';

export {
  buildSmartReminderPlan,
  type LibraryState,
  type LifePlanItem,
  type TodayGoal,
} from './notification-content-core';

const MAX_DUE_DATE_REMINDERS = 24;

export async function loadSmartReminderPlan(
  reminderTimes: readonly number[]
): Promise<ReminderSchedulePlan> {
  const { data: sessionData } = await supabase.auth.getSession();
  const user = sessionData.session?.user;
  const now = new Date();
  if (!user) {
    return buildSmartReminderPlan({
      now,
      reminderTimes,
      goals: [],
      lifePlans: [],
      libraryStates: [],
      affirmations: SOURCED_QUOTE_FALLBACKS,
    });
  }

  const affirmationsPromise = loadAffirmationCatalog()
    .then(({ records }) => records)
    .catch(() => SOURCED_QUOTE_FALLBACKS);
  const [goalsResult, plansResult, libraryResult, affirmations] = await Promise.all([
    supabase
      .from('goals')
      .select('content, created_at, due_at, reminder_at')
      .eq('user_id', user.id)
      .eq('status', 'pending')
      .not('reminder_at', 'is', null)
      .gt('reminder_at', now.toISOString())
      .order('reminder_at', { ascending: true })
      .limit(MAX_DUE_DATE_REMINDERS),
    supabase
      .from('life_plan_items')
      .select('id, title, next_step, target_date')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .not('target_date', 'is', null)
      .order('target_date', { ascending: true })
      .limit(MAX_DUE_DATE_REMINDERS),
    supabase
      .from('user_library_items')
      .select('content_id, is_saved, priority')
      .eq('user_id', user.id)
      .or('is_saved.eq.true,priority.eq.next'),
    affirmationsPromise,
  ]);

  const queryError = goalsResult.error ?? plansResult.error ?? libraryResult.error;
  if (queryError) {
    throw new Error('Notification content could not be loaded.');
  }

  return buildSmartReminderPlan({
    now,
    reminderTimes,
    goals: (goalsResult.data ?? []) as TodayGoal[],
    lifePlans: (plansResult.data ?? []) as LifePlanItem[],
    libraryStates: (libraryResult.data ?? []) as LibraryState[],
    affirmations,
  });
}
