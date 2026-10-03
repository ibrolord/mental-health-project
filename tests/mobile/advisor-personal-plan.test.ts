import { readFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createAdvisorCandidateSet,
  getAdvisorChangeSignals,
  selectAdvisorRecommendation,
  type AdvisorContext,
  type AdvisorRecentRecommendation,
  type AdvisorRecommendation,
  type AdvisorSelectionOptions,
} from '../../mobile/lib/advisor-core';
import { completeAdvisorProfile, defaultAdvisorProfile, type AdvisorPriority } from '../../mobile/lib/advisor-profile';
import { createAdvisorActionStorage } from '../../mobile/lib/advisor-action-storage';
import { createAdvisorStepStarter } from '../../mobile/lib/advisor-start';
import { prefersSmallerStep } from '../../mobile/lib/advisor-step-sizing';
import { createAdvisorBriefSignals, type AdvisorDailyBrief } from '../../mobile/lib/advisor-brief-core';
import type { AppleHealthAiSummary } from '../../mobile/lib/apple-health-core';
import {
  COMMITMENT_ACTIONS,
  normalizePersonalPlan,
  obstacleResponse,
  personalPlanKey,
  type AdvisorPersonalPlan,
} from '../../mobile/lib/onboarding-journey';

const { apiRequest } = vi.hoisted(() => ({ apiRequest: vi.fn() }));
vi.mock('../../mobile/lib/api', () => ({ apiRequest }));
import { requestModelAdvisorRecommendation } from '../../mobile/lib/advisor-ai';

const NOW = new Date(2026, 8, 27, 12).toISOString();
const SECRETS = {
  action: 'Arrange my private indigo notebook 7f82',
  motivation: 'Keep the private copper promise 61b9',
  cue: 'After the private saffron bell 29d4',
  obstacleDetail: 'The private silver hurdle f039',
};
const PLAN: AdvisorPersonalPlan = { ...SECRETS, obstacle: 'custom' };

function context(overrides: Partial<AdvisorContext> = {}): AdvisorContext {
  return {
    nowIso: NOW, mood: null, goals: [], habits: [], health: null,
    profile: completeAdvisorProfile({
      ...defaultAdvisorProfile(NOW), priorities: ['goals'], supportStyle: 'direct', personalPlan: PLAN,
    }, NOW),
    ...overrides,
  };
}

function withPlan(plan: Partial<AdvisorPersonalPlan>): AdvisorContext {
  const input = context();
  return { ...input, profile: { ...input.profile!, personalPlan: { ...PLAN, ...plan } } };
}

// Execute the screen's actual orchestration without loading native UI modules.
const screen = ts.createSourceFile('advisor.tsx', readFileSync(
  path.resolve(process.cwd(), 'mobile/app/(tabs)/advisor.tsx'), 'utf8'
), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const orchestration = screen.statements.filter((statement) =>
  (ts.isFunctionDeclaration(statement) && ['fallbackFocus', 'deterministicBrief', 'selectModelBackedRecommendation', 'recommendationForAction']
    .includes(statement.name?.text ?? '')) ||
  (ts.isVariableStatement(statement) && statement.declarationList.declarations.some((declaration) =>
    ts.isIdentifier(declaration.name) && declaration.name.text === 'FALLBACK_HEADLINES'))
);
type SelectModel = (
  input: AdvisorContext, recent: readonly AdvisorRecentRecommendation[], owner: string | null,
  options?: AdvisorSelectionOptions, health?: AppleHealthAiSummary | null, isCurrent?: () => boolean,
  allowConsent?: boolean, commitment?: import('../../mobile/lib/advisor-action-storage').AdvisorActionInstance | null
) => Promise<{ recommendation: AdvisorRecommendation; model: string | null; brief: AdvisorDailyBrief }>;
type DeterministicBrief = (
  input: AdvisorContext, recommendation: AdvisorRecommendation,
  health: AppleHealthAiSummary | null, existingBrief?: AdvisorDailyBrief
) => AdvisorDailyBrief;

function screenHarness() {
  expect(orchestration).toHaveLength(5);
  const consent = vi.fn(async (_owner: string) => true);
  const candidates = vi.fn(createAdvisorCandidateSet);
  const request = vi.fn(requestModelAdvisorRecommendation);
  const compiled = ts.transpileModule(orchestration.map((statement) => statement.getText(screen)).join('\n'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const runtime = new Function('dependencies', `
    const { selectAdvisorRecommendation, createAdvisorCandidateSet, requestModelAdvisorRecommendation,
      ensureAiDataSharingConsent, hasAiDataSharingConsent, createAdvisorBriefSignals } = dependencies;
    ${compiled}
    return { select: selectModelBackedRecommendation, brief: deterministicBrief };
  `)({ selectAdvisorRecommendation, createAdvisorCandidateSet: candidates,
    requestModelAdvisorRecommendation: request, ensureAiDataSharingConsent: consent,
    hasAiDataSharingConsent: consent, createAdvisorBriefSignals }) as { select: SelectModel; brief: DeterministicBrief };
  return { ...runtime, consent, candidates, request };
}

beforeEach(() => {
  apiRequest.mockReset();
  apiRequest.mockImplementation(async (_path, payload) => ({
    model: 'gemini', personalized: true,
    selection: { candidateId: payload.candidates[0].id, observations: ['One manageable next step.'],
      signalIds: [], focus: 'steady' },
  }));
});

describe('local personal-plan recommendations', () => {
  it('prioritizes the authored action over ordinary goals, habits, and Health without mutating them', () => {
    const input = context({
      goals: [{ id: 'goal', title: 'Learn a language', dueAt: null }],
      habits: [{ id: 'habit', name: 'Walk outside', completedToday: false, tinyStep: 'Put on shoes' }],
      health: {
        sleepMinutes: { recentAverage: 480, baselineAverage: 480, recentCoverageDays: 7, baselineCoverageDays: 14 },
        steps: { recentAverage: 6000, baselineAverage: 6000, recentCoverageDays: 7, baselineCoverageDays: 14 },
        recent: { coverageDays: 7, exerciseMinutes: 30, mindfulMinutes: 0, workoutCount: 2,
          eligibleForSuggestion: true, availableCategoryCount: 2 },
        history: { coverageDays: 21, workoutCount: 4, stateOfMindCount: 0, moodOverlapDays: 0, moodComparison: '' },
      },
    });
    const before = JSON.stringify(input);
    const result = selectAdvisorRecommendation(input);
    expect(result.id).toBe(personalPlanKey(PLAN));
    expect(result.action).toBe(PLAN.action);
    expect(result.smallerAction).toContain(PLAN.action);
    expect(result.sourceLabels).toContain('Your personal plan');
    expect(JSON.stringify(input)).toBe(before);
    expect(selectAdvisorRecommendation(input)).toEqual(result);
  });

  it('keeps motivation, cue, and obstacle guidance together in the local rationale', () => {
    const input = withPlan({ obstacle: 'energy', obstacleDetail: '' });
    const result = selectAdvisorRecommendation(input);
    expect(result.observations).toEqual([
      `You chose this because: ${PLAN.motivation}`, `Your cue: ${PLAN.cue}`,
      obstacleResponse(input.profile!.personalPlan!),
    ]);
    expect(result.observation).toBe(result.observations[0]);
    expect(result.changeSignal).toBeNull();
    expect(result.id).toMatch(/^personal-plan:[0-9a-f]+$/);
    for (const secret of Object.values(SECRETS)) expect(result.id).not.toContain(secret);
    expect(selectAdvisorRecommendation(withPlan({ cue: 'A different moment' })).id).not.toBe(result.id);
  });

  it('requires completed setup and a nonempty action, without inventing missing details', () => {
    const input = context();
    expect(selectAdvisorRecommendation({ ...input, profile: { ...input.profile!, completedAt: null } }).id)
      .not.toMatch(/^personal-plan:/);
    expect(selectAdvisorRecommendation(withPlan({ action: '  ' })).id).not.toMatch(/^personal-plan:/);
    const result = selectAdvisorRecommendation(withPlan({ motivation: '', cue: '', obstacle: null, obstacleDetail: '' }));
    expect(result.observations).toEqual([
      'This is the small step you chose in your personal plan.', 'Start at a pace that works for you.',
    ]);
  });

  it.each([
    ...COMMITMENT_ACTIONS.steady.map((action) => [action, action === 'Notice five things around me' ? '/ground' : '/(tabs)/tracker']),
    ...COMMITMENT_ACTIONS.routine.map((action) => [action, '/habits']),
    ...COMMITMENT_ACTIONS['follow-through'].map((action) => [action, '/goals']),
  ])('routes preset "%s" to %s even with a different priority', (action, route) => {
    const input = withPlan({ action });
    input.profile!.priorities = ['relationships'];
    expect(selectAdvisorRecommendation(input).route).toBe(route);
  });

  it.each([
    ['habits', '/habits', 'Open habits'], ['goals', '/goals', 'Open goals'],
    ['study', '/goals', 'Open goals'], ['mood', '/(tabs)/tracker', 'Open mood tracker'],
    ['relationships', '/accountability', 'Open Together'], ['sleep', '/ground', 'Open grounding'],
    ['movement', '/ground', 'Open grounding'],
  ] as const)('routes and labels a custom action by the %s priority', (priority: AdvisorPriority, route, resourceLabel) => {
    const input = context();
    input.profile!.priorities = [priority];
    expect(selectAdvisorRecommendation(input)).toMatchObject({ route, resourceLabel });
  });

  it.each(['action', 'motivation', 'cue', 'obstacleDetail'] as const)('safety-checks %s before turning any plan into guidance', (field) => {
    const input = withPlan({ [field]: 'I will hu\u200brt myself tonight' });
    const result = selectAdvisorRecommendation(input, [personalPlanKey(PLAN)], { candidateFamily: 'personal-plan' });
    expect(result).toMatchObject({ kind: 'safety', route: '/resources', observations: [] });
    expect(JSON.stringify(result)).not.toContain('tonight');
    expect(createAdvisorCandidateSet(input)).toEqual([result]);
    expect(getAdvisorChangeSignals(input)).toEqual([]);
  });

  it.each(['energy', 'low-mood'] as const)('keeps %s ahead of the plan, including same-day preservation and family retries', (state) => {
    const input = context(state === 'energy' ? { lowEnergyMode: true } : {
      mood: { emoji: '\u{1f622}', localDate: '2026-09-27' },
      goals: [{ id: 'goal', title: 'File application', dueAt: NOW }],
    });
    const recent = [{ recommendationId: personalPlanKey(PLAN), offeredAt: NOW }];
    const expectedPrefix = state === 'energy' ? 'low-energy-' : 'low-goal:';
    for (const options of [{}, { candidateFamily: 'personal-plan', preserveToday: false }]) {
      expect(selectAdvisorRecommendation(input, recent, options).id.startsWith(expectedPrefix)).toBe(true);
      expect(createAdvisorCandidateSet(input, recent, options)).toHaveLength(1);
    }
  });

  it.each([26, 27, 28, 30])('keeps a September %s deadline ahead of a previously offered plan', (day) => {
    const input = context({ goals: [{ id: 'urgent', title: 'Submit application', dueAt: new Date(2026, 8, day, 12).toISOString() }] });
    const recent = [{ recommendationId: personalPlanKey(PLAN), offeredAt: NOW }];
    const options = { candidateFamily: 'personal-plan' };
    expect(selectAdvisorRecommendation(input, recent, options).id).toBe('due-goal:urgent');
    expect(createAdvisorCandidateSet(input, recent, options)).toHaveLength(1);
  });

  it('allows a plan for stale low mood and a goal outside the urgent window', () => {
    const input = context({ mood: { emoji: '\u{1f622}', localDate: '2026-09-26' },
      goals: [{ id: 'later', title: 'Submit application', dueAt: new Date(2026, 9, 1, 12).toISOString() }] });
    expect(selectAdvisorRecommendation(input).id).toBe(personalPlanKey(PLAN));
  });

  it('allows try-another to leave the single authored action without rewriting the plan', () => {
    const input = context();
    const first = selectAdvisorRecommendation(input);
    const alternate = selectAdvisorRecommendation(input, [first.id], {
      preserveToday: false, candidateFamily: 'personal-plan', excludeRecommendationId: first.id,
    });
    expect(alternate.id).not.toBe(first.id);
    expect(alternate.action).not.toBe(first.action);
    expect(input.profile!.personalPlan).toEqual(PLAN);
  });

  it('prioritizes a newly saved plan over an unaccepted same-day offer but remembers a later alternative', () => {
    const input = context();
    const generic = selectAdvisorRecommendation({ ...input, profile: { ...input.profile!, personalPlan: undefined } });
    const earlierOffer = { recommendationId: generic.id, offeredAt: NOW };
    expect(selectAdvisorRecommendation(input, [earlierOffer]).id).toBe(personalPlanKey(PLAN));
    const planOffer = { recommendationId: personalPlanKey(PLAN), offeredAt: NOW };
    expect(selectAdvisorRecommendation(input, [earlierOffer, planOffer]).id).toBe(generic.id);
  });

  it.each(['energy', 'overwhelm'] as const)('prefers a smaller step for %s only after profile completion', (obstacle) => {
    const input = withPlan({ obstacle });
    expect(prefersSmallerStep(input)).toBe(true);
    expect(prefersSmallerStep({ ...input, profile: { ...input.profile!, completedAt: null } })).toBe(false);
    expect(prefersSmallerStep(context())).toBe(false);
    expect(prefersSmallerStep(context({ lowEnergyMode: true, profile: null }))).toBe(true);
  });

  it('does not change the existing gentle-style sizing for an incomplete profile', () => {
    expect(prefersSmallerStep(context({ profile: defaultAdvisorProfile(NOW) }))).toBe(true);
  });

  it.each([null, 'time', 'forget', 'unsure', 'custom'] as const)('keeps the authored microstep for gentle style with obstacle %s', (obstacle) => {
    const input = withPlan({ action: 'Drink a glass of water', obstacle });
    input.profile!.supportStyle = 'gentle';
    const recommendation = selectAdvisorRecommendation(input);
    expect(prefersSmallerStep(input)).toBe(false);
    expect(prefersSmallerStep(input, recommendation)).toBe(false);
    const displayed = prefersSmallerStep(input, recommendation) ? recommendation.smallerAction : recommendation.action;
    expect(displayed).toBe('Drink a glass of water');
  });

  it.each(['energy', 'overwhelm'] as const)('still offers a smaller personal step for a completed %s obstacle', (obstacle) => {
    const input = withPlan({ obstacle });
    input.profile!.supportStyle = 'gentle';
    const recommendation = selectAdvisorRecommendation(input);
    expect(prefersSmallerStep(input, recommendation)).toBe(true);
    expect(prefersSmallerStep({ ...input, profile: { ...input.profile!, completedAt: null } }, recommendation)).toBe(false);
  });

  it('keeps explicit low-energy sizing and gentle sizing for actual non-plan recommendations', () => {
    const input = context();
    input.profile!.supportStyle = 'gentle';
    const personal = selectAdvisorRecommendation(input);
    expect(prefersSmallerStep({ ...input, lowEnergyMode: true }, personal)).toBe(true);
    const alternate = selectAdvisorRecommendation(input, [personal.id], { preserveToday: false });
    expect(prefersSmallerStep(input, alternate)).toBe(true);
    const urgent = { ...input, goals: [{ id: 'urgent', title: 'Submit report', dueAt: NOW }] };
    expect(prefersSmallerStep(urgent)).toBe(true);
    expect(prefersSmallerStep(urgent, selectAdvisorRecommendation(urgent))).toBe(true);
  });

  it('persists long Unicode plan steps and never replaces an active commitment when starting', async () => {
    const values = new Map<string, string>();
    const storage = createAdvisorActionStorage({
      getItem: async (key) => values.get(key) ?? null,
      setItem: async (key, value) => { values.set(key, value); },
      removeItem: async (key) => { values.delete(key); },
    }, () => new Date(NOW));
    const plan = normalizePersonalPlan({ ...PLAN, action: '\u{1f331}'.repeat(120), motivation: '\u{1f331}'.repeat(180) });
    const personal = selectAdvisorRecommendation(withPlan(plan));
    await storage.acceptAdvisorAction('long-plan', personal);
    expect(await storage.loadAdvisorAction('long-plan')).toMatchObject({ action: personal.action, observations: personal.observations });

    const original = selectAdvisorRecommendation(context({ profile: null }));
    const accepted = (await storage.acceptAdvisorAction('owner', original)).action!;
    const active = (await storage.startAdvisorAction('owner', accepted.id)).action!;
    const dependencies = { accept: vi.fn(storage.acceptAdvisorAction), cancelReminder: vi.fn(),
      clearFollowUp: vi.fn(), start: vi.fn() };
    expect(await createAdvisorStepStarter(dependencies)('owner', personal, active, true, () => true))
      .toEqual({ action: active, route: active.route });
    expect(await storage.loadAdvisorAction('owner')).toEqual(active);
    for (const dependency of Object.values(dependencies)) expect(dependency).not.toHaveBeenCalled();
  });
});

describe('personal-plan model isolation', () => {
  it('keeps an accepted step byte-identical while refreshing AI follow-through', async () => {
    const harness = screenHarness();
    const input = context();
    const commitment: import('../../mobile/lib/advisor-action-storage').AdvisorActionInstance = {
      version: 2, id: 'action-test', recommendationId: 'habit:walk', action: 'Walk outside.',
      smallerAction: 'Put on shoes.', route: '/habits', sourceLabels: ['Habit'], observations: ['A walk is planned.'],
      changeSignalId: null, status: 'needs_recovery', acceptedAt: NOW, startedAt: NOW,
      reminderAt: null, followUpAt: null, lastCheckInAt: NOW, lastCheckInResult: 'partial',
      recoveryReason: 'time', recoveryCount: 1, useSmallerStep: false, updatedAt: NOW,
    };
    const result = await harness.select(input, [], 'user_id:owner-a', {}, null, () => true, false, commitment);
    expect(result.model).toBe('gemini');
    expect(result.recommendation.action).toBe(commitment.action);
    expect(result.recommendation.smallerAction).toBe(commitment.smallerAction);
    expect(result.recommendation.id).toBe(commitment.recommendationId);
    expect(harness.candidates).not.toHaveBeenCalled();
    expect(apiRequest.mock.calls[0][1].commitment).toMatchObject({ recoveryReason: 'time' });
    harness.consent.mockResolvedValue(false);
    apiRequest.mockClear();
    const fallback = await harness.select(input, [], 'user_id:owner-a', {}, null, () => true, false, commitment);
    expect(fallback.recommendation.action).toBe(commitment.action);
    expect(apiRequest).not.toHaveBeenCalled();
  });
  it('returns the local plan before checking, prompting, or changing AI consent', async () => {
    const harness = screenHarness();
    const result = await harness.select(context(), [], 'user_id:owner-a');
    expect(result.recommendation.id).toBe(personalPlanKey(PLAN));
    expect(result.model).toBeNull();
    expect(harness.consent).not.toHaveBeenCalled();
    expect(harness.candidates).not.toHaveBeenCalled();
    expect(harness.request).not.toHaveBeenCalled();
    expect(apiRequest).not.toHaveBeenCalled();
  });

  it('leads the local daily brief with motivation and cue, not notification status, without AI consent', async () => {
    const harness = screenHarness();
    const input = context({ notifications: { enabled: false, enabledCategories: [], reminderTimes: [] } });
    const result = await harness.select(input, [], 'user_id:owner-a');
    expect(result.brief.signals.map((signal) => signal.text)).toEqual(result.recommendation.observations);
    expect(result.brief.signals[0].text).toContain(SECRETS.motivation);
    expect(result.brief.signals[1].text).toContain(SECRETS.cue);
    expect(result.brief.signals).toHaveLength(3);
    expect(JSON.stringify(result.brief)).not.toContain('Notifications');
    expect(result.brief.usedAppleHealth).toBe(false);
    for (const signal of result.brief.signals) {
      expect(signal.id).toMatch(/^personal-plan:[0-9a-f]+:observation:\d$/);
    }
    expect(harness.consent).not.toHaveBeenCalled();
    expect(apiRequest).not.toHaveBeenCalled();

    // Rendering local rationale must not alter the separate model signal builder.
    expect(createAdvisorBriefSignals(input)).toEqual([
      { id: 'notifications-current', kind: 'notifications', text: 'Notifications are currently off.' },
    ]);
    await harness.select(input, [result.recommendation.id], 'user_id:owner-a', { preserveToday: false });
    expect(apiRequest).toHaveBeenCalledTimes(1);
    const payload = JSON.stringify(apiRequest.mock.calls[0][1]);
    for (const secret of Object.values(SECRETS)) expect(payload).not.toContain(secret);
    expect(payload).not.toContain(':observation:');
  });

  it('rebuilds old local cached briefs from the selected step rather than a newly edited profile', () => {
    const harness = screenHarness();
    const recommendation = selectAdvisorRecommendation(context());
    const input = withPlan({ motivation: 'A changed reason', cue: 'A changed cue' });
    const oldBrief: AdvisorDailyBrief = { focus: 'steady', headline: 'Keep today clear.', usedAppleHealth: false,
      signals: [{ id: 'notifications-current', kind: 'notifications', text: 'Notifications are currently off.' }] };
    const rebuilt = harness.brief(input, recommendation, null, oldBrief);
    expect(rebuilt.signals.map((signal) => signal.text)).toEqual(recommendation.observations);
    expect(rebuilt.signals[0].text).toContain(SECRETS.motivation);
    expect(rebuilt.signals[1].text).toContain(SECRETS.cue);
    expect(JSON.stringify(rebuilt)).not.toContain('A changed');
    expect(oldBrief.signals[0].id).toBe('notifications-current');
    expect(apiRequest).not.toHaveBeenCalled();
  });

  it('preserves non-plan ambient and cached model brief context', () => {
    const harness = screenHarness();
    const input = context({ notifications: { enabled: false, enabledCategories: [], reminderTimes: [] } });
    const generic = selectAdvisorRecommendation(input, [personalPlanKey(PLAN)], { preserveToday: false });
    const existingBrief: AdvisorDailyBrief = { focus: 'baseline', headline: 'An existing AI brief.', usedAppleHealth: true,
      signals: [{ id: 'health-seven-day', kind: 'health', text: 'The confirmed Health summary.' }] };
    expect(harness.brief(input, generic, null).signals).toEqual(createAdvisorBriefSignals(input).slice(0, 2));
    expect(harness.brief(input, generic, null, existingBrief)).toBe(existingBrief);
    expect(apiRequest).not.toHaveBeenCalled();
  });

  it('generates model candidates with personalPlan undefined and sends no private plan strings', async () => {
    const harness = screenHarness();
    const input = context();
    const before = JSON.stringify(input);
    const isCurrent = () => true;
    const result = await harness.select(input, [personalPlanKey(PLAN)], 'user_id:owner-a', { preserveToday: false }, null, isCurrent);
    expect(result.model).toBe('gemini');
    expect(harness.consent).toHaveBeenCalledWith('user_id:owner-a');
    expect(harness.candidates.mock.calls[0][0].profile?.personalPlan).toBeUndefined();
    expect(harness.request.mock.calls[0][0].profile?.personalPlan).toBeUndefined();
    expect(harness.request.mock.calls[0][4]).toEqual({ isCurrent, expectedUserId: 'owner-a', commitment: null });
    expect(apiRequest.mock.calls[0][2]).toMatchObject({ isCurrent, expectedUserId: 'owner-a' });
    const payload = JSON.stringify(apiRequest.mock.calls[0][1]);
    for (const secret of Object.values(SECRETS)) expect(payload).not.toContain(secret);
    expect(payload).not.toContain('personalPlan');
    expect(payload).not.toContain('personal-plan:');
    expect(JSON.stringify(input)).toBe(before);
  });

  it('defensively filters local candidates and feedback even if a caller passes the full profile', async () => {
    const input = context();
    const local = selectAdvisorRecommendation(input);
    const safe = selectAdvisorRecommendation({ ...input, profile: { ...input.profile!, personalPlan: undefined } });
    await requestModelAdvisorRecommendation(input, [local, { ...local, id: 'unrecognized-local-id' }, safe], [
      { recommendationId: `personal-plan:${SECRETS.action}`, helpful: false },
      { recommendationId: safe.id, helpful: true, feedbackAt: NOW },
    ]);
    const payload = apiRequest.mock.calls[0][1];
    expect(payload.candidates).toHaveLength(1);
    expect(payload.candidates[0].id).toBe(safe.id);
    expect(payload.recentFeedback).toEqual([expect.objectContaining({ recommendationId: safe.id, helpful: true, recordedAt: NOW })]);
    for (const secret of Object.values(SECRETS)) expect(JSON.stringify(payload)).not.toContain(secret);
    expect(payload.profile).not.toHaveProperty('personalPlan');
  });

  it('does not send a request when only local candidates remain', async () => {
    const input = context();
    await expect(requestModelAdvisorRecommendation(input, [selectAdvisorRecommendation(input)], []))
      .rejects.toThrow('No model-safe Advisor candidates');
    expect(apiRequest).not.toHaveBeenCalled();
  });

  it('rejects a model response that selects an excluded local candidate', async () => {
    const input = context();
    const local = selectAdvisorRecommendation(input);
    const safe = selectAdvisorRecommendation(context({ profile: null }));
    apiRequest.mockResolvedValue({ model: 'gemini', personalized: true,
      selection: { candidateId: local.id, observations: [], signalIds: [], focus: 'steady' } });
    await expect(requestModelAdvisorRecommendation(input, [local, safe], [])).rejects.toThrow('unknown action');
  });

  it('keeps unsafe plan text local even if the request boundary is called directly', async () => {
    const input = withPlan({ cue: 'hurt myself tonight' });
    const safe = selectAdvisorRecommendation(context({ profile: null }));
    await expect(requestModelAdvisorRecommendation(input, [safe], [])).rejects.toThrow('safety guidance must stay local');
    expect(apiRequest).not.toHaveBeenCalled();
    const harness = screenHarness();
    expect((await harness.select(input, [], 'user_id:owner-a')).recommendation.kind).toBe('safety');
    expect(harness.consent).not.toHaveBeenCalled();
  });

  it('retains the existing consent-denied local fallback', async () => {
    const harness = screenHarness();
    harness.consent.mockResolvedValue(false);
    const result = await harness.select(context(), [personalPlanKey(PLAN)], 'user_id:owner-a', { preserveToday: false });
    expect(result.model).toBeNull();
    expect(harness.request).not.toHaveBeenCalled();
  });

  it('does not send the old owner context after the account changes while consent is pending', async () => {
    const harness = screenHarness();
    let current = true;
    let finishConsent!: (value: boolean) => void;
    harness.consent.mockImplementation(() => new Promise<boolean>((resolve) => { finishConsent = resolve; }));
    const result = harness.select(context(), [personalPlanKey(PLAN)], 'user_id:old-owner',
      { preserveToday: false }, null, () => current);
    current = false;
    finishConsent(true);
    expect((await result).model).toBeNull();
    expect(harness.candidates).not.toHaveBeenCalled();
    expect(harness.request).not.toHaveBeenCalled();
    expect(apiRequest).not.toHaveBeenCalled();
  });

  it.each([null, 'session_id:legacy', 'user_id:'])('does not request AI without an authenticated owner binding: %s', async (owner) => {
    const harness = screenHarness();
    const result = await harness.select(context(), [personalPlanKey(PLAN)], owner, { preserveToday: false });
    expect(result.model).toBeNull();
    expect(harness.consent).not.toHaveBeenCalled();
    expect(apiRequest).not.toHaveBeenCalled();
  });
});
