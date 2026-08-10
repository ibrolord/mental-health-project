import AsyncStorage from '@react-native-async-storage/async-storage';

interface PreferenceStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

type PreferenceListener = (enabled: boolean) => void;

const APPLE_HEALTH_PREFIX = 'mhtoolkit.apple-health.enabled.';

function preferenceKey(ownerId: string): string {
  const normalized = ownerId.trim();
  if (!normalized) throw new Error('An owner is required for Apple Health settings.');
  return `${APPLE_HEALTH_PREFIX}${normalized}`;
}

export function createAppleHealthPreference(storage: PreferenceStorage) {
  const listeners = new Map<string, Set<PreferenceListener>>();
  const notify = (ownerId: string, enabled: boolean) => {
    for (const listener of listeners.get(ownerId) ?? []) listener(enabled);
  };

  return {
    async read(ownerId: string): Promise<boolean> {
      return (await storage.getItem(preferenceKey(ownerId))) === 'enabled';
    },

    async write(ownerId: string, enabled: boolean): Promise<void> {
      const key = preferenceKey(ownerId);
      const normalizedOwnerId = ownerId.trim();
      if (enabled) {
        await storage.setItem(key, 'enabled');
      } else {
        await storage.removeItem(key);
      }
      notify(normalizedOwnerId, enabled);
    },

    async clear(ownerId: string): Promise<void> {
      await storage.removeItem(preferenceKey(ownerId));
      notify(ownerId.trim(), false);
    },

    subscribe(ownerId: string, listener: PreferenceListener): () => void {
      preferenceKey(ownerId);
      const normalizedOwnerId = ownerId.trim();
      const ownerListeners = listeners.get(normalizedOwnerId) ?? new Set<PreferenceListener>();
      ownerListeners.add(listener);
      listeners.set(normalizedOwnerId, ownerListeners);
      return () => {
        ownerListeners.delete(listener);
        if (ownerListeners.size === 0) listeners.delete(normalizedOwnerId);
      };
    },
  };
}

export const appleHealthPreference = createAppleHealthPreference(AsyncStorage);
