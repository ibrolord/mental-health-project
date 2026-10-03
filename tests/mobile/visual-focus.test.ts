import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { visualFocusTravel, VISUAL_FOCUS_SECONDS } from '../../mobile/lib/body-practices';

const compiled = ts.transpileModule(readFileSync('mobile/components/VisualFocus.tsx', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
}).outputText;

function harness(reduced = false) {
  let focused = true;
  let cursor = 0;
  const slots: { value?: any; deps?: unknown[]; cleanup?: () => void }[] = [];
  let effects: (() => void)[] = [];
  let tree: any;
  const listeners = new Map<string, (value: any) => void>();
  const animations: { start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn> }[] = [];
  const animation = () => { const value = { start: vi.fn(), stop: vi.fn() }; animations.push(value); return value; };
  const announce = vi.fn();
  const jsx = (type: any, props: any) => ({ type, props });
  const exported: any = {};
  new Function('require', 'exports', compiled)((id: string) => {
    if (id === 'react/jsx-runtime') return { jsx, jsxs: jsx };
    if (id === 'react') return {
      useState(initial: any) { const slot = slots[cursor++] ??= { value: initial }; return [slot.value, (next: any) => { slot.value = typeof next === 'function' ? next(slot.value) : next; }]; },
      useRef(initial: any) { return (slots[cursor++] ??= { value: { current: initial } }).value; },
      useEffect(effect: () => (() => void), deps: unknown[]) {
        const index = cursor++; const old = slots[index];
        if (old?.deps?.length === deps.length && deps.every((d, i) => Object.is(d, old.deps?.[i]))) return;
        const slot: { deps: unknown[]; cleanup?: () => void } = slots[index] = { deps };
        effects.push(() => { old?.cleanup?.(); slot.cleanup = effect(); });
      },
    };
    if (id === '@react-navigation/native') return { useIsFocused: () => focused };
    if (id === 'react-native') return {
      Text: 'Text', View: 'View', StyleSheet: { create: (s: unknown) => s },
      Easing: { sin: 'sin', inOut: (e: unknown) => e },
      Animated: { Value: class { setValue = vi.fn(); stopAnimation = vi.fn(); }, View: 'AnimatedView', sequence: animation, loop: animation, timing: animation },
      AppState: { addEventListener: (event: string, cb: (s: string) => void) => { listeners.set(event, cb); return { remove: () => listeners.delete(event) }; } },
      AccessibilityInfo: { isReduceMotionEnabled: async () => reduced, announceForAccessibility: announce, addEventListener: (event: string, cb: (b: boolean) => void) => { listeners.set(event, cb); return { remove: () => listeners.delete(event) }; } },
    };
    if (id === './AppUI') return { AppCard: 'AppCard', AppButton: 'AppButton', ChoiceChip: 'ChoiceChip' };
    if (id === '@/lib/constants') return { Colors: {}, Typography: {} };
    if (id === '@/lib/body-practices') return { visualFocusTravel, VISUAL_FOCUS_SECONDS };
    throw new Error(`Unexpected import ${id}`);
  }, exported);
  const render = () => { cursor = 0; effects = []; tree = exported.VisualFocus(); effects.forEach((run) => run()); };
  const elements = (node: any = tree): any[] => Array.isArray(node) ? node.flatMap((n) => elements(n ?? null)) : node?.props ? [node, ...elements(node.props.children ?? null)] : [];
  const find = (label: string) => elements().find(({ props }) => props.label === label)?.props;
  const press = (label: string) => { const control = find(label); expect(control).toBeDefined(); expect(control.disabled).not.toBe(true); control.onPress(); render(); };
  const tick = (ms: number) => { vi.advanceTimersByTime(ms); render(); };
  render();
  elements().find(({ props }) => props.onLayout).props.onLayout({ nativeEvent: { layout: { width: 300 } } }); render();
  return { render, elements, find, press, tick, animations, announce, listeners,
    settle: async () => { await Promise.resolve(); render(); },
    blur: () => { focused = false; render(); render(); },
    focus: () => { focused = true; render(); },
    unmount: () => { slots.forEach((slot) => slot.cleanup?.()); },
  };
}

afterEach(() => vi.useRealTimers());
describe('visual focus native callbacks', () => {
  it('does not autoplay, stops immediately, and continues only with an explicit action', async () => {
    vi.useFakeTimers(); const h = harness();
    expect(h.find('Start 30 seconds').disabled).toBe(true);
    await h.settle();
    expect(h.animations).toHaveLength(0);
    h.press('Start 30 seconds'); h.tick(6000);
    const last = h.animations.at(-1)!;
    h.press('Stop'); expect(last.stop).toHaveBeenCalled();
    h.tick(10000); expect(h.find('Continue')).toBeDefined();
    h.press('Continue'); h.tick(24000);
    expect(h.announce).toHaveBeenCalledExactlyOnceWith('Visual focus finished.');
    expect(h.find('Start 30 seconds')).toBeDefined();
    h.unmount(); expect(vi.getTimerCount()).toBe(0);
  });
  it('pauses for background and blur without resuming or catching up', async () => {
    vi.useFakeTimers(); const h = harness(); await h.settle();
    h.press('Start 30 seconds'); h.tick(3000);
    h.listeners.get('change')!('inactive'); h.render(); h.tick(40000);
    expect(h.announce).not.toHaveBeenCalled(); expect(h.find('Continue')).toBeDefined();
    h.press('Continue'); h.tick(1000); h.blur(); h.tick(40000); h.focus();
    expect(h.find('Stop')).toBeUndefined(); expect(h.announce).not.toHaveBeenCalled();
    h.unmount();
  });
  it('respects Reduce Motion initially and mid-session, with an explicit static alternative', async () => {
    vi.useFakeTimers(); const h = harness(true); await h.settle();
    expect(h.find('Still focus').selected).toBe(true);
    h.press('Start 30 seconds'); h.tick(1000);
    expect(h.animations).toHaveLength(0);
    h.listeners.get('reduceMotionChanged')!(false); h.render();
    expect(h.find('Continue')).toBeDefined(); h.press('Continue');
    expect(h.animations.length).toBeGreaterThan(0);
    const last = h.animations.at(-1)!;
    h.listeners.get('reduceMotionChanged')!(true); h.render();
    expect(last.stop).toHaveBeenCalled(); expect(h.find('Still focus').selected).toBe(true);
    h.unmount();
  });
  it('resets without starting, stops on unmount, and supports speed and range choices', async () => {
    vi.useFakeTimers(); const h = harness(); await h.settle();
    h.press('Steady'); expect(h.find('Steady').selected).toBe(true);
    h.press('Small movement'); expect(h.find('Small movement').selected).toBe(false);
    h.press('Still focus'); h.press('Start 30 seconds'); h.tick(2000); h.press('Reset');
    expect(h.find('Start 30 seconds')).toBeDefined(); expect(h.announce).not.toHaveBeenCalled();
    h.press('Still focus'); h.press('Start 30 seconds'); const last = h.animations.at(-1)!;
    h.unmount(); expect(last.stop).toHaveBeenCalled(); expect(vi.getTimerCount()).toBe(0);
  });
});
