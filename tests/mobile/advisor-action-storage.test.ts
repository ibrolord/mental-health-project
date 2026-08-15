import { describe, expect, it } from 'vitest';
import {
  advisorActionStorageKey,
  createAdvisorActionStorage,
  type AdvisorActionStorageAdapter,
} from '../../mobile/lib/advisor-action-storage';
import type { AdvisorRecommendation } from '../../mobile/lib/advisor-core';

function memoryStorage(initial: Record<string, string> = {}): {
  adapter: AdvisorActionStorageAdapter;
  values: Map<string, string>;
} {
  const values = new Map(Object.entries(initial));
  return {
    values,
    adapter: {
      getItem: async (key) => values.get(key) ?? null,
      setItem: async (key, value) => { values.set(key, value); },
      removeItem: async (key) => { values.delete(key); },
    },
  };
}

const RECOMMENDATION: AdvisorRecommendation = {
  id: 'habit:walk',
  kind: 'standard',
  observation: 'Your walking habit is still open today.',
  observations: ['Your walking habit is still open today.'],
  action: 'Take a 10-minute walk.',
  smallerAction: 'Put on your walking shoes.',
  route: '/habits',
  sourceLabels: ['Habit'],
  resourceLabel: 'Open habits',
  changeSignal: null,
};

const NOW = new Date('2026-08-15T14:00:00.000Z');

describe('Advisor active action storage', () => {
  it('persists one owner-isolated action through accepted and in-progress states', async () => {
    const { adapter } = memoryStorage();
    const storage = createAdvisorActionStorage(adapter, () => NOW);

    const accepted = await storage.acceptAdvisorAction('user_id:a', RECOMMENDATION);
    expect(accepted.changed).toBe(true);
    expect(accepted.action).toMatchObject({
      recommendationId: 'habit:walk',
      changeSignalId: null,
      status: 'accepted',
      startedAt: null,
    });

    const started = await storage.startAdvisorAction(
      'user_id:a',
      accepted.action!.id,
      '2026-08-15T14:01:00.000Z'
    );
    expect(started.action).toMatchObject({
      status: 'in_progress',
      startedAt: '2026-08-15T14:01:00.000Z',
    });
    expect(await storage.loadAdvisorAction('user_id:b')).toBeNull();
    expect(await storage.loadAdvisorAction('user_id:a')).toEqual(started.action);
  });

  it('does not silently replace an active action', async () => {
    const { adapter } = memoryStorage();
    const storage = createAdvisorActionStorage(adapter, () => NOW);
    const first = await storage.acceptAdvisorAction('owner', RECOMMENDATION);
    const second = await storage.acceptAdvisorAction('owner', {
      ...RECOMMENDATION,
      id: 'goal:write',
      action: 'Write one paragraph.',
      route: '/goals',
    });

    expect(second.changed).toBe(false);
    expect(second.action).toEqual(first.action);
  });

  it('persists resizing and a user-selected reminder', async () => {
    const { adapter } = memoryStorage();
    const storage = createAdvisorActionStorage(adapter, () => NOW);
    const accepted = await storage.acceptAdvisorAction('owner', RECOMMENDATION);
    const resized = await storage.resizeAdvisorAction(
      'owner',
      accepted.action!.id,
      true
    );
    const reminded = await storage.setAdvisorActionReminder(
      'owner',
      accepted.action!.id,
      '2026-08-15T19:00:00.000Z'
    );

    expect(resized.action?.useSmallerStep).toBe(true);
    expect(reminded.action).toMatchObject({
      useSmallerStep: true,
      reminderAt: '2026-08-15T19:00:00.000Z',
    });
  });

  it('keeps the accountability follow-up when native reminder state is cleared', async () => {
    const { adapter } = memoryStorage();
    const storage = createAdvisorActionStorage(adapter, () => NOW);
    const accepted = await storage.acceptAdvisorAction('owner', RECOMMENDATION);
    const followed = await storage.setAdvisorActionFollowUp(
      'owner',
      accepted.action!.id,
      '2026-08-15T19:00:00.000Z'
    );
    const reconciled = await storage.setAdvisorActionReminder(
      'owner',
      accepted.action!.id,
      null
    );

    expect(followed.action?.reminderAt).toBe('2026-08-15T19:00:00.000Z');
    expect(reconciled.action).toMatchObject({
      followUpAt: '2026-08-15T19:00:00.000Z',
      reminderAt: null,
    });
  });

  it('keeps the user-scheduled follow-up when the planned step starts', async () => {
    const { adapter } = memoryStorage();
    const storage = createAdvisorActionStorage(adapter, () => NOW);
    const accepted = await storage.acceptAdvisorAction('owner', RECOMMENDATION);
    const followed = await storage.setAdvisorActionFollowUp(
      'owner',
      accepted.action!.id,
      '2026-08-15T19:00:00.000Z'
    );
    const started = await storage.startAdvisorAction(
      'owner',
      followed.action!.id,
      '2026-08-15T14:05:00.000Z'
    );

    expect(started.action).toMatchObject({
      status: 'in_progress',
      startedAt: '2026-08-15T14:05:00.000Z',
      followUpAt: '2026-08-15T19:00:00.000Z',
      reminderAt: '2026-08-15T19:00:00.000Z',
    });
  });

  it('records partial and missed check-ins as recoverable actions', async () => {
    const { adapter } = memoryStorage();
    const storage = createAdvisorActionStorage(adapter, () => NOW);
    const accepted = await storage.acceptAdvisorAction('owner', RECOMMENDATION);
    const partial = await storage.recordAdvisorActionCheckIn(
      'owner',
      accepted.action!.id,
      'partial',
      'energy',
      '2026-08-15T15:00:00.000Z'
    );

    expect(partial.action).toMatchObject({
      status: 'needs_recovery',
      lastCheckInResult: 'partial',
      recoveryReason: 'energy',
      recoveryCount: 1,
      useSmallerStep: true,
      followUpAt: null,
      reminderAt: null,
    });
  });

  it('migrates version one actions without dropping the current step', async () => {
    const key = advisorActionStorageKey('owner');
    const legacy = {
      version: 1,
      id: 'legacy-action',
      recommendationId: RECOMMENDATION.id,
      action: RECOMMENDATION.action,
      smallerAction: RECOMMENDATION.smallerAction,
      route: RECOMMENDATION.route,
      sourceLabels: RECOMMENDATION.sourceLabels,
      observations: RECOMMENDATION.observations,
      changeSignalId: null,
      status: 'in_progress',
      acceptedAt: NOW.toISOString(),
      startedAt: NOW.toISOString(),
      reminderAt: '2026-08-15T19:00:00.000Z',
      useSmallerStep: false,
      updatedAt: NOW.toISOString(),
    };
    const { adapter } = memoryStorage({ [key]: JSON.stringify(legacy) });
    const storage = createAdvisorActionStorage(adapter, () => NOW);

    expect(await storage.loadAdvisorAction('owner')).toMatchObject({
      version: 2,
      id: 'legacy-action',
      status: 'in_progress',
      followUpAt: '2026-08-15T19:00:00.000Z',
      recoveryCount: 0,
    });
  });

  it('does not count the same journaled recovery twice when it is replayed', async () => {
    const { adapter } = memoryStorage();
    const storage = createAdvisorActionStorage(adapter, () => NOW);
    const accepted = await storage.acceptAdvisorAction('owner', RECOMMENDATION);

    await storage.recordAdvisorActionCheckIn(
      'owner',
      accepted.action!.id,
      'partial',
      'energy',
      '2026-08-15T15:00:00.000Z'
    );
    const replayed = await storage.recordAdvisorActionCheckIn(
      'owner',
      accepted.action!.id,
      'partial',
      'energy',
      '2026-08-15T15:00:00.000Z'
    );

    expect(replayed.action?.recoveryCount).toBe(1);
  });

  it('requires the current action id before clearing', async () => {
    const { adapter } = memoryStorage();
    const storage = createAdvisorActionStorage(adapter, () => NOW);
    const accepted = await storage.acceptAdvisorAction('owner', RECOMMENDATION);

    expect(await storage.clearAdvisorAction('owner', 'wrong-id')).toBe(false);
    expect(await storage.loadAdvisorAction('owner')).not.toBeNull();
    expect(await storage.clearAdvisorAction('owner', accepted.action!.id)).toBe(true);
    expect(await storage.loadAdvisorAction('owner')).toBeNull();
  });

  it('fails closed and removes malformed persisted state', async () => {
    const key = advisorActionStorageKey('owner');
    const { adapter, values } = memoryStorage({ [key]: '{"version":1}' });
    const storage = createAdvisorActionStorage(adapter, () => NOW);

    expect(await storage.loadAdvisorAction('owner')).toBeNull();
    expect(values.has(key)).toBe(false);
  });
});
