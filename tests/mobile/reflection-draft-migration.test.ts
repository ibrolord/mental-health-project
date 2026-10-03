import { readFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { describe, expect, it, vi } from 'vitest';
import { createAdvisorProfileStorage } from '../../mobile/lib/advisor-profile-storage';
import * as reflections from '../../mobile/lib/reflections';
import * as journal from '../../mobile/lib/journal';
import {
  createReflectionDraftStorage,
  reflectionDraftStorageKey,
  type ReflectionDraft,
} from '../../mobile/lib/reflections';

const SOURCE = 'anonymous-source';
const TARGET = 'account-target';
const NOW = '2026-10-03T12:00:00.000Z';
const draft = (text = 'Source private reflection'): ReflectionDraft => ({
  templateId: 'worry-time', stepIndex: 0, responses: { worry: text }, updatedAt: NOW,
});

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((yes) => { resolve = yes; });
  return { promise, resolve };
}

// Execute the real enclosing auth and local migration functions. Only native I/O,
// sessions and the server boundary are replaced; no account or network is used.
let draftGeneration = 0;
function harness(values = new Map<string, string>()) {
  const secureStore = {
    getItemAsync: vi.fn(async (key: string) => values.get(key) ?? null),
    setItemAsync: vi.fn(async (key: string, value: string) => { values.set(key, value); }),
    deleteItemAsync: vi.fn(async (key: string) => { values.delete(key); }),
  };
  const drafts = createReflectionDraftStorage({
    secureStore, now: () => NOW, createGeneration: () => `draft-${++draftGeneration}`,
  });
  const localValues = new Map<string, string>();
  const localStorage = {
    getItem: async (key: string) => localValues.get(key) ?? null,
    setItem: async (key: string, value: string) => { localValues.set(key, value); },
    removeItem: async (key: string) => { localValues.delete(key); },
  };
  const profileStorage = createAdvisorProfileStorage(localStorage);
  const sourceSession = { user: { id: SOURCE, is_anonymous: true },
    access_token: 'test-source-access', refresh_token: 'test-source-refresh' };
  const destination = { user: { id: TARGET, is_anonymous: false },
    access_token: 'test-target-access' };
  const setSession = vi.fn(async (_tokens: unknown): Promise<{ error: Error | null }> => ({ error: null }));
  const supabase = { auth: {
    getSession: vi.fn(async () => ({ data: { session: destination }, error: null })),
    setSession,
  } };
  const apiRequest = vi.fn(async (..._args: unknown[]) => {});
  const moveAudio = vi.fn(async () => {});
  const afterCompletions = vi.fn(async () => {});
  const migrateToolCompletions = vi.fn(async (_source: string, _target: string, migrate: () => Promise<void>) => {
    await migrate();
    await afterCompletions();
  });
  const source = readFileSync(path.resolve('mobile/lib/auth-context.tsx'), 'utf8');
  const ast = ts.createSourceFile('auth-context.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const functions = ast.statements.filter((node) => ts.isFunctionDeclaration(node) &&
    ['moveAsyncStorageKey', 'migrateAnonymousLocalState', 'mergeAnonymousSessionIntoCurrentAccount']
      .includes(node.name?.text ?? ''));
  expect(functions).toHaveLength(3);
  const compiled = ts.transpileModule(functions.map((node) => node.getText(ast)).join('\n'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const auth = new Function('AsyncStorage', 'advisorProfileStorage', 'moodDraftStorage',
    'reflectionDraftStorage', 'moveJournalAudioForUser', 'supabase', 'apiRequest',
    'migrateToolCompletions', 'sourceSession', `let pendingAnonymousMergeSourceId = sourceSession.user.id;
      ${compiled}
      return {
        merge: () => mergeAnonymousSessionIntoCurrentAccount(sourceSession),
        pending: () => pendingAnonymousMergeSourceId,
      };`)(localStorage, profileStorage, { read: async () => null, clear: async () => {} },
    drafts, moveAudio, supabase, apiRequest, migrateToolCompletions, sourceSession
  ) as { merge: () => Promise<void>; pending: () => string | null };
  return { ...auth, drafts, values, secureStore, apiRequest, setSession, moveAudio, afterCompletions };
}

function pauseWrite(h: ReturnType<typeof harness>, owner: string, manifest = false) {
  const started = deferred();
  const release = deferred();
  let paused = false;
  h.secureStore.setItemAsync.mockImplementation(async (key, value) => {
    if (!paused && key.startsWith(`${reflectionDraftStorageKey(owner)}.`) &&
        key.endsWith('.manifest') === manifest) {
      paused = true;
      started.resolve();
      await release.promise;
    }
    h.values.set(key, value);
  });
  return { started: started.promise, release: release.resolve };
}

// Inspect the encrypted-store adapter without waiting on the public read barrier.
function stored(h: ReturnType<typeof harness>, owner: string): ReflectionDraft | null {
  const value = storedRecord(h, owner);
  return value ? { templateId: value.templateId, stepIndex: value.stepIndex,
    responses: value.responses, updatedAt: value.updatedAt } : null;
}

function storedRecord(h: ReturnType<typeof harness>, owner: string) {
  const key = reflectionDraftStorageKey(owner);
  const raw = h.values.get(`${key}.manifest`);
  if (!raw) return null;
  const manifest = JSON.parse(raw);
  if (manifest.state === 'deleting') return null;
  return JSON.parse(Array.from({ length: manifest.count }, (_, i) =>
    h.values.get(`${key}.${manifest.generation}.${i}`) ?? '').join(''));
}

type Element = { type: any; props: Record<string, any> };
type Slot = { value?: any; deps?: readonly unknown[]; cleanup?: () => void };
const screenCode = ts.transpileModule(
  `${readFileSync(path.resolve('mobile/app/reflect.tsx'), 'utf8')}\nexport { ReflectContent };`, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
  }
).outputText;

// Real screen handlers and effects with deterministic hooks/native boundaries.
// This deliberately keeps the same component mounted across destination merges.
function mountReflect(h: ReturnType<typeof harness>, owner = SOURCE) {
  const slots: Slot[] = [];
  let cursor = 0;
  let dirty = false;
  let effects: (() => void)[] = [];
  let tree: Element;
  let background: ((state: string) => void) | undefined;
  let alertButtons: { text: string; onPress?: () => void }[] = [];
  const journalResult = vi.fn(async (): Promise<{ data: { id: string } | null; error: Error | null }> =>
    ({ data: { id: 'test-journal-entry' }, error: null }));
  const insert = vi.fn(() => ({ select: () => ({ single: journalResult }) }));
  const completion = { start: vi.fn(() => ({ id: 'test-completion' })), complete: vi.fn(async () => true), error: '' };
  const hooks = {
    useState(initial: any) {
      const index = cursor++;
      slots[index] ??= { value: typeof initial === 'function' ? initial() : initial };
      return [slots[index].value, (value: any) => {
        const next = typeof value === 'function' ? value(slots[index].value) : value;
        if (!Object.is(next, slots[index].value)) { slots[index].value = next; dirty = true; }
      }];
    },
    useRef(initial: any) {
      return (slots[cursor++] ??= { value: { current: initial } }).value;
    },
    useEffect(effect: () => void | (() => void), deps: readonly unknown[]) {
      const index = cursor++;
      const previous = slots[index];
      if (previous?.deps?.length === deps.length && deps.every((dep, i) => Object.is(previous.deps?.[i], dep))) return;
      const slot = slots[index] = { deps } as Slot;
      effects.push(() => { previous?.cleanup?.(); slot.cleanup = effect() || undefined; });
    },
  };
  const jsx = (type: any, props: Record<string, any>) => ({ type, props });
  const primitives = new Proxy({}, { get: (_target, key) => String(key) });
  const evaluated = { exports: {} as Record<string, any> };
  new Function('require', 'module', 'exports', screenCode)((id: string) => {
    if (id === 'react') return hooks;
    if (id === 'react/jsx-runtime') return { jsx, jsxs: jsx };
    if (id === 'react-native') return {
      ...primitives, StyleSheet: { create: (styles: unknown) => styles },
      AppState: { addEventListener: (_name: string, callback: typeof background) => {
        background = callback; return { remove: () => { background = undefined; } };
      } },
      Alert: { alert: (_title: string, _message: string, buttons: typeof alertButtons) => { alertButtons = buttons; } },
    };
    if (id === '@expo/vector-icons') return { Feather: 'Feather' };
    if (id === '@react-native-community/datetimepicker') return { default: 'DateTimePicker' };
    if (id === 'expo-router') return { useLocalSearchParams: () => ({ mode: 'worry-time' }), useRouter: () => ({ push: vi.fn() }) };
    if (id === '@/components/AppUI') return primitives;
    if (id === '@/lib/constants') return { Colors: primitives };
    if (id === '@/lib/hooks/use-data-context') return { useDataContext: () => ({ context: { user_id: owner }, authLoading: false }) };
    if (id === '@/lib/hooks/use-tool-completion') return { useToolCompletion: () => completion };
    if (id === '@/components/ToolCompletionRetry') return { ToolCompletionRetry: 'ToolCompletionRetry' };
    if (id === '@/lib/reflections') return reflections;
    if (id === '@/lib/reflection-draft-storage') return { reflectionDraftStorage: h.drafts };
    if (id === '@/lib/journal') return journal;
    if (id === '@/lib/supabase') return { supabase: { from: () => ({ insert }) } };
    throw new Error(`Unmocked reflection dependency: ${id}`);
  }, evaluated, evaluated.exports);
  const render = () => {
    let renders = 0;
    do {
      dirty = false; cursor = 0; effects = [];
      tree = evaluated.exports.ReflectContent();
      effects.forEach((effect) => effect());
      if (++renders > 25) throw new Error('Reflection component did not settle');
    } while (dirty);
  };
  const ready = () => vi.waitFor(() => {
    render(); expect(tree.props.template?.id).toBe('worry-time');
    expect(tree.props.needsReload).toBe(false);
  });
  const elements = (node: any = tree): Element[] => {
    if (Array.isArray(node)) return node.flatMap((child) => elements(child));
    if (!node || typeof node !== 'object' || !('props' in node)) return [];
    return [node, ...elements(node.props.children ?? null)];
  };
  render();
  return {
    render, ready, insert, journalResult, completion,
    props: () => { render(); return tree.props; },
    edit: (step: string, value: string) => { tree.props.onResponseChange(step, value); render(); },
    background: () => { background?.('background'); render(); },
    confirmDiscard: () => { alertButtons.find((button) => button.text === 'Discard')?.onPress?.(); render(); },
    choose: (id: string) => {
      render();
      const card = elements().find(({ props }) => props.template?.id === id && props.onSelect);
      if (!card) throw new Error(`Missing reflection template: ${id}`);
      expect(card.props.disabled).toBe(false);
      card.props.onSelect(card.props.template); render();
    },
    unmount: () => { slots.forEach((slot) => slot.cleanup?.()); },
  };
}

describe('reflection draft transfer through actual anonymous auth migration', () => {
  it.each([SOURCE, TARGET])('drains an accepted %s write before checking for a collision', async (owner) => {
    const h = harness();
    await h.drafts.write(SOURCE, draft());
    const other = owner === SOURCE ? TARGET : SOURCE;
    await h.drafts.write(other, draft());
    const paused = pauseWrite(h, owner);
    const writing = h.drafts.write(owner, draft('New conflicting answer'));
    await paused.started;
    const begin = vi.spyOn(h.drafts, 'beginOwnerMigration');
    const merging = expect(h.merge()).rejects.toThrow('Both profiles have an unfinished reflection');
    await vi.waitFor(() => expect(begin).toHaveBeenCalledOnce());
    expect(h.apiRequest).not.toHaveBeenCalled();
    paused.release();
    await writing;
    await merging;
    expect(await h.drafts.read(owner)).toEqual(draft('New conflicting answer'));
    expect(await h.drafts.read(other)).toEqual(draft());
    expect(h.apiRequest).not.toHaveBeenCalled();
    expect(h.setSession).toHaveBeenCalledOnce();
  });

  it('drains queued source snapshots and transfers the latest one, not the first in flight', async () => {
    const h = harness();
    const paused = pauseWrite(h, SOURCE);
    const first = h.drafts.write(SOURCE, draft('First snapshot'));
    await paused.started;
    const last = h.drafts.write(SOURCE, draft('Latest accepted snapshot'));
    const begin = vi.spyOn(h.drafts, 'beginOwnerMigration');
    const merging = h.merge();
    await vi.waitFor(() => expect(begin).toHaveBeenCalledOnce());
    expect(h.apiRequest).not.toHaveBeenCalled();
    paused.release();
    await Promise.all([first, last, merging]);
    expect(await h.drafts.read(TARGET)).toEqual(draft('Latest accepted snapshot'));
    expect(await h.drafts.read(SOURCE)).toBeNull();
  });

  it('suspends both owners before the preflight read and releases them on collision', async () => {
    const h = harness();
    await h.drafts.write(SOURCE, draft());
    await h.drafts.write(TARGET, draft('Target private reflection'));
    const started = deferred();
    const release = deferred();
    h.secureStore.getItemAsync.mockImplementationOnce(async (key) => {
      started.resolve();
      await release.promise;
      return h.values.get(key) ?? null;
    });
    const merging = expect(h.merge()).rejects.toThrow('Both profiles');
    await started.promise;
    for (const owner of [SOURCE, TARGET]) {
      await expect(h.drafts.write(owner, draft('Racing answer'))).rejects.toThrow('being transferred');
      await expect(h.drafts.clear(owner)).rejects.toThrow('being transferred');
    }
    release.resolve();
    await merging;
    expect(await h.drafts.read(SOURCE)).toEqual(draft());
    expect(await h.drafts.read(TARGET)).toEqual(draft('Target private reflection'));
    expect(h.apiRequest).not.toHaveBeenCalled();
    await h.drafts.write(SOURCE, draft('Explicit source edit after failed sign-in'));
    await h.drafts.write(TARGET, draft('Explicit target edit after failed sign-in'));
  });

  it.each(['server', 'local', 'completions', 'cleanup'] as const)(
    'rejects writes and clears through the %s phase, including stale tokens after release', async (phase) => {
      const h = harness();
      await h.drafts.write(SOURCE, draft());
      const oldSource = h.drafts.captureWriteToken(SOURCE);
      const oldTarget = h.drafts.captureWriteToken(TARGET);
      const started = deferred();
      const release = deferred();
      const pause = async () => { started.resolve(); await release.promise; };
      if (phase === 'server') h.apiRequest.mockImplementationOnce(pause);
      if (phase === 'local') h.moveAudio.mockImplementationOnce(pause);
      if (phase === 'completions') h.afterCompletions.mockImplementationOnce(pause);
      if (phase === 'cleanup') {
        h.secureStore.setItemAsync.mockImplementation(async (key, value) => {
          if (key === `${reflectionDraftStorageKey(SOURCE)}.manifest` && JSON.parse(value).state === 'deleting') {
            await pause();
          }
          h.values.set(key, value);
        });
      }
      const merging = h.merge();
      await started.promise;
      expect(stored(h, TARGET)).toEqual(draft());
      expect(stored(h, SOURCE)).toEqual(draft());
      expect(h.pending()).toBe(SOURCE);
      const duringTarget = h.drafts.captureWriteToken(TARGET);
      for (const [owner, token] of [[SOURCE, oldSource], [TARGET, oldTarget]] as const) {
        await expect(h.drafts.write(owner, draft('Stale answer'), token)).rejects.toThrow('being transferred');
        await expect(h.drafts.write(owner, draft('Untokened answer'))).rejects.toThrow('being transferred');
        await expect(h.drafts.clear(owner)).rejects.toThrow('being transferred');
      }
      const readFinished = vi.fn();
      const reading = h.drafts.read(TARGET).then(readFinished);
      await h.drafts.write('unrelated', draft('Unrelated owner'));
      expect(readFinished).not.toHaveBeenCalled();
      release.resolve();
      await merging;
      await reading;
      expect(readFinished).toHaveBeenCalledWith(draft());
      expect(await h.drafts.read(SOURCE)).toBeNull();
      expect(await h.drafts.write(TARGET, draft('Old target snapshot'), oldTarget)).toBe(false);
      expect(await h.drafts.write(TARGET, draft('During-transfer snapshot'), duringTarget)).toBe(false);
      await expect(h.drafts.write(SOURCE, draft('Old source snapshot'), oldSource)).rejects.toThrow('transferred');
      await expect(h.drafts.write(SOURCE, draft('Recreated source'))).rejects.toThrow('transferred');
      expect(await h.drafts.read(TARGET)).toEqual(draft());
      expect(h.apiRequest).toHaveBeenCalledExactlyOnceWith('/api/data/merge-anonymous', {
        sourceAnonymousUserId: SOURCE, sourceAccessToken: 'test-source-access',
      }, { accessToken: 'test-target-access' });
      expect(h.setSession).not.toHaveBeenCalled();
      expect(h.pending()).toBeNull();
      await h.drafts.write(TARGET, draft('Fresh target edit'), h.drafts.captureWriteToken(TARGET));
      expect(await h.drafts.read(TARGET)).toEqual(draft('Fresh target edit'));
    }
  );

  it('does not call the server until the encrypted destination copy is committed and verified', async () => {
    const h = harness();
    await h.drafts.write(SOURCE, draft());
    const paused = pauseWrite(h, TARGET, true);
    const merging = h.merge();
    await paused.started;
    expect(stored(h, TARGET)).toBeNull();
    expect(stored(h, SOURCE)).toEqual(draft());
    expect(h.apiRequest).not.toHaveBeenCalled();
    paused.release();
    await merging;
    expect(await h.drafts.read(TARGET)).toEqual(draft());
  });

  it('reloads a destination read accepted before reservation instead of hydrating a stale empty draft', async () => {
    const h = harness();
    await h.drafts.write(SOURCE, draft());
    const readingStarted = deferred();
    const releaseRead = deferred();
    h.secureStore.getItemAsync.mockImplementationOnce(async () => {
      readingStarted.resolve();
      await releaseRead.promise;
      return null;
    });
    const hydrated = vi.fn();
    const reading = h.drafts.read(TARGET).then(hydrated);
    await readingStarted.promise;
    const serverStarted = deferred();
    const releaseServer = deferred();
    h.apiRequest.mockImplementationOnce(async () => {
      serverStarted.resolve();
      await releaseServer.promise;
    });
    const begin = vi.spyOn(h.drafts, 'beginOwnerMigration');
    const merging = h.merge();
    await vi.waitFor(() => expect(begin).toHaveBeenCalledOnce());
    releaseRead.resolve();
    await serverStarted.promise;
    expect(hydrated).not.toHaveBeenCalled();
    releaseServer.resolve();
    await Promise.all([merging, reading]);
    expect(hydrated).toHaveBeenCalledExactlyOnceWith(draft());
  });

  it.each(['chunk', 'manifest', 'verification'] as const)('keeps the source when destination %s fails before the server', async (failure) => {
    const h = harness();
    await h.drafts.write(SOURCE, draft());
    if (failure === 'verification') {
      h.secureStore.getItemAsync.mockImplementation(async (key) =>
        key.startsWith(`${reflectionDraftStorageKey(TARGET)}.draft-`) ? null : h.values.get(key) ?? null);
    } else {
      h.secureStore.setItemAsync.mockImplementation(async (key, value) => {
        if (key.startsWith(`${reflectionDraftStorageKey(TARGET)}.`) &&
            key.endsWith('.manifest') === (failure === 'manifest')) throw new Error('disk full');
        h.values.set(key, value);
      });
    }
    await expect(h.merge()).rejects.toThrow(failure === 'verification' ? 'verification failed' : 'disk full');
    expect(await h.drafts.read(SOURCE)).toEqual(draft());
    expect(await h.drafts.read(TARGET)).toBeNull();
    expect(h.apiRequest).not.toHaveBeenCalled();
    expect(h.setSession).toHaveBeenCalledOnce();
    await h.drafts.write(SOURCE, draft('Source remains editable'));
  });

  it('aborts before server work if an accepted write fails during the drain', async () => {
    const h = harness();
    await h.drafts.write(SOURCE, draft());
    const started = deferred();
    const release = deferred();
    h.secureStore.setItemAsync.mockImplementationOnce(async () => {
      started.resolve();
      await release.promise;
      throw new Error('accepted write failed');
    });
    const writing = expect(h.drafts.write(SOURCE, draft('Not durable'))).rejects.toThrow('accepted write failed');
    await started.promise;
    const begin = vi.spyOn(h.drafts, 'beginOwnerMigration');
    const merging = expect(h.merge()).rejects.toThrow('accepted write failed');
    await vi.waitFor(() => expect(begin).toHaveBeenCalledOnce());
    release.resolve();
    await Promise.all([writing, merging]);
    expect(h.apiRequest).not.toHaveBeenCalled();
    expect(await h.drafts.read(SOURCE)).toEqual(draft());
  });

  it('preserves both durable copies through a failed server call and delayed session restoration', async () => {
    const h = harness();
    await h.drafts.write(SOURCE, draft());
    h.apiRequest.mockRejectedValueOnce(new Error('server unavailable'));
    const restoring = deferred();
    const release = deferred();
    h.setSession.mockImplementationOnce(async () => {
      restoring.resolve();
      await release.promise;
      return { error: null };
    });
    const merging = expect(h.merge()).rejects.toThrow('server unavailable');
    await restoring.promise;
    expect(stored(h, SOURCE)).toEqual(draft());
    expect(stored(h, TARGET)).toEqual(draft());
    await expect(h.drafts.clear(TARGET)).rejects.toThrow('being transferred');
    release.resolve();
    await merging;
    expect(h.setSession).toHaveBeenCalledExactlyOnceWith({
      access_token: 'test-source-access', refresh_token: 'test-source-refresh',
    });
    expect(await h.drafts.read(SOURCE)).toEqual(draft());
    expect(await h.drafts.read(TARGET)).toEqual(draft());
    // A fresh process can still read both copies; reservations are not durability.
    const restarted = createReflectionDraftStorage({ secureStore: h.secureStore });
    expect(await restarted.read(SOURCE)).toEqual(draft());
    expect(await restarted.read(TARGET)).toEqual(draft());
    await h.merge();
    expect(await h.drafts.read(SOURCE)).toBeNull();
    expect(await h.drafts.read(TARGET)).toEqual(draft());
  });

  it.each(['local', 'completions', 'cleanup-before-tombstone', 'cleanup-after-tombstone'] as const)(
    'keeps the destination draft and session on a post-server %s failure', async (failure) => {
      const h = harness();
      await h.drafts.write(SOURCE, draft());
      if (failure === 'local') h.moveAudio.mockRejectedValueOnce(new Error('local failed'));
      if (failure === 'completions') h.afterCompletions.mockRejectedValueOnce(new Error('completions failed'));
      if (failure === 'cleanup-before-tombstone') {
        h.secureStore.setItemAsync.mockImplementation(async (key, value) => {
          if (key === `${reflectionDraftStorageKey(SOURCE)}.manifest`) throw new Error('cleanup failed');
          h.values.set(key, value);
        });
      }
      if (failure === 'cleanup-after-tombstone') {
        h.secureStore.deleteItemAsync.mockImplementation(async (key) => {
          if (key.startsWith(`${reflectionDraftStorageKey(SOURCE)}.draft-`)) throw new Error('cleanup failed');
          h.values.delete(key);
        });
      }
      await expect(h.merge()).rejects.toThrow('failed');
      expect(h.apiRequest).toHaveBeenCalledOnce();
      expect(h.setSession).not.toHaveBeenCalled();
      expect(h.pending()).toBeNull();
      expect(await h.drafts.read(TARGET)).toEqual(draft());
      expect(await h.drafts.read(SOURCE)).toEqual(failure === 'cleanup-after-tombstone' ? null : draft());
      const restarted = createReflectionDraftStorage({ secureStore: h.secureStore });
      expect(await restarted.read(TARGET)).toEqual(draft());
      await h.drafts.write(TARGET, draft('Destination is editable after failure'));
    }
  );

  it('keeps an equivalent destination draft without replacing its progress or timestamp', async () => {
    const h = harness();
    await h.drafts.write(SOURCE, draft());
    await h.drafts.write(TARGET, { ...draft(), stepIndex: 2 });
    const targetBefore = await h.drafts.read(TARGET);
    await h.merge();
    expect(await h.drafts.read(TARGET)).toEqual(targetBefore);
    expect(await h.drafts.read(SOURCE)).toBeNull();
  });

  it('leaves a destination-only draft untouched', async () => {
    const h = harness();
    await h.drafts.write(TARGET, draft('Destination only'));
    await h.merge();
    expect(await h.drafts.read(TARGET)).toEqual(draft('Destination only'));
  });

  it('fails closed without deleting malformed source bytes during preflight', async () => {
    const h = harness();
    const key = reflectionDraftStorageKey(SOURCE);
    h.values.set(key, '{invalid-private-draft');
    await expect(h.merge()).rejects.toThrow('Sign-in was stopped to preserve it');
    expect(h.values.get(key)).toBe('{invalid-private-draft');
    expect(h.apiRequest).not.toHaveBeenCalled();
  });

  it('rejects overlapping reservations without unlocking the existing transfer', async () => {
    const h = harness();
    await h.drafts.write(SOURCE, draft());
    const started = deferred();
    const release = deferred();
    h.apiRequest.mockImplementationOnce(async () => { started.resolve(); await release.promise; });
    const merging = h.merge();
    await started.promise;
    await expect(h.drafts.beginOwnerMigration(TARGET, 'other-target')).rejects.toThrow('being transferred');
    await expect(h.drafts.write(TARGET, draft('Still reserved'))).rejects.toThrow('being transferred');
    release.resolve();
    await merging;
    expect(await h.drafts.read(TARGET)).toEqual(draft());
  });
});

describe('reflection screen and provisional-copy regressions', () => {
  it.each(['mounted', 'background', 'unmount'] as const)(
    'registers rapid screen edits before auth drains storage (%s)', async (lifecycle) => {
      const h = harness();
      const screen = mountReflect(h);
      await screen.ready();
      const writes = vi.spyOn(h.drafts, 'write');
      const paused = pauseWrite(h, SOURCE);
      screen.edit('worry', 'First submitted words');
      await paused.started;
      // These callbacks must enter the storage queue synchronously, even while
      // the first write is blocked. No timer, rerender effect or local tail owns them.
      const edit = screen.props().onResponseChange;
      edit('worry', 'Last submitted words');
      edit('action', 'A second field before React rerenders');
      expect(writes).toHaveBeenCalledTimes(3);
      if (lifecycle === 'background') screen.background();
      if (lifecycle === 'unmount') screen.unmount();
      const begin = vi.spyOn(h.drafts, 'beginOwnerMigration');
      const merging = h.merge();
      await vi.waitFor(() => expect(begin).toHaveBeenCalledOnce());
      expect(h.apiRequest).not.toHaveBeenCalled();
      paused.release();
      await merging;
      expect(await h.drafts.read(TARGET)).toMatchObject({ responses: {
        worry: 'Last submitted words', action: 'A second field before React rerenders',
      } });
      expect(await h.drafts.read(SOURCE)).toBeNull();
      expect(writes).toHaveBeenCalledTimes(3);
      if (lifecycle !== 'unmount') screen.unmount();
    }
  );

  it.each([false, true])('blocks a same-owner stale destination editor until rehydration (existing draft: %s)', async (existing) => {
    const h = harness();
    await h.drafts.write(SOURCE, draft());
    if (existing) await h.drafts.write(TARGET, draft());
    const screen = mountReflect(h, TARGET);
    await screen.ready();
    const stale = screen.props();
    const writes = vi.spyOn(h.drafts, 'write');
    const capture = vi.spyOn(h.drafts, 'captureWriteToken');
    await h.merge();
    stale.onResponseChange('worry', 'Old editor must not replace the transferred draft');
    stale.onStepChange(1);
    stale.onSave();
    expect(screen.props().needsReload).toBe(true);
    expect(writes).not.toHaveBeenCalled();
    expect(capture).not.toHaveBeenCalled();
    expect(screen.insert).not.toHaveBeenCalled();
    expect(await h.drafts.read(TARGET)).toEqual(draft());
    screen.props().onReload();
    await screen.ready();
    expect(screen.props().responses).toEqual(draft().responses);
    stale.onResponseChange('worry', 'Delayed native input from the old render');
    stale.onDiscard();
    stale.onSave();
    expect(writes).not.toHaveBeenCalled();
    expect(screen.insert).not.toHaveBeenCalled();
    expect(screen.props().needsReload).toBe(false);
    screen.edit('worry', 'An edit based on the reloaded draft');
    expect(await h.drafts.read(TARGET)).toEqual(draft('An edit based on the reloaded draft'));
    screen.unmount();
  });

  it('does not permit a stale discard confirmation to erase the same-owner transferred draft', async () => {
    const h = harness();
    await h.drafts.write(SOURCE, draft());
    const screen = mountReflect(h, TARGET);
    await screen.ready();
    screen.props().onDiscard();
    await h.merge();
    screen.confirmDiscard();
    expect(screen.props().needsReload).toBe(true);
    expect(await h.drafts.read(TARGET)).toEqual(draft());
    screen.unmount();
  });

  it('does not clear the transferred destination when an older journal save completes later', async () => {
    const h = harness();
    await h.drafts.write(SOURCE, draft());
    await h.drafts.write(TARGET, draft());
    const screen = mountReflect(h, TARGET);
    await screen.ready();
    const saving = deferred();
    screen.journalResult.mockImplementationOnce(async () => {
      await saving.promise;
      return { data: { id: 'older-journal-save' }, error: null };
    });
    screen.props().onSave();
    expect(screen.insert).toHaveBeenCalledOnce();
    await h.merge();
    saving.resolve();
    await vi.waitFor(() => expect(screen.props().needsReload).toBe(true));
    expect(await h.drafts.read(TARGET)).toEqual(draft());
    expect(screen.completion.complete).not.toHaveBeenCalled();
    screen.unmount();
  });

  it('retains screen edits and reports storage errors instead of losing an unregistered tail at sign-in', async () => {
    const h = harness();
    const screen = mountReflect(h);
    await screen.ready();
    const started = deferred();
    const release = deferred();
    h.secureStore.setItemAsync.mockImplementationOnce(async () => {
      started.resolve(); await release.promise; throw new Error('screen write failed');
    });
    screen.edit('worry', 'Words that could not reach disk');
    await started.promise;
    const begin = vi.spyOn(h.drafts, 'beginOwnerMigration');
    const merging = expect(h.merge()).rejects.toThrow('screen write failed');
    await vi.waitFor(() => expect(begin).toHaveBeenCalledOnce());
    release.resolve();
    await merging;
    expect(h.apiRequest).not.toHaveBeenCalled();
    expect(screen.props().responses.worry).toBe('Words that could not reach disk');
    expect(screen.props().draftState).toBe('error');
    screen.unmount();
  });

  it.each(['save', 'discard'] as const)('blocks a settled failed write until the user successfully resolves it by %s', async (resolution) => {
    const h = harness();
    await h.drafts.write(SOURCE, draft());
    h.secureStore.setItemAsync.mockRejectedValueOnce(new Error('disk temporarily unavailable'));
    await expect(h.drafts.write(SOURCE, draft('Not yet durable'))).rejects.toThrow('disk temporarily unavailable');
    await expect(h.merge()).rejects.toThrow('Save or discard it before signing in');
    expect(h.apiRequest).not.toHaveBeenCalled();
    expect(await h.drafts.read(SOURCE)).toEqual(draft());
    if (resolution === 'save') await h.drafts.write(SOURCE, draft('Not yet durable'));
    else await h.drafts.clear(SOURCE);
    await h.merge();
    expect(await h.drafts.read(TARGET)).toEqual(resolution === 'save' ? draft('Not yet durable') : null);
  });

  it.each(['discard', 'journal save'] as const)('rehydrates after %s before starting another reflection', async (action) => {
    const h = harness();
    await h.drafts.write(SOURCE, draft());
    const screen = mountReflect(h);
    await screen.ready();
    const previous = screen.props();
    if (action === 'discard') {
      previous.onDiscard(); screen.confirmDiscard();
    } else {
      previous.onSave();
      await vi.waitFor(() => expect(screen.props().saveState).toBe('saved'));
      screen.props().onChooseAnother();
    }
    await vi.waitFor(() => {
      screen.render(); expect(screen.props().template).toBeUndefined();
      expect(stored(h, SOURCE)).toBeNull();
    });
    // Waiting for the read is distinct from showing the empty catalogue.
    await vi.waitFor(() => screen.choose('balanced-thought'));
    screen.edit('situation', 'A fresh reflection after cleanup');
    expect(await h.drafts.read(SOURCE)).toMatchObject({
      templateId: 'balanced-thought', responses: { situation: 'A fresh reflection after cleanup' },
    });
    previous.onResponseChange('worry', 'Old render cannot borrow the new token');
    expect((await h.drafts.read(SOURCE))?.responses).toEqual({ situation: 'A fresh reflection after cleanup' });
    screen.unmount();
  });

  it.each([false, true])('refreshes only the unchanged provisional copy after a source screen edit and retry (restart: %s)', async (restart) => {
    const first = harness();
    await first.drafts.write(SOURCE, draft());
    first.apiRequest.mockRejectedValueOnce(new Error('merge unavailable'));
    await expect(first.merge()).rejects.toThrow('merge unavailable');
    expect(storedRecord(first, TARGET)._ownerMigration).toMatchObject({ version: 1, sourceOwnerId: SOURCE });
    const h = restart ? harness(first.values) : first;
    expect(await h.drafts.read(TARGET)).not.toHaveProperty('_ownerMigration');
    expect((await h.drafts.readForEditing(TARGET)).draft).not.toHaveProperty('_ownerMigration');
    // Merely hydrating/backgrounding the target must not promote a provisional copy.
    const target = mountReflect(h, TARGET);
    await target.ready(); target.background(); target.unmount();
    expect(storedRecord(h, TARGET)).toHaveProperty('_ownerMigration');
    const source = mountReflect(h);
    await source.ready();
    source.edit('worry', 'Updated anonymous words after failed sign-in');
    await h.merge();
    expect(await h.drafts.read(TARGET)).toEqual(draft('Updated anonymous words after failed sign-in'));
    expect(await h.drafts.read(SOURCE)).toBeNull();
    expect(storedRecord(h, TARGET)).not.toHaveProperty('_ownerMigration');
    expect(await harness(h.values).drafts.read(TARGET)).toEqual(draft('Updated anonymous words after failed sign-in'));
    source.unmount();
  });

  describe.each(['discard', 'journal save'] as const)('retry after source %s', (action) => {
    async function removeSource(h: ReturnType<typeof harness>) {
      const screen = mountReflect(h);
      await screen.ready();
      if (action === 'discard') {
        screen.props().onDiscard();
        screen.confirmDiscard();
        expect(screen.insert).not.toHaveBeenCalled();
      } else {
        screen.props().onSave();
        await vi.waitFor(() => expect(screen.props().saveState).toBe('saved'));
        expect(screen.insert).toHaveBeenCalledOnce();
        expect(screen.completion.complete).toHaveBeenCalledOnce();
      }
      await vi.waitFor(() => expect(stored(h, SOURCE)).toBeNull());
      screen.unmount();
    }

    it('removes the unchanged same-source provisional copy before merging after restart', async () => {
      const first = harness();
      await first.drafts.write(SOURCE, draft());
      first.apiRequest.mockRejectedValueOnce(new Error('merge unavailable'));
      await expect(first.merge()).rejects.toThrow('merge unavailable');
      await removeSource(first);
      expect(storedRecord(first, TARGET)._ownerMigration.sourceOwnerId).toBe(SOURCE);

      const restarted = harness(first.values);
      restarted.apiRequest.mockImplementationOnce(async () => {
        expect(stored(restarted, SOURCE)).toBeNull();
        expect(stored(restarted, TARGET)).toBeNull();
      });
      await restarted.merge();
      expect(restarted.apiRequest).toHaveBeenCalledOnce();
      expect(restarted.setSession).not.toHaveBeenCalled();
      const afterRestart = harness(restarted.values);
      expect(await afterRestart.drafts.read(SOURCE)).toBeNull();
      expect(await afterRestart.drafts.read(TARGET)).toBeNull();
    });

    it.each(['different words', 'identical save', 'modified with old provenance', 'another source provenance'] as const)(
      'preserves an independent destination after restart (%s)', async (change) => {
        const first = harness();
        await first.drafts.write(SOURCE, draft());
        first.apiRequest.mockRejectedValueOnce(new Error('merge unavailable'));
        await expect(first.merge()).rejects.toThrow('merge unavailable');
        const targetDraft = draft(change === 'different words' || change === 'modified with old provenance'
          ? 'Independent destination answer' : undefined);
        if (change === 'different words' || change === 'identical save') {
          await first.drafts.write(TARGET, targetDraft);
        } else {
          const key = reflectionDraftStorageKey(TARGET);
          const manifest = JSON.parse(first.values.get(`${key}.manifest`)!);
          expect(manifest.count).toBe(1);
          const modified = storedRecord(first, TARGET);
          if (change === 'modified with old provenance') modified.responses = targetDraft.responses;
          else modified._ownerMigration.sourceOwnerId = 'another-anonymous-source';
          first.values.set(`${key}.${manifest.generation}.0`, JSON.stringify(modified));
        }
        await removeSource(first);

        const restarted = harness(first.values);
        restarted.apiRequest.mockImplementationOnce(async () => {
          expect(stored(restarted, TARGET)).toEqual(targetDraft);
        });
        await restarted.merge();
        expect(restarted.apiRequest).toHaveBeenCalledOnce();
        const afterRestart = harness(restarted.values);
        expect(await afterRestart.drafts.read(SOURCE)).toBeNull();
        expect(await afterRestart.drafts.read(TARGET)).toEqual(targetDraft);
      }
    );
  });

  it.each(['tombstone', 'chunk cleanup'] as const)(
    'stops before the server on provisional removal failure and safely retries after restart (%s)', async (failure) => {
      const first = harness();
      await first.drafts.write(SOURCE, draft());
      first.apiRequest.mockRejectedValueOnce(new Error('merge unavailable'));
      await expect(first.merge()).rejects.toThrow('merge unavailable');
      await first.drafts.clear(SOURCE);
      const restarted = harness(first.values);
      const original = storedRecord(restarted, TARGET);
      if (failure === 'tombstone') {
        restarted.secureStore.setItemAsync.mockRejectedValueOnce(new Error('removal failed'));
      } else {
        restarted.secureStore.deleteItemAsync.mockRejectedValueOnce(new Error('removal failed'));
      }
      await expect(restarted.merge()).rejects.toThrow('removal failed');
      expect(restarted.apiRequest).not.toHaveBeenCalled();
      expect(storedRecord(restarted, TARGET)).toEqual(failure === 'tombstone' ? original : null);
      // The reservation was released; reads do not hang after failed cleanup.
      expect(await restarted.drafts.read(TARGET)).toEqual(failure === 'tombstone' ? draft() : null);
      const retry = harness(restarted.values);
      await retry.merge();
      expect(retry.apiRequest).toHaveBeenCalledOnce();
      expect(await retry.drafts.read(SOURCE)).toBeNull();
      expect(await retry.drafts.read(TARGET)).toBeNull();
    }
  );

  it.each(['different words', 'identical save', 'cleared and restored'] as const)(
    'preserves an independently edited target across restart (%s)', async (change) => {
      const first = harness();
      await first.drafts.write(SOURCE, draft());
      first.apiRequest.mockRejectedValueOnce(new Error('merge unavailable'));
      await expect(first.merge()).rejects.toThrow('merge unavailable');
      if (change === 'cleared and restored') await first.drafts.clear(TARGET);
      const targetDraft = draft(change === 'different words' ? 'Independent destination answer' : undefined);
      await first.drafts.write(TARGET, targetDraft);
      expect(storedRecord(first, TARGET)).not.toHaveProperty('_ownerMigration');
      const h = harness(first.values);
      await h.drafts.write(SOURCE, draft('New source answer'));
      const before = new Map(h.values);
      await expect(h.merge()).rejects.toThrow('Both profiles');
      expect(h.values).toEqual(before);
      expect(h.apiRequest).not.toHaveBeenCalled();
      expect(await h.drafts.read(TARGET)).toEqual(targetDraft);
      expect(await h.drafts.read(SOURCE)).toEqual(draft('New source answer'));
    }
  );

  it('does not replace a target modified outside the draft API while retaining old provenance', async () => {
    const h = harness();
    await h.drafts.write(SOURCE, draft());
    h.apiRequest.mockRejectedValueOnce(new Error('merge unavailable'));
    await expect(h.merge()).rejects.toThrow('merge unavailable');
    const targetKey = reflectionDraftStorageKey(TARGET);
    const manifest = JSON.parse(h.values.get(`${targetKey}.manifest`)!);
    expect(manifest.count).toBe(1);
    const modified = storedRecord(h, TARGET);
    modified.responses.worry = 'Independently changed secure bytes';
    h.values.set(`${targetKey}.${manifest.generation}.0`, JSON.stringify(modified));
    const restarted = harness(h.values);
    await restarted.drafts.write(SOURCE, draft('Newer source words'));
    await expect(restarted.merge()).rejects.toThrow('Both profiles');
    expect(restarted.apiRequest).not.toHaveBeenCalled();
    expect(await restarted.drafts.read(TARGET)).toEqual(draft('Independently changed secure bytes'));
  });

  it('keeps both drafts and the old provenance when refreshing a provisional copy fails', async () => {
    const h = harness();
    await h.drafts.write(SOURCE, draft());
    h.apiRequest.mockRejectedValueOnce(new Error('merge unavailable'));
    await expect(h.merge()).rejects.toThrow('merge unavailable');
    await h.drafts.write(SOURCE, draft('Latest source words'));
    const oldTarget = storedRecord(h, TARGET);
    h.secureStore.setItemAsync.mockRejectedValueOnce(new Error('refresh failed'));
    await expect(h.merge()).rejects.toThrow('refresh failed');
    expect(h.apiRequest).toHaveBeenCalledOnce();
    expect(storedRecord(h, TARGET)).toEqual(oldTarget);
    expect(await h.drafts.read(SOURCE)).toEqual(draft('Latest source words'));
    await h.merge();
    expect(await h.drafts.read(TARGET)).toEqual(draft('Latest source words'));
  });

  it('finalizes destination ownership before source cleanup so a restart cannot overwrite a committed copy', async () => {
    const h = harness();
    await h.drafts.write(SOURCE, draft());
    h.secureStore.setItemAsync.mockImplementation(async (key, value) => {
      if (key === `${reflectionDraftStorageKey(SOURCE)}.manifest`) throw new Error('source cleanup failed');
      h.values.set(key, value);
    });
    await expect(h.merge()).rejects.toThrow('source cleanup failed');
    expect(h.setSession).not.toHaveBeenCalled();
    expect(storedRecord(h, TARGET)).not.toHaveProperty('_ownerMigration');
    const restarted = harness(h.values);
    await restarted.drafts.write(SOURCE, draft('Stale source changed after server success'));
    await expect(restarted.merge()).rejects.toThrow('Both profiles');
    expect(restarted.apiRequest).not.toHaveBeenCalled();
    expect(await restarted.drafts.read(TARGET)).toEqual(draft());
  });
});
