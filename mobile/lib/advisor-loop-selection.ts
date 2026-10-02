import type { AdvisorOutcome } from './advisor-outcome-storage';
import type { AdvisorSelectionOptions } from './advisor-core';

// A resolved commitment must not win "keep today's suggestion" on the next
// foreground refresh. Positive feedback still informs the existing selector.
export function advisorLoopSelectionOptions(
  outcomes: readonly AdvisorOutcome[],
  nowIso: string
): AdvisorSelectionOptions {
  const now = new Date(nowIso).getTime();
  const resolved = outcomes
    .map((outcome) => ({
      outcome,
      time: new Date(outcome.feedbackAt ?? outcome.resolvedAt ?? outcome.completedAt ?? '').getTime(),
    }))
    .filter(({ outcome, time }) => {
      const days = outcome.helpful === false ? 14 : 3;
      return (outcome.helpful === false || outcome.resolution != null || outcome.completedAt != null)
        && Number.isFinite(time) && time <= now && now - time <= days * 24 * 60 * 60 * 1000;
    })
    .sort((a, b) => b.time - a.time)[0];
  if (!resolved) return {};
  return {
    excludeRecommendationId: resolved.outcome.recommendationId,
    // The brief cache already stabilizes an unchanged context. The old
    // preserve-today shortcut can otherwise select this resolved step again.
    preserveToday: false,
  };
}
