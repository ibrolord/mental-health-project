export interface AsyncKeyValueStore {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export interface SecureKeyValueStore {
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string): Promise<void>;
  deleteItemAsync(key: string): Promise<void>;
}

interface ActiveManifest {
  state?: 'active';
  generation: string;
  count: number;
}

interface DeletingManifest {
  state: 'deleting';
  generation?: string;
  count?: number;
}

type SecureManifest = ActiveManifest | DeletingManifest;
type ManifestRead =
  | { status: 'missing' }
  | { status: 'invalid' }
  | { status: 'active'; manifest: ActiveManifest }
  | { status: 'deleting'; manifest: DeletingManifest };

interface SecureSessionStorageOptions {
  secureStore: SecureKeyValueStore;
  legacyStorage: AsyncKeyValueStore;
  chunkSize?: number;
  createGeneration?: () => string;
  onCleanupError?: (error: unknown) => void;
}

const DEFAULT_CHUNK_SIZE = 1800;
const MAX_CHUNKS = 100;

function defaultGeneration(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function isValidGeneration(value: unknown): value is string {
  return typeof value === 'string' && /^[a-z0-9-]+$/i.test(value);
}

function isValidCount(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) >= 1 && Number(value) <= MAX_CHUNKS;
}

function utf8ByteLength(character: string): number {
  const codePoint = character.codePointAt(0) ?? 0;
  if (codePoint <= 0x7f) return 1;
  if (codePoint <= 0x7ff) return 2;
  if (codePoint <= 0xffff) return 3;
  return 4;
}

function chunkByUtf8Bytes(value: string, maxBytes: number): string[] {
  if (!value) return [''];

  const chunks: string[] = [];
  let chunk = '';
  let chunkBytes = 0;
  for (const character of value) {
    const characterBytes = utf8ByteLength(character);
    if (characterBytes > maxBytes) {
      throw new Error('Secure session chunk size cannot contain a UTF-8 character');
    }
    if (chunk && chunkBytes + characterBytes > maxBytes) {
      chunks.push(chunk);
      chunk = '';
      chunkBytes = 0;
    }
    chunk += character;
    chunkBytes += characterBytes;
  }
  if (chunk) chunks.push(chunk);
  return chunks;
}

function firstRejected(
  results: PromiseSettledResult<unknown>[]
): PromiseRejectedResult | undefined {
  return results.find(
    (result): result is PromiseRejectedResult => result.status === 'rejected'
  );
}

export function createSecureSessionStorage({
  secureStore,
  legacyStorage,
  chunkSize = DEFAULT_CHUNK_SIZE,
  createGeneration = defaultGeneration,
  onCleanupError = () => {},
}: SecureSessionStorageOptions): AsyncKeyValueStore {
  if (!Number.isSafeInteger(chunkSize) || chunkSize < 1) {
    throw new Error('Secure session chunk size must be a positive integer');
  }

  const queues = new Map<string, Promise<unknown>>();

  function runExclusive<T>(key: string, operation: () => Promise<T>): Promise<T> {
    const previous = queues.get(key) ?? Promise.resolve();
    const current = previous.catch(() => undefined).then(operation);
    queues.set(key, current);
    return current.finally(() => {
      if (queues.get(key) === current) queues.delete(key);
    });
  }

  async function readManifest(key: string): Promise<ManifestRead> {
    const raw = await secureStore.getItemAsync(`${key}.manifest`);
    if (raw === null) return { status: 'missing' };

    try {
      const value = JSON.parse(raw) as SecureManifest;
      if (value.state === 'deleting') {
        const hasGeneration = value.generation !== undefined;
        const hasCount = value.count !== undefined;
        if (
          hasGeneration !== hasCount ||
          (hasGeneration &&
            (!isValidGeneration(value.generation) || !isValidCount(value.count)))
        ) {
          return { status: 'invalid' };
        }
        return { status: 'deleting', manifest: value };
      }

      if (
        value.state !== undefined &&
        value.state !== 'active'
      ) {
        return { status: 'invalid' };
      }
      if (!isValidGeneration(value.generation) || !isValidCount(value.count)) {
        return { status: 'invalid' };
      }
      return { status: 'active', manifest: value };
    } catch {
      return { status: 'invalid' };
    }
  }

  function manifestGeneration(manifestRead: ManifestRead): ActiveManifest | null {
    if (manifestRead.status === 'active') return manifestRead.manifest;
    if (
      manifestRead.status === 'deleting' &&
      manifestRead.manifest.generation !== undefined &&
      manifestRead.manifest.count !== undefined
    ) {
      return {
        generation: manifestRead.manifest.generation,
        count: manifestRead.manifest.count,
      };
    }
    return null;
  }

  async function deleteGeneration(
    key: string,
    manifest: ActiveManifest | null
  ): Promise<void> {
    if (!manifest) return;
    const results = await Promise.allSettled(
      Array.from({ length: manifest.count }, (_, index) =>
        secureStore.deleteItemAsync(`${key}.${manifest.generation}.${index}`)
      )
    );
    const failure = firstRejected(results);
    if (failure) throw failure.reason;
  }

  async function getItemUnlocked(key: string): Promise<string | null> {
    const manifestRead = await readManifest(key);
    if (manifestRead.status === 'invalid') {
      throw new Error('Secure session manifest is invalid');
    }
    if (manifestRead.status === 'deleting') return null;
    if (manifestRead.status === 'active') {
      const { manifest } = manifestRead;
      const chunks = await Promise.all(
        Array.from({ length: manifest.count }, (_, index) =>
          secureStore.getItemAsync(`${key}.${manifest.generation}.${index}`)
        )
      );
      if (chunks.some((chunk) => chunk === null)) {
        throw new Error('Secure session generation is incomplete');
      }
      return chunks.join('');
    }

    const existingSecureValue = await secureStore.getItemAsync(key);
    if (existingSecureValue !== null) return existingSecureValue;

    const legacyValue = await legacyStorage.getItem(key);
    if (legacyValue === null) return null;
    await setItemUnlocked(key, legacyValue);
    return legacyValue;
  }

  async function setItemUnlocked(key: string, value: string): Promise<void> {
    const previousRead = await readManifest(key);
    if (previousRead.status === 'invalid') {
      throw new Error('Secure session manifest is invalid');
    }
    const previous = manifestGeneration(previousRead);
    const generation = createGeneration();
    if (!isValidGeneration(generation)) {
      throw new Error('Secure session generation is invalid');
    }
    if (generation === previous?.generation) {
      throw new Error('Secure session generation must be unique');
    }

    const chunks = chunkByUtf8Bytes(value, chunkSize);
    if (chunks.length > MAX_CHUNKS) {
      throw new Error('Secure session value exceeds the supported size');
    }
    const next = { state: 'active', generation, count: chunks.length } satisfies ActiveManifest;

    const writes = await Promise.allSettled(
      chunks.map((chunk, index) =>
        secureStore.setItemAsync(`${key}.${generation}.${index}`, chunk)
      )
    );
    let failure = firstRejected(writes);
    let verificationError: Error | undefined;
    if (!failure) {
      const reads = await Promise.allSettled(
        chunks.map((_, index) =>
          secureStore.getItemAsync(`${key}.${generation}.${index}`)
        )
      );
      failure = firstRejected(reads);
      if (
        !failure &&
        reads.some(
          (result) => result.status !== 'fulfilled' || result.value === null
        )
      ) {
        verificationError = new Error('Secure session write verification failed');
      } else if (
        !failure &&
        reads.map((result) =>
          result.status === 'fulfilled' ? result.value : ''
        ).join('') !== value
      ) {
        verificationError = new Error('Secure session write verification failed');
      }
    }

    if (failure || verificationError) {
      await deleteGeneration(key, next).catch(onCleanupError);
      if (failure) throw failure.reason;
      throw verificationError;
    }

    try {
      // This small pointer is the commit point. The previous generation remains
      // readable until every new chunk has been written and verified.
      await secureStore.setItemAsync(`${key}.manifest`, JSON.stringify(next));
    } catch (commitError) {
      await deleteGeneration(key, next).catch(onCleanupError);
      throw commitError;
    }

    const cleanup = await Promise.allSettled([
      deleteGeneration(key, previous),
      secureStore.deleteItemAsync(key),
      legacyStorage.removeItem(key),
    ]);
    for (const result of cleanup) {
      if (result.status === 'rejected') onCleanupError(result.reason);
    }
  }

  async function removeItemUnlocked(key: string): Promise<void> {
    const manifestRead = await readManifest(key);
    const generation = manifestGeneration(manifestRead);
    const tombstone: DeletingManifest = generation
      ? {
          state: 'deleting',
          generation: generation.generation,
          count: generation.count,
        }
      : { state: 'deleting' };

    // The durable tombstone prevents old unchunked or legacy credentials from
    // becoming readable if any cleanup step fails.
    await secureStore.setItemAsync(`${key}.manifest`, JSON.stringify(tombstone));
    const cleanup = await Promise.allSettled([
      deleteGeneration(key, generation),
      secureStore.deleteItemAsync(key),
      legacyStorage.removeItem(key),
    ]);
    const cleanupFailure = firstRejected(cleanup);
    if (cleanupFailure) throw cleanupFailure.reason;

    // The credentials are already gone. A retained tombstone is inert and is
    // safer than reporting that account cleanup failed after it succeeded.
    try {
      await secureStore.deleteItemAsync(`${key}.manifest`);
    } catch (error) {
      onCleanupError(error);
    }
  }

  return {
    getItem: (key) => runExclusive(key, () => getItemUnlocked(key)),
    setItem: (key, value) => runExclusive(key, () => setItemUnlocked(key, value)),
    removeItem: (key) => runExclusive(key, () => removeItemUnlocked(key)),
  };
}
