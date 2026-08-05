import {
  createSecureSessionStorage,
  type SecureKeyValueStore,
} from './secure-session-storage';

const CACHE_VERSION = 1;
const CACHE_PREFIX = 'mhtoolkit.safety-plan.v1';
const MAX_CACHE_BYTES = 160_000;

const SAFETY_ITEM_KINDS = new Set([
  'warning_sign',
  'coping_strategy',
  'distraction',
  'safe_environment',
  'support_contact',
  'professional_support',
  'reason_to_live',
  'other',
]);

const PLAN_STATUSES = new Set(['draft', 'active', 'archived']);

export type OfflineSafetyPlan = {
  id: string;
  user_id: string;
  title: string;
  status: 'draft' | 'active' | 'archived';
  created_at: string;
  updated_at: string;
};

export type OfflineSafetyPlanItem = {
  id: string;
  plan_id: string;
  user_id: string;
  item_kind:
    | 'warning_sign'
    | 'coping_strategy'
    | 'distraction'
    | 'safe_environment'
    | 'support_contact'
    | 'professional_support'
    | 'reason_to_live'
    | 'other';
  label: string;
  details: string;
  position: number;
  created_at: string;
  updated_at: string;
};

export type OfflineSafetyPlanSnapshot = {
  plan: OfflineSafetyPlan;
  items: OfflineSafetyPlanItem[];
};

export type CachedSafetyPlanSnapshot = OfflineSafetyPlanSnapshot & {
  savedAt: string;
};

type StoredSafetyPlanSnapshot = OfflineSafetyPlanSnapshot & {
  version: typeof CACHE_VERSION;
  ownerId: string;
  savedAt: string;
};

type OfflineSafetyPlanCacheOptions = {
  secureStore: SecureKeyValueStore;
  now?: () => string;
  createGeneration?: () => string;
  onCleanupError?: (error: unknown) => void;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function assertOwnerId(ownerId: string): void {
  if (!/^[a-z0-9_-]{1,128}$/i.test(ownerId)) {
    throw new Error('Safety plan cache owner is invalid');
  }
}

export function offlineSafetyPlanCacheKey(ownerId: string): string {
  assertOwnerId(ownerId);
  return `${CACHE_PREFIX}.${ownerId}`;
}

function isPlan(value: unknown, ownerId: string): value is OfflineSafetyPlan {
  if (!isRecord(value)) return false;
  return (
    isString(value.id) &&
    value.user_id === ownerId &&
    isString(value.title) &&
    value.title.trim().length >= 1 &&
    value.title.length <= 120 &&
    PLAN_STATUSES.has(String(value.status)) &&
    isString(value.created_at) &&
    isString(value.updated_at)
  );
}

function isItem(
  value: unknown,
  ownerId: string,
  planId: string
): value is OfflineSafetyPlanItem {
  if (!isRecord(value)) return false;
  return (
    isString(value.id) &&
    value.plan_id === planId &&
    value.user_id === ownerId &&
    SAFETY_ITEM_KINDS.has(String(value.item_kind)) &&
    isString(value.label) &&
    value.label.trim().length >= 1 &&
    value.label.length <= 120 &&
    isString(value.details) &&
    value.details.length <= 1000 &&
    Number.isInteger(value.position) &&
    Number(value.position) >= 0 &&
    Number(value.position) <= 5 &&
    isString(value.created_at) &&
    isString(value.updated_at)
  );
}

function isStoredSnapshot(
  value: unknown,
  ownerId: string
): value is StoredSafetyPlanSnapshot {
  if (!isRecord(value) || value.version !== CACHE_VERSION) return false;
  if (value.ownerId !== ownerId || !isString(value.savedAt)) return false;
  const plan = value.plan;
  const items = value.items;
  if (
    !isPlan(plan, ownerId) ||
    !Array.isArray(items) ||
    items.length > 6
  ) {
    return false;
  }
  if (!items.every((item) => isItem(item, ownerId, plan.id))) return false;

  const positions = new Set(items.map((item) => item.position));
  return positions.size === items.length;
}

function assertSnapshotOwner(
  ownerId: string,
  snapshot: OfflineSafetyPlanSnapshot
): void {
  if (
    snapshot.plan.user_id !== ownerId ||
    snapshot.items.some(
      (item) => item.user_id !== ownerId || item.plan_id !== snapshot.plan.id
    )
  ) {
    throw new Error('Safety plan cache cannot store another owner\'s plan');
  }
}

function utf8ByteLength(value: string): number {
  let bytes = 0;
  for (const character of value) {
    const codePoint = character.codePointAt(0) ?? 0;
    bytes += codePoint <= 0x7f ? 1 : codePoint <= 0x7ff ? 2 : codePoint <= 0xffff ? 3 : 4;
  }
  return bytes;
}

export function createOfflineSafetyPlanCache({
  secureStore,
  now = () => new Date().toISOString(),
  createGeneration,
  onCleanupError = () => {},
}: OfflineSafetyPlanCacheOptions) {
  const emptyStore = {
    getItem: async () => null,
    setItem: async () => {},
    removeItem: async () => {},
  };
  const storage = createSecureSessionStorage({
    secureStore,
    legacyStorage: emptyStore,
    createGeneration,
    onCleanupError,
  });

  return {
    async read(ownerId: string): Promise<CachedSafetyPlanSnapshot | null> {
      const key = offlineSafetyPlanCacheKey(ownerId);
      const raw = await storage.getItem(key);
      if (raw === null) return null;

      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        await storage.removeItem(key);
        return null;
      }
      if (!isStoredSnapshot(parsed, ownerId)) {
        await storage.removeItem(key);
        return null;
      }

      return {
        plan: parsed.plan,
        items: [...parsed.items].sort(
          (left, right) => left.position - right.position
        ),
        savedAt: parsed.savedAt,
      };
    },

    async write(
      ownerId: string,
      snapshot: OfflineSafetyPlanSnapshot
    ): Promise<void> {
      const key = offlineSafetyPlanCacheKey(ownerId);
      assertSnapshotOwner(ownerId, snapshot);
      const stored: StoredSafetyPlanSnapshot = {
        version: CACHE_VERSION,
        ownerId,
        savedAt: now(),
        plan: snapshot.plan,
        items: [...snapshot.items].sort(
          (left, right) => left.position - right.position
        ),
      };
      if (!isStoredSnapshot(stored, ownerId)) {
        throw new Error('Safety plan cache snapshot is invalid');
      }
      const serialized = JSON.stringify(stored);
      if (utf8ByteLength(serialized) > MAX_CACHE_BYTES) {
        throw new Error('Safety plan is too large for encrypted offline storage');
      }
      await storage.setItem(key, serialized);
    },

    clear(ownerId: string): Promise<void> {
      return storage.removeItem(offlineSafetyPlanCacheKey(ownerId));
    },
  };
}
