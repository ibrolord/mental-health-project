import { describe, expect, it } from 'vitest';
import { advisorLoopSelectionOptions } from '../../mobile/lib/advisor-loop-selection';
import { selectAdvisorRecommendation, type AdvisorContext } from '../../mobile/lib/advisor-core';
import type { AdvisorOutcome } from '../../mobile/lib/advisor-outcome-storage';

const NOW = '2026-10-01T14:00:00.000Z';
const completed: AdvisorOutcome = {
  recommendationId: 'goal:g1', offeredAt: '2026-10-01T10:00:00.000Z',
  startedAt: '2026-10-01T10:01:00.000Z', completedAt: '2026-10-01T12:00:00.000Z',
  resolution: 'completed', resolvedAt: '2026-10-01T12:00:00.000Z',
  helpful: null, feedbackAt: null,
};
const context: AdvisorContext = {
  nowIso: NOW, mood: null, health: null, habits: [],
  goals: [{ id: 'g1', title: 'Read one page', dueAt: null }, { id: 'g2', title: 'Practice French', dueAt: null }],
};

describe('Advisor follow-through adaptation', () => {
  it('does not preserve a completed step just because it was offered today', () => {
    const options = advisorLoopSelectionOptions([completed], NOW);
    expect(options).toEqual({ preserveToday: false, excludeRecommendationId: 'goal:g1' });
    expect(selectAdvisorRecommendation(context, [completed], options).id).not.toBe('goal:g1');
  });

  it('does not resurrect a completed step when a newer suggestion is no longer a candidate', () => {
    const suggestion: AdvisorOutcome = {
      ...completed, recommendationId: 'goal:g2', offeredAt: '2026-10-01T13:00:00.000Z',
      startedAt: null, completedAt: null, resolution: null, resolvedAt: null,
    };
    const options = advisorLoopSelectionOptions([suggestion, completed], NOW);
    expect(options.preserveToday).toBe(false);
    expect(selectAdvisorRecommendation(context, [suggestion, completed], options).id).not.toBe('goal:g1');
  });

  it('uses new negative feedback to reconsider the next suggestion', () => {
    const negative = { ...completed, helpful: false, feedbackAt: '2026-10-01T13:59:00.000Z' };
    const options = advisorLoopSelectionOptions([negative], NOW);
    expect(options).toEqual({ preserveToday: false, excludeRecommendationId: 'goal:g1' });
    expect(selectAdvisorRecommendation(context, [negative], options).id).not.toBe('goal:g1');
  });

  it('ignores future-dated, malformed, expired, and unresolved events', () => {
    expect(advisorLoopSelectionOptions([
      { ...completed, completedAt: null, resolution: null, resolvedAt: null },
      { ...completed, resolvedAt: '2026-11-01T12:00:00.000Z' },
      { ...completed, resolvedAt: 'invalid' },
      { ...completed, resolvedAt: '2026-09-01T12:00:00.000Z' },
    ], NOW)).toEqual({});
  });

  it('does not override safety-first selection', () => {
    const severe: AdvisorContext = { ...context, mood: { emoji: '😢', localDate: '2026-10-01' } };
    const options = advisorLoopSelectionOptions([completed], NOW);
    expect(selectAdvisorRecommendation(severe, [completed], options).id).not.toBe('goal:g1');
  });
});
