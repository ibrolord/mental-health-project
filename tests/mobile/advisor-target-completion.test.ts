import { describe, expect, it, vi } from 'vitest';
import {
  advisorActionTarget,
  createAdvisorTargetCompletionChecker,
} from '../../mobile/lib/advisor-target-completion';
import type { AdvisorActionInstance } from '../../mobile/lib/advisor-action-storage';

const ACTION: AdvisorActionInstance = {
  version: 2,
  id: 'action-1',
  recommendationId: 'goal:goal-1:alternate',
  action: 'Give the goal five minutes.',
  smallerAction: 'Open the goal.',
  route: '/goals',
  sourceLabels: ['Goal'],
  observations: ['The goal is active.'],
  changeSignalId: null,
  status: 'in_progress',
  acceptedAt: '2026-08-15T12:00:00.000Z',
  startedAt: '2026-08-15T12:05:00.000Z',
  reminderAt: null,
  followUpAt: null,
  lastCheckInAt: null,
  lastCheckInResult: null,
  recoveryReason: null,
  recoveryCount: 0,
  useSmallerStep: false,
  updatedAt: '2026-08-15T12:05:00.000Z',
};

describe('Advisor target completion', () => {
  it('parses goal and habit targets while ignoring general actions', () => {
    expect(advisorActionTarget('due-goal:goal-1:alternate')).toEqual({ kind: 'goal', id: 'goal-1' });
    expect(advisorActionTarget('low-goal:goal-2')).toEqual({ kind: 'goal', id: 'goal-2' });
    expect(advisorActionTarget('habit:habit-1')).toEqual({ kind: 'habit', id: 'habit-1' });
    expect(advisorActionTarget('low-grounding')).toBeNull();
  });

  it('requires goal completion after the action started', async () => {
    const loadGoal = vi.fn().mockResolvedValue({
      status: 'completed',
      completedAt: '2026-08-15T12:06:00.000Z',
    });
    const checker = createAdvisorTargetCompletionChecker({
      loadGoal,
      loadHabitCompletion: vi.fn(),
    });

    await expect(checker(ACTION, {
      queryColumn: 'user_id',
      queryValue: 'owner',
      userId: 'owner',
    })).resolves.toBe(true);
    expect(loadGoal).toHaveBeenCalledWith('goal-1', {
      queryColumn: 'user_id',
      queryValue: 'owner',
    });
  });

  it('uses owner-scoped habit logs from the action start through today', async () => {
    const loadHabitCompletion = vi.fn().mockResolvedValue(true);
    const checker = createAdvisorTargetCompletionChecker({
      loadGoal: vi.fn(),
      loadHabitCompletion,
    });

    await expect(checker(
      { ...ACTION, recommendationId: 'habit:habit-1', route: '/habits' },
      { queryColumn: 'user_id', queryValue: 'owner', userId: 'owner' },
      new Date('2026-08-15T16:00:00.000Z')
    )).resolves.toBe(true);
    expect(loadHabitCompletion).toHaveBeenCalledWith(
      'habit-1',
      { userId: 'owner' },
      '2026-08-15T12:05:00.000Z',
      '2026-08-15',
      '2026-08-15',
      '2026-08-15T16:00:00.000Z'
    );
  });

  it('reconciles a habit completed before midnight when Advisor reopens the next day', async () => {
    const loadHabitCompletion = vi.fn().mockResolvedValue(true);
    const checker = createAdvisorTargetCompletionChecker({
      loadGoal: vi.fn(),
      loadHabitCompletion,
    });
    const overnightAction = {
      ...ACTION,
      recommendationId: 'habit:habit-1',
      route: '/habits' as const,
      acceptedAt: '2026-08-15T23:30:00.000Z',
      startedAt: '2026-08-15T23:35:00.000Z',
    };

    await expect(checker(
      overnightAction,
      { queryColumn: 'user_id', queryValue: 'owner', userId: 'owner' },
      new Date('2026-08-16T08:00:00.000Z')
    )).resolves.toBe(true);
    expect(loadHabitCompletion).toHaveBeenCalledWith(
      'habit-1',
      { userId: 'owner' },
      '2026-08-15T23:35:00.000Z',
      '2026-08-15',
      '2026-08-16',
      '2026-08-16T08:00:00.000Z'
    );
  });

  it('reconciles a linked target completed while the action is in recovery', async () => {
    const checker = createAdvisorTargetCompletionChecker({
      loadGoal: vi.fn().mockResolvedValue({
        status: 'completed',
        completedAt: '2026-08-15T12:10:00.000Z',
      }),
      loadHabitCompletion: vi.fn(),
    });

    await expect(checker(
      { ...ACTION, status: 'needs_recovery' },
      { queryColumn: 'user_id', queryValue: 'owner', userId: 'owner' }
    )).resolves.toBe(true);
  });
});
