import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import ts from 'typescript';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as guidedTimer from '../../mobile/lib/guided-timer';
import * as games from '../../mobile/lib/wellbeing/games';
import * as focus from '../../mobile/lib/wellbeing/focus';

type Element = { type: string; props: Record<string, any> };
type Slot = { value?: any; deps?: readonly unknown[]; cleanup?: () => void };

// Execute the real component callbacks with deterministic hook state and native
// primitives. This verifies completion boundaries, not native rendering or QA.
function mountCallbacks(file: string, component: string, initialProps = {}, imports: Record<string, unknown> = {}) {
  const slots: Slot[] = [];
  let cursor = 0;
  let dirty = false;
  let effects: (() => void)[] = [];
  let props = initialProps;
  let tree: Element;
  let nextId = 0;
  const completion = {
    start: vi.fn((itemId: string) => ({ id: `run-${++nextId}`, itemId, startedAt: new Date().toISOString() })),
    complete: vi.fn(async () => true),
    error: '',
  };
  const equalDeps = (a?: readonly unknown[], b?: readonly unknown[]) =>
    Boolean(a && b && a.length === b.length && a.every((value, i) => Object.is(value, b[i])));
  const hooks = {
    useState(initial: any) {
      const index = cursor++;
      if (!slots[index]) slots[index] = { value: typeof initial === 'function' ? initial() : initial };
      return [slots[index].value, (value: any) => {
        const next = typeof value === 'function' ? value(slots[index].value) : value;
        if (!Object.is(next, slots[index].value)) {
          slots[index].value = next;
          dirty = true;
        }
      }];
    },
    useRef(initial: any) {
      const index = cursor++;
      slots[index] ??= { value: { current: initial } };
      return slots[index].value;
    },
    useCallback(callback: any, deps: readonly unknown[]) {
      const index = cursor++;
      if (!equalDeps(slots[index]?.deps, deps)) slots[index] = { value: callback, deps };
      return slots[index].value;
    },
    useEffect(effect: () => void | (() => void), deps?: readonly unknown[]) {
      const index = cursor++;
      if (equalDeps(slots[index]?.deps, deps)) return;
      const previous = slots[index];
      slots[index] = { deps };
      effects.push(() => {
        previous?.cleanup?.();
        slots[index].cleanup = effect() || undefined;
      });
    },
  };
  const primitives = new Proxy({}, { get: (_target, name) => String(name) });
  const jsx = (type: string, elementProps: Record<string, any>) => ({ type, props: elementProps });
  const source = readFileSync(resolve(process.cwd(), file), 'utf8');
  const code = ts.transpileModule(`${source}\nexport { ${component} as Subject };`, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const evaluated = { exports: {} as Record<string, any> };
  const requireMock = (name: string) => {
    if (name in imports) return imports[name];
    if (name === 'react') return hooks;
    if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx, Fragment: 'Fragment' };
    if (name === 'react-native') return {
      ...Object.fromEntries(['View', 'Text', 'TextInput', 'Pressable'].map((name) => [name, name])),
      StyleSheet: { create: (styles: unknown) => styles },
      AccessibilityInfo: { announceForAccessibility: vi.fn() },
      AppState: { addEventListener: () => ({ remove: vi.fn() }) },
    };
    if (name === '@expo/vector-icons') return { Feather: 'Feather' };
    if (name === '@/components/AppUI') return primitives;
    if (name === '@/lib/constants') return { Colors: primitives };
    if (name === '@/lib/guided-timer') return guidedTimer;
    if (name === '@/lib/wellbeing/games') return games;
    if (name === '@/lib/wellbeing/focus') return focus;
    if (name === '@/components/OptionalSoundscape') return { OptionalSoundscape: 'OptionalSoundscape' };
    if (name === '@/components/ToolCompletionRetry') return { ToolCompletionRetry: 'ToolCompletionRetry' };
    if (name === 'expo-router') return { useLocalSearchParams: () => ({}), useRouter: () => ({ setParams: vi.fn() }) };
    if (name === '@/lib/hooks/use-data-context') return { useDataContext: () => ({ context: { user_id: 'owner-a' } }) };
    if (name === '@/lib/hooks/use-tool-completion') return { useToolCompletion: () => completion };
    throw new Error(`Unmocked component dependency: ${name}`);
  };
  new Function('require', 'module', 'exports', code)(requireMock, evaluated, evaluated.exports);
  const render = (nextProps = props) => {
    props = nextProps;
    let renders = 0;
    do {
      dirty = false;
      cursor = 0;
      effects = [];
      tree = evaluated.exports.Subject(props);
      for (const effect of effects) effect();
      if (++renders > 20) throw new Error('Component did not settle');
    } while (dirty);
  };
  const elements = (): Element[] => {
    const found: Element[] = [];
    const visit = (node: any) => {
      if (Array.isArray(node)) return node.forEach(visit);
      if (!node || typeof node !== 'object' || !('props' in node)) return;
      found.push(node);
      visit(node.props.children);
    };
    visit(tree);
    return found;
  };
  const find = (label: string) => {
    const node = elements().find(({ props }) => props.label === label || props.accessibilityLabel === label);
    if (!node) throw new Error(`Control not found: ${label}`);
    return node;
  };
  const press = async (label: string) => {
    const node = find(label);
    if (!node.props.disabled) await node.props.onPress();
    render();
  };
  const text = (label: string, value: string) => {
    find(label).props.onChangeText(value);
    render();
  };
  const tick = (seconds: number) => {
    for (let i = 0; i < seconds; i++) {
      vi.advanceTimersByTime(1000);
      render();
    }
  };
  render();
  return {
    completion, render, find, press, text, tick, elements,
    unmount() { slots.forEach((slot) => slot.cleanup?.()); },
  };
}

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

describe('guided practice completion callback', () => {
  it('completes once, ignores callback identity changes, and completes a replay separately', async () => {
    const first = vi.fn();
    const second = vi.fn();
    const steps = [{ label: 'Notice', instruction: 'Notice a detail.', seconds: 2 }];
    const screen = mountCallbacks('mobile/components/GuidedPractice.tsx', 'GuidedPractice', { steps, onComplete: first });
    expect(first).not.toHaveBeenCalled();
    await screen.press('Begin');
    screen.tick(2);
    expect(first).toHaveBeenCalledTimes(1);
    screen.render({ steps, onComplete: second });
    expect(second).not.toHaveBeenCalled();
    await screen.press('Start again');
    screen.tick(2);
    expect(second).toHaveBeenCalledTimes(1);
    screen.unmount();
  });

  it('does not complete paused, reset, unmounted or blocked-start practices', async () => {
    const onComplete = vi.fn();
    const steps = [{ label: 'Notice', instruction: 'Notice a detail.', seconds: 3 }];
    const screen = mountCallbacks('mobile/components/GuidedPractice.tsx', 'GuidedPractice', { steps, onComplete });
    await screen.press('Begin');
    screen.tick(1);
    await screen.press('Pause');
    screen.tick(5);
    await screen.press('Reset');
    expect(onComplete).not.toHaveBeenCalled();
    screen.render({ steps, onComplete, onBeforeStart: async () => false } as any);
    await screen.press('Begin');
    screen.tick(5);
    screen.unmount();
    expect(onComplete).not.toHaveBeenCalled();
  });

  it('does not give full credit after skipping and persists the first unfinished step', async () => {
    const onComplete = vi.fn();
    const onPause = vi.fn();
    const steps = [
      { label: 'First', instruction: 'First instruction', seconds: 2 },
      { label: 'Second', instruction: 'Second instruction', seconds: 2 },
      { label: 'Last', instruction: 'Last instruction', seconds: 2 },
    ];
    const screen = mountCallbacks('mobile/components/GuidedPractice.tsx', 'GuidedPractice', { steps, onComplete, onPause });
    await screen.press('Go to step 3: Last');
    expect(onPause).toHaveBeenLastCalledWith({ stepIndex: 0, elapsed: 0, running: false, complete: false });
    await screen.press('Begin');
    screen.tick(2);
    expect(onComplete).not.toHaveBeenCalled();
    await screen.press('Start again');
    screen.tick(6);
    expect(onComplete).toHaveBeenCalledTimes(1);
    screen.unmount();
  });

  it('retains legitimate restored progress and completes all remaining steps', async () => {
    const onComplete = vi.fn();
    const steps = [
      { label: 'First', instruction: 'First instruction', seconds: 2 },
      { label: 'Second', instruction: 'Second instruction', seconds: 2 },
      { label: 'Last', instruction: 'Last instruction', seconds: 2 },
    ];
    const initialTimer = { stepIndex: 1, elapsed: 1, running: false, complete: false };
    const screen = mountCallbacks('mobile/components/GuidedPractice.tsx', 'GuidedPractice', { steps, initialTimer, onComplete });
    await screen.press('Continue');
    screen.tick(3);
    expect(onComplete).toHaveBeenCalledTimes(1);
    screen.unmount();
  });
});

describe('focus persistence completion boundary', () => {
  function focusDatabase() {
    let failFinalSave = false;
    const updates: Record<string, any>[] = [];
    const from = () => {
      let inserted: Record<string, any> | undefined;
      let updated: Record<string, any> | undefined;
      let id: string | undefined;
      const builder = {
        select: () => builder,
        eq: (key: string, value: string) => { if (key === 'id') id = value; return builder; },
        gte: () => builder,
        insert: (values: Record<string, any>) => { inserted = values; return builder; },
        update: (values: Record<string, any>) => { updated = values; updates.push(values); return builder; },
        single: async () => {
          if (inserted) return { data: { id: inserted.id }, error: null };
          if (failFinalSave) return { data: null, error: new Error('Offline') };
          return { data: { id, completed_at: updated?.completed_at }, error: null };
        },
        then: (onFulfilled: (value: any) => any, onRejected?: (reason: any) => any) =>
          Promise.resolve({ count: 0, error: null }).then(onFulfilled, onRejected),
      };
      return builder;
    };
    return { from, updates, fail(value: boolean) { failFinalSave = value; } };
  }

  it('does not report an abandoned block, and retries failed final persistence with its original timestamp', async () => {
    const database = focusDatabase();
    const screen = mountCallbacks('mobile/app/focus.tsx', 'FocusContent', {}, {
      '@/lib/supabase': { supabase: database },
    });
    screen.text('Outcome for this block', 'A bounded task');
    screen.text('Focus', '5');
    await screen.press('Begin focus block');
    screen.tick(10);
    await screen.press('Stop');
    expect(screen.completion.complete).not.toHaveBeenCalled();
    expect(database.updates.some(({ status }) => status === 'abandoned')).toBe(true);

    database.fail(true);
    await screen.press('Begin focus block');
    screen.tick(300);
    await Promise.resolve();
    screen.render();
    expect(screen.completion.complete).not.toHaveBeenCalled();
    expect(screen.find('Plan another block').props.disabled).toBe(true);
    const firstAttempt = database.updates.find(({ status }) => status === 'complete');
    database.fail(false);
    screen.tick(10);
    await screen.press('Retry saving session');
    await Promise.resolve();
    screen.render();
    expect(screen.completion.complete).toHaveBeenCalledTimes(1);
    expect(screen.completion.complete).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'run-2' }),
      { id: 'run-2', completedAt: firstAttempt?.completed_at },
    );
    expect(database.updates.filter(({ status }) => status === 'complete')).toHaveLength(2);
    screen.unmount();
  });
});

describe('attention game completion boundaries', () => {
  for (const component of ['ColorSwitch', 'VisualSweep', 'CategorySprint']) {
    it(`${component} counts a full timer only, retaining one token across pause`, async () => {
      const screen = mountCallbacks('mobile/app/mind-games.tsx', component);
      await screen.press('Start');
      screen.tick(30);
      await screen.press('Pause');
      screen.tick(60);
      expect(screen.completion.complete).not.toHaveBeenCalled();
      await screen.press('Continue');
      screen.tick(30);
      expect(screen.completion.start).toHaveBeenCalledTimes(1);
      expect(screen.completion.complete).toHaveBeenCalledTimes(1);
      screen.render();
      expect(screen.completion.complete).toHaveBeenCalledTimes(1);
      await screen.press(component === 'CategorySprint' ? 'New round' : 'Reset');
      await screen.press('Start');
      screen.tick(10);
      screen.unmount();
      expect(screen.completion.complete).toHaveBeenCalledTimes(1);
    });
  }

  it('counts Number Flow after ten answers and creates a new token after replay', async () => {
    const screen = mountCallbacks('mobile/app/mind-games.tsx', 'NumberFlow');
    for (let round = 0; round < 10; round++) {
      expect(screen.completion.complete).not.toHaveBeenCalled();
      screen.text('Math answer', '1');
      await screen.press('Check');
    }
    expect(screen.completion.complete).toHaveBeenCalledTimes(1);
    await screen.press('New round');
    screen.text('Math answer', '2');
    await screen.press('Check');
    expect(screen.completion.start).toHaveBeenCalledTimes(2);
    expect(screen.completion.complete).toHaveBeenCalledTimes(1);
    screen.unmount();
  });

  it('requires a checked Sequence Hold round and explicit finish, never each correct answer', async () => {
    const screen = mountCallbacks('mobile/app/mind-games.tsx', 'SequenceHold');
    expect(screen.find('Finish practice').props.disabled).toBe(true);
    await screen.press('Finish practice');
    await screen.press('Show a sequence');
    screen.tick(2);
    screen.text('Enter the digits', '123');
    await screen.press('Check');
    await screen.press('Check');
    expect(screen.completion.complete).not.toHaveBeenCalled();
    expect(screen.find('Check').props.disabled).toBe(true);
    await screen.press('Finish practice');
    expect(screen.completion.complete).toHaveBeenCalledTimes(1);
    await screen.press('Start again');
    expect(screen.find('Finish practice').props.disabled).toBe(true);
    screen.unmount();
  });

  it('counts Sensory Orient only after all fifteen observations', async () => {
    const screen = mountCallbacks('mobile/app/mind-games.tsx', 'SensoryOrient');
    for (let index = 0; index < 15; index++) {
      expect(screen.completion.complete).not.toHaveBeenCalled();
      screen.elements().find(({ props }) => props.onChangeText)!.props.onChangeText('A detail');
      screen.render();
      await screen.press('Add');
    }
    expect(screen.completion.start).toHaveBeenCalledTimes(1);
    expect(screen.completion.complete).toHaveBeenCalledTimes(1);
    screen.unmount();
  });
});
