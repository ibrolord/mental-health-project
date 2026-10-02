import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  defaultAdvisorProfile,
  hasUnsupportedAdvisorProfileVersion,
  normalizeAdvisorProfile,
  type AdvisorProfile,
} from './advisor-profile';

const PREFIX = 'mhtoolkit.advisor.profile.v1:';
const MIGRATION_FIELD = '_ownerMigration';

type ProvisionalMigration = {
  version: 1;
  sourceOwnerKey: string;
  scope: 'profile' | 'personalPlan';
};

type Storage = Pick<typeof AsyncStorage, 'getItem' | 'setItem' | 'removeItem'>;
type MigrationFinalization = 'complete' | 'retry-required';

function key(ownerKey: string): string {
  return `${PREFIX}${encodeURIComponent(ownerKey)}`;
}

function parseMigrationProfile(raw: string): Record<string, unknown> {
  const parsed: unknown = JSON.parse(raw);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Advisor setup could not be migrated.');
  }
  if (hasUnsupportedAdvisorProfileVersion(parsed)) {
    throw new Error('Advisor setup was saved by a newer app version.');
  }
  return parsed as Record<string, unknown>;
}

function provisionalMigration(profile: Record<string, unknown>): ProvisionalMigration | null {
  if (!Object.prototype.hasOwnProperty.call(profile, MIGRATION_FIELD)) return null;
  const value = profile[MIGRATION_FIELD];
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Advisor migration could not be recovered.');
  }
  const marker = value as Record<string, unknown>;
  if (marker.version !== 1 || typeof marker.sourceOwnerKey !== 'string' ||
      !marker.sourceOwnerKey || (marker.scope !== 'profile' && marker.scope !== 'personalPlan')) {
    throw new Error('Advisor migration could not be recovered.');
  }
  return marker as ProvisionalMigration;
}

function serialize(profile: AdvisorProfile, migration?: ProvisionalMigration): string {
  return JSON.stringify(migration ? { ...profile, [MIGRATION_FIELD]: migration } : profile);
}

export function createAdvisorProfileStorage(storage: Storage) {
  const listeners = new Map<string, Set<(profile: AdvisorProfile | null) => void>>();
  const mutations = new Map<string, Promise<void>>();
  const revisions = new Map<string, symbol>();
  const publishedCopies = new Map<string, string>();
  const notify = (ownerKey: string, profile: AdvisorProfile | null) => {
    for (const listener of listeners.get(ownerKey) ?? []) listener(profile);
  };

  function mutate<T>(ownerKeys: string[], operation: () => Promise<T>): Promise<T> {
    const owners = [...new Set(ownerKeys)];
    const result = Promise.all(owners.map((owner) => mutations.get(owner))).then(operation);
    const settled = result.then(() => {}, () => {});
    // Reserve every owner synchronously, so overlapping migrations cannot deadlock.
    for (const owner of owners) mutations.set(owner, settled);
    void settled.then(() => {
      for (const owner of owners) {
        if (mutations.get(owner) === settled) mutations.delete(owner);
      }
    });
    return result;
  }

  // Only call these helpers inside mutate; queuing again would wait on our own lock.
  async function persist(
    ownerKey: string,
    normalized: AdvisorProfile,
    migration?: ProvisionalMigration
  ): Promise<AdvisorProfile> {
    // The profile and provenance share one atomic storage write. Explicit saves omit
    // provenance, even when the user saves identical values, and become authoritative.
    await storage.setItem(key(ownerKey), serialize(normalized, migration));
    revisions.set(ownerKey, Symbol());
    notify(ownerKey, normalized);
    if (migration) publishedCopies.set(ownerKey, serialize(normalized, migration));
    else publishedCopies.delete(ownerKey);
    return normalized;
  }

  async function remove(ownerKey: string): Promise<void> {
    await storage.removeItem(key(ownerKey));
    revisions.set(ownerKey, Symbol());
    publishedCopies.delete(ownerKey);
    notify(ownerKey, null);
  }

  const store = {
    async read(ownerKey: string): Promise<AdvisorProfile> {
      const raw = await storage.getItem(key(ownerKey));
      if (!raw) return defaultAdvisorProfile();
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        return defaultAdvisorProfile();
      }
      if (hasUnsupportedAdvisorProfileVersion(parsed)) {
        throw new Error('Advisor setup was saved by a newer app version.');
      }
      return normalizeAdvisorProfile(parsed);
    },
    async write(ownerKey: string, profile: AdvisorProfile): Promise<AdvisorProfile> {
      const normalized = normalizeAdvisorProfile(profile);
      return mutate([ownerKey], () => persist(ownerKey, normalized));
    },
    async clear(ownerKey: string): Promise<void> {
      return mutate([ownerKey], () => remove(ownerKey));
    },
    async migrateOwner(sourceOwnerKey: string, targetOwnerKey: string): Promise<() => Promise<MigrationFinalization>> {
      if (sourceOwnerKey === targetOwnerKey) return async () => 'complete';
      return mutate([sourceOwnerKey, targetOwnerKey], async () => {
        const sourceRaw = await storage.getItem(key(sourceOwnerKey));
        const targetRaw = await storage.getItem(key(targetOwnerKey));
        const target = targetRaw === null ? null : parseMigrationProfile(targetRaw);
        const pending = target && provisionalMigration(target);
        if (sourceRaw === null) {
          // Recover a crash after source removal but before provenance cleanup.
          if (pending?.sourceOwnerKey === sourceOwnerKey && target) {
            const normalized = normalizeAdvisorProfile(target);
            if (publishedCopies.get(targetOwnerKey) !== targetRaw) notify(targetOwnerKey, normalized);
            await storage.setItem(key(targetOwnerKey), serialize(normalized));
            publishedCopies.delete(targetOwnerKey);
          }
          return () => mutate([sourceOwnerKey, targetOwnerKey], async () =>
            await storage.getItem(key(sourceOwnerKey)) === null ? 'complete' : 'retry-required');
        }
        if (pending && pending.sourceOwnerKey !== sourceOwnerKey) {
          throw new Error('Another Advisor profile migration is still pending.');
        }
        let sourceRevision = revisions.get(sourceOwnerKey);
        let sourceSnapshot = sourceRaw;
        const source = parseMigrationProfile(sourceRaw);
        const scope = pending?.scope ?? (target === null ? 'profile' :
          !Object.prototype.hasOwnProperty.call(target, 'personalPlan') &&
          Object.prototype.hasOwnProperty.call(source, 'personalPlan') ? 'personalPlan' : null);
        let copiedRaw = targetRaw;
        if (scope) {
          const normalized = normalizeAdvisorProfile(scope === 'profile' ? source : {
            ...target,
            personalPlan: normalizeAdvisorProfile(source).personalPlan,
          });
          const marker: ProvisionalMigration = { version: 1, sourceOwnerKey, scope };
          copiedRaw = serialize(normalized, marker);
          if (copiedRaw !== targetRaw) await persist(targetOwnerKey, normalized, marker);
          else if (publishedCopies.get(targetOwnerKey) !== copiedRaw) {
            // setItem may commit before reporting a failure. Reuse the durable copy,
            // but still publish it if this instance never acknowledged that write.
            notify(targetOwnerKey, normalized);
            publishedCopies.set(targetOwnerKey, copiedRaw);
          }
        }
        let finalized = false;
        // The caller finalizes only after all local stores migrate successfully.
        return () => mutate([sourceOwnerKey, targetOwnerKey], async () => {
          if (finalized) return 'complete';
          const currentSourceRaw = await storage.getItem(key(sourceOwnerKey));
          const currentTargetRaw = await storage.getItem(key(targetOwnerKey));
          // A cleared destination is not a safe copy. Never delete the only profile.
          if (currentSourceRaw === null || currentTargetRaw === null) return 'retry-required';
          const currentTarget = parseMigrationProfile(currentTargetRaw);
          const currentPending = provisionalMigration(currentTarget);
          if (currentPending && (currentPending.sourceOwnerKey !== sourceOwnerKey ||
              currentTargetRaw !== copiedRaw)) return 'retry-required';
          const currentSourceRevision = revisions.get(sourceOwnerKey);
          if (currentSourceRevision !== sourceRevision || currentSourceRaw !== sourceSnapshot) {
            const latestSource = parseMigrationProfile(currentSourceRaw);
            // Refresh only our unchanged provisional copy. An explicit target save
            // has no marker and stays authoritative, even when its plan is empty.
            if (currentPending) {
              const normalized = normalizeAdvisorProfile(currentPending.scope === 'profile' ? latestSource : {
                ...currentTarget,
                personalPlan: normalizeAdvisorProfile(latestSource).personalPlan,
              });
              const refreshedRaw = serialize(normalized, currentPending);
              if (refreshedRaw !== currentTargetRaw) await persist(targetOwnerKey, normalized, currentPending);
              copiedRaw = refreshedRaw;
            }
            sourceSnapshot = currentSourceRaw;
            sourceRevision = currentSourceRevision;
            // Notifications can queue another source save. Recheck under the owner
            // locks on a bounded caller retry instead of declaring success here.
            return 'retry-required';
          }
          await remove(sourceOwnerKey);
          // Remove the source first: failure or interruption leaves provenance intact
          // so a retained, edited source can still refresh the copy on the next retry.
          if (currentPending) {
            await storage.setItem(key(targetOwnerKey), serialize(normalizeAdvisorProfile(currentTarget)));
          }
          publishedCopies.delete(targetOwnerKey);
          finalized = true;
          return 'complete';
        });
      });
    },
    subscribe(ownerKey: string, listener: (profile: AdvisorProfile | null) => void): () => void {
      const ownerListeners = listeners.get(ownerKey) ?? new Set();
      ownerListeners.add(listener);
      listeners.set(ownerKey, ownerListeners);
      return () => {
        ownerListeners.delete(listener);
        if (ownerListeners.size === 0) listeners.delete(ownerKey);
      };
    },
  };
  return store;
}

export const advisorProfileStorage = createAdvisorProfileStorage(AsyncStorage);

export function advisorProfileStorageKey(ownerKey: string): string {
  return key(ownerKey);
}
