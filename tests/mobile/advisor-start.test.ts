import { describe, expect, it, vi } from 'vitest';
import { createAdvisorStepStarter } from '../../mobile/lib/advisor-start';
import { createAdvisorActionStorage } from '../../mobile/lib/advisor-action-storage';
import type { AdvisorRecommendation } from '../../mobile/lib/advisor-core';
import { automaticAdvisorFollowUpAt } from '../../mobile/lib/advisor-cadence-core';

const NOW = new Date('2026-09-27T12:00:00.000Z');
const recommendation: AdvisorRecommendation = {
  id: 'habit:walk', kind: 'standard', action: 'Take a short walk.', smallerAction: 'Put on shoes.',
  observation: 'Your habit is open.', observations: ['Your habit is open.'], route: '/habits',
  sourceLabels: ['Habit'], resourceLabel: 'Open habit', changeSignal: null,
};

function harness() {
  const values = new Map<string, string>();
  const storage = createAdvisorActionStorage({
    getItem: async (key) => values.get(key) ?? null,
    setItem: async (key, value) => { values.set(key, value); },
    removeItem: async (key) => { values.delete(key); },
  }, () => NOW);
  const dependencies = {
    accept: vi.fn(storage.acceptAdvisorAction), cancelReminder: vi.fn(async () => {}),
    clearFollowUp: vi.fn((owner: string, id: string) => storage.setAdvisorActionFollowUp(owner, id, null, null)),
    start: vi.fn(async (owner: string, action: { id: string }) => (await storage.startAdvisorAction(owner, action.id)).action),
  };
  return { storage, dependencies, start: createAdvisorStepStarter(dependencies) };
}

describe('shared Today / Advisor start transition', () => {
  it('persists the chosen step before returning a navigation destination', async () => {
    const { start, storage } = harness();
    const result = await start('owner:a', recommendation, null, true, () => true, NOW);
    expect(result?.route).toBe('/habits');
    expect(await storage.loadAdvisorAction('owner:a')).toMatchObject({ status: 'in_progress', useSmallerStep: true });
    expect(await storage.loadAdvisorAction('owner:b')).toBeNull();
  });

  it('continues the actual saved step, not a newly suggested one', async () => {
    const { start, storage, dependencies } = harness();
    const saved = await storage.acceptAdvisorAction('owner', { ...recommendation, route: '/goals' });
    const inProgress = (await storage.startAdvisorAction('owner', saved.action!.id)).action;
    expect((await start('owner', recommendation, inProgress, false, () => true, NOW))?.route).toBe('/goals');
    expect(dependencies.start).not.toHaveBeenCalled();
    expect(dependencies.accept).not.toHaveBeenCalled();
  });

  it('clears a due follow-up before starting but preserves a future one', async () => {
    for (const [date, shouldClear] of [['2026-09-26T12:00:00.000Z', true], ['2026-09-28T12:00:00.000Z', false]] as const) {
      const { start, storage, dependencies } = harness();
      const saved = await storage.acceptAdvisorAction('owner', recommendation);
      const planned = (await storage.setAdvisorActionFollowUp('owner', saved.action!.id, date)).action;
      const result = await start('owner', recommendation, planned, false, () => true, NOW);
      expect(result?.action?.followUpAt).toBe(shouldClear ? automaticAdvisorFollowUpAt(NOW) : date);
      expect(dependencies.cancelReminder).toHaveBeenCalledTimes(shouldClear ? 1 : 0);
    }
  });

  it('does not navigate or start after the account changes during persistence', async () => {
    const { dependencies } = harness();
    let current = true;
    const accept = dependencies.accept.getMockImplementation()!;
    dependencies.accept.mockImplementation(async (...args) => { const result = await accept(...args); current = false; return result; });
    const result = await createAdvisorStepStarter(dependencies)('owner', recommendation, null, false, () => current, NOW);
    expect(result).toBeNull();
    expect(dependencies.start).not.toHaveBeenCalled();
  });

  it('does not claim success after a failed lifecycle write', async () => {
    const { dependencies } = harness();
    dependencies.start.mockResolvedValue(null);
    await expect(createAdvisorStepStarter(dependencies)('owner', recommendation, null, false, () => true, NOW))
      .rejects.toThrow('could not be started');
  });

  it('opens safety support without accepting or starting a task', async () => {
    const { start, dependencies } = harness();
    const result = await start('owner', { ...recommendation, kind: 'safety', route: '/resources' }, null, false, () => true);
    expect(result).toEqual({ route: '/resources', action: null });
    expect(dependencies.accept).not.toHaveBeenCalled();
  });

  it('preserves Together actions on reload', async () => {
    const { start, storage } = harness();
    await start('owner', { ...recommendation, route: '/accountability' }, null, false, () => true);
    expect((await storage.loadAdvisorAction('owner'))?.route).toBe('/accountability');
  });
});
