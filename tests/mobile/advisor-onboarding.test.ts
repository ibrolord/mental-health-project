import { describe, expect, it } from 'vitest';
import { defaultAdvisorProfile, completeAdvisorProfile } from '../../mobile/lib/advisor-profile';
import { createAdvisorProfileStorage } from '../../mobile/lib/advisor-profile-storage';
import { advisorWelcomeOption, createWelcomeSaveGate, dismissAdvisorWelcomeForSession, finishAdvisorWelcome, saveAdvisorWelcomeAndOpen, shouldOfferAdvisorSetup, todayGreeting } from '../../mobile/lib/advisor-onboarding';
import { selectAdvisorRecommendation, type AdvisorContext } from '../../mobile/lib/advisor-core';
import { dashboardModulesForToday, defaultDashboardLayout } from '../../mobile/lib/dashboard-layout';
import { prefersSmallerStep } from '../../mobile/lib/advisor-step-sizing';

const NOW = '2026-09-27T12:00:00.000Z';
const context = (overrides: Partial<AdvisorContext> = {}): AdvisorContext => ({
  nowIso: NOW, mood: null, goals: [], habits: [], health: null, habitWeek: null, ...overrides,
});

describe('short Advisor onboarding', () => {
  it('offers setup only until the owner completes or skips it', () => {
    const original = defaultAdvisorProfile(NOW);
    expect(shouldOfferAdvisorSetup(original)).toBe(true);
    expect(shouldOfferAdvisorSetup(completeAdvisorProfile(original, NOW))).toBe(false);
    const skipped = finishAdvisorWelcome(original, null, 'Unsaved name', NOW);
    expect(shouldOfferAdvisorSetup(skipped)).toBe(false);
    expect(skipped.completedAt).toBeNull();
    expect(skipped.priorities).toEqual(original.priorities);
    expect(skipped.preferredName).toBe(original.preferredName);
    expect(original.onboardingDismissedAt).toBeNull();
  });

  it.each([
    ['steady', 'stability', ['mood']],
    ['routine', 'structure', ['habits']],
    ['follow-through', 'momentum', ['goals']],
  ] as const)('maps %s only to the previewed priority', (focus, expectedFocus, priorities) => {
    const original = { ...defaultAdvisorProfile(NOW), lowEnergyEssentials: ['rest' as const] };
    const profile = finishAdvisorWelcome(original, focus, '  Ada   Lovelace ', NOW);
    expect(profile).toMatchObject({ focus: expectedFocus, priorities: [...priorities],
      lowEnergyEssentials: ['rest'], preferredName: 'Ada Lovelace', completedAt: NOW });
    expect(original.completedAt).toBeNull();
    expect(original.priorities).toEqual(['mood', 'sleep']);
  });

  it.each(['routine', 'follow-through'] as const)('gives %s a relevant starting tool even after a low check-in', (focus) => {
    const profile = finishAdvisorWelcome(defaultAdvisorProfile(NOW), focus, '', NOW);
    for (const mood of [null, { emoji: '😞' as const, localDate: '2026-09-27' }]) {
      expect(selectAdvisorRecommendation(context({ profile, mood })).route)
        .toBe(focus === 'routine' ? '/habits' : '/goals');
    }
  });

  it('uses an existing habit instead of suggesting a new routine or grounding for low mood', () => {
    const profile = finishAdvisorWelcome(defaultAdvisorProfile(NOW), 'routine', '', NOW);
    const recommendation = selectAdvisorRecommendation(context({ profile,
      mood: { emoji: '😞', localDate: '2026-09-27' },
      habits: [{ id: 'walk', name: 'Walk outside', completedToday: false, tinyStep: 'Put on shoes' }],
    }));
    expect(recommendation.id).toBe('habit:walk');
    expect(recommendation.action).toContain('smallest version');
  });

  it('preserves safety overrides regardless of onboarding focus', () => {
    const profile = finishAdvisorWelcome(defaultAdvisorProfile(NOW), 'follow-through', '', NOW);
    expect(selectAdvisorRecommendation(context({ profile,
      goals: [{ id: 'unsafe', title: 'hurt myself', dueAt: null }],
    })).kind).toBe('safety');
  });

  it('only filters low-energy tools, without rewriting the saved home layout', () => {
    const layout = defaultDashboardLayout();
    const saved = JSON.stringify(layout);
    const profile = finishAdvisorWelcome({ ...defaultAdvisorProfile(NOW), lowEnergyEssentials: ['habits'] }, 'routine', '', NOW);
    expect(dashboardModulesForToday(layout, true, profile.lowEnergyEssentials)).toContain('habits');
    expect(JSON.stringify(layout)).toBe(saved);
    expect(dashboardModulesForToday(layout, false, profile.lowEnergyEssentials)).toEqual(layout.moduleIds);
  });

  it('keeps skip state owner-isolated and persistent and does not announce failed writes', async () => {
    const values = new Map<string, string>();
    let fail = false;
    const storage = createAdvisorProfileStorage({
      getItem: async (key) => values.get(key) ?? null,
      setItem: async (key, value) => { if (fail) throw new Error('disk'); values.set(key, value); },
      removeItem: async (key) => { values.delete(key); },
    });
    const original = defaultAdvisorProfile(NOW);
    await storage.write('session_id:a', finishAdvisorWelcome(original, null, '', NOW));
    expect(shouldOfferAdvisorSetup(await storage.read('session_id:a'))).toBe(false);
    expect(shouldOfferAdvisorSetup(await storage.read('user_id:b'))).toBe(true);
    const seen: unknown[] = [];
    storage.subscribe('user_id:b', (value) => seen.push(value));
    fail = true;
    await expect(storage.write('user_id:b', finishAdvisorWelcome(original, 'routine', 'Ada', NOW))).rejects.toThrow('disk');
    expect(seen).toEqual([]);
    expect((await storage.read('user_id:b')).completedAt).toBeNull();
  });

  it('personalizes the greeting without requiring a name', () => {
    expect(todayGreeting(9, ' Ada ')).toBe('Good morning, Ada.');
    expect(todayGreeting(15, '')).toBe('Good afternoon.');
    expect(todayGreeting(20, 'Sam')).toBe('Good evening, Sam.');
  });

  it('keeps a failed skip write from re-prompting this owner during the same session', () => {
    const profile = defaultAdvisorProfile(NOW);
    dismissAdvisorWelcomeForSession('session_id:skipped');
    dismissAdvisorWelcomeForSession(null);
    expect(shouldOfferAdvisorSetup(profile, 'session_id:skipped')).toBe(false);
    expect(shouldOfferAdvisorSetup(profile, 'user_id:different')).toBe(true);
    expect(shouldOfferAdvisorSetup(profile, null)).toBe(true);
  });

  it.each([
    ['steady', '/(tabs)/tracker', 'Check in with myself'],
    ['routine', '/habits', 'Choose my habit'],
    ['follow-through', '/goals', 'Choose my goal'],
  ] as const)('saves %s before opening its first tool', async (focus, route, action) => {
    const events: string[] = [];
    const profile = defaultAdvisorProfile(NOW);
    const original = JSON.stringify(profile);
    expect(advisorWelcomeOption(focus).action).toBe(action);
    expect(await saveAdvisorWelcomeAndOpen({ profile, focus, name: '  Ada ', isCurrent: () => true,
      save: async (next) => { expect(next.preferredName).toBe('Ada'); events.push('save'); return true; },
      open: (destination) => events.push(destination),
    })).toBe('saved');
    expect(events).toEqual(['save', route]);
    expect(JSON.stringify(profile)).toBe(original);
  });

  it.each(['false', 'throw'] as const)('keeps the user on the welcome when saving returns %s', async (failure) => {
    const opened: string[] = [];
    expect(await saveAdvisorWelcomeAndOpen({ profile: defaultAdvisorProfile(NOW), focus: 'routine', name: '',
      isCurrent: () => true, save: async () => { if (failure === 'throw') throw new Error('disk'); return false; },
      open: (route) => opened.push(route),
    })).toBe('failed');
    expect(opened).toEqual([]);
  });

  it('does not save or navigate after an account change before confirmation', async () => {
    const calls: string[] = [];
    expect(await saveAdvisorWelcomeAndOpen({ profile: defaultAdvisorProfile(NOW), focus: 'steady', name: '',
      isCurrent: () => false, save: async () => { calls.push('save'); return true; },
      open: (route) => calls.push(route),
    })).toBe('stale');
    expect(calls).toEqual([]);
  });

  it('does not navigate after the user leaves or switches accounts during a save', async () => {
    let current = true;
    let finishSave!: (value: boolean) => void;
    const opened: string[] = [];
    const result = saveAdvisorWelcomeAndOpen({ profile: defaultAdvisorProfile(NOW), focus: 'follow-through', name: '',
      isCurrent: () => current, save: () => new Promise<boolean>((resolve) => { finishSave = resolve; }),
      open: (route) => opened.push(route),
    });
    current = false;
    finishSave(true);
    expect(await result).toBe('stale');
    expect(opened).toEqual([]);
  });

  it('blocks duplicate confirmation for one owner but not a different account', () => {
    const gate = createWelcomeSaveGate();
    const operationA = gate.begin('owner-a')!;
    expect(gate.begin('owner-a')).toBeNull();
    expect(gate.has('owner-b')).toBe(false);
    const operationB = gate.begin('owner-b')!;
    gate.finish('owner-a', operationA);
    expect(gate.has('owner-a')).toBe(false);
    expect(gate.has('owner-b')).toBe(true);
    gate.finish('owner-b', operationA);
    expect(gate.has('owner-b')).toBe(true);
    gate.finish('owner-b', operationB);
    const newer = gate.begin('owner-b')!;
    gate.finish('owner-b', operationB);
    expect(gate.has('owner-b')).toBe(true);
    gate.finish('owner-b', newer);
    expect(gate.has('owner-b')).toBe(false);
  });

  it.each(['steady', 'routine', 'follow-through'] as const)('offers an actual alternative for %s', (focus) => {
    const profile = finishAdvisorWelcome(defaultAdvisorProfile(NOW), focus, '', NOW);
    const currentContext = context({ profile, mood: { emoji: '🙂', localDate: '2026-09-27' } });
    const first = selectAdvisorRecommendation(currentContext);
    const alternate = selectAdvisorRecommendation(currentContext, [first.id], {
      candidateFamily: first.id.split(':')[0], excludeRecommendationId: first.id, preserveToday: false,
    });
    expect(alternate.id).not.toBe(first.id);
    expect(alternate.action).not.toBe(first.action);
    expect(alternate.smallerAction).not.toBe(first.smallerAction);
  });

  it('uses the same gentle and low-energy step sizing on both surfaces', () => {
    const profile = finishAdvisorWelcome(defaultAdvisorProfile(NOW), 'routine', '', NOW);
    expect(prefersSmallerStep(context({ profile }))).toBe(true);
    expect(prefersSmallerStep(context({ profile: { ...profile, supportStyle: 'direct' } }))).toBe(false);
    expect(prefersSmallerStep(context({ profile: { ...profile, supportStyle: 'direct' }, lowEnergyMode: true }))).toBe(true);
  });
});
