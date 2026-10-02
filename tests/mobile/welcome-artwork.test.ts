import { readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { describe, expect, it, vi } from 'vitest';

const read = (file: string) => readFileSync(path.resolve(process.cwd(), file), 'utf8');

function artworkHarness() {
  const refs: { current: unknown }[] = [];
  let cursor = 0;
  let cleanup: (() => void) | undefined;
  const animations: { start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn> }[] = [];
  const timings: Record<string, unknown>[] = [];
  class Value {
    value: number;
    constructor(initial: number) { this.value = initial; }
    stopAnimation = vi.fn();
    setValue(value: number) { this.value = value; }
    interpolate = vi.fn(() => 'interpolated');
  }
  type Element = { type: any; props: any };
  const jsx = (type: any, props: any): Element => ({ type, props });
  const compiledModule = { exports: {} as { WelcomeArtwork: (props: any) => Element } };
  const compiled = ts.transpileModule(read('mobile/components/WelcomeArtwork.tsx'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  new Function('require', 'exports', compiled)((id: string) => {
    if (id === 'react') return {
      useRef: (initial: unknown) => refs[cursor++] ?? (refs[cursor - 1] = { current: initial }),
      useEffect: (effect: () => (() => void) | undefined) => { cleanup?.(); cleanup = effect(); },
    };
    if (id === 'react-native') return {
      View: 'View', Image: 'StaticImage', StyleSheet: { create: (value: unknown) => value, absoluteFillObject: {} },
      Easing: { out: (value: unknown) => value, cubic: 'cubic' },
      Animated: {
        Value, Image: 'Image',
        timing: (_value: unknown, config: Record<string, unknown>) => { timings.push(config); return config; },
        parallel: () => {
          const animation = { start: vi.fn(), stop: vi.fn() };
          animations.push(animation);
          return animation;
        },
      },
    };
    if (id === 'react/jsx-runtime') return { jsx, jsxs: jsx };
    if (id.endsWith('.png')) return id;
    throw new Error(`Unexpected import: ${id}`);
  }, compiledModule.exports);
  const frame = (focus: string | null, reduceMotion: boolean | null, step = 'focus') =>
    compiledModule.exports.WelcomeArtwork({ focus, reduceMotion, step, height: 170 });
  const layer = (active: boolean) => {
    cursor = 0;
    const component = frame('steady', false).props.children[0];
    return component.type({ ...component.props, active });
  };
  return { frame, layer, animations, timings, unmount: () => cleanup?.() };
}

describe('illustrated iOS onboarding', () => {
  it('bundles every full-color transparent scene for offline use', () => {
    for (const name of ['steady', 'routine', 'goals', 'motivation', 'obstacle', 'evidence', 'ready']) {
      const file = path.resolve(process.cwd(), `mobile/assets/welcome-${name}.png`);
      const bytes = readFileSync(file);
      expect(bytes.subarray(1, 4).toString()).toBe('PNG');
      expect(bytes[25]).toBe(6); // PNG RGBA, not a black or flattened background.
      expect(statSync(file).size).toBeLessThan(3_000_000);
    }
  });

  it('has exactly one matching illustration on every journey step in both motion modes', () => {
    const expected = { motivation: 'motivation', obstacle: 'obstacle', evidence: 'evidence', commitment: 'routine', review: 'ready' };
    for (const [step, asset] of Object.entries(expected)) {
      for (const reduced of [false, true, null]) {
        const frame = artworkHarness().frame('steady', reduced, step);
        const images = reduced === false ? frame.props.children.filter((item: any) => item.props.active) : [frame.props.children];
        expect(images).toHaveLength(1);
        expect(images[0].props.source).toContain(`welcome-${asset}.png`);
      }
    }
  });

  it('shows the right scene for each focus and keeps decoration out of accessibility', () => {
    const hook = artworkHarness();
    for (const focus of [null, 'steady', 'routine', 'follow-through']) {
      const frame = hook.frame(focus, false);
      expect(frame.props.pointerEvents).toBe('none');
      expect(frame.props.accessibilityElementsHidden).toBe(true);
      expect(frame.props.children.filter((child: any) => child.props.active)).toHaveLength(1);
      const selected = frame.props.children.find((child: any) => child.props.active);
      expect(selected.props.source).toContain(focus === 'routine' ? 'routine' : focus === 'follow-through' ? 'goals' : 'steady');
    }
  });

  it('renders a fully visible static scene for reduced or unknown motion preferences', () => {
    for (const preference of [null, true]) {
      const hook = artworkHarness();
      const visible = hook.frame('routine', preference);
      expect(Array.isArray(visible.props.children)).toBe(false);
      expect(visible.props.children.type).toBe('StaticImage');
      expect(visible.props.children.props.source).toContain('routine');
      expect(visible.props.children.props.style).not.toHaveProperty('opacity');
      expect(visible.props.children.props.style).not.toHaveProperty('transform');
      expect(hook.timings).toHaveLength(0);
      hook.unmount();
    }
  });

  it('cancels a transition on rapid selection and when static rendering unmounts it', () => {
    const hook = artworkHarness();
    hook.layer(true);
    expect(hook.animations[0].start).toHaveBeenCalledOnce();
    hook.layer(false);
    expect(hook.animations[0].stop).toHaveBeenCalledOnce();
    expect(hook.frame('routine', true).props.children.type).toBe('StaticImage');
    hook.unmount();
    expect(hook.animations[1].stop).toHaveBeenCalledOnce();
    expect(hook.timings.every((config) => config.useNativeDriver && config.isInteraction === false)).toBe(true);
  });
});
