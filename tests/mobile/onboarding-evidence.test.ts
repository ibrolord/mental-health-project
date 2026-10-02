import { readFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { describe, expect, it, vi } from 'vitest';
import { STARTING_FOCUS_OPTIONS } from '../../mobile/lib/advisor-onboarding';
import { ONBOARDING_EVIDENCE, welcomeMotionSpec, welcomeNextStep } from '../../mobile/lib/onboarding-evidence';

const read = (file: string) => readFileSync(path.resolve(process.cwd(), file), 'utf8');

describe('iOS onboarding research and progression', () => {
  it.each(STARTING_FOCUS_OPTIONS)('provides a bounded primary source for $id', ({ id }) => {
    const evidence = ONBOARDING_EVIDENCE[id];
    expect(new URL(evidence.url).protocol).toBe('https:');
    expect(evidence.finding.length).toBeGreaterThan(30);
    expect(evidence.detail).toMatch(/not|did not/);
    expect(evidence.citation).toMatch(/2026|2002|2016/);
    expect(evidence.metric).toMatch(/\d/);
    expect(evidence.qualifier).toMatch(/not MHtoolkit/i);
    expect(evidence.application.length).toBeGreaterThan(20);
    expect(welcomeNextStep(id, true, false)).toBe('first-step');
    expect(welcomeNextStep(id, false, false)).toBe('focus');
    expect(welcomeNextStep(id, true, true)).toBe('focus');
  });

  it('does not advance without a chosen focus', () => {
    expect(welcomeNextStep(null, true, false)).toBe('focus');
  });

  it('keeps the exercise percentage tied to its trial population and endpoint', () => {
    const study = ONBOARDING_EVIDENCE.routine;
    expect(study.metric).toBe('91% vs 38%');
    expect(study.metricLabel).toContain('following week');
    expect(study.finding).toContain('248 UK students');
    expect(study.comparison).toEqual([
      { percent: 91, label: 'Motivation + a specific plan' },
      { percent: 38, label: 'Control group' },
    ]);
    expect(study.detail).toContain('248 UK undergraduates');
    expect(study.detail).toContain('ages 18-34');
    expect(study.detail).toContain('health-motivation leaflet plus a when-and-where plan');
    expect(study.detail).toContain('self-reported');
    expect(study.finding).toContain('20-minute');
    expect(study.detail).toContain('not a test of MHtoolkit');
    expect(study.url).toBe('https://bpspsychub.onlinelibrary.wiley.com/doi/pdf/10.1348/135910702169420');
  });

  it('never turns a meta-analysis effect size into a success percentage', () => {
    expect(ONBOARDING_EVIDENCE['follow-through'].metric).toBe('138');
    expect(ONBOARDING_EVIDENCE['follow-through'].metricLabel).toBe('studies, with 19,951 participants');
    expect(ONBOARDING_EVIDENCE['follow-through'].detail).toContain('not a 40% success rate');
    expect(ONBOARDING_EVIDENCE['follow-through'].finding).toContain('on average');
    expect(ONBOARDING_EVIDENCE['follow-through'].comparison).toBeUndefined();
  });

  it('keeps the WHO number approximate and separates global need from treatment evidence', () => {
    const evidence = ONBOARDING_EVIDENCE.steady;
    expect(evidence.metric).toBe('1 in 7');
    expect(evidence.metricLabel).toContain('Nearly one in seven people worldwide');
    expect(evidence.finding).toContain('mental disorder in 2023');
    expect(evidence.detail).toContain('not just adults or people using apps');
    expect(evidence.detail).toContain('not evidence that an app improves mental health');
    expect(evidence.citation).toContain('2026 fact sheet, using 2023 data');
    expect(evidence.url).toBe('https://www.who.int/news-room/fact-sheets/detail/mental-disorders');
  });

  it('only charts actual bounded percentages, with explicit group labels', () => {
    for (const evidence of Object.values(ONBOARDING_EVIDENCE)) {
      if (!evidence.comparison) continue;
      expect(evidence.metric).toBe(evidence.comparison.map(({ percent }) => `${percent}%`).join(' vs '));
      expect(new Set(evidence.comparison.map(({ label }) => label)).size).toBe(evidence.comparison.length);
      for (const { percent, label } of evidence.comparison) {
        expect(percent).toBeGreaterThanOrEqual(0);
        expect(percent).toBeLessThanOrEqual(100);
        expect(label.length).toBeGreaterThan(3);
      }
    }
  });

  it('uses static, visible content until motion is explicitly allowed', () => {
    for (const preference of [true, null]) {
      expect(welcomeMotionSpec(preference)).toEqual({ duration: 0, translateY: 0, initialOpacity: 1 });
    }
    expect(welcomeMotionSpec(false)).toEqual({ duration: 320, translateY: 12, initialOpacity: 0.35 });
  });
});

describe('native welcome integration contracts', () => {
  const screen = read('mobile/components/AdvisorWelcome.ios.tsx');
  const setup = read('mobile/app/advisor-setup.tsx');

  it('keeps the first transition separate from the existing protected save', () => {
    expect(screen).toContain("if (step !== 'review') changeStep(nextJourneyStep(step))");
    expect(screen).toContain('else { Keyboard.dismiss(); onFinish(focus, preferredName, cleanPlan); }');
    expect(screen).not.toMatch(/AsyncStorage|fetch\(|supabase|requestPermissions|ensureAiDataSharingConsent/);
    expect(setup).toContain('key={`${ownerKey}:${ready}`}');
    expect(setup).toContain("scroll={Platform.OS !== 'ios'}");
  });

  it('keeps exits independent of readiness and name editing optional', () => {
    const skip = screen.slice(screen.indexOf('<AppButton label={busy ?'), screen.indexOf('</View>;'));
    expect(skip).toContain('onSkip()');
    expect(skip).not.toMatch(/disabled=|loading=/);
    expect(screen).toContain('onPress={onSupport}');
    expect(screen).toContain('{nameExpanded ? <AppInput');
    expect(screen).not.toContain('autoFocus');
    expect(screen).toContain('Explore without saving');
  });

  it('keeps large text and compact screens scrollable without a tall fixed footer', () => {
    expect(screen).toContain('fontScale >= LARGE_TEXT_SCALE || height < 650');
    expect(screen).toContain('{inlineActions ? actions : null}');
    expect(screen).toContain('{!inlineActions ? actions : null}');
    expect(screen).toContain('behavior="padding" keyboardVerticalOffset={headerHeight}');
    expect(screen).not.toContain('automaticallyAdjustKeyboardInsets');
    expect(screen).toContain('accessibilityRole="radio"');
    expect(screen).toContain('accessibilityState={{ expanded: evidenceExpanded }}');
    expect(screen).toContain('height < 650 || keyboardVisible');
    expect(screen).toContain("Keyboard.addListener('keyboardWillShow'");
    expect(screen).toContain('show.remove(); hide.remove()');
    expect(screen).toContain('if (keyboardVisible) scroll.current?.scrollToEnd({ animated: false })');
    expect(screen).toContain('fontScale >= LARGE_TEXT_SCALE && styles.stackedChangeFocus');
    expect(screen).toContain('fontScale >= LARGE_TEXT_SCALE && styles.stackedChangeLabel');
    expect(screen).toContain("buttonLabel: { flexShrink: 1, textAlign: 'center' }");
    expect(screen.match(/labelStyle={styles.buttonLabel}/g)).toHaveLength(4);
    expect(read('mobile/components/AppUI.tsx')).toContain('styles.buttonText, { color: foreground }, labelStyle');
  });

  it('moves accessibility focus after the new heading is laid out, not after animation', () => {
    expect(screen).toContain('focusHeading.current = true');
    expect(screen).toContain('key={step} ref={heading} onLayout={focusNewHeading}');
    expect(screen).toContain('AccessibilityInfo.setAccessibilityFocus(target)');
    expect(screen).toContain('if (request === linkRequest.current) setLinkError');
  });

  it('keeps source attribution and the qualifier visible before expanding details', () => {
    const visible = screen.slice(screen.indexOf('testID="onboarding-evidence"'), screen.indexOf('{evidenceExpanded ?'));
    expect(visible).toContain('{evidence.qualifier}');
    expect(visible).toContain('{evidence.citation}');
    expect(visible).toContain('{evidence.finding}');
    expect(visible).toContain('Evidence details and source');
    expect(screen).toContain('label="Read the source"');
    expect(screen).toContain('Linking.openURL(evidence.url)');
  });

  it('keeps percentages readable without color or motion and stacks comparison rows at large text sizes', () => {
    expect(screen).toContain('accessibilityLabel={`${percent} percent. ${label}.`}');
    expect(screen).toContain('fontScale >= LARGE_TEXT_SCALE && styles.stackedComparison');
    expect(screen).toContain("{ width: `${percent}%` }");
    expect(screen).toContain('<Text style={styles.comparisonMetric}>{percent}%</Text>');
    expect(screen).not.toMatch(/setInterval|Animated\.loop|numberOfLines/);
  });
});

// Execute the real preference hook with mocked native events, not just source assertions.
function motionPreferenceHarness() {
  let resolve!: (enabled: boolean) => void;
  let reject!: (reason: Error) => void;
  const query = new Promise<boolean>((yes, no) => { resolve = yes; reject = no; });
  let listener!: (enabled: boolean) => void;
  let cleanup!: () => void;
  const updates: boolean[] = [];
  const remove = vi.fn();
  const testModule = { exports: {} as { useWelcomeReducedMotion: () => boolean | null } };
  const compiled = ts.transpileModule(read('mobile/components/WelcomeMotion.tsx'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  new Function('require', 'exports', compiled)((id: string) => {
    if (id === 'react') return {
      useState: (initial: null) => [initial, (value: boolean) => updates.push(value)],
      useEffect: (effect: () => () => void) => { cleanup = effect(); },
    };
    if (id === 'react-native') return { AccessibilityInfo: {
      addEventListener: (_event: string, handler: (enabled: boolean) => void) => { listener = handler; return { remove }; },
      isReduceMotionEnabled: () => query,
    } };
    if (id === '@/lib/onboarding-evidence') return { welcomeMotionSpec };
    if (id === 'react/jsx-runtime') return {};
    throw new Error(`Unexpected import: ${id}`);
  }, testModule.exports);
  const initial = testModule.exports.useWelcomeReducedMotion();
  return { initial, updates, resolve, reject, event: (enabled: boolean) => listener(enabled), cleanup: () => cleanup(), remove };
}

describe('Reduce Motion preference races', () => {
  it('applies the initial system query', async () => {
    const hook = motionPreferenceHarness();
    expect(hook.initial).toBeNull();
    hook.resolve(false);
    await Promise.resolve();
    expect(hook.updates).toEqual([false]);
    hook.cleanup();
  });

  it('never overwrites a live preference change with a stale query', async () => {
    const hook = motionPreferenceHarness();
    hook.event(true);
    hook.resolve(false);
    await Promise.resolve();
    expect(hook.updates).toEqual([true]);
    hook.event(false);
    expect(hook.updates).toEqual([true, false]);
    hook.cleanup();
  });

  it('falls back to static content when the native query fails', async () => {
    const hook = motionPreferenceHarness();
    hook.reject(new Error('native unavailable'));
    await Promise.resolve(); await Promise.resolve();
    expect(hook.updates).toEqual([true]);
    hook.cleanup();
  });

  it('unsubscribes and ignores late query and event callbacks after unmount', async () => {
    const hook = motionPreferenceHarness();
    hook.cleanup();
    hook.resolve(false);
    hook.event(true);
    await Promise.resolve();
    expect(hook.remove).toHaveBeenCalledOnce();
    expect(hook.updates).toEqual([]);
  });
});
