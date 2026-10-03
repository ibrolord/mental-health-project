import { describe, expect, it } from 'vitest';
import { advisorModelFeedback, advisorFollowThroughOptions } from '../../mobile/lib/advisor-follow-through';

const now = '2026-10-03T16:00:00.000Z';
const row = { recommendationId: 'habit:walk', offeredAt: now, helpful: null };

describe('grounded adaptive follow-through', () => {
  it('distinguishes unknown start history, recorded starts, partial, skipped and completed', () => {
    expect(advisorFollowThroughOptions(row.recommendationId, [])).toEqual([]);
    expect(advisorModelFeedback([row], now)[0]).not.toHaveProperty('started');
    expect(advisorModelFeedback([{ ...row, startedAt: now }], now)[0].started).toBe(true);
    expect(advisorModelFeedback([{ ...row, completedAt: now }], now)[0]).not.toHaveProperty('started');
    for (const resolution of ['partial', 'skipped', 'completed'] as const) {
      expect(advisorModelFeedback([{ ...row, resolution, resolvedAt: now }], now)[0].resolution).toBe(resolution);
    }
  });
  it('excludes local personal plans, old records and future records; sorts actual feedback ahead of offers', () => {
    const feedback = advisorModelFeedback([
      { ...row, recommendationId: 'personal-plan:private', helpful: true },
      { ...row, offeredAt: '2026-01-01T00:00:00.000Z' },
      { ...row, offeredAt: '2027-01-01T00:00:00.000Z' },
      { ...row, offeredAt: '2026-10-02T00:00:00.000Z' },
      { ...row, offeredAt: '2026-10-01T00:00:00.000Z', feedbackAt: now, helpful: false },
    ], now);
    expect(feedback).toHaveLength(2);
    expect(feedback[0].helpful).toBe(false);
  });
  it('grounds recovery in an explicit barrier without changing the commitment', () => {
    const commitment = { recommendationId: row.recommendationId, status: 'needs_recovery' as const,
      lastCheckInResult: 'partial' as const, recoveryReason: 'energy' as const, useSmallerStep: true };
    const before = JSON.stringify(commitment);
    const options = advisorFollowThroughOptions(row.recommendationId, [], commitment);
    expect(options[0]).toMatchObject({ id: 'smaller', text: expect.stringContaining('already chosen the smaller version') });
    expect(options.map((option) => option.id)).toContain('partial');
    expect(JSON.stringify(commitment)).toBe(before);
    expect(advisorFollowThroughOptions('goal:other', [], commitment)).toEqual([]);
  });
  it('uses explicit helpfulness without claiming improved health', () => {
    const feedback = advisorModelFeedback([{ ...row, helpful: false, feedbackAt: now }], now);
    expect(advisorFollowThroughOptions(row.recommendationId, feedback)).toEqual([
      expect.objectContaining({ id: 'not-helpful' }),
    ]);
    expect(advisorFollowThroughOptions('goal:next', feedback)[0].id).toBe('different');
  });
  it('does not transfer an older attempt\'s partial progress or barrier to a new commitment', () => {
    const feedback = advisorModelFeedback([{ ...row, resolution: 'partial', barrier: 'energy' }], now);
    const options = advisorFollowThroughOptions(row.recommendationId, feedback, {
      recommendationId: row.recommendationId, status: 'accepted',
      lastCheckInResult: null, recoveryReason: null, useSmallerStep: false,
    });
    expect(options.map((option) => option.id)).toEqual(['keep-step']);
  });
  it('does not urge abandoning a new commitment because an older attempt did not help', () => {
    const feedback = advisorModelFeedback([{ ...row, helpful: false, feedbackAt: now }], now);
    const options = advisorFollowThroughOptions(row.recommendationId, feedback, {
      recommendationId: row.recommendationId, status: 'accepted',
      lastCheckInResult: null, recoveryReason: null, useSmallerStep: false,
    });
    expect(options.map((option) => option.id)).toEqual(['keep-step']);
  });
});
