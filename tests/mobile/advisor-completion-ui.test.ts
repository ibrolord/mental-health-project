import { readFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { describe, expect, it, vi } from 'vitest';
import type { AdvisorActionInstance } from '../../mobile/lib/advisor-action-storage';
import type { AdvisorRecommendation } from '../../mobile/lib/advisor-core';
import { TOOL_COMPLETION_LABELS, type ToolCompletion } from '../../mobile/lib/tool-completion-storage';
import { createAdvisorLoopRefresh } from '../../mobile/lib/advisor-loop-refresh';
import { createAdvisorStepStarter } from '../../mobile/lib/advisor-start';
import { advisorLoopSelectionOptions } from '../../mobile/lib/advisor-loop-selection';

// Exercise the actual screen render and callbacks with native hosts replaced by
// element records. These are screen logic tests, not native interaction QA.
type Element = { type: string; props: Record<string, any> };
const jsx = (type: string, props: Record<string, any>): Element => ({ type, props });
const constants = { Colors: {}, Typography: {}, Radius: {}, Spacing: {}, LARGE_TEXT_SCALE: 1.4 };
const native = {
  Text: 'Text', View: 'View', Pressable: 'Pressable', Image: 'Image',
  StyleSheet: { create: (styles: unknown) => styles },
  Platform: { OS: 'ios' },
  useWindowDimensions: () => ({ width: 375, fontScale: 1 }),
};

function loadComponent(file: string, modules: Record<string, unknown>) {
  const source = readFileSync(path.resolve(process.cwd(), file), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const evaluated = { exports: {} as Record<string, any> };
  const requireMock = (name: string) => {
    if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx, Fragment: 'Fragment' };
    if (name === 'react-native') return { ...native, ...(modules[name] ?? {}) };
    if (name === '@/lib/constants') return constants;
    if (name in modules) return modules[name];
    if (name === '@/lib/advisor-client-events') return { subscribeAdvisorClient: () => () => {} };
    throw new Error(`Missing screen dependency: ${name}`);
  };
  new Function('require', 'module', 'exports', compiled)(requireMock, evaluated, evaluated.exports);
  return evaluated.exports;
}

function todayRefreshEffect(dependencies: Record<string, unknown>): () => void {
  const file = path.resolve(process.cwd(), 'mobile/app/(tabs)/index.tsx');
  const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let effect: ts.Expression | undefined;
  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node) && node.expression.getText(source) === 'useEffect' &&
      node.arguments[0]?.getText(source).includes('refreshToolCompletions')) effect = node.arguments[0];
    ts.forEachChild(node, visit);
  };
  visit(source);
  if (!effect) throw new Error('Today completion refresh effect is missing');
  const compiled = ts.transpileModule(`const effect = ${effect.getText(source)};`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText;
  return new Function(...Object.keys(dependencies), `${compiled}; return effect;`)(...Object.values(dependencies));
}

function todayStartAction(dependencies: Record<string, unknown>): () => Promise<void> {
  const file = path.resolve(process.cwd(), 'mobile/app/(tabs)/index.tsx');
  const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let callback: ts.Expression | undefined;
  const visit = (node: ts.Node) => {
    if (ts.isVariableDeclaration(node) && node.name.getText(source) === 'startNextStep') callback = node.initializer;
    ts.forEachChild(node, visit);
  };
  visit(source);
  if (!callback) throw new Error('Today start action is missing');
  const compiled = ts.transpileModule(`const callback = ${callback.getText(source)};`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText;
  return new Function(...Object.keys(dependencies), `${compiled}; return callback;`)(...Object.values(dependencies));
}

function elements(tree: unknown): Element[] {
  if (Array.isArray(tree)) return tree.flatMap(elements);
  if (!tree || typeof tree !== 'object' || !('props' in tree)) return [];
  const element = tree as Element;
  return [element, ...elements(element.props.children)];
}
function text(tree: unknown): string {
  if (Array.isArray(tree)) return tree.map(text).join(' ');
  if (typeof tree === 'string') return tree;
  if (!tree || typeof tree !== 'object' || !('props' in tree)) return '';
  return text((tree as Element).props.children);
}
const settle = async () => { for (let i = 0; i < 35; i++) await Promise.resolve(); };
const now = '2026-09-25T14:00:00.000Z';
const recommendation: AdvisorRecommendation = {
  id: 'low-grounding', kind: 'standard', route: '/ground',
  observation: 'One manageable step.', observations: ['One manageable step.'],
  action: 'Take a grounding pause.', smallerAction: 'Notice one thing.',
  resourceLabel: 'Start grounding', sourceLabels: ['Mood check-in'], changeSignal: null,
};
const action: AdvisorActionInstance = {
  version: 2, id: 'grounding-action', recommendationId: recommendation.id,
  action: recommendation.action, smallerAction: recommendation.smallerAction,
  route: '/ground', sourceLabels: [], observations: [], changeSignalId: null,
  status: 'in_progress', acceptedAt: now, startedAt: now, reminderAt: null,
  followUpAt: null, lastCheckInAt: null, lastCheckInResult: null, recoveryReason: null,
  recoveryCount: 0, useSmallerStep: false, updatedAt: now,
};
const completion: ToolCompletion = {
  id: 'e3e2eff1-0a26-4b67-8ac7-5c76bdc8e5a4', kind: 'grounding', itemId: 'five-senses',
  startedAt: now, completedAt: now, sourceStepId: action.id, partial: false, synced: false,
};

function advisorHarness(initial: { action: AdvisorActionInstance | null; completion: ToolCompletion | null }) {
  const cells: any[] = [];
  let cursor = 0;
  let focused: (() => (() => void)) | null = null;
  let cleanup: (() => void) | undefined;
  const auth = { user: { id: 'a' }, sessionId: null, isAuthenticated: true, isAnonymous: false };
  const refresh = vi.fn(async () => initial);
  const push = vi.fn();
  const offered = vi.fn(async () => undefined);
  const loadOutcomes = vi.fn(async (): Promise<any[]> => []);
  const answerHelpfulness = vi.fn(async () => undefined);
  const accept = vi.fn(async () => ({ action }));
  const start = vi.fn(async (_owner: string, active: AdvisorActionInstance) => active);
  const checkTarget = vi.fn(async () => false);
  const completeAction = vi.fn(async (): Promise<AdvisorActionInstance | null> => null);
  const replaceAction = vi.fn(async () => undefined);
  const alert = vi.fn();
  const cancelReminder = vi.fn(async (): Promise<void> => undefined);
  const hasReminder = vi.fn(async () => true);
  const clearFollowUp = vi.fn(async () => ({ action }));
  const appStateListeners = new Set<(state: string) => void>();
  const clientListeners = new Set<(event: { ownerKey: string; kind: string }) => void>();
  const select = vi.fn(() => recommendation);
  const requestModel = vi.fn();
  const context = { nowIso: now, profile: { completedAt: now }, lowEnergyMode: false };
  const hooks = {
    useState: (initialValue: any) => {
      const index = cursor++;
      if (!(index in cells)) cells[index] = typeof initialValue === 'function' ? initialValue() : initialValue;
      return [cells[index], (value: any) => { cells[index] = typeof value === 'function' ? value(cells[index]) : value; }];
    },
    useRef: (value: unknown) => {
      const index = cursor++;
      if (!(index in cells)) cells[index] = { current: value };
      return cells[index];
    },
    useCallback: (callback: unknown) => callback,
    useEffect: () => undefined,
  };
  const modules: Record<string, unknown> = {
    react: hooks,
    'react-native': {
      Alert: { alert },
      AppState: { currentState: 'active', addEventListener: (_event: string, listener: (state: string) => void) => {
        appStateListeners.add(listener);
        return { remove: () => appStateListeners.delete(listener) };
      } },
    },
    'expo-router': { useRouter: () => ({ push }), useFocusEffect: (callback: () => () => void) => { focused = callback; } },
    'date-fns': { format: () => '2026-09-25', formatDistanceToNow: () => 'a moment ago' },
    '@/components/AppUI': Object.fromEntries(['ActionRow', 'AppButton', 'AppCard', 'AppScreen', 'DisclosureCard', 'InlineStatus', 'PageHeader', 'SupportAction'].map((name) => [name, name])),
    '@/components/BotanicalHero': { BotanicalHero: 'BotanicalHero' },
    '@/components/AdvisorTrendCard': { AdvisorTrendCard: 'AdvisorTrendCard' },
    '@/lib/auth-context': { useAuth: () => auth },
    '@/lib/advisor-context': { loadAmbientAdvisorContext: async () => context },
    '@/lib/advisor-client-events': { subscribeAdvisorClient: (listener: (event: { ownerKey: string; kind: string }) => void) => {
      clientListeners.add(listener);
      return () => clientListeners.delete(listener);
    } },
    '@/lib/advisor-core': { selectAdvisorRecommendation: select, createAdvisorTrendSummary: () => null },
    '@/lib/advisor-ai': { requestModelAdvisorRecommendation: requestModel },
    '@/lib/advisor-brief-core': { createAdvisorBriefFingerprint: () => 'fingerprint', createAdvisorBriefSignals: () => [] },
    '@/lib/advisor-brief-storage': { advisorBriefStorage: { read: async () => null, write: async () => undefined } },
    '@/lib/advisor-action-storage': { acceptAdvisorAction: accept, setAdvisorActionFollowUp: clearFollowUp },
    '@/lib/advisor-accountability-core': { advisorFollowUpState: () => 'none', createAdvisorWeeklyReview: () => ({ started: 0, completed: 0, partial: 0, skipped: 0 }) },
    '@/lib/advisor-reminder-coordinator': { createAdvisorReminderCoordinator: () => () => undefined },
    '@/lib/advisor-cadence-core': { advisorCadenceLabel: () => '' },
    '@/lib/advisor-outcome-storage': { loadAdvisorOutcomes: loadOutcomes, recordAdvisorOffered: offered, answerAdvisorHelpfulness: answerHelpfulness },
    '@/lib/advisor-lifecycle-runtime': { startAdvisorLifecycle: start, completeAdvisorLifecycle: completeAction, replaceAdvisorLifecycle: replaceAction },
    '@/lib/advisor-loop-refresh': { createAdvisorLoopRefresh },
    '@/lib/advisor-loop-selection': { advisorLoopSelectionOptions },
    '@/lib/advisor-start-runtime': { startAdvisorStep: createAdvisorStepStarter({ accept, start, cancelReminder, clearFollowUp }) },
    '@/lib/advisor-step-sizing': { prefersSmallerStep: () => false },
    '@/lib/advisor-observation-ledger': {},
    '@/lib/advisor-target-completion-runtime': { checkAdvisorTargetCompletion: checkTarget },
    '@/lib/tool-completion-runtime': { refreshToolCompletions: refresh },
    '@/lib/tool-completion-storage': { TOOL_COMPLETION_LABELS },
    '@/lib/ai-consent': { ensureAiDataSharingConsent: async () => false, hasAiDataSharingConsent: async () => false },
    '@/lib/apple-health-preference': {}, '@/lib/apple-health': {},
    '@/lib/apple-health-core': {}, '@/lib/apple-health-ai-consent': {},
    '@/lib/notifications': { refreshReminders: async () => undefined, cancelAdvisorReminder: cancelReminder, hasAdvisorReminder: hasReminder },
  };
  const component = loadComponent('mobile/app/(tabs)/advisor.tsx', modules).default;
  const render = () => { cursor = 0; return component() as Element; };
  const focus = async () => {
    render(); cleanup?.(); cleanup = focused!(); await settle(); return render();
  };
  const setAppState = (state: string) => appStateListeners.forEach((listener) => listener(state));
  const changed = (ownerKey: string) => clientListeners.forEach((listener) => listener({ ownerKey, kind: 'changed' }));
  return { auth, context, refresh, push, offered, loadOutcomes, answerHelpfulness, accept, start, checkTarget, completeAction, replaceAction, alert, cancelReminder, hasReminder, clearFollowUp, setAppState, changed, select, requestModel, render, focus };
}

describe('completion UI behavior', () => {
  it.each([
    ['complete', 'offered'], ['replace', 'offered'],
    ['complete', 'read'], ['replace', 'read'],
  ] as const)('keeps a committed %s successful when optional history %s fails', async (kind, failure) => {
    const harness = advisorHarness({ action, completion: null });
    let tree = await harness.focus();
    if (failure === 'offered') harness.offered.mockRejectedValueOnce(new Error('optional history unavailable'));
    else harness.loadOutcomes.mockRejectedValue(new Error('optional history unavailable'));
    const actions = elements(tree).filter((element) => element.type === 'ActionRow').flatMap((element) => element.props.actions);
    if (kind === 'complete') {
      actions.find((item) => item.label === 'Done').onPress();
    } else {
      actions.find((item) => item.label === 'Change step').onPress();
      const buttons = harness.alert.mock.calls[0][2];
      buttons.find((button: { text: string }) => button.text === 'Change step').onPress();
    }
    await settle();
    tree = harness.render();
    expect(kind === 'complete' ? harness.completeAction : harness.replaceAction).toHaveBeenCalledOnce();
    expect(harness.offered).toHaveBeenCalled();
    expect(elements(tree).some((element) => element.props.label === 'Start')).toBe(true);
    expect(elements(tree).some((element) => element.props.label === 'Continue')).toBe(false);
    expect(elements(tree).filter((element) => element.type === 'InlineStatus').map((element) => element.props.message).join(' ')).not.toContain('could not');
  });
  it('does not present an already completed action as retryable if next-step selection fails', async () => {
    const harness = advisorHarness({ action, completion: null });
    const tree = await harness.focus();
    harness.select.mockImplementationOnce(() => { throw new Error('next suggestion unavailable'); });
    const actions = elements(tree).filter((element) => element.type === 'ActionRow').flatMap((element) => element.props.actions);
    actions.find((item) => item.label === 'Done').onPress();
    await settle();
    const result = elements(harness.render());
    expect(harness.completeAction).toHaveBeenCalledOnce();
    expect(result.some((element) => ['Continue', 'Start'].includes(element.props.label))).toBe(false);
    expect(result.filter((element) => element.type === 'InlineStatus').map((element) => element.props.message).join(' ')).toContain('Step completed. Your next suggestion could not load');
  });
  it('refreshes a committed change without requiring background-follow-up opt-in', async () => {
    const harness = advisorHarness({ action, completion: null });
    await harness.focus();
    const reads = harness.refresh.mock.calls.length;
    harness.changed('user_id:other');
    await settle();
    expect(harness.refresh).toHaveBeenCalledTimes(reads);
    harness.changed('user_id:a');
    await settle();
    expect(harness.refresh).toHaveBeenCalledTimes(reads + 1);
  });
  it.each(['/ground', '/goals', '/resources'] as const)('starts Today %s with the correct saved-step linkage', async (route) => {
    const push = vi.fn();
    const started = { route, action: route === '/resources' ? null : { ...action, route } };
    const startStep = vi.fn(async () => started);
    const callback = todayStartAction({
      ownerKey: 'user_id:a', ownerKeyRef: { current: 'user_id:a' },
      visibleAdvisor: { recommendation: { ...recommendation, route } },
      visibleAdvisorAction: null, useSmallerStep: false, advisorBusyRef: { current: false },
      setAdvisorBusy: vi.fn(), setAdvisorError: vi.fn(), setAdvisorRefresh: vi.fn(),
      startAdvisorStep: startStep, router: { push },
    });
    await callback();
    expect(push).toHaveBeenCalledWith(route === '/ground'
      ? { pathname: '/ground', params: { sourceStepId: action.id } }
      : route);
    expect(startStep).toHaveBeenCalledOnce();
  });

  it('settles Today safely when both completion refresh and Advisor loading fail', async () => {
    const setOwner = vi.fn();
    const setToday = vi.fn();
    const setCompletion = vi.fn();
    const setLoading = vi.fn();
    const setError = vi.fn();
    const effect = todayRefreshEffect({
      ownerKey: 'user_id:a', ownerKeyRef: { current: 'user_id:a' },
      profileReady: true, queryColumn: 'user_id', queryValue: 'a', user: { id: 'a' },
      setTodayAdvisor: setToday, setToolCompletion: setCompletion, setAdvisorOwnerKey: setOwner,
      setAdvisorLoading: setLoading, setAdvisorError: setError,
      refreshToolCompletions: vi.fn(async () => { throw new Error('completion read failed'); }),
      loadTodayAdvisor: vi.fn(async () => { throw new Error('Advisor read failed'); }),
    });
    effect();
    await settle();
    expect(setOwner).toHaveBeenLastCalledWith(null);
    expect(setToday).toHaveBeenLastCalledWith(null);
    expect(setCompletion).toHaveBeenLastCalledWith(null);
    expect(setLoading).toHaveBeenLastCalledWith(false);
    expect(setError).toHaveBeenLastCalledWith('Your next step could not load. You can still use your tools below.');
  });

  it('shows the quiet Today acknowledgement without replacing an unrelated current action', () => {
    const { AdvisorHomeCard } = loadComponent('mobile/components/AdvisorHomeCard.tsx', {
      '@expo/vector-icons': { Feather: 'Feather' },
    });
    const onOpen = vi.fn();
    const complete = AdvisorHomeCard({ lowEnergy: false, completionLabel: 'Grounding complete.', onOpen });
    expect(text(complete)).toContain('Grounding complete.');
    expect(text(complete)).not.toContain('Your next step is ready.');
    elements(complete).find((element) => element.type === 'Pressable')!.props.onPress();
    expect(onOpen).toHaveBeenCalledOnce();
    const active = AdvisorHomeCard({ lowEnergy: false, currentAction: 'Write one paragraph.', actionStatus: 'in_progress', completionLabel: 'Grounding complete.', onOpen });
    expect(text(active)).toContain('Write one paragraph.');
    expect(text(active)).toContain('Continue');
    expect(text(active)).not.toContain('Grounding complete.');
  });

  it('holds the Advisor acknowledgement until another step is explicitly requested', async () => {
    const harness = advisorHarness({ action: null, completion });
    let tree = await harness.focus();
    expect(text(tree)).toContain('Grounding complete.');
    expect(harness.offered).not.toHaveBeenCalled();
    expect(harness.accept).not.toHaveBeenCalled();
    expect(harness.start).not.toHaveBeenCalled();
    expect(harness.requestModel).not.toHaveBeenCalled();
    expect(elements(tree).filter((element) => element.type === 'AppButton').map((element) => element.props.label)).toEqual(['Choose another step']);
    elements(tree).find((element) => element.props.label === 'Choose another step')!.props.onPress();
    await settle();
    tree = harness.render();
    expect(text(tree)).not.toContain('COMPLETED TODAY');
    expect(harness.offered).toHaveBeenCalledOnce();
    expect(harness.accept).not.toHaveBeenCalled();
    expect(harness.start).not.toHaveBeenCalled();
    expect(elements(tree).some((element) => element.props.label === 'Start')).toBe(true);
    tree = await harness.focus();
    expect(text(tree)).not.toContain('COMPLETED TODAY');
  });

  it.each(['/ground', '/goals'] as const)('continues %s with linkage only for an actual tool route', async (route) => {
    const harness = advisorHarness({ action: { ...action, route }, completion });
    const tree = await harness.focus();
    expect(text(tree)).not.toContain('COMPLETED TODAY');
    elements(tree).find((element) => element.props.label === 'Continue')!.props.onPress();
    await settle();
    expect(harness.push).toHaveBeenCalledWith(route === '/ground'
      ? { pathname: '/ground', params: { sourceStepId: action.id } }
      : '/goals');
    expect(harness.accept).not.toHaveBeenCalled();
  });

  it('attaches the saved action id when a suggested grounding step starts', async () => {
    const harness = advisorHarness({ action: null, completion: null });
    const tree = await harness.focus();
    elements(tree).find((element) => element.props.label === 'Start')!.props.onPress();
    await settle();
    expect(harness.start).toHaveBeenCalledWith('user_id:a', action);
    expect(harness.push).toHaveBeenCalledWith({ pathname: '/ground', params: { sourceStepId: action.id } });
  });

  it('preserves a replacement returned while reconciling a completed goal', async () => {
    const harness = advisorHarness({ action: { ...action, route: '/goals' }, completion: null });
    const replacement = { ...action, id: 'new-habit-action', action: 'Take a short walk.', route: '/habits' as const };
    harness.checkTarget.mockResolvedValue(true);
    harness.completeAction.mockResolvedValue(replacement);
    const tree = await harness.focus();
    expect(text(tree)).toContain(replacement.action);
    elements(tree).find((element) => element.props.label === 'Continue')!.props.onPress();
    await settle();
    expect(harness.push).toHaveBeenCalledWith('/habits');
  });

  it('does not start or navigate a saved action after the owner changes', async () => {
    const harness = advisorHarness({ action: null, completion: null });
    let finish!: (value: { action: AdvisorActionInstance }) => void;
    harness.accept.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    const tree = await harness.focus();
    elements(tree).find((element) => element.props.label === 'Start')!.props.onPress();
    harness.auth.user.id = 'b';
    harness.render();
    finish({ action });
    await settle();
    expect(harness.start).not.toHaveBeenCalled();
    expect(harness.push).not.toHaveBeenCalled();
  });

  it('keeps helpfulness feedback available without requiring another step', async () => {
    const harness = advisorHarness({ action: null, completion });
    const pendingFeedback = [{
      actionId: action.id, recommendationId: recommendation.id, completedAt: now,
      startedAt: now, feedbackAt: null, helpful: null,
    }];
    harness.loadOutcomes.mockResolvedValueOnce(pendingFeedback).mockResolvedValueOnce(pendingFeedback);
    const tree = await harness.focus();
    expect(text(tree)).toContain('Did your last step help?');
    elements(tree).find((element) => element.props.accessibilityLabel === 'Yes, my last Advisor step helped')!.props.onPress();
    await settle();
    expect(harness.answerHelpfulness).toHaveBeenCalledWith('user_id:a', action.id, true);
    expect(text(harness.render())).toContain('Grounding complete.');
    expect(text(harness.render())).not.toContain('Did your last step help?');
    expect(harness.offered).not.toHaveBeenCalled();
    expect(harness.accept).not.toHaveBeenCalled();
  });

  it.each([true, false, null])('refreshes explicit feedback %s while preserving an active commitment', async (helpful) => {
    const harness = advisorHarness({ action, completion: null });
    const previous = {
      actionId: 'previous-action', recommendationId: recommendation.id, completedAt: now,
      startedAt: now, feedbackAt: null, helpful: null,
    };
    harness.loadOutcomes.mockResolvedValue([previous]);
    const tree = await harness.focus();
    const reads = harness.refresh.mock.calls.length;
    const before = JSON.stringify(action);
    harness.loadOutcomes.mockResolvedValue([{ ...previous, helpful, feedbackAt: now }]);
    const label = helpful === true ? 'Yes, my last Advisor step helped'
      : helpful === false ? 'My last Advisor step did not help' : 'Skip Advisor feedback';
    elements(tree).find((element) => element.props.accessibilityLabel === label)!.props.onPress();
    await settle();
    expect(harness.answerHelpfulness).toHaveBeenCalledWith('user_id:a', 'previous-action', helpful);
    expect(harness.refresh).toHaveBeenCalledTimes(reads + (helpful === null ? 0 : 1));
    expect(JSON.stringify(action)).toBe(before);
    expect(harness.accept).not.toHaveBeenCalled();
    expect(harness.start).not.toHaveBeenCalled();
    expect(harness.push).not.toHaveBeenCalled();
    expect(text(harness.render())).not.toContain('Did your last step help?');
  });

  it('finishes setup before offering a new step after a browsed activity', async () => {
    const harness = advisorHarness({ action: null, completion });
    harness.context.profile.completedAt = '';
    const tree = await harness.focus();
    expect(harness.push).not.toHaveBeenCalled();
    elements(tree).find((element) => element.props.label === 'Choose another step')!.props.onPress();
    await settle();
    expect(harness.push).toHaveBeenCalledWith('/advisor-setup');
    expect(harness.offered).not.toHaveBeenCalled();
    expect(harness.accept).not.toHaveBeenCalled();
  });

  it('keeps safety guidance ahead of a tool completion', async () => {
    const harness = advisorHarness({ action: null, completion });
    harness.select.mockReturnValue({ ...recommendation, kind: 'safety', route: '/resources' });
    const tree = await harness.focus();
    expect(text(tree)).not.toContain('COMPLETED TODAY');
    expect(elements(tree).some((element) => element.props.label === 'Find support')).toBe(true);
  });

  it.each(['cancel', 'storage'] as const)('keeps safety guidance visible when %s cleanup fails on foreground', async (failure) => {
    const harness = advisorHarness({ action: { ...action, reminderAt: '2099-09-25T14:00:00.000Z' }, completion });
    await harness.focus();
    harness.select.mockReturnValue({ ...recommendation, kind: 'safety', route: '/resources' });
    if (failure === 'cancel') harness.cancelReminder.mockRejectedValueOnce(new Error('notification failure'));
    else harness.clearFollowUp.mockRejectedValueOnce(new Error('storage failure'));
    harness.setAppState('background');
    harness.setAppState('active');
    await settle();
    const tree = harness.render();
    expect(elements(tree).some((element) => element.props.label === 'Find support')).toBe(true);
    expect(elements(tree).some((element) => element.props.label === 'Continue')).toBe(false);
    expect(text(tree)).not.toContain('COMPLETED TODAY');
    expect(harness.cancelReminder).toHaveBeenCalledOnce();
  });

  it('displays safety support before reminder cleanup settles', async () => {
    const harness = advisorHarness({ action: { ...action, reminderAt: '2099-09-25T14:00:00.000Z' }, completion: null });
    harness.select.mockReturnValue({ ...recommendation, kind: 'safety', route: '/resources' });
    let finish!: () => void;
    harness.cancelReminder.mockImplementationOnce(() => new Promise<void>((resolve) => { finish = resolve; }));
    const tree = await harness.focus();
    expect(elements(tree).some((element) => element.props.label === 'Find support')).toBe(true);
    finish();
    await settle();
  });

  it.each(['notification', 'lifecycle'] as const)('keeps safety visible on foreground with a stuck %s queue', async (queue) => {
    const harness = advisorHarness({ action: { ...action, reminderAt: '2099-09-25T14:00:00.000Z' }, completion: null });
    harness.select.mockReturnValue({ ...recommendation, kind: 'safety', route: '/resources' });
    let finish!: () => void;
    const pending = new Promise<void>((resolve) => { finish = resolve; });
    harness.cancelReminder.mockImplementation(() => pending);
    harness.hasReminder.mockImplementation(async () => { await pending; return true; });
    await harness.focus();
    if (queue === 'lifecycle') {
      harness.refresh.mockImplementationOnce(async () => {
        await pending;
        return { action, completion: null };
      });
    }
    harness.setAppState('background');
    harness.setAppState('active');
    await settle();
    const tree = harness.render();
    expect(elements(tree).some((element) => element.props.label === 'Find support')).toBe(true);
    expect(elements(tree).some((element) => element.props.label === 'Continue')).toBe(false);
    expect(harness.hasReminder).not.toHaveBeenCalled();
    finish();
    await settle();
  });

  it('replaces the old active step with completion acknowledgement on foreground', async () => {
    const harness = advisorHarness({ action, completion: null });
    await harness.focus();
    harness.refresh.mockResolvedValueOnce({ action: null, completion });
    harness.setAppState('background');
    harness.setAppState('active');
    await settle();
    const tree = harness.render();
    expect(text(tree)).toContain('Grounding complete.');
    expect(elements(tree).some((element) => element.props.label === 'Continue')).toBe(false);
  });

  it('ignores a completion refresh that resolves after the owner changes', async () => {
    const harness = advisorHarness({ action: null, completion: null });
    let finish!: (value: { action: null; completion: ToolCompletion }) => void;
    harness.refresh.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    await harness.focus();
    harness.auth.user.id = 'b';
    await harness.focus();
    finish({ action: null, completion });
    await settle();
    expect(text(harness.render())).not.toContain('COMPLETED TODAY');
    expect(harness.push).not.toHaveBeenCalled();
  });
});
