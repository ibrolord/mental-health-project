import { describe, expect, it } from 'vitest';
import {
  createAdvisorBriefStorage,
  type StoredAdvisorBrief,
} from '../../mobile/lib/advisor-brief-storage';

function memoryStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  return {
    values,
    storage: {
      getItem: async (key: string) => values.get(key) ?? null,
      setItem: async (key: string, value: string) => {
        values.set(key, value);
      },
      removeItem: async (key: string) => {
        values.delete(key);
      },
    },
  };
}

function brief(overrides: Partial<StoredAdvisorBrief> = {}): StoredAdvisorBrief {
  return {
    version: 1,
    ownerKey: 'user_id:user-1',
    localDate: '2026-08-14',
    fingerprint: 'abc123',
    generatedAt: '2026-08-14T12:00:00.000Z',
    model: 'gemini',
    recommendation: {
      id: 'habit:walk',
      kind: 'standard',
      observation: 'Your walk is still open.',
      action: 'Walk for five minutes.',
      smallerAction: 'Put on your shoes.',
      route: '/habits',
      sourceLabels: ['Habit'],
      resourceLabel: 'Open habit',
      observations: ['Your walk is still open.'],
      changeSignal: null,
    },
    brief: {
      focus: 'routine',
      headline: 'Keep the routine moving.',
      signals: [
        { id: 'routine:walk', kind: 'routine', text: 'Morning routine is open.' },
      ],
      usedAppleHealth: false,
    },
    ...overrides,
  };
}

describe('Advisor daily brief storage', () => {
  it('returns a brief only for the same owner, day, and context fingerprint', async () => {
    const { storage } = memoryStorage();
    const briefs = createAdvisorBriefStorage(storage);
    await briefs.write(brief());

    await expect(
      briefs.read('user_id:user-1', '2026-08-14', 'abc123')
    ).resolves.toMatchObject({ model: 'gemini' });
    await expect(
      briefs.read('user_id:user-1', '2026-08-15', 'abc123')
    ).resolves.toBeNull();
    await expect(
      briefs.read('user_id:user-1', '2026-08-14', 'changed')
    ).resolves.toBeNull();
  });

  it('rejects malformed cached routes instead of returning them to navigation', async () => {
    const { storage, values } = memoryStorage();
    const briefs = createAdvisorBriefStorage(storage);
    const malformed = brief();
    (malformed.recommendation as { route: string }).route = '/unsafe';
    values.set(
      'mhtoolkit.advisor.daily-brief.v1.user_id:user-1',
      JSON.stringify(malformed)
    );

    await expect(
      briefs.read('user_id:user-1', '2026-08-14', 'abc123')
    ).resolves.toBeNull();
  });

  it('rejects unknown cached signal kinds', async () => {
    const { storage, values } = memoryStorage();
    const briefs = createAdvisorBriefStorage(storage);
    const malformed = brief();
    (malformed.brief.signals[0] as { kind: string }).kind = 'diagnosis';
    values.set(
      'mhtoolkit.advisor.daily-brief.v1.user_id:user-1',
      JSON.stringify(malformed)
    );

    await expect(
      briefs.read('user_id:user-1', '2026-08-14', 'abc123')
    ).resolves.toBeNull();
  });
});
