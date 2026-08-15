import type { AdvisorActionInstance } from './advisor-action-storage';
import type { AdvisorOutcome } from './advisor-outcome-storage';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export type AdvisorFollowUpState =
  | 'none'
  | 'planned'
  | 'planned_due'
  | 'due'
  | 'needs_recovery';

export type AdvisorWeeklyReview = {
  started: number;
  completed: number;
  partial: number;
  skipped: number;
  summary: string;
};

export function advisorFollowUpState(
  action: AdvisorActionInstance | null,
  now: Date
): AdvisorFollowUpState {
  if (!action) return 'none';
  if (action.status === 'needs_recovery') return 'needs_recovery';
  if (!action.followUpAt) return 'none';
  const followUpTime = new Date(action.followUpAt).getTime();
  if (!Number.isFinite(followUpTime)) return 'none';
  if (followUpTime > now.getTime()) return 'planned';
  return action.status === 'accepted' ? 'planned_due' : 'due';
}

export function createAdvisorWeeklyReview(
  outcomes: AdvisorOutcome[],
  now: Date
): AdvisorWeeklyReview {
  const cutoff = now.getTime() - WEEK_MS;
  const isRecent = (value: string | null | undefined): boolean => {
    if (!value) return false;
    const timestamp = new Date(value).getTime();
    return Number.isFinite(timestamp) && timestamp >= cutoff && timestamp <= now.getTime();
  };
  const started = outcomes.filter((outcome) => isRecent(outcome.startedAt)).length;
  const completed = outcomes.filter(
    (outcome) =>
      (outcome.resolution === 'completed' || Boolean(outcome.completedAt)) &&
      isRecent(outcome.resolvedAt ?? outcome.completedAt)
  ).length;
  const partial = outcomes.filter(
    (outcome) => outcome.resolution === 'partial' && isRecent(outcome.resolvedAt)
  ).length;
  const skipped = outcomes.filter(
    (outcome) => outcome.resolution === 'skipped' && isRecent(outcome.resolvedAt)
  ).length;

  let summary = 'Start one small step to begin a weekly pattern.';
  if (started > 0 && completed === 0 && partial === 0 && skipped === 0) {
    summary = `${started} ${started === 1 ? 'step is' : 'steps are'} still in progress.`;
  } else if (completed > 0 || partial > 0) {
    const finished = `${completed} finished`;
    const moved = partial > 0 ? ` and ${partial} partly done` : '';
    summary = `${finished}${moved}. Keep the next commitment realistic.`;
  } else if (skipped > 0) {
    summary = `${skipped} ${skipped === 1 ? 'step was' : 'steps were'} reset. A smaller next step can help you restart.`;
  }

  return { started, completed, partial, skipped, summary };
}
