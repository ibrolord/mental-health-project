import { createAdvisorTargetCompletionChecker } from './advisor-target-completion';
import { supabase } from './supabase';

export const checkAdvisorTargetCompletion = createAdvisorTargetCompletionChecker({
  async loadGoal(id, owner) {
    const result = await supabase
      .from('goals')
      .select('status, completed_at')
      .eq('id', id)
      .eq(owner.queryColumn, owner.queryValue)
      .maybeSingle();
    if (result.error) throw result.error;
    if (!result.data) return null;
    return {
      status: result.data.status,
      completedAt: result.data.completed_at,
    };
  },
  async loadHabitCompletion(
    id,
    owner,
    startedAtIso,
    startLocalDate,
    endLocalDate,
    checkedAtIso
  ) {
    const habit = await supabase
      .from('habits')
      .select('id')
      .eq('id', id)
      .eq('user_id', owner.userId)
      .maybeSingle();
    if (habit.error) throw habit.error;
    if (!habit.data) return false;
    const logs = await supabase
      .from('habit_logs')
      .select('id')
      .eq('habit_id', id)
      .eq('completed', true)
      .gte('log_date', startLocalDate)
      .lte('log_date', endLocalDate);
    if (logs.error) throw logs.error;
    const logIds = (logs.data ?? []).map((row) => row.id);
    if (logIds.length === 0) return false;
    const completion = await supabase
      .from('advisor_momentum_events')
      .select('id')
      .in('habit_log_id', logIds)
      .gte('created_at', startedAtIso)
      .lte('created_at', checkedAtIso)
      .limit(1)
      .maybeSingle();
    if (completion.error) throw completion.error;
    return Boolean(completion.data);
  },
});
