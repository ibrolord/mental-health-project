import { describe, expect, it } from 'vitest';
import {
  advisorFollowUpState,
  createAdvisorWeeklyReview,
} from '../../mobile/lib/advisor-accountability-core';
import type { AdvisorActionInstance } from '../../mobile/lib/advisor-action-storage';
import type { AdvisorOutcome } from '../../mobile/lib/advisor-outcome-storage';

const NOW = new Date('2026-08-15T14:00:00.000Z');

const ACTION: AdvisorActionInstance = {
  version: 2,
  id: 'action-1',
  recommendationId: 'habit:walk',
  action: 'Take a short walk.',
  smallerAction: 'Put on your shoes.',
  route: '/habits',
  sourceLabels: ['Habit'],
  observations: ['A walk is still open.'],
  changeSignalId: null,
  status: 'in_progress',
  acceptedAt: NOW.toISOString(),
  startedAt: NOW.toISOString(),
  reminderAt: null,
  followUpAt: null,
  lastCheckInAt: null,
  lastCheckInResult: null,
  recoveryReason: null,
  recoveryCount: 0,
  useSmallerStep: false,
  updatedAt: NOW.toISOString(),
};

describe('Advisor accountability', () => {
  it('distinguishes planned, pre-start due, active due, and recovery follow-ups', () => {
    expect(advisorFollowUpState({ ...ACTION, followUpAt: '2026-08-15T15:00:00.000Z' }, NOW)).toBe('planned');
    expect(advisorFollowUpState({
      ...ACTION,
      status: 'accepted',
      startedAt: null,
      followUpAt: '2026-08-15T13:00:00.000Z',
    }, NOW)).toBe('planned_due');
    expect(advisorFollowUpState({ ...ACTION, followUpAt: '2026-08-15T13:00:00.000Z' }, NOW)).toBe('due');
    expect(advisorFollowUpState({ ...ACTION, status: 'needs_recovery' }, NOW)).toBe('needs_recovery');
  });

  it('summarizes only the last seven days without a composite score', () => {
    const outcomes: AdvisorOutcome[] = [
      {
        recommendationId: 'one',
        offeredAt: '2026-08-14T14:00:00.000Z',
        startedAt: '2026-08-14T14:00:00.000Z',
        completedAt: '2026-08-14T15:00:00.000Z',
        resolution: 'completed',
        resolvedAt: '2026-08-14T15:00:00.000Z',
        barrier: null,
        helpful: null,
        feedbackAt: null,
      },
      {
        recommendationId: 'two',
        offeredAt: '2026-08-13T14:00:00.000Z',
        startedAt: '2026-08-13T14:00:00.000Z',
        completedAt: null,
        resolution: 'partial',
        resolvedAt: '2026-08-13T15:00:00.000Z',
        barrier: 'energy',
        helpful: null,
        feedbackAt: null,
      },
      {
        recommendationId: 'old',
        offeredAt: '2026-07-01T14:00:00.000Z',
        startedAt: '2026-07-01T14:00:00.000Z',
        completedAt: '2026-07-01T15:00:00.000Z',
        helpful: null,
        feedbackAt: null,
      },
    ];

    expect(createAdvisorWeeklyReview(outcomes, NOW)).toEqual({
      started: 2,
      completed: 1,
      partial: 1,
      skipped: 0,
      summary: '1 finished and 1 partly done. Keep the next commitment realistic.',
    });
  });

  it('counts a recent resolution even when the step started before the weekly window', () => {
    const outcomes: AdvisorOutcome[] = [
      {
        recommendationId: 'long-step',
        offeredAt: '2026-08-01T10:00:00.000Z',
        startedAt: '2026-08-01T10:05:00.000Z',
        completedAt: '2026-08-15T13:00:00.000Z',
        resolution: 'completed',
        resolvedAt: '2026-08-15T13:00:00.000Z',
        barrier: null,
        helpful: null,
        feedbackAt: null,
      },
    ];

    expect(createAdvisorWeeklyReview(outcomes, NOW)).toMatchObject({
      started: 0,
      completed: 1,
      partial: 0,
      skipped: 0,
    });
  });
});
