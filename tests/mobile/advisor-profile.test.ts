import { describe, expect, it } from 'vitest';
import {
  ADVISOR_PROFILE_VERSION,
  completeAdvisorProfile,
  defaultAdvisorProfile,
  hasUnsupportedAdvisorProfileVersion,
  normalizeAdvisorProfile,
  sanitizeAdvisorName,
} from '../../mobile/lib/advisor-profile';
import { createAdvisorProfileStorage } from '../../mobile/lib/advisor-profile-storage';

class MemoryStorage {
  values = new Map<string, string>();
  async getItem(key: string) { return this.values.get(key) ?? null; }
  async setItem(key: string, value: string) { this.values.set(key, value); }
  async removeItem(key: string) { this.values.delete(key); }
}

describe('mobile Advisor profile', () => {
  it('sanitizes a name and rejects unsupported options', () => {
    expect(sanitizeAdvisorName('  Ada   Lovelace  ')).toBe('Ada Lovelace');
    expect(normalizeAdvisorProfile({
      focus: 'structure',
      priorities: ['goals', 'invalid', 'study', 'goals'],
      supportStyle: 'unknown',
      lowEnergyEssentials: ['goals', 'invalid', 'grounding'],
    })).toMatchObject({
      focus: 'structure',
      priorities: ['goals', 'study'],
      supportStyle: 'gentle',
      lowEnergyEssentials: ['goals', 'grounding'],
    });
  });

  it('marks setup complete while preserving an earlier completion date', () => {
    const completed = completeAdvisorProfile(
      normalizeAdvisorProfile({ preferredName: 'Ada' }),
      '2026-08-24T12:00:00.000Z'
    );
    expect(completed.completedAt).toBe('2026-08-24T12:00:00.000Z');
    expect(completeAdvisorProfile(completed, '2026-08-25T12:00:00.000Z').completedAt)
      .toBe('2026-08-24T12:00:00.000Z');
  });

  it('preserves future-version profiles and reports storage read failures', async () => {
    const memory = new MemoryStorage();
    const storage = createAdvisorProfileStorage(memory);
    const owner = 'user_id:a';
    const key = `mhtoolkit.advisor.profile.v1:${encodeURIComponent(owner)}`;
    const future = { ...defaultAdvisorProfile(), version: ADVISOR_PROFILE_VERSION + 1 };
    memory.values.set(key, JSON.stringify(future));

    expect(hasUnsupportedAdvisorProfileVersion(future)).toBe(true);
    await expect(storage.read(owner)).rejects.toThrow('newer app version');
    expect(memory.values.get(key)).toBe(JSON.stringify(future));

    const failing = createAdvisorProfileStorage({
      getItem: async () => { throw new Error('unavailable'); },
      setItem: async () => {},
      removeItem: async () => {},
    });
    await expect(failing.read(owner)).rejects.toThrow('unavailable');
  });

  it('notifies mounted consumers after profile writes', async () => {
    const storage = createAdvisorProfileStorage(new MemoryStorage());
    const observed: string[] = [];
    const unsubscribe = storage.subscribe('user_id:a', (profile) => {
      observed.push(profile?.preferredName ?? 'cleared');
    });
    await storage.write('user_id:a', { ...defaultAdvisorProfile(), preferredName: 'Ada' });
    await storage.clear('user_id:a');
    unsubscribe();
    expect(observed).toEqual(['Ada', 'cleared']);
  });
});
