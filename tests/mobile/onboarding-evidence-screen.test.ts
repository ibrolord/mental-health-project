import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { describe, expect, it, vi } from 'vitest';
import * as onboarding from '../../mobile/lib/advisor-onboarding';
import * as journey from '../../mobile/lib/onboarding-journey';
import { ONBOARDING_EVIDENCE } from '../../mobile/lib/onboarding-evidence';

type Node = { type: unknown; props: Record<string, unknown> };

function nodes(value: unknown): Node[] {
  if (Array.isArray(value)) return value.flatMap(nodes);
  if (!value || typeof value !== 'object' || !('props' in value)) return [];
  const node = value as Node;
  return [node, ...nodes(node.props.children)];
}

function text(value: unknown): string {
  if (Array.isArray(value)) return value.map(text).join(' ');
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (value && typeof value === 'object' && 'props' in value) return text((value as Node).props.children);
  return '';
}

// Execute the real component handlers with native views mocked. This tests state transitions,
// not native layout, gestures, VoiceOver, or OS link handling.
function screenHarness(fontScale = 1) {
  const state: unknown[] = [];
  let cursor = 0;
  const openURL = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
  const onFinish = vi.fn();
  const onSkip = vi.fn();
  const onSupport = vi.fn();
  const react = {
    useState: (initial: unknown) => {
      const slot = cursor++;
      if (!(slot in state)) state[slot] = typeof initial === 'function' ? initial() : initial;
      return [state[slot], (next: unknown) => {
        state[slot] = typeof next === 'function' ? next(state[slot]) : next;
      }];
    },
    useRef: (initial: unknown) => {
      const slot = cursor++;
      if (!(slot in state)) state[slot] = { current: initial };
      return state[slot];
    },
    useEffect: () => {},
  };
  const jsx = (type: unknown, props: Record<string, unknown>): Node => ({ type, props });
  const testModule = { exports: {} as { AdvisorWelcome: (props: Record<string, unknown>) => Node } };
  const compiled = ts.transpileModule(readFileSync('mobile/components/AdvisorWelcome.ios.tsx', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  new Function('require', 'exports', compiled)((id: string) => {
    if (id === 'react') return react;
    if (id === 'react/jsx-runtime') return { jsx, jsxs: jsx, Fragment: 'Fragment' };
    if (id === 'react-native') return {
      AccessibilityInfo: { announceForAccessibility: vi.fn(), setAccessibilityFocus: vi.fn() },
      findNodeHandle: () => null,
      Keyboard: { isVisible: () => false, dismiss: vi.fn() },
      KeyboardAvoidingView: 'KeyboardAvoidingView', Linking: { openURL }, Pressable: 'Pressable',
      ScrollView: 'ScrollView', StyleSheet: { create: (value: unknown) => value, hairlineWidth: 1 },
      Text: 'Text', View: 'View', useWindowDimensions: () => ({ fontScale, height: 844, width: 390 }),
    };
    if (id === '@react-navigation/elements') return { useHeaderHeight: () => 0 };
    if (id === 'react-native-safe-area-context') return { useSafeAreaInsets: () => ({ top: 0 }) };
    if (id === '@expo/vector-icons') return { Feather: 'Feather' };
    if (id === './AppUI') return { AppButton: 'AppButton', AppInput: 'AppInput', SupportAction: 'SupportAction' };
    if (id === './WelcomeMotion') return { useWelcomeReducedMotion: () => true, WelcomeReveal: 'WelcomeReveal' };
    if (id === './WelcomeArtwork') return { WelcomeArtwork: 'WelcomeArtwork' };
    if (id === '@/lib/constants') return { Colors: {}, LARGE_TEXT_SCALE: 1.3, Radius: {}, Typography: {} };
    if (id === '@/lib/advisor-onboarding') return onboarding;
    if (id === '@/lib/onboarding-evidence') return { ONBOARDING_EVIDENCE };
    if (id === '@/lib/onboarding-journey') return journey;
    throw new Error(`Unexpected import: ${id}`);
  }, testModule.exports);
  const render = () => {
    cursor = 0;
    return testModule.exports.AdvisorWelcome({ name: '', busy: false, ready: true, onFinish, onSkip, onSupport });
  };
  const find = (label: string) => nodes(render()).find(({ props }) => props.label === label || props.accessibilityLabel === label);
  const press = (label: string) => {
    const target = find(label);
    expect(target, `Missing ${label}`).toBeDefined();
    expect(target?.props.disabled).not.toBe(true);
    (target?.props.onPress as () => void)();
  };
  const reachEvidence = (label: string) => {
    press(label); press('Find my starting point');
    press('Skip this question'); press('Skip this question');
  };
  return { render, find, press, reachEvidence, openURL, onFinish, onSkip };
}

describe('native evidence-step interactions', () => {
  it.each(onboarding.STARTING_FOCUS_OPTIONS)('shows bounded evidence for $label and opens its exact primary source', async ({ id, label }) => {
    const screen = screenHarness();
    screen.reachEvidence(label);
    const evidence = ONBOARDING_EVIDENCE[id];
    const visible = text(screen.render());
    expect(visible).toContain(evidence.metricLabel);
    expect(visible).toContain(evidence.finding);
    expect(visible).toContain(evidence.qualifier);
    expect(visible).toContain(evidence.citation);
    expect(visible).toContain(evidence.application);
    expect(visible).not.toContain(evidence.detail);
    expect(screen.openURL).not.toHaveBeenCalled();
    screen.press('Evidence details and source');
    expect(text(screen.render())).toContain(evidence.detail);
    expect(screen.find('Evidence details and source')?.props.accessibilityState).toEqual({ expanded: true });
    screen.press('Read the source');
    expect(screen.openURL).toHaveBeenCalledWith(evidence.url);
    await Promise.resolve();
    screen.press('Evidence details and source');
    expect(text(screen.render())).not.toContain(evidence.detail);
    screen.press('Make it personal');
    expect(text(screen.render())).toContain('What is one small step you could take?');
    expect(screen.onFinish).not.toHaveBeenCalled();
  });

  it('preserves chosen answers while revisiting evidence and can skip without saving', () => {
    const screen = screenHarness();
    screen.press('Build a routine'); screen.press('Find my starting point');
    screen.press(journey.MOTIVATIONS[0]); screen.press('Continue');
    screen.press(journey.OBSTACLES[0].label); screen.press('Continue');
    screen.press('Evidence details and source'); screen.press('Back a step');
    expect(screen.find(journey.OBSTACLES[0].label)?.props.accessibilityState).toMatchObject({ checked: true });
    screen.press('Back a step');
    expect(screen.find(journey.MOTIVATIONS[0])?.props.accessibilityState).toMatchObject({ checked: true });
    screen.press('Continue'); screen.press('Continue');
    expect(screen.find('Evidence details and source')?.props.accessibilityState).toEqual({ expanded: false });
    screen.press('Explore without saving');
    expect(screen.onSkip).toHaveBeenCalledOnce();
    expect(screen.onFinish).not.toHaveBeenCalled();
  });

  it('exposes link failure and retries rather than swallowing the error', async () => {
    const screen = screenHarness();
    screen.reachEvidence('Build a routine'); screen.press('Evidence details and source');
    screen.openURL.mockRejectedValueOnce(new Error('Cannot open'));
    screen.press('Read the source'); await Promise.resolve();
    expect(text(screen.render())).toContain('Could not open the source. Please try again.');
    screen.press('Read the source'); await Promise.resolve();
    expect(screen.openURL).toHaveBeenCalledTimes(2);
    expect(text(screen.render())).not.toContain('Could not open the source. Please try again.');
  });

  it('does not show a late link failure after leaving the evidence step', async () => {
    const screen = screenHarness();
    let reject!: (error: Error) => void;
    screen.openURL.mockReturnValueOnce(new Promise<void>((_resolve, fail) => { reject = fail; }));
    screen.reachEvidence('Build a routine'); screen.press('Evidence details and source');
    screen.press('Read the source'); screen.press('Make it personal');
    reject(new Error('Late failure')); await Promise.resolve();
    screen.press('Back a step'); screen.press('Evidence details and source');
    expect(text(screen.render())).not.toContain('Could not open the source. Please try again.');
  });

  it('keeps group labels and full percentages in the large-text, reduced-motion variant', () => {
    const screen = screenHarness(2);
    screen.reachEvidence('Build a routine');
    const tree = nodes(screen.render());
    for (const { percent, label } of ONBOARDING_EVIDENCE.routine.comparison ?? []) {
      expect(tree.some(({ props }) => props.accessibilityLabel === `${percent} percent. ${label}.`)).toBe(true);
    }
    expect(tree.some(({ type }) => type === 'WelcomeArtwork')).toBe(false);
    expect(tree.filter(({ props }) => props.label === 'Make it personal')).toHaveLength(1);
    expect(tree.some(({ props }) => Array.isArray(props.style) && props.style.some((style) =>
      style?.flexDirection === 'column' && style?.alignItems === 'flex-start'))).toBe(true);
  });
});
