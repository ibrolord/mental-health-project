import { afterEach, describe, expect, it, vi } from 'vitest';
import { createAdvisorClientCoordinator, DEFAULT_ADVISOR_CLIENT_PREFERENCES, loadAdvisorClientSnapshot, parseAdvisorClientPreferences, type AdvisorClientPreferences } from '../../mobile/lib/advisor-client-core';
import type { AdvisorActionInstance } from '../../mobile/lib/advisor-action-storage';

const time = new Date('2026-10-02T14:00:00Z');
afterEach(() => vi.useRealTimers());
function step(patch: Partial<AdvisorActionInstance> = {}): AdvisorActionInstance {
  return { version: 2, id: 'step-1', recommendationId: 'goal:1', action: 'Study', smallerAction: 'Open a book',
    route: '/goals', sourceLabels: [], observations: [], changeSignalId: null, status: 'in_progress',
    acceptedAt: time.toISOString(), startedAt: time.toISOString(), reminderAt: null,
    followUpAt: '2026-10-02T16:00:00Z', lastCheckInAt: null, lastCheckInResult: null,
    recoveryReason: null, recoveryCount: 0, useSmallerStep: false, updatedAt: time.toISOString(), ...patch };
}
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
}
function harness() {
  const state = { owner: 'user_id:a' as string | null,
    prefs: { ...DEFAULT_ADVISOR_CLIENT_PREFERENCES, enabled: true },
    action: step() as AdvisorActionInstance | null, safety: false, completed: false };
  const deps = {
    currentOwner: vi.fn(async () => state.owner), read: vi.fn(async () => ({ ...state.prefs })),
    write: vi.fn(async (_owner: string, prefs: AdvisorClientPreferences) => { state.prefs = prefs; }),
    load: vi.fn(async () => ({ action: state.action, safety: state.safety, targetCompleted: state.completed })),
    loadAction: vi.fn(async () => state.action), refreshCompletions: vi.fn(async () => {}),
    complete: vi.fn(async () => { state.action = null; }),
    schedule: vi.fn(async (_input: unknown, current: () => Promise<boolean>) => { expect(await current()).toBe(true); }),
    cancel: vi.fn(async () => {}), clearHistory: vi.fn(async (_owner: string) => {}), syncBackground: vi.fn(async (_enabled: boolean) => 'available'),
    emit: vi.fn(), now: () => time,
  };
  return { state, deps, coordinator: createAdvisorClientCoordinator(deps) };
}

describe('Advisor client preferences', () => {
  it('uses only an existing local step when remote data fails', async () => {
    await expect(loadAdvisorClientSnapshot(async () => {throw new Error('offline');}, async () => step()))
      .resolves.toEqual({action:step(),safety:false,targetCompleted:false});
  });
  it('bounds slow context reads without inventing completion or another step', async () => {
    vi.useFakeTimers();
    const work = loadAdvisorClientSnapshot(() => new Promise(() => {}), async () => null);
    await vi.advanceTimersByTimeAsync(4_000);
    await expect(work).resolves.toEqual({action:null,safety:false,targetCompleted:false});
    expect(vi.getTimerCount()).toBe(0);
  });
  it('preserves a known safety snapshot rather than using local fallback', async () => {
    const local = vi.fn(async () => step());
    const result = await loadAdvisorClientSnapshot(async () => ({action:null,safety:true,targetCompleted:false}), local);
    expect(result.safety).toBe(true); expect(local).not.toHaveBeenCalled();
  });
  it.each([null, '', 'oops', '{}', '[]', '{"enabled":true}', '{"enabled":"true"}'])('fails closed for %s', (raw) => {
    expect(parseAdvisorClientPreferences(raw)).toEqual(DEFAULT_ADVISOR_CLIENT_PREFERENCES);
  });
  it.each([{quietStartHour: 24}, {quietEndHour: -1}, {quietEndHour: 8.5}, {quietEndHour: 21}, {pausedUntil:'bad'}])('rejects invalid quiet hours or pause: %j', (patch) => {
    expect(parseAdvisorClientPreferences(JSON.stringify({...DEFAULT_ADVISOR_CLIENT_PREFERENCES, enabled:true, ...patch})).enabled).toBe(false);
  });
  it('round trips an explicit choice and pause', () => {
    const prefs = {...DEFAULT_ADVISOR_CLIENT_PREFERENCES, enabled:true, pausedUntil:'2026-10-03T12:00:00Z'};
    expect(parseAdvisorClientPreferences(JSON.stringify(prefs))).toEqual(prefs);
  });
});

describe('client-first follow-up coordinator', () => {
  it('schedules a started action with saved quiet hours and refreshes the UI', async () => {
    const h = harness(); await h.coordinator.refresh();
    expect(h.deps.schedule).toHaveBeenCalledWith({ownerKey:'user_id:a',actionId:'step-1',followUpAt:'2026-10-02T16:00:00Z',quietStartHour:21,quietEndHour:8},expect.any(Function));
    expect(h.deps.emit).toHaveBeenCalledWith('user_id:a','refreshed');
  });
  it.each(['off', 'paused'] as const)('does not load context when %s', async (kind) => {
    const h = harness();
    if (kind === 'off') h.state.prefs.enabled = false;
    else h.state.prefs.pausedUntil = '2026-10-03T12:00:00Z';
    await h.coordinator.refresh();
    expect(h.deps.load).not.toHaveBeenCalled(); expect(h.deps.schedule).not.toHaveBeenCalled();
    expect(h.deps.cancel).toHaveBeenCalledOnce();
    expect(h.deps.syncBackground).toHaveBeenCalledWith(kind === 'paused');
  });
  it('resumes after a pause expires without forcing a new foreground visit', async () => {
    const h = harness(); h.state.prefs.pausedUntil = '2026-10-01T12:00:00Z';
    await h.coordinator.refresh(); expect(h.deps.schedule).toHaveBeenCalledOnce();
  });
  it('does not create an anonymous session or schedule when signed out', async () => {
    const h = harness(); h.state.owner = null;
    await h.coordinator.refresh(); expect(h.deps.load).not.toHaveBeenCalled();
    expect(h.deps.syncBackground).not.toHaveBeenCalled();
  });
  it('gives safety priority before completion work', async () => {
    const h = harness(); h.state.safety = true;
    await h.coordinator.refresh(); expect(h.deps.refreshCompletions).not.toHaveBeenCalled();
    expect(h.deps.schedule).not.toHaveBeenCalled(); expect(h.deps.cancel).toHaveBeenCalledOnce();
  });
  it('does not let an older snapshot restore a reminder after a newer safety cancellation', async () => {
    const h = harness(); const entered = deferred(); const release = deferred();
    h.deps.load.mockImplementationOnce(async () => {
      entered.resolve(); await release.promise;
      return {action:step(),safety:false,targetCompleted:false};
    });
    const older = h.coordinator.refresh(); await entered.promise;
    h.state.safety = true;
    await h.coordinator.refresh();
    expect(h.deps.cancel).toHaveBeenCalledOnce();
    release.resolve(); await older;
    expect(h.deps.schedule).not.toHaveBeenCalled();
    expect(h.deps.refreshCompletions).not.toHaveBeenCalled();
    expect(h.deps.emit).toHaveBeenCalledTimes(1);
  });
  it('does not apply an older safety result after a newer snapshot has scheduled', async () => {
    const h = harness(); const entered = deferred(); const release = deferred();
    h.deps.load.mockImplementationOnce(async () => {
      entered.resolve(); await release.promise;
      return {action:step(),safety:true,targetCompleted:false};
    });
    const older = h.coordinator.refresh(); await entered.promise;
    await h.coordinator.refresh();
    expect(h.deps.schedule).toHaveBeenCalledOnce();
    release.resolve(); await older;
    expect(h.deps.cancel).not.toHaveBeenCalled();
    expect(h.deps.schedule).toHaveBeenCalledOnce();
  });
  it('does not complete a step from superseded remote evidence', async () => {
    const h = harness(); const entered = deferred(); const release = deferred();
    h.deps.load.mockImplementationOnce(async () => {
      entered.resolve(); await release.promise;
      return {action:step(),safety:false,targetCompleted:true};
    });
    const older = h.coordinator.refresh(); await entered.promise;
    await h.coordinator.refresh();
    release.resolve(); await older;
    expect(h.deps.complete).not.toHaveBeenCalled();
    expect(h.deps.schedule).toHaveBeenCalledOnce();
  });
  it.each([null, step({status:'accepted'}), step({status:'needs_recovery'}), step({startedAt:null}), step({followUpAt:null}), step({reminderAt:'2026-10-02T17:00:00Z'})])('does not create another reminder for an ineligible action %j', async (action) => {
    const h = harness(); h.state.action = action;
    await h.coordinator.refresh(); expect(h.deps.schedule).not.toHaveBeenCalled(); expect(h.deps.cancel).toHaveBeenCalledOnce();
  });
  it('completes the same confirmed goal and cancels its pending automatic reminder', async () => {
    const h = harness(); h.state.completed = true;
    await h.coordinator.refresh(); expect(h.deps.complete).toHaveBeenCalledWith('user_id:a',expect.objectContaining({id:'step-1'}));
    expect(h.deps.schedule).not.toHaveBeenCalled(); expect(h.deps.cancel).toHaveBeenCalledOnce();
  });
  it('does not complete a replacement action using old evidence', async () => {
    const h = harness(); h.state.completed = true;
    h.deps.refreshCompletions.mockImplementation(async () => {h.state.action = step({id:'step-2'});});
    await h.coordinator.refresh(); expect(h.deps.complete).not.toHaveBeenCalled();
    expect(h.deps.schedule).toHaveBeenCalledWith(expect.objectContaining({actionId:'step-2'}),expect.any(Function));
  });
  it('notices a tool completion before scheduling', async () => {
    const h = harness(); h.deps.refreshCompletions.mockImplementation(async () => {h.state.action = null;});
    await h.coordinator.refresh(); expect(h.deps.schedule).not.toHaveBeenCalled();
  });
  it('drops a slow read after an account switch without cancelling the new account reminder', async () => {
    const h = harness(); const barrier = deferred(); const entered = deferred();
    h.deps.load.mockImplementation(async () => {entered.resolve(); await barrier.promise; return {action:step(),safety:false,targetCompleted:false};});
    const work = h.coordinator.refresh(); await entered.promise; h.state.owner = 'user_id:b'; barrier.resolve(); await work;
    expect(h.deps.schedule).not.toHaveBeenCalled(); expect(h.deps.cancel).not.toHaveBeenCalled(); expect(h.deps.emit).not.toHaveBeenCalled();
  });
  it('checks the action again at the native scheduling boundary', async () => {
    const h = harness(); h.deps.schedule.mockImplementation(async (_input, current) => {
      h.state.action = step({id:'replacement'}); expect(await current()).toBe(false);
    });
    await h.coordinator.refresh();
  });
  it('invalidates an in-flight refresh immediately when pausing', async () => {
    const h = harness(); const barrier = deferred(); const entered = deferred();
    h.deps.load.mockImplementation(async () => {entered.resolve(); await barrier.promise; return {action:step(),safety:false,targetCompleted:false};});
    const work = h.coordinator.refresh(); await entered.promise;
    const pause = h.coordinator.update('user_id:a',{pausedUntil:'2026-10-03T12:00:00Z'});
    await pause;
    expect(h.deps.cancel).toHaveBeenCalledWith('user_id:a');
    barrier.resolve(); await work;
    expect(h.deps.schedule).not.toHaveBeenCalled(); expect(h.state.prefs.pausedUntil).toBe('2026-10-03T12:00:00Z');
  });
  it('drains and disables before data deletion; later wakes cannot recreate state', async () => {
    const h = harness(); const barrier = deferred(); const entered = deferred();
    h.deps.load.mockImplementation(async () => {entered.resolve(); await barrier.promise; return {action:step(),safety:false,targetCompleted:false};});
    const work = h.coordinator.refresh(); await entered.promise; const clear = h.coordinator.clear('user_id:a');
    await clear;
    expect(h.deps.cancel).toHaveBeenCalledWith('user_id:a');
    barrier.resolve(); await work; await h.coordinator.refresh();
    expect(h.deps.clearHistory).toHaveBeenCalledWith('user_id:a');
    expect(h.deps.schedule).not.toHaveBeenCalled(); expect(h.state.prefs.enabled).toBe(false);
    expect(h.deps.syncBackground).toHaveBeenLastCalledWith(false);
  });
  it('requires explicit opt-in again after cleanup', async () => {
    const h = harness(); await h.coordinator.clear('user_id:a');
    await h.coordinator.update('user_id:a',{enabled:true});
    expect(h.deps.schedule).toHaveBeenCalledOnce();
  });
  it('refuses preferences from a stale Settings screen', async () => {
    const h = harness(); h.state.owner='user_id:b';
    await expect(h.coordinator.update('user_id:a',{enabled:true})).rejects.toThrow('profile changed');
    expect(h.deps.write).not.toHaveBeenCalled();
  });
  it('rejects an empty quiet interval without writing settings', async () => {
    const h = harness(); await expect(h.coordinator.update('user_id:a',{quietEndHour:21})).rejects.toThrow('different');
    expect(h.deps.write).not.toHaveBeenCalled();
  });
  it('applies quiet hours locally before reporting success, without waiting for context', async () => {
    const h = harness();
    await h.coordinator.update('user_id:a',{quietStartHour:20,quietEndHour:9});
    expect(h.deps.load).not.toHaveBeenCalled();
    expect(h.deps.schedule).toHaveBeenCalledWith(expect.objectContaining({quietStartHour:20,quietEndHour:9}),expect.any(Function));
  });
  it('uses committed quiet hours when a refresh starts during a preference write', async () => {
    const h = harness(); const writing = deferred(); const release = deferred();
    h.deps.write.mockImplementation(async (_owner, prefs) => {
      writing.resolve(); await release.promise; h.state.prefs = prefs;
    });
    const save = h.coordinator.update('user_id:a', {quietStartHour:20});
    await writing.promise;
    const refresh = h.coordinator.refresh();
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(h.deps.load).not.toHaveBeenCalled();
    release.resolve();
    await save; await refresh;
    expect(h.state.prefs.quietStartHour).toBe(20);
    expect(h.deps.schedule.mock.calls.map(([input]) => (input as {quietStartHour:number}).quietStartHour)).toEqual([20,20]);
  });
  it('does not cancel an opt-in using an old disabled preference snapshot', async () => {
    const h = harness(); h.state.prefs.enabled = false;
    const writing = deferred(); const release = deferred();
    h.deps.write.mockImplementation(async (_owner, prefs) => {
      writing.resolve(); await release.promise; h.state.prefs = prefs;
    });
    const save = h.coordinator.update('user_id:a', {enabled:true});
    await writing.promise;
    const refresh = h.coordinator.refresh();
    await new Promise<void>((resolve) => setImmediate(resolve));
    release.resolve();
    await save; await refresh;
    expect(h.deps.cancel).not.toHaveBeenCalled();
    expect(h.deps.syncBackground).toHaveBeenLastCalledWith(true);
    expect(h.deps.schedule).toHaveBeenCalledTimes(2);
  });
  it('does not unregister the new profile task when clearing an old profile', async () => {
    const h = harness(); h.state.owner='user_id:b';
    await h.coordinator.clear('user_id:a');
    expect(h.deps.cancel).toHaveBeenCalledWith('user_id:a');
    expect(h.deps.syncBackground).not.toHaveBeenCalled();
  });
  it('reports failures and allows a later refresh to retry', async () => {
    const h = harness(); h.deps.load.mockRejectedValueOnce(new Error('offline'));
    await expect(h.coordinator.refresh()).rejects.toThrow('offline');
    expect(h.deps.schedule).not.toHaveBeenCalled(); await h.coordinator.refresh();
    expect(h.deps.schedule).toHaveBeenCalledOnce();
  });
});
