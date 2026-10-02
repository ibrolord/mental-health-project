import { describe, expect, it, vi } from 'vitest';
import { createAdvisorActionStorage, advisorActionStorageKey } from '../../mobile/lib/advisor-action-storage';
import { createAdvisorOutcomeStorage } from '../../mobile/lib/advisor-outcome-storage';
import { createAdvisorLifecycleCoordinator, advisorLifecycleStorageKey } from '../../mobile/lib/advisor-lifecycle';
import { createAdvisorStepStarter } from '../../mobile/lib/advisor-start';
import { advisorFollowUpState } from '../../mobile/lib/advisor-accountability-core';
import { automaticAdvisorFollowUpAt } from '../../mobile/lib/advisor-cadence-core';
import type { AdvisorRecommendation } from '../../mobile/lib/advisor-core';

const RECOMMENDATION: AdvisorRecommendation = {
  id: 'habit:walk', kind: 'standard', action: 'Take a short walk.', smallerAction: 'Put on shoes.',
  observation: 'Your habit is open.', observations: ['Your habit is open.'], route: '/habits',
  sourceLabels: ['Habit'], resourceLabel: 'Open habit', changeSignal: null,
};
const OWNER = 'session_id:disposable-loop';

function harness() {
  let now = new Date(2026, 9, 1, 10);
  const values = new Map<string, string>();
  const adapter = {
    getItem: async (key: string) => values.get(key) ?? null,
    setItem: async (key: string, value: string) => { values.set(key, value); },
    removeItem: async (key: string) => { values.delete(key); },
  };
  const actions = createAdvisorActionStorage(adapter, () => now);
  const outcomes = createAdvisorOutcomeStorage(adapter, () => now);
  const dependencies = {
    loadAction: actions.loadAdvisorAction,
    startAction: actions.startAdvisorAction,
    clearAction: actions.clearAdvisorAction,
    recordCheckIn: actions.recordAdvisorActionCheckIn,
    recordOffered: vi.fn(outcomes.recordAdvisorOffered),
    markStarted: outcomes.markAdvisorStarted,
    resolveOutcome: outcomes.answerAdvisorResolution,
    cancelReminder: vi.fn(async () => {}),
  };
  const makeLifecycle = () => createAdvisorLifecycleCoordinator(adapter, dependencies, () => now);
  const lifecycle = makeLifecycle();
  const start = createAdvisorStepStarter({
    accept: actions.acceptAdvisorAction,
    cancelReminder: dependencies.cancelReminder,
    clearFollowUp: (owner, id) => actions.setAdvisorActionFollowUp(owner, id, null, null),
    start: lifecycle.startAdvisorLifecycle,
  });
  return { actions, outcomes, lifecycle, start, values, dependencies, makeLifecycle,
    now: () => now, advance: (hours: number) => { now = new Date(now.getTime() + hours * 60 * 60 * 1000); } };
}

describe('durable in-app Advisor follow-through loop', () => {
  it('starts, persists an automatic local followup, becomes due, and finishes without scheduling permissions', async () => {
    const h = harness();
    const started = await h.start(OWNER, RECOMMENDATION, null, false, () => true, h.now());
    expect(started?.action).toMatchObject({ status: 'in_progress', reminderAt: null,
      followUpAt: automaticAdvisorFollowUpAt(h.now()) });
    expect(h.dependencies.cancelReminder).not.toHaveBeenCalled();
    const restored = await h.actions.loadAdvisorAction(OWNER);
    expect(restored).toEqual(started?.action);
    expect(advisorFollowUpState(restored, h.now())).toBe('planned');
    h.advance(2);
    expect(advisorFollowUpState(restored, h.now())).toBe('due');
    await h.lifecycle.completeAdvisorLifecycle(OWNER, restored!);
    expect(await h.actions.loadAdvisorAction(OWNER)).toBeNull();
    expect(await h.outcomes.loadAdvisorOutcomes(OWNER)).toEqual([
      expect.objectContaining({ actionId: restored!.id, resolution: 'completed', completedAt: h.now().toISOString() }),
    ]);
    expect(await h.actions.loadAdvisorAction('user_id:another')).toBeNull();
    expect(await h.outcomes.loadAdvisorOutcomes('user_id:another')).toEqual([]);
  });

  it('does not postpone the same followup every time Continue is tapped', async () => {
    const h = harness();
    const first = await h.start(OWNER, RECOMMENDATION, null, false, () => true, h.now());
    h.advance(3);
    const continued = await h.start(OWNER, RECOMMENDATION, first!.action, false, () => true, h.now());
    expect(continued?.action?.followUpAt).toBe(first?.action?.followUpAt);
    expect(advisorFollowUpState(continued!.action, h.now())).toBe('due');
    expect((await h.outcomes.loadAdvisorOutcomes(OWNER))).toHaveLength(1);
  });

  it.each(['partial', 'not_done'] as const)('adapts %s and restarts from the retry time, not the original start', async (result) => {
    const h = harness();
    const first = await h.start(OWNER, RECOMMENDATION, null, false, () => true, h.now());
    h.advance(3);
    const recovery = await h.lifecycle.recoverAdvisorLifecycle(OWNER, first!.action!, result, 'energy');
    expect(recovery).toMatchObject({ status: 'needs_recovery', useSmallerStep: true, followUpAt: null, reminderAt: null });
    expect(advisorFollowUpState(recovery, h.now())).toBe('needs_recovery');
    h.advance(1);
    const retry = await h.start(OWNER, RECOMMENDATION, recovery, true, () => true, h.now());
    expect(retry?.action).toMatchObject({ status: 'in_progress', useSmallerStep: true,
      startedAt: first!.action!.startedAt, followUpAt: automaticAdvisorFollowUpAt(h.now()) });
    expect(advisorFollowUpState(retry!.action, h.now())).toBe('planned');
    await h.lifecycle.completeAdvisorLifecycle(OWNER, retry!.action!);
    expect(await h.outcomes.loadAdvisorOutcomes(OWNER)).toEqual([
      expect.objectContaining({ resolution: 'completed', barrier: null }),
    ]);
  });

  it('adapts time barriers but does not make an unrelated priority decision for the user', async () => {
    for (const [reason, smaller] of [['time', true], ['priority', false], ['unclear', false]] as const) {
      const h = harness();
      const first = await h.start(OWNER, RECOMMENDATION, null, false, () => true, h.now());
      const recovery = await h.lifecycle.recoverAdvisorLifecycle(OWNER, first!.action!, 'not_done', reason);
      expect(recovery?.useSmallerStep).toBe(smaller);
      expect(recovery?.recommendationId).toBe(RECOMMENDATION.id);
    }
  });

  it('reschedules recovery in-app with no OS reminder and no immediate repeat question', async () => {
    const h = harness();
    const first = await h.start(OWNER, RECOMMENDATION, null, false, () => true, h.now());
    h.advance(2);
    const recovery = await h.lifecycle.recoverAdvisorLifecycle(OWNER, first!.action!, 'partial', null);
    const next = automaticAdvisorFollowUpAt(h.now());
    const deferred = await h.actions.deferAdvisorActionFollowUp(OWNER, recovery!.id, next);
    expect(deferred.action).toMatchObject({ followUpAt: next, reminderAt: null, useSmallerStep: true });
    expect(advisorFollowUpState(deferred.action, h.now())).toBe('planned');
  });

  it('preserves an explicitly scheduled future reminder and followup on start', async () => {
    const h = harness();
    const accepted = await h.actions.acceptAdvisorAction(OWNER, RECOMMENDATION);
    const chosen = new Date(2026, 9, 2, 9).toISOString();
    const planned = await h.actions.setAdvisorActionFollowUp(OWNER, accepted.action!.id, chosen, chosen);
    const started = await h.start(OWNER, RECOMMENDATION, planned.action, false, () => true, h.now());
    expect(started?.action).toMatchObject({ followUpAt: chosen, reminderAt: chosen });
    expect(h.dependencies.cancelReminder).not.toHaveBeenCalled();
  });

  it('starts a due in-app-only planned step without touching native notifications', async () => {
    const h = harness();
    const accepted = await h.actions.acceptAdvisorAction(OWNER, RECOMMENDATION);
    const planned = await h.actions.setAdvisorActionFollowUp(OWNER, accepted.action!.id, h.now().toISOString(), null);
    const started = await h.start(OWNER, RECOMMENDATION, planned.action, false, () => true, h.now());
    expect(started?.action?.followUpAt).toBe(automaticAdvisorFollowUpAt(h.now()));
    expect(h.dependencies.cancelReminder).not.toHaveBeenCalled();
  });

  it('recovers a failed outcome write after restart without duplicate or sliding followups', async () => {
    const h = harness();
    h.dependencies.recordOffered.mockRejectedValueOnce(new Error('disk full'));
    await expect(h.start(OWNER, RECOMMENDATION, null, false, () => true, h.now())).rejects.toThrow('disk full');
    const persisted = await h.actions.loadAdvisorAction(OWNER);
    expect(h.values.has(advisorLifecycleStorageKey(OWNER))).toBe(true);
    h.advance(1);
    const replayed = await h.makeLifecycle().reconcileAdvisorLifecycle(OWNER);
    expect(replayed?.followUpAt).toBe(persisted?.followUpAt);
    expect(await h.outcomes.loadAdvisorOutcomes(OWNER)).toHaveLength(1);
    expect(h.values.has(advisorLifecycleStorageKey(OWNER))).toBe(false);
  });

  it('gives legacy in-progress actions without followups a check-in on Continue', async () => {
    const h = harness();
    const first = await h.start(OWNER, RECOMMENDATION, null, false, () => true, h.now());
    const legacy = { ...first!.action!, followUpAt: null };
    h.values.set(advisorActionStorageKey(OWNER), JSON.stringify(legacy));
    h.advance(1);
    const continued = await h.start(OWNER, RECOMMENDATION, legacy, false, () => true, h.now());
    expect(continued?.action?.followUpAt).toBe(automaticAdvisorFollowUpAt(h.now()));
  });

  it('ignores stale lifecycle commands for a replaced commitment', async () => {
    const h = harness();
    const first = await h.start(OWNER, RECOMMENDATION, null, false, () => true, h.now());
    await h.actions.acceptAdvisorAction(OWNER, { ...RECOMMENDATION, id: 'habit:other' }, { replace: true });
    await h.lifecycle.completeAdvisorLifecycle(OWNER, first!.action!);
    expect((await h.actions.loadAdvisorAction(OWNER))?.recommendationId).toBe('habit:other');
    expect((await h.outcomes.loadAdvisorOutcomes(OWNER))[0].completedAt).toBeNull();
    expect(h.dependencies.cancelReminder).not.toHaveBeenCalled();
  });

  it('never starts an accountability loop for a safety recommendation', async () => {
    const h = harness();
    const result = await h.start(OWNER, { ...RECOMMENDATION, kind: 'safety', route: '/resources' }, null, false, () => true, h.now());
    expect(result).toEqual({ route: '/resources', action: null });
    expect(h.values.size).toBe(0);
  });
});
