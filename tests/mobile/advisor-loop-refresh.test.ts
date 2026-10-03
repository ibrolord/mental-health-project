import { describe, expect, it, vi } from 'vitest';
import { createAdvisorLoopRefresh } from '../../mobile/lib/advisor-loop-refresh';

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
}

describe('Advisor foreground refresh gate', () => {
  it('tracks background state while the owner is temporarily unavailable', async () => {
    let current = true;
    const load = vi.fn(async () => {});
    const gate = createAdvisorLoopRefresh({ isOwnerCurrent: () => current, load, onLoading: vi.fn(), onError: vi.fn() });
    await gate.refresh();
    current = false;
    gate.setAppActive(false);
    current = true;
    await gate.refresh();
    expect(load).toHaveBeenCalledTimes(1);
    gate.setAppActive(true);
    await gate.refresh();
    expect(load).toHaveBeenCalledTimes(2);
    gate.dispose();
  });
  it('replaces a queued pre-background change with a single fresh foreground load', async () => {
    const slow = deferred();
    const load = vi.fn(async () => { if (load.mock.calls.length === 1) await slow.promise; });
    const gate = createAdvisorLoopRefresh({ isOwnerCurrent: () => true, load, onLoading: vi.fn(), onError: vi.fn() });
    const old = gate.refresh();
    await Promise.resolve();
    void gate.refresh(false, true);
    gate.setAppActive(false);
    gate.setAppActive(true);
    await gate.refresh();
    slow.resolve();
    await old;
    expect(load).toHaveBeenCalledTimes(2);
    gate.dispose();
  });
  it('coalesces data changes during a model request into one fresh load', async () => {
    const slow = deferred();
    const seen: number[] = [];
    let data = 0;
    const gate = createAdvisorLoopRefresh({
      isOwnerCurrent: () => true, onLoading: vi.fn(), onError: vi.fn(),
      load: async () => { seen.push(data); if (seen.length === 1) await slow.promise; },
    });
    const pending = gate.refresh();
    await Promise.resolve();
    data = 1;
    void gate.refresh(false, true);
    data = 2;
    void gate.refresh(false, true);
    slow.resolve();
    await pending;
    await gate.refresh();
    expect(seen).toEqual([0, 2]);
    gate.dispose();
  });
  it('refreshes relevant context once per real foreground event, without polling or prompting for consent', async () => {
    const readContext = vi.fn(async () => {});
    const readAction = vi.fn(async () => {});
    const readCompletion = vi.fn(async () => {});
    const load = vi.fn(async (_request: { allowConsent: boolean }) => {
      await readContext(); await readAction(); await readCompletion();
    });
    const gate = createAdvisorLoopRefresh({ isOwnerCurrent: () => true, load, onLoading: vi.fn(), onError: vi.fn() });
    await gate.refresh(true);
    gate.setAppActive(true);
    expect(load).toHaveBeenCalledTimes(1);
    gate.setAppActive(false);
    gate.setAppActive(true);
    await gate.refresh();
    expect(load).toHaveBeenCalledTimes(2);
    expect(load.mock.calls[1][0]).toMatchObject({ allowConsent: false });
    expect(readContext).toHaveBeenCalledTimes(2);
    expect(readCompletion).toHaveBeenCalledTimes(2);
    expect(readAction).toHaveBeenCalledTimes(2);
  });

  it('deduplicates overlapping loads and drops late results from before backgrounding', async () => {
    const slow = deferred();
    const values: string[] = [];
    let count = 0;
    const gate = createAdvisorLoopRefresh({
      isOwnerCurrent: () => true, onLoading: vi.fn(), onError: vi.fn(),
      load: async ({ isCurrent }) => {
        count += 1;
        const id = count;
        if (id === 1) await slow.promise;
        if (isCurrent()) values.push(`snapshot-${id}`);
      },
    });
    const old = gate.refresh();
    expect(gate.refresh()).toBe(old);
    await Promise.resolve();
    gate.setAppActive(false);
    gate.setAppActive(true);
    await gate.refresh();
    slow.resolve();
    await old;
    expect(values).toEqual(['snapshot-2']);
  });

  it.each(['owner', 'blur'] as const)('drops results and errors after %s changes', async (kind) => {
    const slow = deferred();
    let owner = 'a';
    const applied = vi.fn();
    const onError = vi.fn();
    const gate = createAdvisorLoopRefresh({
      isOwnerCurrent: () => owner === 'a', onLoading: vi.fn(), onError,
      load: async ({ isCurrent }) => {
        await slow.promise;
        if (isCurrent()) applied();
        throw new Error('stale network error');
      },
    });
    const pending = gate.refresh();
    await Promise.resolve();
    if (kind === 'owner') owner = 'b'; else gate.dispose();
    slow.resolve();
    await pending;
    expect(applied).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
    expect(gate.beginMutation()).toBeNull();
  });

  it('queues foreground reads behind a durable mutation and coalesces repeated resumes', async () => {
    let stored = 'before';
    const seen: string[] = [];
    const gate = createAdvisorLoopRefresh({
      isOwnerCurrent: () => true, onLoading: vi.fn(), onError: vi.fn(),
      load: async () => { seen.push(stored); },
    });
    await gate.refresh();
    const operation = gate.beginMutation()!;
    expect(gate.beginMutation()).toBeNull();
    for (let i = 0; i < 3; i++) { gate.setAppActive(false); gate.setAppActive(true); }
    expect(seen).toEqual(['before']);
    stored = 'completed';
    operation.finish();
    await gate.refresh();
    expect(seen).toEqual(['before', 'completed']);
    expect(operation.isCurrent()).toBe(false);
  });

  it('invalidates an in-flight read when a user mutation starts', async () => {
    const slow = deferred();
    const applied = vi.fn();
    const gate = createAdvisorLoopRefresh({
      isOwnerCurrent: () => true, onLoading: vi.fn(), onError: vi.fn(),
      load: async ({ isCurrent }) => { await slow.promise; if (isCurrent()) applied(); },
    });
    const reading = gate.refresh();
    await Promise.resolve();
    const operation = gate.beginMutation()!;
    slow.resolve();
    await reading;
    expect(applied).not.toHaveBeenCalled();
    operation.finish();
    await gate.refresh();
    expect(applied).toHaveBeenCalledTimes(1);
  });

  it('does not let a disposed mutation affect a later visit, even to the same owner', async () => {
    const load = vi.fn(async () => {});
    const gate = createAdvisorLoopRefresh({ isOwnerCurrent: () => true, load, onLoading: vi.fn(), onError: vi.fn() });
    const operation = gate.beginMutation()!;
    await gate.refresh();
    gate.dispose();
    expect(operation.isCurrent()).toBe(false);
    operation.finish();
    await gate.refresh();
    expect(load).not.toHaveBeenCalled();
  });

  it('reports current failures and permits the next foreground retry', async () => {
    const load = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(undefined);
    const onError = vi.fn();
    const gate = createAdvisorLoopRefresh({ isOwnerCurrent: () => true, load, onLoading: vi.fn(), onError });
    await gate.refresh();
    gate.setAppActive(false);
    gate.setAppActive(true);
    await gate.refresh();
    expect(load).toHaveBeenCalledTimes(2);
    expect(onError).toHaveBeenCalledTimes(1);
  });
});
