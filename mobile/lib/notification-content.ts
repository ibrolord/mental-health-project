import { format } from 'date-fns';
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
  if (!user || (user as { is_anonymous?: boolean }).is_anonymous) {
    return buildSmartReminderPlan({
      now,
      reminderTimes,
      goals: [],
      lifePlans: [],
      libraryStates: [],
      affirmations: SOURCED_QUOTE_FALLBACKS,
    });
  }

  const today = format(now, 'yyyy-MM-dd');
  const affirmationsPromise = loadAffirmationCatalog()
    .then(({ records }) => records)
    .catch(() => SOURCED_QUOTE_FALLBACKS);
  const [goalsResult, plansResult, libraryResult, affirmations] = await Promise.all([
    supabase
      .from('goals')
      .select('content, created_at')
      .eq('user_id', user.id)
      .eq('date', today)
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(1),
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

  return buildSmartReminderPlan({
    now,
    reminderTimes,
    goals: goalsResult.error ? [] : (goalsResult.data ?? []) as TodayGoal[],
    lifePlans: plansResult.error ? [] : (plansResult.data ?? []) as LifePlanItem[],
    libraryStates: libraryResult.error
      ? []
      : (libraryResult.data ?? []) as LibraryState[],
    affirmations,
  });
}
