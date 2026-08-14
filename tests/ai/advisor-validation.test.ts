import { describe, expect, it } from 'vitest';
import { advisorModelRequestSchema } from '../../lib/ai/advisor-validation';

const candidate = {
  id: 'habit:walk',
  observation: 'A walk is still open.',
  observations: ['A walk is still open.'],
  action: 'Walk for five minutes.',
  smallerAction: 'Put on your shoes.',
  sourceLabels: ['Habit'],
};

describe('Advisor model request validation', () => {
  it('accepts a bounded request', () => {
    expect(advisorModelRequestSchema.safeParse({
      nowIso: '2026-08-14T12:00:00.000Z',
      mood: null,
      candidates: [candidate],
      signals: [],
      appleHealthSummary: null,
      recentFeedback: [],
    }).success).toBe(true);
  });

  it('rejects duplicate candidate IDs', () => {
    expect(advisorModelRequestSchema.safeParse({
      nowIso: '2026-08-14T12:00:00.000Z',
      mood: null,
      candidates: [candidate, candidate],
      signals: [],
      appleHealthSummary: null,
      recentFeedback: [],
    }).success).toBe(false);
  });

  it('rejects unbounded candidate text', () => {
    expect(advisorModelRequestSchema.safeParse({
      nowIso: '2026-08-14T12:00:00.000Z',
      mood: null,
      candidates: [{ ...candidate, action: 'x'.repeat(241) }],
      signals: [],
      appleHealthSummary: null,
      recentFeedback: [],
    }).success).toBe(false);
  });
});
