import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AdvisorContext } from '../../mobile/lib/advisor-core';
import type { AdvisorActionInstance } from '../../mobile/lib/advisor-action-storage';
import type { AdvisorOutcome } from '../../mobile/lib/advisor-outcome-storage';
import { selectAdvisorRecommendation } from '../../mobile/lib/advisor-core';
import { advisorLoopSelectionOptions } from '../../mobile/lib/advisor-loop-selection';
import { completeAdvisorProfile, defaultAdvisorProfile } from '../../mobile/lib/advisor-profile';

const mocks = vi.hoisted(() => ({
  context: vi.fn(), action: vi.fn(), outcomes: vi.fn(), cache: vi.fn(), completed: vi.fn(),
}));
vi.mock('../../mobile/lib/advisor-context', () => ({ loadAmbientAdvisorContext: mocks.context }));
vi.mock('../../mobile/lib/advisor-action-storage', () => ({ loadAdvisorAction: mocks.action }));
vi.mock('../../mobile/lib/advisor-outcome-storage', () => ({ loadAdvisorOutcomes: mocks.outcomes }));
vi.mock('../../mobile/lib/advisor-brief-storage', () => ({ advisorBriefStorage: { read: mocks.cache } }));
vi.mock('../../mobile/lib/advisor-target-completion-runtime', () => ({ checkAdvisorTargetCompletion: mocks.completed }));
import { loadTodayAdvisor } from '../../mobile/lib/today-advisor';

const owner = { ownerKey: 'session_id:test', queryColumn: 'session_id' as const, queryValue: 'test', userId: 'anon-auth-id' };
const context: AdvisorContext = { nowIso: '2026-09-27T12:00:00.000Z', mood: null, goals: [], habits: [], health: null, habitWeek: null };
const action: AdvisorActionInstance = {
  version: 2, id: 'saved-action', recommendationId: 'goal:g1', action: 'Write one paragraph.',
  smallerAction: 'Open the document.', route: '/goals', sourceLabels: ['Goal'], observations: [],
  changeSignalId: null, status: 'in_progress', acceptedAt: context.nowIso, startedAt: context.nowIso,
  reminderAt: null, followUpAt: null, lastCheckInAt: null, lastCheckInResult: null, recoveryReason: null,
  recoveryCount: 0, useSmallerStep: false, updatedAt: context.nowIso,
};

beforeEach(() => {
  vi.resetAllMocks();
  mocks.context.mockResolvedValue(context);
  mocks.action.mockResolvedValue(null);
  mocks.outcomes.mockResolvedValue([]);
  mocks.cache.mockResolvedValue(null);
  mocks.completed.mockResolvedValue(false);
});

describe('Today Advisor read model', () => {
  it('uses the shared selection without requesting a model', async () => {
    expect((await loadTodayAdvisor(owner)).recommendation.route).toBe('/(tabs)/tracker');
    expect(mocks.action).toHaveBeenCalledWith(owner.ownerKey);
    expect(mocks.context).toHaveBeenCalledWith(owner);
  });

  it('reuses a matching cached brief and retains the actual current action', async () => {
    const selection = (await loadTodayAdvisor(owner)).recommendation;
    mocks.action.mockResolvedValue(action);
    mocks.cache.mockResolvedValue({ recommendation: { ...selection, id: 'cached-choice' } });
    const result = await loadTodayAdvisor(owner);
    expect(result.recommendation.id).toBe('cached-choice');
    expect(result.action).toEqual(action);
    expect(mocks.completed).toHaveBeenCalledWith(action, owner);
  });

  it('reports completion for a review handoff instead of completing or deleting anything on load', async () => {
    mocks.action.mockResolvedValue(action);
    mocks.completed.mockResolvedValue(true);
    const result = await loadTodayAdvisor(owner);
    expect(result.targetCompleted).toBe(true);
    expect(result.action).toEqual(action);
    expect(mocks.outcomes).toHaveBeenCalledTimes(1);
  });

  it('does not invent completion when its verification is unavailable', async () => {
    mocks.action.mockResolvedValue(action);
    mocks.completed.mockRejectedValue(new Error('offline'));
    expect((await loadTodayAdvisor(owner)).targetCompleted).toBe(false);
  });

  it('prioritizes safety over cached advice and an existing commitment', async () => {
    mocks.context.mockResolvedValue({ ...context, goals: [{ id: 'g', title: 'hurt myself', dueAt: null }] });
    mocks.action.mockResolvedValue(action);
    const result = await loadTodayAdvisor(owner);
    expect(result.recommendation.kind).toBe('safety');
    expect(result.action).toBeNull();
    expect(mocks.cache).not.toHaveBeenCalled();
  });

  it.each([false, true])('matches Advisor after a negatively rated plan and an unavailable newer offer (cached: %s)', async (cached) => {
    const personalContext: AdvisorContext = {
      ...context,
      profile: completeAdvisorProfile({
        ...defaultAdvisorProfile(context.nowIso),
        personalPlan: {
          action: 'Read one page.', motivation: 'Make time for learning.', cue: 'After breakfast.',
          obstacle: 'time', obstacleDetail: '',
        },
      }, context.nowIso),
    };
    const plan = selectAdvisorRecommendation(personalContext);
    expect(plan.id).toMatch(/^personal-plan:/);
    const completed: AdvisorOutcome = {
      recommendationId: plan.id, offeredAt: '2026-09-27T09:00:00.000Z',
      startedAt: '2026-09-27T09:01:00.000Z', completedAt: '2026-09-27T09:05:00.000Z',
      resolution: 'completed', resolvedAt: '2026-09-27T09:05:00.000Z',
      helpful: false, feedbackAt: '2026-09-27T09:06:00.000Z',
    };
    const unavailable: AdvisorOutcome = {
      recommendationId: 'goal:removed', offeredAt: '2026-09-27T10:00:00.000Z',
      startedAt: null, completedAt: null, helpful: null, feedbackAt: null,
    };
    const outcomes = [unavailable, completed];
    const expected = selectAdvisorRecommendation(personalContext, outcomes,
      advisorLoopSelectionOptions(outcomes, personalContext.nowIso));
    // Without the loop exclusions, the preserve-today shortcut revives the plan.
    expect(selectAdvisorRecommendation(personalContext, outcomes).id).toBe(plan.id);
    expect(expected.id).not.toBe(plan.id);
    mocks.context.mockResolvedValue(personalContext);
    mocks.outcomes.mockResolvedValue(outcomes);
    if (cached) mocks.cache.mockResolvedValue({ recommendation: plan });
    expect((await loadTodayAdvisor(owner)).recommendation).toEqual(expected);
  });

  it('does not let an older cached suggestion replace a newly authored personal plan', async () => {
    const older = selectAdvisorRecommendation(context);
    const personalContext: AdvisorContext = {
      ...context,
      profile: completeAdvisorProfile({
        ...defaultAdvisorProfile(context.nowIso),
        personalPlan: {
          action: 'Read one page.', motivation: 'Make time for learning.', cue: 'After breakfast.',
          obstacle: 'time', obstacleDetail: '',
        },
      }, context.nowIso),
    };
    mocks.context.mockResolvedValue(personalContext);
    mocks.cache.mockResolvedValue({ recommendation: older });
    const result = await loadTodayAdvisor(owner);
    expect(result.recommendation.id).toMatch(/^personal-plan:/);
    expect(result.recommendation).toEqual(selectAdvisorRecommendation(personalContext));
  });
});
