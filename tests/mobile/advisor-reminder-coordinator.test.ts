import { describe, expect, it, vi } from 'vitest';
import {
  createAdvisorReminderCoordinator,
} from '../../mobile/lib/advisor-reminder-coordinator';
import type { AdvisorActionInstance } from '../../mobile/lib/advisor-action-storage';
import type { AdvisorRecommendation } from '../../mobile/lib/advisor-core';

const RECOMMENDATION: AdvisorRecommendation = {
  id: 'habit:walk',
  kind: 'standard',
  observation: 'A walk is still open.',
  observations: ['A walk is still open.'],
  action: 'Take a short walk.',
  smallerAction: 'Put on your shoes.',
  route: '/habits',
  sourceLabels: ['Habit'],
  resourceLabel: 'Open habits',
  changeSignal: null,
};

const ACTION: AdvisorActionInstance = {
  version: 2,
  id: 'action-1',
  recommendationId: RECOMMENDATION.id,
  action: RECOMMENDATION.action,
  smallerAction: RECOMMENDATION.smallerAction,
  route: RECOMMENDATION.route,
  sourceLabels: [...RECOMMENDATION.sourceLabels],
  observations: [...RECOMMENDATION.observations],
  changeSignalId: null,
  status: 'accepted',
  acceptedAt: '2026-08-15T12:00:00.000Z',
  startedAt: null,
  reminderAt: null,
  followUpAt: null,
  lastCheckInAt: null,
  lastCheckInResult: null,
  recoveryReason: null,
  recoveryCount: 0,
  useSmallerStep: false,
  updatedAt: '2026-08-15T12:00:00.000Z',
};

describe('Advisor reminder coordinator', () => {
  it('persists the durable follow-up after native scheduling succeeds', async () => {
    const schedule = vi.fn().mockResolvedValue(true);
    const setFollowUp = vi.fn().mockResolvedValue({
      action: {
        ...ACTION,
        followUpAt: '2026-08-15T15:00:00.000Z',
        reminderAt: '2026-08-15T15:00:00.000Z',
      },
      changed: true,
    });
    const coordinator = createAdvisorReminderCoordinator({
      schedule,
      cancel: vi.fn(),
      accept: vi.fn(),
      setFollowUp,
      clear: vi.fn(),
    });

    await expect(coordinator({
      ownerKey: 'owner',
      recommendation: RECOMMENDATION,
      existingAction: ACTION,
      useSmallerStep: false,
      date: new Date('2026-08-15T15:00:00.000Z'),
    })).resolves.toMatchObject({ scheduled: true });
    expect(setFollowUp).toHaveBeenCalledWith(
      'owner',
      ACTION.id,
      '2026-08-15T15:00:00.000Z',
      '2026-08-15T15:00:00.000Z'
    );
    expect(setFollowUp.mock.invocationCallOrder[0]).toBeLessThan(
      schedule.mock.invocationCallOrder[0]
    );
  });

  it('rolls back a new action when notifications are disabled', async () => {
    const accept = vi.fn().mockResolvedValue({ action: ACTION, changed: true });
    const clear = vi.fn().mockResolvedValue(true);
    const coordinator = createAdvisorReminderCoordinator({
      schedule: vi.fn().mockResolvedValue(false),
      cancel: vi.fn(),
      accept,
      setFollowUp: vi.fn().mockResolvedValue({
        action: {
          ...ACTION,
          followUpAt: '2026-08-15T15:00:00.000Z',
          reminderAt: '2026-08-15T15:00:00.000Z',
        },
        changed: true,
      }),
      clear,
    });

    await expect(coordinator({
      ownerKey: 'owner',
      recommendation: RECOMMENDATION,
      existingAction: null,
      useSmallerStep: false,
      date: new Date('2026-08-15T15:00:00.000Z'),
    })).resolves.toEqual({ action: null, scheduled: false });
    expect(accept).toHaveBeenCalledOnce();
    expect(clear).toHaveBeenCalledWith('owner', ACTION.id);
  });

  it('clears a new action when reminder persistence fails before native scheduling', async () => {
    const schedule = vi.fn();
    const cancel = vi.fn().mockResolvedValue(undefined);
    const clear = vi.fn().mockResolvedValue(true);
    const coordinator = createAdvisorReminderCoordinator({
      schedule,
      cancel,
      accept: vi.fn().mockResolvedValue({ action: ACTION, changed: true }),
      setFollowUp: vi.fn().mockRejectedValue(new Error('storage failed')),
      clear,
    });

    await expect(coordinator({
      ownerKey: 'owner',
      recommendation: RECOMMENDATION,
      existingAction: null,
      useSmallerStep: false,
      date: new Date('2026-08-15T15:00:00.000Z'),
    })).rejects.toThrow('storage failed');
    expect(schedule).not.toHaveBeenCalled();
    expect(cancel).not.toHaveBeenCalled();
    expect(clear).toHaveBeenCalledWith('owner', ACTION.id);
  });

  it('retains persisted action state when native cancellation fails', async () => {
    const clear = vi.fn();
    const coordinator = createAdvisorReminderCoordinator({
      schedule: vi.fn().mockRejectedValue(new Error('native schedule uncertain')),
      cancel: vi.fn().mockRejectedValue(new Error('native cancel failed')),
      accept: vi.fn().mockResolvedValue({ action: ACTION, changed: true }),
      setFollowUp: vi.fn().mockResolvedValue({
        action: {
          ...ACTION,
          followUpAt: '2026-08-15T15:00:00.000Z',
          reminderAt: '2026-08-15T15:00:00.000Z',
        },
        changed: true,
      }),
      clear,
    });

    await expect(coordinator({
      ownerKey: 'owner',
      recommendation: RECOMMENDATION,
      existingAction: null,
      useSmallerStep: false,
      date: new Date('2026-08-15T15:00:00.000Z'),
    })).rejects.toThrow('could not be fully rolled back');
    expect(clear).not.toHaveBeenCalled();
  });

  it('reports an explicit cleanup failure when a new action cannot be cleared', async () => {
    const coordinator = createAdvisorReminderCoordinator({
      schedule: vi.fn(),
      cancel: vi.fn(),
      accept: vi.fn().mockResolvedValue({ action: ACTION, changed: true }),
      setFollowUp: vi.fn().mockRejectedValue(new Error('storage failed')),
      clear: vi.fn().mockResolvedValue(false),
    });

    await expect(coordinator({
      ownerKey: 'owner',
      recommendation: RECOMMENDATION,
      existingAction: null,
      useSmallerStep: false,
      date: new Date('2026-08-15T15:00:00.000Z'),
    })).rejects.toThrow('could not be fully rolled back');
  });
});
