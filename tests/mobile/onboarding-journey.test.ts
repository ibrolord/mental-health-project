import { describe, expect, it, vi } from 'vitest';
import {
  finishAdvisorWelcome,
  saveAdvisorWelcomeAndOpen,
} from '../../mobile/lib/advisor-onboarding';
import {
  ADVISOR_PROFILE_VERSION,
  defaultAdvisorProfile,
  normalizeAdvisorProfile,
  type AdvisorProfile,
} from '../../mobile/lib/advisor-profile';
import { createAdvisorProfileStorage } from '../../mobile/lib/advisor-profile-storage';
import {
  JOURNEY_STEPS,
  boundedPlanText,
  nextJourneyStep,
  normalizePersonalPlan,
  obstacleResponse,
  personalPlanKey,
  previousJourneyStep,
  type AdvisorPersonalPlan,
  type JourneyStep,
} from '../../mobile/lib/onboarding-journey';

const NOW = '2026-09-27T12:00:00.000Z';
const BEFORE = '2026-09-26T12:00:00.000Z';
const EMPTY_PLAN: AdvisorPersonalPlan = {
  motivation: '', obstacle: null, obstacleDetail: '', action: '', cue: '',
};
const PLAN: AdvisorPersonalPlan = {
  motivation: 'Have time for my family',
  obstacle: 'custom',
  obstacleDetail: 'My schedule changes each week',
  action: 'Take a short walk',
  cue: 'After lunch',
};
const DRAFT: AdvisorPersonalPlan = {
  motivation: '  Have time\nfor my family  ',
  obstacle: 'custom',
  obstacleDetail: '\tMy schedule\u0000changes each week ',
  action: ' Take a\u007fshort walk ',
  cue: ' After\r\nlunch ',
};

function profileStorage() {
  const values = new Map<string, string>();
  return createAdvisorProfileStorage({
    getItem: async (key) => values.get(key) ?? null,
    setItem: async (key, value) => { values.set(key, value); },
    removeItem: async (key) => { values.delete(key); },
  });
}

function pendingSave() {
  let resolve!: (value: boolean) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<boolean>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

describe('personal onboarding journey navigation', () => {
  it('visits exactly six ordered steps', () => {
    expect(JOURNEY_STEPS).toEqual(['focus', 'motivation', 'obstacle', 'evidence', 'commitment', 'review']);
    const visited: JourneyStep[] = [JOURNEY_STEPS[0]];
    for (let index = 1; index < 6; index += 1) {
      visited.push(nextJourneyStep(visited[index - 1]));
    }
    expect(visited).toEqual(JOURNEY_STEPS);
  });

  it.each([
    ['focus', 'focus', 'motivation'],
    ['motivation', 'focus', 'obstacle'],
    ['obstacle', 'motivation', 'evidence'],
    ['evidence', 'obstacle', 'commitment'],
    ['commitment', 'evidence', 'review'],
    ['review', 'commitment', 'review'],
  ] as const)('bounds backward and forward navigation at %s', (step, previous, next) => {
    expect(previousJourneyStep(step)).toBe(previous);
    expect(nextJourneyStep(step)).toBe(next);
  });
});

describe('bounded personal plan text', () => {
  it.each([undefined, null, 42, false, [], {}, { toString: () => 'not user text' }].map((value) => ({ value })))(
    'does not coerce non-string input $value into personal text', ({ value }) => {
      expect(boundedPlanText(value)).toBe('');
    }
  );

  it('replaces every ASCII control character with a word separator', () => {
    for (const code of [...Array.from({ length: 32 }, (_, index) => index), 127]) {
      expect(boundedPlanText(`one${String.fromCharCode(code)}two`)).toBe('one two');
    }
    expect(boundedPlanText('\u0000\t\r\n\u001f\u007f')).toBe('');
  });

  it('collapses Unicode whitespace without discarding non-ASCII text', () => {
    expect(boundedPlanText(' \u00a0Caf\u00e9\u2003\u6771\u4eac\n\u{1f331}  '))
      .toBe('Caf\u00e9 \u6771\u4eac \u{1f331}');
    expect(boundedPlanText('e\u0301')).toBe('e\u0301');
  });

  it('uses a default limit of 180 Unicode code points rather than UTF-16 units', () => {
    const symbol = '\u{1f331}';
    expect(boundedPlanText(symbol.repeat(180))).toBe(symbol.repeat(180));
    expect(boundedPlanText(symbol.repeat(181))).toBe(symbol.repeat(180));
  });

  it.each([0, 1, 100, 120, 180])('honors an explicit %i-code-point limit', (limit) => {
    const symbol = '\u{1f331}';
    const result = boundedPlanText(symbol.repeat(limit + 1), limit);
    expect(result).toBe(symbol.repeat(limit));
    expect(Array.from(result)).toHaveLength(limit);
  });

  it('sanitizes before truncating so leading whitespace does not consume the limit', () => {
    expect(boundedPlanText(' \n A\t\tB\u0000C ', 3)).toBe('A B');
  });
});

describe('personal plan normalization', () => {
  it.each([undefined, null, 5, false, 'draft', [], {}].map((value) => ({ value })))(
    'defaults malformed plan $value', ({ value }) => {
      expect(normalizePersonalPlan(value)).toEqual(EMPTY_PLAN);
    }
  );

  it('sanitizes all fields without mutating the draft and is idempotent', () => {
    const draft = { ...DRAFT };
    const original = JSON.stringify(draft);
    const normalized = normalizePersonalPlan(draft);
    expect(normalized).toEqual(PLAN);
    expect(normalized).not.toBe(draft);
    expect(JSON.stringify(draft)).toBe(original);
    expect(normalizePersonalPlan(normalized)).toEqual(PLAN);
  });

  it.each([
    ['motivation', 180], ['obstacleDetail', 180], ['action', 120], ['cue', 100],
  ] as const)('bounds %s at %i Unicode code points', (field, limit) => {
    const symbol = '\u{1f331}';
    for (const length of [limit - 1, limit, limit + 1]) {
      const normalized = normalizePersonalPlan({ ...PLAN, [field]: symbol.repeat(length) });
      expect(normalized[field]).toBe(symbol.repeat(Math.min(length, limit)));
    }
  });

  it('rejects invalid field types rather than stringifying them', () => {
    expect(normalizePersonalPlan({
      motivation: ['family'], obstacle: 'custom', obstacleDetail: {}, action: 123, cue: true,
    })).toEqual({ ...EMPTY_PLAN, obstacle: 'custom' });
  });

  it.each(['energy', 'overwhelm', 'time', 'forget', 'unsure'] as const)(
    'keeps %s but removes detail left over from a custom obstacle', (obstacle) => {
      expect(normalizePersonalPlan({ ...PLAN, obstacle })).toEqual({ ...PLAN, obstacle, obstacleDetail: '' });
    }
  );

  it.each([undefined, null, '', 'ENERGY', 'rest', '__proto__', 1, {}, ['energy']].map((obstacle) => ({ obstacle })))(
    'rejects invalid obstacle $obstacle and its stale detail', ({ obstacle }) => {
      expect(normalizePersonalPlan({ ...PLAN, obstacle })).toEqual({ ...PLAN, obstacle: null, obstacleDetail: '' });
    }
  );

  it.each([undefined, null, '', ' \n\u0000\u007f ', 0, [], {}].map((action) => ({ action })))(
    'removes the cue when the action is empty or invalid: $action', ({ action }) => {
      expect(normalizePersonalPlan({ ...PLAN, action })).toEqual({ ...PLAN, action: '', cue: '' });
    }
  );

  it('keeps an action without requiring an optional cue', () => {
    expect(normalizePersonalPlan({ ...PLAN, cue: null })).toEqual({ ...PLAN, cue: '' });
  });

  it.each(['energy', 'overwhelm', 'time', 'forget', 'unsure'] as const)(
    'uses the predefined response for %s without repeating private detail', (obstacle) => {
      const response = obstacleResponse({ ...PLAN, obstacle });
      expect(response).not.toBe(obstacleResponse({ ...EMPTY_PLAN }));
      expect(response).not.toContain(PLAN.obstacleDetail);
      expect(response.length).toBeGreaterThan(0);
    }
  );

  it.each(['custom', null] as const)('uses a neutral response for obstacle %s', (obstacle) => {
    expect(obstacleResponse({ ...PLAN, obstacle })).toBe('Start at a pace that works for you.');
  });
});

describe('opaque personal plan keys', () => {
  it('is deterministic across serialization and property order without including personal text', () => {
    const key = personalPlanKey(PLAN);
    const reordered = { cue: PLAN.cue, action: PLAN.action, obstacleDetail: PLAN.obstacleDetail,
      obstacle: PLAN.obstacle, motivation: PLAN.motivation };
    expect(personalPlanKey(JSON.parse(JSON.stringify(PLAN)))).toBe(key);
    expect(personalPlanKey(reordered)).toBe(key);
    expect(key).toMatch(/^personal-plan:[0-9a-f]+$/);
    for (const text of [PLAN.motivation, PLAN.obstacleDetail, PLAN.action, PLAN.cue]) {
      expect(key).not.toContain(text);
    }
  });

  it('keys the normalized plan rather than whitespace or discarded answers', () => {
    expect(personalPlanKey(DRAFT)).toBe(personalPlanKey(PLAN));
    expect(personalPlanKey({ ...PLAN, obstacle: 'time' }))
      .toBe(personalPlanKey({ ...PLAN, obstacle: 'time', obstacleDetail: '' }));
    expect(personalPlanKey({ ...PLAN, action: '' }))
      .toBe(personalPlanKey({ ...PLAN, action: '', cue: '' }));
    expect(personalPlanKey({ ...PLAN, motivation: 'a'.repeat(181) }))
      .toBe(personalPlanKey({ ...PLAN, motivation: 'a'.repeat(180) }));
  });

  it.each([
    { motivation: 'Be present with friends' },
    { obstacle: 'energy' as const },
    { obstacleDetail: 'I work late' },
    { action: 'Stretch for two minutes' },
    { cue: 'Before bed' },
  ])('changes when a retained answer changes: %j', (change) => {
    expect(personalPlanKey({ ...PLAN, ...change })).not.toBe(personalPlanKey(PLAN));
  });

  it('distinguishes supplementary Unicode characters in otherwise identical actions', () => {
    const first = { ...PLAN, action: 'Notice \u{1f331}' };
    const second = { ...PLAN, action: 'Notice \u{1f33b}' };
    expect(personalPlanKey(first)).not.toBe(personalPlanKey(second));
  });
});

describe('backward-compatible Advisor personal plans', () => {
  const legacy: AdvisorProfile = {
    version: 1, preferredName: 'Ada', focus: 'structure', priorities: ['habits', 'study'],
    supportStyle: 'practical', lowEnergyEssentials: ['rest'], completedAt: BEFORE,
    onboardingDismissedAt: null, updatedAt: BEFORE,
  };

  it('normalizes a version-one profile without losing its existing preferences or completion', () => {
    expect(normalizeAdvisorProfile(legacy)).toEqual({
      ...legacy, version: ADVISOR_PROFILE_VERSION, personalPlan: EMPTY_PLAN,
    });
    expect(legacy).not.toHaveProperty('personalPlan');
  });

  it.each([null, false, 42, 'old data', []].map((personalPlan) => ({ personalPlan })))(
    'tolerates malformed saved personalPlan $personalPlan', ({ personalPlan }) => {
      expect(normalizeAdvisorProfile({ ...legacy, personalPlan })).toEqual({
        ...legacy, version: ADVISOR_PROFILE_VERSION, personalPlan: EMPTY_PLAN,
      });
    }
  );

  it('normalizes a partial stored plan and removes answers that no longer apply', () => {
    expect(normalizeAdvisorProfile({ ...legacy, personalPlan: {
      motivation: '  More\nspace ', obstacle: 'unknown', obstacleDetail: 'Stale answer',
      cue: 'After lunch',
    } }).personalPlan).toEqual({ ...EMPTY_PLAN, motivation: 'More space' });
  });

  it('normalizes and preserves a plan through JSON storage', async () => {
    const storage = profileStorage();
    await storage.write('user_id:plan-owner', { ...legacy, personalPlan: DRAFT });
    expect(await storage.read('user_id:plan-owner')).toEqual({
      ...legacy, version: ADVISOR_PROFILE_VERSION, personalPlan: PLAN,
    });
    expect((await storage.read('user_id:another-owner')).personalPlan).toEqual(EMPTY_PLAN);
    expect(normalizeAdvisorProfile(JSON.parse(JSON.stringify({ ...legacy, personalPlan: DRAFT }))).personalPlan)
      .toEqual(PLAN);
  });

  it('does not share mutable default plans between profiles', () => {
    const first = defaultAdvisorProfile(NOW);
    first.personalPlan!.action = 'Only for the first profile';
    expect(defaultAdvisorProfile(NOW).personalPlan).toEqual(EMPTY_PLAN);
    expect(normalizeAdvisorProfile(legacy).personalPlan).toEqual(EMPTY_PLAN);
  });
});

describe('welcome personal plan persistence', () => {
  it.each(['steady', 'routine', 'follow-through'] as const)(
    'finishes %s with a normalized optional plan without mutating its inputs', async (focus) => {
      const original = defaultAdvisorProfile(BEFORE);
      const before = JSON.stringify({ original, draft: DRAFT });
      const finished = finishAdvisorWelcome(original, focus, ' Ada ', NOW, DRAFT);
      expect(finished).toMatchObject({ personalPlan: PLAN, preferredName: 'Ada', completedAt: NOW, updatedAt: NOW });
      expect(JSON.stringify({ original, draft: DRAFT })).toBe(before);
      const storage = profileStorage();
      await storage.write('owner:finish', finished);
      expect(await storage.read('owner:finish')).toEqual(finished);
    }
  );

  it.each([undefined, PLAN])('preserves the existing plan when the optional argument is omitted: %j', (personalPlan) => {
    const original = { ...defaultAdvisorProfile(BEFORE), personalPlan };
    const finished = finishAdvisorWelcome(original, 'routine', 'Ada', NOW);
    expect(finished.personalPlan).toEqual(personalPlan ?? EMPTY_PLAN);
    expect(finished.completedAt).toBe(NOW);
  });

  it('allows an explicitly empty plan to replace a previously saved plan', () => {
    const original = { ...defaultAdvisorProfile(BEFORE), personalPlan: PLAN, completedAt: BEFORE };
    const finished = finishAdvisorWelcome(original, 'steady', '', NOW, EMPTY_PLAN);
    expect(finished.personalPlan).toEqual(EMPTY_PLAN);
    expect(finished.completedAt).toBe(BEFORE);
    expect(original.personalPlan).toEqual(PLAN);
  });

  it.each([
    { personalPlan: undefined, completedAt: null },
    { personalPlan: PLAN, completedAt: null },
    { personalPlan: PLAN, completedAt: BEFORE },
  ])('skip retains existing answers instead of saving a draft: %j', async ({ personalPlan, completedAt }) => {
    const original: AdvisorProfile = { ...defaultAdvisorProfile(BEFORE), preferredName: 'Saved name',
      focus: 'recovery', priorities: ['sleep'], personalPlan, completedAt };
    const draft = { ...DRAFT, motivation: 'Do not save this draft', action: 'Unsaved action' };
    const before = JSON.stringify({ original, draft });
    const skipped = finishAdvisorWelcome(original, null, 'Unsaved name', NOW, draft);
    expect(skipped).toEqual({ ...original, personalPlan: personalPlan ?? EMPTY_PLAN,
      onboardingDismissedAt: NOW, updatedAt: NOW });
    const storage = profileStorage();
    await storage.write('owner:skip', skipped);
    expect(await storage.read('owner:skip')).toEqual(skipped);
    expect(JSON.stringify({ original, draft })).toBe(before);
  });

  it.each([
    ['steady', '/(tabs)/tracker'], ['routine', '/habits'], ['follow-through', '/goals'],
  ] as const)('roundtrips the plan before opening the %s destination', async (focus, route) => {
    const storage = profileStorage();
    const pending = pendingSave();
    const original = defaultAdvisorProfile(BEFORE);
    const before = JSON.stringify({ original, draft: DRAFT });
    const save = vi.fn(async (next: AdvisorProfile) => {
      expect(next.personalPlan).toEqual(PLAN);
      await pending.promise;
      await storage.write('owner:save', next);
      return true;
    });
    const open = vi.fn();
    const result = saveAdvisorWelcomeAndOpen({ profile: original, focus, name: ' Ada ', personalPlan: DRAFT,
      save, isCurrent: () => true, open });
    expect(save).toHaveBeenCalledOnce();
    expect(open).not.toHaveBeenCalled();
    expect((await storage.read('owner:save')).personalPlan).toEqual(EMPTY_PLAN);
    pending.resolve(true);
    expect(await result).toBe('saved');
    expect(open).toHaveBeenCalledExactlyOnceWith(route);
    expect(await storage.read('owner:save')).toEqual(save.mock.calls[0][0]);
    expect((await storage.read('owner:save')).personalPlan).toEqual(PLAN);
    expect(JSON.stringify({ original, draft: DRAFT })).toBe(before);
  });

  it.each([undefined, PLAN])('supports save-and-open without a personalPlan option: %j', async (personalPlan) => {
    const storage = profileStorage();
    const open = vi.fn();
    const result = await saveAdvisorWelcomeAndOpen({
      profile: { ...defaultAdvisorProfile(BEFORE), personalPlan }, focus: 'routine', name: '',
      save: async (next) => { await storage.write('owner:optional', next); return true; },
      isCurrent: () => true, open,
    });
    expect(result).toBe('saved');
    expect((await storage.read('owner:optional')).personalPlan).toEqual(personalPlan ?? EMPTY_PLAN);
    expect(open).toHaveBeenCalledExactlyOnceWith('/habits');
  });

  it.each(['false', 'throw'] as const)('does not navigate or mutate the saved plan after save returns %s', async (failure) => {
    const storage = profileStorage();
    const original = { ...defaultAdvisorProfile(BEFORE), personalPlan: PLAN };
    await storage.write('owner:failure', original);
    const open = vi.fn();
    const save = vi.fn(async (next: AdvisorProfile) => {
      expect(next.personalPlan?.action).toBe('New unsaved action');
      if (failure === 'throw') throw new Error('disk unavailable');
      return false;
    });
    expect(await saveAdvisorWelcomeAndOpen({ profile: original, focus: 'routine', name: '',
      personalPlan: { ...DRAFT, action: 'New unsaved action' }, save, isCurrent: () => true, open,
    })).toBe('failed');
    expect(save).toHaveBeenCalledOnce();
    expect(open).not.toHaveBeenCalled();
    expect(await storage.read('owner:failure')).toEqual(original);
  });

  it('does not save the plan or navigate for an already-stale owner', async () => {
    const save = vi.fn(async () => true);
    const open = vi.fn();
    expect(await saveAdvisorWelcomeAndOpen({ profile: defaultAdvisorProfile(NOW), focus: 'steady',
      name: '', personalPlan: DRAFT, save, isCurrent: () => false, open,
    })).toBe('stale');
    expect(save).not.toHaveBeenCalled();
    expect(open).not.toHaveBeenCalled();
  });

  it.each(['saved', 'failed', 'throw'] as const)('does not navigate when the owner changes during a %s save', async (outcome) => {
    const pending = pendingSave();
    let currentOwner = 'owner:original';
    const save = vi.fn((_next: AdvisorProfile) => pending.promise);
    const open = vi.fn();
    const result = saveAdvisorWelcomeAndOpen({ profile: defaultAdvisorProfile(NOW), focus: 'follow-through',
      name: '', personalPlan: DRAFT, save, isCurrent: () => currentOwner === 'owner:original', open,
    });
    expect(save).toHaveBeenCalledOnce();
    expect(save.mock.calls[0][0].personalPlan).toEqual(PLAN);
    expect(open).not.toHaveBeenCalled();
    currentOwner = 'owner:other';
    if (outcome === 'throw') pending.reject(new Error('disk unavailable'));
    else pending.resolve(outcome === 'saved');
    expect(await result).toBe('stale');
    expect(open).not.toHaveBeenCalled();
  });
});
