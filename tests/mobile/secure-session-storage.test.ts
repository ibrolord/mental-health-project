import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createSecureSessionStorage,
  type AsyncKeyValueStore,
  type SecureKeyValueStore,
} from '../../mobile/lib/secure-session-storage';

class MemoryLegacyStore implements AsyncKeyValueStore {
  values = new Map<string, string>();
  failRemoveFor = new Set<string>();

  async getItem(key: string): Promise<string | null> {
    return this.values.get(key) ?? null;
  }

  async setItem(key: string, value: string): Promise<void> {
    this.values.set(key, value);
  }

  async removeItem(key: string): Promise<void> {
    if (this.failRemoveFor.has(key)) throw new Error(`legacy delete failed: ${key}`);
    this.values.delete(key);
  }
}

class MemorySecureStore implements SecureKeyValueStore {
  values = new Map<string, string>();
  failSetFor = new Set<string>();
  rejectSetFor = new Map<string, unknown>();
  failDeleteFor = new Set<string>();
  corruptReadFor = new Map<string, string | null>();
  waitSetFor = new Map<string, Promise<void>>();
  setCalls: string[] = [];

  async getItemAsync(key: string): Promise<string | null> {
    if (this.corruptReadFor.has(key)) return this.corruptReadFor.get(key) ?? null;
    return this.values.get(key) ?? null;
  }

  async setItemAsync(key: string, value: string): Promise<void> {
    this.setCalls.push(key);
    await this.waitSetFor.get(key);
    if (this.rejectSetFor.has(key)) throw this.rejectSetFor.get(key);
    if (this.failSetFor.has(key)) throw new Error(`set failed: ${key}`);
    this.values.set(key, value);
  }

  async deleteItemAsync(key: string): Promise<void> {
    if (this.failDeleteFor.has(key)) throw new Error(`delete failed: ${key}`);
    this.values.delete(key);
  }
}

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

describe('iOS secure session storage', () => {
  let secure: MemorySecureStore;
  let legacy: MemoryLegacyStore;
  let generation: number;

  beforeEach(() => {
    secure = new MemorySecureStore();
    legacy = new MemoryLegacyStore();
    generation = 0;
  });

  const makeStorage = (onCleanupError = vi.fn(), chunkSize = 8) =>
    createSecureSessionStorage({
      secureStore: secure,
      legacyStorage: legacy,
      chunkSize,
      createGeneration: () => `generation-${++generation}`,
      onCleanupError,
    });

  it('round-trips sessions larger than the iOS SecureStore item limit', async () => {
    const storage = makeStorage(vi.fn(), 1800);
    const value = JSON.stringify({ access_token: 'a'.repeat(6000), refresh_token: 'r'.repeat(900) });

    await storage.setItem('auth', value);

    expect(await storage.getItem('auth')).toBe(value);
    expect([...secure.values.keys()].filter((key) => /^auth\.generation-1\.\d+$/.test(key)))
      .toHaveLength(Math.ceil(value.length / 1800));
  });

  it('limits chunks by UTF-8 bytes rather than JavaScript characters', async () => {
    const storage = makeStorage();
    const value = JSON.stringify({ name: 'Adebayo 🌍 café Đặng'.repeat(12) });

    await storage.setItem('auth', value);

    expect(await storage.getItem('auth')).toBe(value);
    const chunks = [...secure.values.entries()]
      .filter(([key]) => /^auth\.generation-1\.\d+$/.test(key))
      .map(([, chunk]) => chunk);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((chunk) => Buffer.byteLength(chunk, 'utf8') <= 8)).toBe(true);
  });

  it('rotates repeated token refreshes without retaining stale generations', async () => {
    const storage = makeStorage();

    for (let index = 0; index < 100; index += 1) {
      const value = `access-${index}-${'x'.repeat((index % 7) * 11)}`;
      await storage.setItem('auth', value);
      expect(await storage.getItem('auth')).toBe(value);
    }

    const manifest = JSON.parse(secure.values.get('auth.manifest') || '{}') as {
      generation?: string;
    };
    const chunkKeys = [...secure.values.keys()].filter((key) =>
      /^auth\.generation-\d+\.\d+$/.test(key)
    );
    expect(chunkKeys.every((key) => key.startsWith(`auth.${manifest.generation}.`)))
      .toBe(true);
  });

  it('preserves the previous committed session when a chunk write fails', async () => {
    const storage = makeStorage();
    await storage.setItem('auth', 'previous-session');
    secure.failSetFor.add('auth.generation-2.1');

    await expect(storage.setItem('auth', 'replacement-session')).rejects.toThrow('set failed');

    expect(await storage.getItem('auth')).toBe('previous-session');
    expect([...secure.values.keys()].some((key) => key.startsWith('auth.generation-2.')))
      .toBe(false);
  });

  it('waits for late native writes before cleaning a failed generation', async () => {
    const storage = makeStorage();
    const delayed = deferred();
    secure.waitSetFor.set('auth.generation-1.0', delayed.promise);
    secure.failSetFor.add('auth.generation-1.1');

    const write = storage.setItem('auth', 'session-value');
    await vi.waitFor(() => {
      expect(secure.setCalls).toContain('auth.generation-1.1');
    });
    delayed.resolve();

    await expect(write).rejects.toThrow('set failed');
    expect([...secure.values.keys()].some((key) => key.startsWith('auth.generation-1.')))
      .toBe(false);
  });

  it('treats an empty native rejection reason as a failed chunk write', async () => {
    const storage = makeStorage();
    secure.rejectSetFor.set('auth.generation-1.1', undefined);

    await expect(storage.setItem('auth', 'session-value')).rejects.toBeUndefined();
    expect(secure.values.has('auth.manifest')).toBe(false);
    expect([...secure.values.keys()].some((key) => key.startsWith('auth.generation-1.')))
      .toBe(false);
  });

  it('preserves the previous session when manifest commit fails', async () => {
    const storage = makeStorage();
    await storage.setItem('auth', 'previous-session');
    secure.failSetFor.add('auth.manifest');

    await expect(storage.setItem('auth', 'replacement-session')).rejects.toThrow('set failed');

    secure.failSetFor.delete('auth.manifest');
    expect(await storage.getItem('auth')).toBe('previous-session');
    expect([...secure.values.keys()].some((key) => key.startsWith('auth.generation-2.')))
      .toBe(false);
  });

  it('rejects a session whose committed chunks cannot be verified', async () => {
    const storage = makeStorage();
    secure.corruptReadFor.set('auth.generation-1.1', 'tampered');

    await expect(storage.setItem('auth', 'session-value')).rejects.toThrow(
      'Secure session write verification failed'
    );
    expect(await storage.getItem('auth')).toBeNull();
  });

  it('fails closed when a committed generation is missing a chunk', async () => {
    const storage = makeStorage();
    await storage.setItem('auth', 'session-value');
    secure.values.delete('auth.generation-1.1');

    await expect(storage.getItem('auth')).rejects.toThrow('generation is incomplete');
  });

  it('does not roll back to stale storage when the manifest is malformed', async () => {
    const storage = makeStorage();
    secure.values.set('auth.manifest', '{not-json');
    secure.values.set('auth', 'stale-secure-session');
    legacy.values.set('auth', 'stale-legacy-session');

    await expect(storage.getItem('auth')).rejects.toThrow('manifest is invalid');
  });

  it('rejects values that cannot fit in a valid manifest before writing chunks', async () => {
    const storage = makeStorage();

    await expect(storage.setItem('auth', 'x'.repeat(801))).rejects.toThrow(
      'exceeds the supported size'
    );
    expect([...secure.values.keys()].some((key) => key.startsWith('auth.generation-1.')))
      .toBe(false);
  });

  it('atomically migrates a legacy AsyncStorage session', async () => {
    const storage = makeStorage();
    legacy.values.set('auth', 'legacy-session');

    expect(await storage.getItem('auth')).toBe('legacy-session');
    expect(legacy.values.has('auth')).toBe(false);
    expect(await storage.getItem('auth')).toBe('legacy-session');
  });

  it('serializes reads behind an in-progress token write', async () => {
    const storage = makeStorage();
    const delayed = deferred();
    secure.waitSetFor.set('auth.generation-1.0', delayed.promise);

    const write = storage.setItem('auth', 'new-session');
    const read = storage.getItem('auth');
    delayed.resolve();

    await expect(write).resolves.toBeUndefined();
    await expect(read).resolves.toBe('new-session');
  });

  it('round-trips empty values instead of treating them as missing', async () => {
    const storage = makeStorage();

    await storage.setItem('auth', '');

    await expect(storage.getItem('auth')).resolves.toBe('');
  });

  it('removes stale unchunked storage after a successful token rotation', async () => {
    const storage = makeStorage();
    secure.values.set('auth', 'old-secure-session');
    legacy.values.set('auth', 'old-legacy-session');

    await storage.setItem('auth', 'rotated-session');

    expect(secure.values.has('auth')).toBe(false);
    expect(legacy.values.has('auth')).toBe(false);
    expect(await storage.getItem('auth')).toBe('rotated-session');
  });

  it('removes committed, unchunked, and legacy session forms', async () => {
    const storage = makeStorage();
    await storage.setItem('auth', 'current-session');
    secure.values.set('auth', 'old-secure-session');
    legacy.values.set('auth', 'old-async-session');

    await storage.removeItem('auth');

    expect(await storage.getItem('auth')).toBeNull();
    expect([...secure.values.keys()].filter((key) => key.startsWith('auth'))).toEqual([]);
    expect(legacy.values.has('auth')).toBe(false);
  });

  it.each(['generation', 'secure', 'legacy'] as const)(
    'retains a deletion tombstone when %s cleanup fails',
    async (failure) => {
      const storage = makeStorage();
      await storage.setItem('auth', 'current-session');
      secure.values.set('auth', 'old-secure-session');
      legacy.values.set('auth', 'old-legacy-session');

      if (failure === 'generation') secure.failDeleteFor.add('auth.generation-1.0');
      if (failure === 'secure') secure.failDeleteFor.add('auth');
      if (failure === 'legacy') legacy.failRemoveFor.add('auth');
      await expect(storage.removeItem('auth')).rejects.toThrow('failed');
      expect(JSON.parse(secure.values.get('auth.manifest') || '{}')).toMatchObject({
        state: 'deleting',
      });
      await expect(storage.getItem('auth')).resolves.toBeNull();

      secure.failDeleteFor.clear();
      legacy.failRemoveFor.clear();
      await expect(storage.removeItem('auth')).resolves.toBeUndefined();
      await expect(storage.getItem('auth')).resolves.toBeNull();
    }
  );

  it('reports manifest tombstone cleanup without failing completed deletion', async () => {
    const onCleanupError = vi.fn();
    const storage = makeStorage(onCleanupError);
    await storage.setItem('auth', 'current-session');
    secure.failDeleteFor.add('auth.manifest');

    await expect(storage.removeItem('auth')).resolves.toBeUndefined();
    await expect(storage.getItem('auth')).resolves.toBeNull();
    expect(onCleanupError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'delete failed: auth.manifest' })
    );
  });

  it('rejects a generation collision without deleting the active session', async () => {
    const storage = createSecureSessionStorage({
      secureStore: secure,
      legacyStorage: legacy,
      chunkSize: 8,
      createGeneration: () => 'same-generation',
    });
    await storage.setItem('auth', 'current-session');

    await expect(storage.setItem('auth', 'replacement-session')).rejects.toThrow(
      'generation must be unique'
    );
    await expect(storage.getItem('auth')).resolves.toBe('current-session');
  });

  it('rejects invalid chunk sizes and generation names', async () => {
    expect(() =>
      createSecureSessionStorage({
        secureStore: secure,
        legacyStorage: legacy,
        chunkSize: 0,
      })
    ).toThrow('positive integer');

    const storage = createSecureSessionStorage({
      secureStore: secure,
      legacyStorage: legacy,
      createGeneration: () => '../invalid',
    });
    await expect(storage.setItem('auth', 'session')).rejects.toThrow('generation is invalid');
  });
});
