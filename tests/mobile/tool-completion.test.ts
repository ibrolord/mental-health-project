import { describe, expect, it, vi } from 'vitest';
import {
  createToolCompletionStorage, latestToolCompletionToday, toolCompletionsStorageKey,
  type ToolCompletion,
} from '../../mobile/lib/tool-completion-storage';
import {
  completionMatchesAction, createToolCompletionCoordinator, type ToolCompletionSession,
} from '../../mobile/lib/tool-completion-core';
import type { AdvisorActionInstance } from '../../mobile/lib/advisor-action-storage';

const NOW = new Date('2026-09-25T15:00:00Z');
const OWNER = 'user_id:11111111-1111-4111-8111-111111111111';
const OTHER = 'user_id:22222222-2222-4222-8222-222222222222';
const ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const OTHER_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const row: ToolCompletion = {
  id: ID, kind: 'grounding', itemId: 'overwhelmed',
  startedAt: '2026-09-25T14:55:00Z', completedAt: NOW.toISOString(),
  sourceStepId: 'step-1', partial: false, synced: false,
};
const action: AdvisorActionInstance = {
  version: 2, id: 'step-1', recommendationId: 'low-grounding',
  action: 'Try grounding.', smallerAction: 'Notice one thing.', route: '/ground',
  sourceLabels: [], observations: [], changeSignalId: null, status: 'in_progress',
  acceptedAt: '2026-09-25T14:50:00Z', startedAt: '2026-09-25T14:54:00Z',
  reminderAt: null, followUpAt: null, lastCheckInAt: null, lastCheckInResult: null,
  recoveryReason: null, recoveryCount: 0, useSmallerStep: false, updatedAt: '2026-09-25T14:54:00Z',
};
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => { resolve = r; });
  return { promise, resolve };
}
function harness() {
  const values = new Map<string, string>();
  const adapter = {
    getItem: vi.fn(async (key: string) => values.get(key) ?? null),
    setItem: vi.fn(async (key: string, value: string) => { values.set(key, value); }),
    removeItem: vi.fn(async (key: string) => { values.delete(key); }),
  };
  const storage = createToolCompletionStorage(adapter, () => NOW);
  let owner = OWNER;
  let active: AdvisorActionInstance | null = { ...action };
  const deps = {
    storage,
    currentOwner: vi.fn(async () => owner),
    upload: vi.fn(async (_owner: string, _rows: ToolCompletion[]) => {}),
    download: vi.fn(async () => [] as ToolCompletion[]),
    reconcileAction: vi.fn(async () => active),
    completeAction: vi.fn(async (): Promise<AdvisorActionInstance | null> => { active = null; return null; }),
    clearBrief: vi.fn(async () => {}),
  };
  const coordinator = createToolCompletionCoordinator(deps, () => NOW);
  const token = (overrides: Partial<ToolCompletionSession> = {}): ToolCompletionSession => ({
    id: ID, kind: row.kind, itemId: row.itemId, startedAt: row.startedAt,
    sourceStepId: row.sourceStepId, ownerKey: OWNER, generation: storage.generation(OWNER), ...overrides,
  });
  return { adapter, values, storage, coordinator, deps, token,
    setOwner: (next: string) => { owner = next; },
    setAction: (next: AdvisorActionInstance | null) => { active = next; },
  };
}

describe('tool completion persistence', () => {
  it('preserves concurrent sessions and deduplicates repeated finish effects across reloads', async () => {
    const h = harness();
    await Promise.all([
      h.storage.add(OWNER, row), h.storage.add(OWNER, row),
      h.storage.add(OWNER, { ...row, id: OTHER_ID }),
    ]);
    const restored = createToolCompletionStorage(h.adapter, () => NOW);
    expect((await restored.list(OWNER)).map((item) => item.id).sort()).toEqual([ID, OTHER_ID]);
    expect(await restored.list(OTHER)).toEqual([]);
  });
  it('does not replace a completion with conflicting data on an ID retry', async () => {
    const h = harness();
    await h.storage.add(OWNER, row);
    await h.storage.add(OWNER, { ...row, kind: 'journal', sourceStepId: null });
    expect(await h.storage.list(OWNER)).toEqual([row]);
  });
  it('keeps unsynced sessions when an acknowledgement races a new write', async () => {
    const h = harness();
    await h.storage.add(OWNER, row);
    await Promise.all([
      h.storage.markSynced(OWNER, [ID]), h.storage.add(OWNER, { ...row, id: OTHER_ID }),
    ]);
    expect((await h.storage.list(OWNER)).find((item) => item.id === ID)?.synced).toBe(true);
    expect((await h.storage.list(OWNER)).find((item) => item.id === OTHER_ID)?.synced).toBe(false);
  });
  it('drops expired and malformed records and never displays partial or future completions', async () => {
    const h = harness();
    h.values.set(toolCompletionsStorageKey(OWNER), JSON.stringify([
      row, { ...row, id: OTHER_ID, startedAt: '2026-01-01T00:00:00Z', completedAt: '2026-01-01T01:00:00Z' },
      { ...row, id: 'invalid' },
    ]));
    expect(await h.storage.list(OWNER)).toEqual([row]);
    expect(latestToolCompletionToday([{ ...row, partial: true }], NOW)).toBeNull();
    expect(latestToolCompletionToday([{ ...row, completedAt: '2026-09-25T23:00:00Z' }], NOW)).toBeNull();
  });
  it('invalidates queued completions and remote merges when data is cleared', async () => {
    const h = harness();
    const old = h.storage.generation(OWNER);
    await h.storage.clear(OWNER);
    expect(await h.storage.add(OWNER, row, old)).toBe(false);
    await h.storage.merge(OWNER, [{ ...row, synced: true }], old);
    expect(await h.storage.list(OWNER)).toEqual([]);
  });
  it('does not resurrect a mirror after the app exits during data deletion', async () => {
    const h = harness();
    await h.storage.add(OWNER, row);
    await h.storage.beginDeletion(OWNER);
    const afterRestart = createToolCompletionStorage(h.adapter, () => NOW);
    expect(await afterRestart.list(OWNER)).toEqual([]);
    expect(h.values.has(toolCompletionsStorageKey(OWNER))).toBe(false);
  });
});

describe('tool completion write-back', () => {
  it('closes only the exact started grounding step, once, and clears its cached brief', async () => {
    const h = harness();
    await Promise.all([h.coordinator.record(h.token()), h.coordinator.record(h.token())]);
    expect(h.deps.completeAction).toHaveBeenCalledTimes(1);
    expect(h.deps.completeAction).toHaveBeenCalledWith(OWNER, action);
    expect(h.deps.clearBrief).toHaveBeenCalledWith(OWNER);
    expect((await h.coordinator.refresh(OWNER)).action).toBeNull();
    expect((await h.storage.list(OWNER))).toHaveLength(1);
  });
  it.each([
    { sourceStepId: null }, { sourceStepId: 'different-step' }, { kind: 'journal' as const },
    { startedAt: '2026-09-25T14:00:00Z' },
  ])('records browsed/unrelated activity without completing the current step: %o', async (change) => {
    const h = harness();
    await h.coordinator.record(h.token(change));
    expect(h.deps.completeAction).not.toHaveBeenCalled();
    expect((await h.storage.list(OWNER))[0].sourceStepId).toBeNull();
    expect((await h.coordinator.refresh(OWNER)).action?.id).toBe(action.id);
  });
  it('retains a replacement action returned while an older completion is reconciled', async () => {
    const h = harness();
    const replacement = { ...action, id: 'new-step' };
    await h.storage.add(OWNER, row);
    h.deps.completeAction.mockImplementationOnce(async () => {
      h.setAction(replacement);
      return replacement;
    });
    expect((await h.coordinator.refresh(OWNER)).action).toEqual(replacement);
    expect(h.deps.clearBrief).not.toHaveBeenCalled();
  });
  it('never completes a merely accepted action or a partial session', () => {
    expect(completionMatchesAction(row, { ...action, status: 'accepted' })).toBe(false);
    expect(completionMatchesAction({ ...row, partial: true }, action)).toBe(false);
  });
  it('saves offline immediately and retries uploading the same ID on a later refresh', async () => {
    const h = harness();
    h.deps.upload.mockRejectedValueOnce(new Error('offline'));
    expect(await h.coordinator.record(h.token())).toBe(true);
    await h.coordinator.sync(OWNER).catch(() => {});
    expect((await h.storage.list(OWNER))[0].synced).toBe(false);
    await h.coordinator.sync(OWNER);
    expect((await h.storage.list(OWNER))[0].synced).toBe(true);
    expect(h.deps.upload.mock.calls.every((call) => call[1][0].id === ID)).toBe(true);
  });
  it('does not wait for network upload to return the local acknowledgement', async () => {
    const h = harness();
    const network = deferred<void>();
    h.deps.upload.mockImplementation(() => network.promise);
    expect(await h.coordinator.record(h.token())).toBe(true);
    expect((await h.coordinator.refresh(OWNER)).completion?.id).toBe(ID);
    network.resolve();
    await h.coordinator.sync(OWNER);
  });
  it('retries a failed Advisor transition from the durable local completion', async () => {
    const h = harness();
    h.deps.completeAction.mockRejectedValueOnce(new Error('disk full'));
    expect(await h.coordinator.record(h.token())).toBe(true);
    expect((await h.coordinator.refresh(OWNER)).action).toBeNull();
    expect(h.deps.completeAction).toHaveBeenCalledTimes(2);
  });
  it('rejects a finish after account switching and does not upload another owner’s records', async () => {
    const h = harness();
    const token = h.token();
    h.setOwner(OTHER);
    expect(await h.coordinator.record(token)).toBe(false);
    await h.coordinator.sync(OWNER);
    expect(await h.storage.list(OWNER)).toEqual([]);
    expect(await h.storage.list(OTHER)).toEqual([]);
    expect(h.deps.upload).not.toHaveBeenCalled();
  });
  it('drains an in-flight upload before deletion and blocks old sessions from restoring data', async () => {
    const h = harness();
    const network = deferred<void>();
    const entered = deferred<void>();
    const events: string[] = [];
    h.deps.upload.mockImplementation(async () => {
      entered.resolve(); await network.promise; events.push('upload');
    });
    const token = h.token();
    await h.coordinator.record(token);
    await entered.promise;
    const deleting = h.coordinator.remove(OWNER, async () => { events.push('delete'); });
    expect(await h.coordinator.record({ ...token, id: OTHER_ID })).toBe(false);
    network.resolve();
    await deleting;
    expect(events).toEqual(['upload', 'delete']);
    expect(await h.storage.list(OWNER)).toEqual([]);
    expect(await h.coordinator.record(token)).toBe(false);
  });
  it('does not re-upload old records after an ambiguous server deletion response', async () => {
    const h = harness();
    await h.storage.add(OWNER, row);
    await expect(h.coordinator.remove(OWNER, async () => { throw new Error('offline'); })).rejects.toThrow('offline');
    expect(await h.storage.list(OWNER)).toEqual([]);
    expect(await h.coordinator.record(h.token({ id: OTHER_ID }))).toBe(true);
  });
  it('retains pending completions through sign-out and uploads only after the same owner returns', async () => {
    const h = harness();
    await h.storage.add(OWNER, row);
    await h.storage.add(OWNER, { ...row, id: OTHER_ID, synced: true });
    const oldSession = h.token();
    await h.coordinator.suspend(OWNER);
    h.setOwner(OTHER);
    await h.coordinator.sync(OWNER);
    expect(h.deps.upload).not.toHaveBeenCalled();
    expect(await h.storage.list(OWNER)).toEqual([row]);
    h.setOwner(OWNER);
    expect(await h.coordinator.record(oldSession)).toBe(false);
    await h.coordinator.sync(OWNER);
    expect((await h.storage.list(OWNER))[0].synced).toBe(true);
  });
  it('preserves source records when a profile migration fails before copying them', async () => {
    const h = harness();
    await h.storage.add(OWNER, row);
    await expect(h.coordinator.remove(OWNER, async () => { throw new Error('disk full'); }, false)).rejects.toThrow('disk full');
    expect(await h.storage.list(OWNER)).toEqual([row]);
  });
  it('drains source uploads before transferring server ownership and pending local records', async () => {
    const h = harness();
    const entered = deferred<void>();
    const network = deferred<void>();
    let remoteOwner: string | null = null;
    h.deps.upload.mockImplementation(async () => {
      entered.resolve();
      await network.promise;
      remoteOwner = OWNER;
    });
    await h.coordinator.record(h.token());
    await entered.promise;
    h.setOwner(OTHER);
    const merging = h.coordinator.remove(OWNER, async () => {
      expect(remoteOwner).toBe(OWNER);
      remoteOwner = OTHER;
      await h.storage.merge(OTHER, await h.storage.list(OWNER));
    }, false);
    network.resolve();
    await merging;
    expect(remoteOwner).toBe(OTHER);
    expect(await h.storage.list(OWNER)).toEqual([]);
    expect((await h.storage.list(OTHER)).map((record) => record.id)).toEqual([ID]);
  });
  it('keeps sync blocked if local erasure fails after remote deletion', async () => {
    const h = harness();
    await h.storage.add(OWNER, row);
    h.adapter.removeItem.mockRejectedValueOnce(new Error('disk error'));
    await expect(h.coordinator.remove(OWNER, async () => {})).rejects.toThrow('disk error');
    await h.coordinator.sync(OWNER);
    expect(h.deps.upload).not.toHaveBeenCalled();
    expect(await h.coordinator.record(h.token({ id: OTHER_ID }))).toBe(false);
  });
});
