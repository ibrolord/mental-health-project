import { format } from 'date-fns';
import type { AdvisorActionInstance } from './advisor-action-storage';

export type AdvisorActionTarget =
  | { kind: 'goal'; id: string }
  | { kind: 'habit'; id: string };

export type AdvisorTargetCompletionDependencies = {
  loadGoal: (
    id: string,
    owner: { queryColumn: 'user_id' | 'session_id'; queryValue: string }
  ) => Promise<{ status: string; completedAt: string | null } | null>;
  loadHabitCompletion: (
    id: string,
    owner: { userId: string },
    startedAtIso: string,
    startLocalDate: string,
    endLocalDate: string,
    checkedAtIso: string
  ) => Promise<boolean>;
};

export type AdvisorTargetOwner = {
  queryColumn: 'user_id' | 'session_id';
  queryValue: string | null;
  userId: string | null;
};

export function advisorActionTarget(recommendationId: string): AdvisorActionTarget | null {
  const parts = recommendationId.split(':');
  if (
    (parts[0] === 'goal' || parts[0] === 'due-goal' || parts[0] === 'low-goal') &&
    parts[1]
  ) {
    return { kind: 'goal', id: parts[1] };
  }
  if (parts[0] === 'habit' && parts[1]) {
    return { kind: 'habit', id: parts[1] };
  }
  return null;
}

export function createAdvisorTargetCompletionChecker(
  dependencies: AdvisorTargetCompletionDependencies
) {
  return async function checkAdvisorTargetCompletion(
    action: AdvisorActionInstance,
    owner: AdvisorTargetOwner,
    now: Date = new Date()
  ): Promise<boolean> {
    if (action.status !== 'in_progress' && action.status !== 'needs_recovery') {
      return false;
    }
    const target = advisorActionTarget(action.recommendationId);
    if (!target) return false;
    if (target.kind === 'goal') {
      if (!owner.queryValue) return false;
      const goal = await dependencies.loadGoal(target.id, {
        queryColumn: owner.queryColumn,
        queryValue: owner.queryValue,
      });
      if (!goal || goal.status !== 'completed' || !goal.completedAt) return false;
      const completedAt = new Date(goal.completedAt).getTime();
      const startedAt = new Date(action.startedAt ?? action.acceptedAt).getTime();
      return Number.isFinite(completedAt) && completedAt >= startedAt;
    }
    if (!owner.userId) return false;
    const started = new Date(action.startedAt ?? action.acceptedAt);
    const effectiveStart = Number.isFinite(started.getTime()) ? started : now;
    const startLocalDate = format(effectiveStart, 'yyyy-MM-dd');
    return dependencies.loadHabitCompletion(
      target.id,
      { userId: owner.userId },
      effectiveStart.toISOString(),
      startLocalDate,
      format(now, 'yyyy-MM-dd'),
      now.toISOString()
    );
  };
}
