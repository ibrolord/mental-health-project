import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  createDashboardPreferenceWriter,
  createDashboardPreferences,
} from '../../mobile/lib/dashboard-preferences';

class MemoryStorage {
  values = new Map<string, string>();

  async getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  async setItem(key: string, value: string) {
    this.values.set(key, value);
  }

  async removeItem(key: string) {
    this.values.delete(key);
  }
}

describe('mobile dashboard preferences', () => {
  it('remembers low-energy mode per owner', async () => {
    const storage = new MemoryStorage();
    const preferences = createDashboardPreferences(storage);

    await preferences.writeLowEnergyMode('user_id:owner-a', true);

    await expect(
      preferences.readLowEnergyMode('user_id:owner-a')
    ).resolves.toBe(true);
    await expect(
      preferences.readLowEnergyMode('user_id:owner-b')
    ).resolves.toBe(false);
  });

  it('removes the preference when full view is restored', async () => {
    const storage = new MemoryStorage();
    const preferences = createDashboardPreferences(storage);

    await preferences.writeLowEnergyMode('user_id:owner-a', true);
    await preferences.writeLowEnergyMode('user_id:owner-a', false);

    await expect(
      preferences.readLowEnergyMode('user_id:owner-a')
    ).resolves.toBe(false);
  });

  it('keeps the toggle disabled until the matching owner is hydrated', () => {
    const dashboard = readFileSync(
      resolve('mobile/app/(tabs)/index.tsx'),
      'utf8'
    );

    expect(dashboard).toContain(
      'disabled={!ownerKey || lowEnergyOwnerKey !== ownerKey}'
    );
    expect(dashboard).toContain(
      'if (!ownerKey || lowEnergyOwnerKey !== ownerKey) return;'
    );
  });

  it('coalesces queued preference changes to the latest value', async () => {
    const storage = new MemoryStorage();
    const preferences = createDashboardPreferences(storage);
    const writer = createDashboardPreferenceWriter(preferences);
    writer.hydrate('user_id:owner-a', false);

    const first = writer.writeLatest('user_id:owner-a', true);
    const second = writer.writeLatest('user_id:owner-a', false);

    await Promise.all([first, second]);
    await expect(
      preferences.readLowEnergyMode('user_id:owner-a')
    ).resolves.toBe(false);
    await expect(first).resolves.toMatchObject({ current: false });
    await expect(second).resolves.toMatchObject({
      current: true,
      persisted: false,
      error: null,
    });
  });

  it('reports the last persisted value when the current write fails', async () => {
    const preferences = {
      async readLowEnergyMode() {
        return true;
      },
      async writeLowEnergyMode() {
        throw new Error('storage unavailable');
      },
    };
    const writer = createDashboardPreferenceWriter(preferences);
    writer.hydrate('user_id:owner-a', true);

    await expect(
      writer.writeLatest('user_id:owner-a', false)
    ).resolves.toMatchObject({ current: true, persisted: true });
  });
});
