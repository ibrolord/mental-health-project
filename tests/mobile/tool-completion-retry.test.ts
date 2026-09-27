import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import ts from 'typescript';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ToolCompletionSession } from '../../mobile/lib/tool-completion-core';

type Hook = {
  start(itemId: string): ToolCompletionSession | null;
  complete(session: ToolCompletionSession | null, result?: { id?: string; completedAt?: string }): Promise<boolean>;
  retry(): Promise<boolean>;
  canRetry: boolean;
  retrying: boolean;
  error: string;
};
type Slot = { value?: unknown; deps?: unknown[] };

// Run the actual hook against controlled auth, storage results and React state.
// Native UI/device behavior is deliberately outside this test's claim.
function mountHook() {
  const slots: Slot[] = [];
  let cursor = 0;
  let owner: string | null = 'owner-a';
  let effects: Array<() => void> = [];
  let result: Hook;
  let sequence = 0;
  const record = vi.fn(async (_session: ToolCompletionSession, _result: { id?: string; completedAt?: string }) => true);
  const hooks = {
    useRef(value: unknown) {
      const index = cursor++;
      slots[index] ??= { value: { current: value } };
      return slots[index].value;
    },
    useState(value: unknown) {
      const index = cursor++;
      slots[index] ??= { value };
      return [slots[index].value, (next: unknown) => { slots[index].value = next; }];
    },
    useCallback(value: unknown) { cursor++; return value; },
    useEffect(effect: () => void, deps: unknown[]) {
      const index = cursor++;
      const previous = slots[index]?.deps;
      slots[index] = { deps };
      if (!previous || deps.some((value, i) => value !== previous[i])) effects.push(effect);
    },
  };
  const source = readFileSync(resolve(process.cwd(), 'mobile/lib/hooks/use-tool-completion.ts'), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const evaluated = { exports: {} as { useToolCompletion(kind: string): Hook } };
  const requireMock = (name: string) => {
    if (name === 'react') return hooks;
    if (name === 'expo-router') return { useLocalSearchParams: () => ({ sourceStepId: 'step-1' }) };
    if (name === './use-data-context') return {
      useDataContext: () => ({ context: { user_id: owner }, authLoading: false }),
    };
    if (name === '../tool-completion-runtime') return {
      recordToolCompletion: record,
      startToolCompletion: (ownerKey: string, kind: string, itemId: string, sourceStepId: string) => ({
        id: `run-${++sequence}`, ownerKey, generation: 0, kind, itemId, sourceStepId,
        startedAt: new Date().toISOString(),
      }),
    };
    throw new Error(`Unexpected hook dependency: ${name}`);
  };
  new Function('require', 'module', 'exports', compiled)(requireMock, evaluated, evaluated.exports);
  const render = () => {
    cursor = 0;
    effects = [];
    result = evaluated.exports.useToolCompletion('focus');
    if (effects.length) {
      for (const effect of effects) effect();
      cursor = 0;
      effects = [];
      result = evaluated.exports.useToolCompletion('focus');
    }
    return result;
  };
  render();
  return { record, render, get current() { return result; }, changeOwner(next: string | null) { owner = next; render(); } };
}

afterEach(() => vi.useRealTimers());

describe('tool completion recovery', () => {
  it('retries only the original completion with its persisted entry ID and first completion timestamp', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-25T12:00:00.000Z'));
    const hook = mountHook();
    const session = hook.current.start('focus')!;
    hook.record.mockRejectedValueOnce(new Error('Disk write failed'));
    expect(await hook.current.complete(session, { id: 'persisted-entry-id' })).toBe(false);
    expect(hook.render().canRetry).toBe(true);
    vi.setSystemTime(new Date('2026-09-25T12:03:00.000Z'));
    expect(await hook.current.retry()).toBe(true);
    expect(hook.render()).toMatchObject({ canRetry: false, retrying: false, error: '' });
    expect(hook.record.mock.calls).toEqual([
      [session, { id: 'persisted-entry-id', completedAt: '2026-09-25T12:00:00.000Z' }],
      [session, { id: 'persisted-entry-id', completedAt: '2026-09-25T12:00:00.000Z' }],
    ]);
  });

  it('keeps an explicit server completion time through multiple failed attempts', async () => {
    const hook = mountHook();
    const session = hook.current.start('focus')!;
    const completedAt = '2026-09-25T12:00:00.000Z';
    hook.record.mockRejectedValueOnce(new Error('Disk')).mockRejectedValueOnce(new Error('Still full'));
    await hook.current.complete(session, { completedAt });
    await hook.current.retry();
    expect(hook.render().canRetry).toBe(true);
    await hook.current.retry();
    expect(hook.record.mock.calls.map(([, result]) => result.completedAt)).toEqual([completedAt, completedAt, completedAt]);
  });

  it('does not offer retry when the coordinator rejects an obsolete owner or deletion generation', async () => {
    const hook = mountHook();
    const session = hook.current.start('focus')!;
    hook.record.mockResolvedValueOnce(false);
    await hook.current.complete(session);
    expect(hook.render().canRetry).toBe(false);
    await hook.current.retry();
    expect(hook.record).toHaveBeenCalledTimes(1);
  });

  it('drops retry when the owner changes and rejects late errors from the old owner', async () => {
    const hook = mountHook();
    const session = hook.current.start('focus')!;
    hook.record.mockRejectedValueOnce(new Error('Disk'));
    await hook.current.complete(session);
    expect(hook.render().canRetry).toBe(true);
    hook.changeOwner('owner-b');
    expect(hook.current.canRetry).toBe(false);
    await hook.current.retry();
    await hook.current.complete(session);
    expect(hook.record).toHaveBeenCalledTimes(1);
    expect(hook.render().error).toBe('');
  });

  it('drops an old retry when a new activity starts and never resurrects it from a late rejection', async () => {
    const hook = mountHook();
    const first = hook.current.start('focus')!;
    let reject: (reason: Error) => void = () => {};
    hook.record.mockImplementationOnce(() => new Promise<boolean>((_resolve, rejectPromise) => { reject = rejectPromise; }));
    const finishing = hook.current.complete(first);
    hook.current.start('focus');
    reject(new Error('Late disk error'));
    await finishing;
    expect(hook.render()).toMatchObject({ canRetry: false, error: '' });
    await hook.current.retry();
    expect(hook.record).toHaveBeenCalledTimes(1);
  });

  it('deduplicates rapid retry presses and removes retry after a stale-generation result', async () => {
    const hook = mountHook();
    const session = hook.current.start('focus')!;
    hook.record.mockRejectedValueOnce(new Error('Disk'));
    await hook.current.complete(session);
    let finish: (value: boolean) => void = () => {};
    hook.record.mockImplementationOnce(() => new Promise<boolean>((resolve) => { finish = resolve; }));
    const firstRetry = hook.current.retry();
    expect(hook.render().retrying).toBe(true);
    expect(await hook.current.retry()).toBe(false);
    finish(false);
    await firstRetry;
    expect(hook.render()).toMatchObject({ canRetry: false, retrying: false });
    expect(hook.record).toHaveBeenCalledTimes(2);
  });
});
