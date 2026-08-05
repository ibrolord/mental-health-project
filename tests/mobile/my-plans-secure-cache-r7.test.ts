import { beforeEach, describe, expect, it } from 'vitest';

import {
  createOfflineSafetyPlanCache,
  offlineSafetyPlanCacheKey,
  type OfflineSafetyPlanSnapshot,
} from '../../mobile/lib/offline-safety-plan';

class MemorySecureStore {
  values = new Map<string, string>();

  async getItemAsync(key: string): Promise<string | null> {
    return this.values.get(key) ?? null;
  }

  async setItemAsync(key: string, value: string): Promise<void> {
    this.values.set(key, value);
  }

  async deleteItemAsync(key: string): Promise<void> {
    this.values.delete(key);
  }
}

function snapshot(
  ownerId: string,
  label = 'Call someone I trust',
  details = 'Use the number saved in my contacts.'
): OfflineSafetyPlanSnapshot {
  return {
    plan: {
      id: `plan-${ownerId}`,
      user_id: ownerId,
      title: 'My safety plan',
      status: 'active',
      created_at: '2026-08-05T12:00:00.000Z',
      updated_at: '2026-08-05T12:00:00.000Z',
    },
    items: [
      {
        id: `item-${ownerId}`,
        plan_id: `plan-${ownerId}`,
        user_id: ownerId,
        item_kind: 'support_contact',
        label,
        details,
        position: 0,
        created_at: '2026-08-05T12:00:00.000Z',
        updated_at: '2026-08-05T12:00:00.000Z',
      },
    ],
  };
}

function maximumSnapshot(ownerId: string): OfflineSafetyPlanSnapshot {
  const base = snapshot(ownerId);
  return {
    ...base,
    plan: {
      ...base.plan,
      title: 'S'.repeat(120),
    },
    items: Array.from({ length: 6 }, (_, position) => ({
      ...base.items[0],
      id: `item-${ownerId}-${position}`,
      label: 'L'.repeat(120),
      details: 'D'.repeat(1000),
      position,
    })),
  };
}

describe('My Plans secure offline safety cache', () => {
  let secureStore: MemorySecureStore;
  let generation: number;

  beforeEach(() => {
    secureStore = new MemorySecureStore();
    generation = 0;
  });

  const createCache = () =>
    createOfflineSafetyPlanCache({
      secureStore,
      now: () => '2026-08-05T13:00:00.000Z',
      createGeneration: () => `cache-${++generation}`,
    });

  it('isolates snapshots under per-owner SecureStore keys', async () => {
    const cache = createCache();

    await cache.write('owner-a', snapshot('owner-a', 'Owner A item'));
    await cache.write('owner-b', snapshot('owner-b', 'Owner B item'));

    await expect(cache.read('owner-a')).resolves.toMatchObject({
      savedAt: '2026-08-05T13:00:00.000Z',
      items: [{ label: 'Owner A item', user_id: 'owner-a' }],
    });
    await expect(cache.read('owner-b')).resolves.toMatchObject({
      items: [{ label: 'Owner B item', user_id: 'owner-b' }],
    });
    expect([...secureStore.values.keys()]).toEqual(
      expect.arrayContaining([
        expect.stringContaining(offlineSafetyPlanCacheKey('owner-a')),
        expect.stringContaining(offlineSafetyPlanCacheKey('owner-b')),
      ])
    );
  });

  it('chunks a large plan and reads the complete value', async () => {
    const cache = createCache();
    const largeDetails = 'K'.repeat(1000);
    const largeSnapshot = snapshot('large-owner', 'Large item', largeDetails);
    largeSnapshot.items.push({
      ...largeSnapshot.items[0],
      id: 'item-large-owner-2',
      label: 'Second large item',
      position: 1,
    });

    await cache.write('large-owner', largeSnapshot);

    await expect(cache.read('large-owner')).resolves.toMatchObject({
      items: expect.arrayContaining([
        expect.objectContaining({ details: largeDetails }),
      ]),
    });
    expect(
      [...secureStore.values.keys()].filter((key) =>
        key.startsWith(`${offlineSafetyPlanCacheKey('large-owner')}.cache-1.`)
      ).length
    ).toBeGreaterThan(1);
  });

  it('accepts the maximum database-valid safety plan', async () => {
    const cache = createCache();
    const maximum = maximumSnapshot('maximum-owner');

    await cache.write('maximum-owner', maximum);

    await expect(cache.read('maximum-owner')).resolves.toMatchObject({
      plan: { title: 'S'.repeat(120) },
      items: expect.arrayContaining([
        expect.objectContaining({ position: 0, details: 'D'.repeat(1000) }),
        expect.objectContaining({ position: 5, label: 'L'.repeat(120) }),
      ]),
    });
  });

  it('rejects an oversized encrypted payload before writing any chunks', async () => {
    const cache = createOfflineSafetyPlanCache({
      secureStore,
      now: () => '2'.repeat(160_001),
      createGeneration: () => `cache-${++generation}`,
    });

    await expect(
      cache.write('owner-a', snapshot('owner-a'))
    ).rejects.toThrow('too large for encrypted offline storage');
    expect(secureStore.values.size).toBe(0);
  });

  it('rejects duplicate positions and more than six items', async () => {
    const cache = createCache();
    const maximum = maximumSnapshot('owner-a');

    await expect(
      cache.write('owner-a', {
        ...maximum,
        items: maximum.items.map((item, index) =>
          index === 5 ? { ...item, position: 4 } : item
        ),
      })
    ).rejects.toThrow('snapshot is invalid');
    await expect(
      cache.write('owner-a', {
        ...maximum,
        items: [
          ...maximum.items,
          { ...maximum.items[5], id: 'item-owner-a-6' },
        ],
      })
    ).rejects.toThrow('snapshot is invalid');
    expect(secureStore.values.size).toBe(0);
  });

  it('atomically replaces the previous snapshot and removes stale chunks', async () => {
    const cache = createCache();

    await cache.write('owner-a', snapshot('owner-a', 'Old item'));
    await cache.write('owner-a', snapshot('owner-a', 'Current item'));

    await expect(cache.read('owner-a')).resolves.toMatchObject({
      items: [{ label: 'Current item' }],
    });
    expect(
      [...secureStore.values.keys()].some((key) => key.includes('.cache-1.'))
    ).toBe(false);
  });

  it('rejects cross-owner data before writing anything', async () => {
    const cache = createCache();

    await expect(cache.write('owner-a', snapshot('owner-b'))).rejects.toThrow(
      "another owner's plan"
    );
    expect(secureStore.values.size).toBe(0);
  });

  it('clears malformed cached content instead of returning it', async () => {
    const cache = createCache();
    const key = offlineSafetyPlanCacheKey('owner-a');
    secureStore.values.set(key, '{not-json');

    await expect(cache.read('owner-a')).resolves.toBeNull();
    expect(
      [...secureStore.values.keys()].filter((entry) => entry.startsWith(key))
    ).toEqual([]);
  });

  it('clears every stored form for only the requested owner', async () => {
    const cache = createCache();
    await cache.write('owner-a', snapshot('owner-a'));
    await cache.write('owner-b', snapshot('owner-b'));

    await cache.clear('owner-a');

    await expect(cache.read('owner-a')).resolves.toBeNull();
    await expect(cache.read('owner-b')).resolves.toMatchObject({
      plan: { user_id: 'owner-b' },
    });
    expect(
      [...secureStore.values.keys()].some((key) =>
        key.startsWith(offlineSafetyPlanCacheKey('owner-a'))
      )
    ).toBe(false);
  });
});
