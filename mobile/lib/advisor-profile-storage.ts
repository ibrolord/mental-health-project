import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  defaultAdvisorProfile,
  hasUnsupportedAdvisorProfileVersion,
  normalizeAdvisorProfile,
  type AdvisorProfile,
} from './advisor-profile';

const PREFIX = 'mhtoolkit.advisor.profile.v1:';

type Storage = Pick<typeof AsyncStorage, 'getItem' | 'setItem' | 'removeItem'>;

function key(ownerKey: string): string {
  return `${PREFIX}${encodeURIComponent(ownerKey)}`;
}

export function createAdvisorProfileStorage(storage: Storage) {
  const listeners = new Map<string, Set<(profile: AdvisorProfile | null) => void>>();
  const notify = (ownerKey: string, profile: AdvisorProfile | null) => {
    for (const listener of listeners.get(ownerKey) ?? []) listener(profile);
  };
  return {
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
      await storage.setItem(key(ownerKey), JSON.stringify(normalized));
      notify(ownerKey, normalized);
      return normalized;
    },
    async clear(ownerKey: string): Promise<void> {
      await storage.removeItem(key(ownerKey));
      notify(ownerKey, null);
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
}

export const advisorProfileStorage = createAdvisorProfileStorage(AsyncStorage);

export function advisorProfileStorageKey(ownerKey: string): string {
  return key(ownerKey);
}
