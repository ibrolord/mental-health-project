import { describe, expect, it, vi } from 'vitest';
import {
  advisorLifecycleStorageKey,
  createAdvisorLifecycleCoordinator,
  type AdvisorLifecycleDependencies,
  type AdvisorLifecycleStorageAdapter,
} from '../../mobile/lib/advisor-lifecycle';
import type { AdvisorActionInstance } from '../../mobile/lib/advisor-action-storage';

const NOW = new Date('2026-08-15T14:00:00.000Z');

const ACTION: AdvisorActionInstance = {
  version: 2,
  id: 'habit:walk:action-1',
  recommendationId: 'habit:walk',
  action: 'Take a short walk.',
  smallerAction: 'Put on your shoes.',
  route: '/habits',
  sourceLabels: ['Habit'],
  observations: ['The habit is still open.'],
  changeSignalId: 'habit-stalled:walk',
  status: 'accepted',
  acceptedAt: '2026-08-15T13:55:00.000Z',
  startedAt: null,
  reminderAt: null,
  followUpAt: null,
  lastCheckInAt: null,
  lastCheckInResult: null,
  recoveryReason: null,
  recoveryCount: 0,
  useSmallerStep: false,
  updatedAt: '2026-08-15T13:55:00.000Z',
};

function memoryStorage(): {
  adapter: AdvisorLifecycleStorageAdapter;
  values: Map<string, string>;
} {
  const values = new Map<string, string>();
  return {
    values,
    adapter: {
      getItem: vi.fn(async (key) => values.get(key) ?? null),
      setItem: vi.fn(async (key, value) => { values.set(key, value); }),
      removeItem: vi.fn(async (key) => { values.delete(key); }),
    },
  };
}

function dependencies(initialAction: AdvisorActionInstance | null = ACTION) {
  let action = initialAction;
  let failRecordOffered = false;
  let failClear = false;
  const outcome = {
    offered: false,
    startedAt: null as string | null,
    resolution: null as 'completed' | 'partial' | 'skipped' | null,
    barrier: null as string | null,
  };
  const deps: AdvisorLifecycleDependencies = {
    loadAction: vi.fn(async () => action),
    startAction: vi.fn(async (_owner, _id, nowIso) => {
      if (action) action = { ...action, status: 'in_progress', startedAt: action.startedAt ?? nowIso };
      return { action };
    }),
    clearAction: vi.fn(async () => {
      if (failClear) {
        failClear = false;
        throw new Error('clear failed');
      }
      action = null;
      return true;
    }),
    recordCheckIn: vi.fn(async (_owner, _id, result, barrier, nowIso) => {
      if (action) {
        action = {
          ...action,
          status: 'needs_recovery',
          lastCheckInAt: nowIso,
          lastCheckInResult: result,
          recoveryReason: barrier,
        };
      }
      return { action };
    }),
    recordOffered: vi.fn(async () => {
      if (failRecordOffered) {
        failRecordOffered = false;
        throw new Error('offer failed');
      }
      outcome.offered = true;
    }),
    markStarted: vi.fn(async (_owner, _id, nowIso) => {
      outcome.startedAt ??= nowIso;
    }),
    resolveOutcome: vi.fn(async (_owner, _id, resolution, barrier) => {
      outcome.resolution = resolution;
      outcome.barrier = barrier;
    }),
    cancelReminder: vi.fn(async () => undefined),
  };
  return {
    deps,
    outcome,
    getAction: () => action,
    failNextOffer: () => { failRecordOffered = true; },
    failNextClear: () => { failClear = true; },
  };
}

describe('Advisor lifecycle journal', () => {
  it('replays a start after the action write succeeds but the outcome write fails', async () => {
    const { adapter, values } = memoryStorage();
    const state = dependencies();
    state.failNextOffer();
    const lifecycle = createAdvisorLifecycleCoordinator(adapter, state.deps, () => NOW);

    await expect(lifecycle.startAdvisorLifecycle('owner', ACTION)).rejects.toThrow('offer failed');
    expect(state.getAction()?.status).toBe('in_progress');
    expect(values.has(advisorLifecycleStorageKey('owner'))).toBe(true);

    await expect(lifecycle.reconcileAdvisorLifecycle('owner')).resolves.toMatchObject({
      status: 'in_progress',
    });
    expect(state.outcome).toMatchObject({ offered: true, startedAt: NOW.toISOString() });
    expect(values.has(advisorLifecycleStorageKey('owner'))).toBe(false);
  });

  it('replays completion when clearing the action fails after outcome resolution', async () => {
    const started = { ...ACTION, status: 'in_progress' as const, startedAt: NOW.toISOString() };
    const { adapter, values } = memoryStorage();
    const state = dependencies(started);
    state.failNextClear();
    const lifecycle = createAdvisorLifecycleCoordinator(adapter, state.deps, () => NOW);

    await expect(lifecycle.completeAdvisorLifecycle('owner', started)).rejects.toThrow('clear failed');
    expect(state.outcome.resolution).toBe('completed');
    expect(values.has(advisorLifecycleStorageKey('owner'))).toBe(true);

    await expect(lifecycle.reconcileAdvisorLifecycle('owner')).resolves.toBeNull();
    expect(state.getAction()).toBeNull();
    expect(state.deps.cancelReminder).toHaveBeenCalledTimes(1);
    expect(values.has(advisorLifecycleStorageKey('owner'))).toBe(false);
  });

  it('resolves a replaced started step before removing it', async () => {
    const started = { ...ACTION, status: 'in_progress' as const, startedAt: NOW.toISOString() };
    const { adapter } = memoryStorage();
    const state = dependencies(started);
    const lifecycle = createAdvisorLifecycleCoordinator(adapter, state.deps, () => NOW);

    await expect(lifecycle.replaceAdvisorLifecycle('owner', started)).resolves.toBeNull();
    expect(state.outcome).toMatchObject({
      resolution: 'skipped',
      barrier: 'priority',
    });
  });

  it('does not replay a pending transition after journal-first profile cleanup', async () => {
    const { adapter, values } = memoryStorage();
    const state = dependencies();
    state.failNextOffer();
    const lifecycle = createAdvisorLifecycleCoordinator(adapter, state.deps, () => NOW);

    await expect(lifecycle.startAdvisorLifecycle('owner', ACTION)).rejects.toThrow('offer failed');
    await lifecycle.clearAdvisorLifecycleJournal('owner');
    await state.deps.clearAction('owner', ACTION.id);

    await expect(lifecycle.reconcileAdvisorLifecycle('owner')).resolves.toBeNull();
    expect(values.has(advisorLifecycleStorageKey('owner'))).toBe(false);
    expect(state.outcome.offered).toBe(false);
  });
});
