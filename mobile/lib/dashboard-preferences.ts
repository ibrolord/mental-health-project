import AsyncStorage from '@react-native-async-storage/async-storage';

interface PreferenceStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

const LOW_ENERGY_PREFIX = 'mhtoolkit.dashboard.low-energy.';

function lowEnergyKey(ownerKey: string): string {
  return `${LOW_ENERGY_PREFIX}${ownerKey}`;
}

export function createDashboardPreferences(storage: PreferenceStorage) {
  return {
    async readLowEnergyMode(ownerKey: string): Promise<boolean> {
      return (await storage.getItem(lowEnergyKey(ownerKey))) === 'enabled';
    },
    async writeLowEnergyMode(ownerKey: string, enabled: boolean): Promise<void> {
      if (enabled) {
        await storage.setItem(lowEnergyKey(ownerKey), 'enabled');
        return;
      }
      await storage.removeItem(lowEnergyKey(ownerKey));
    },
  };
}

type DashboardPreferences = ReturnType<typeof createDashboardPreferences>;

export function createDashboardPreferenceWriter(
  preferences: DashboardPreferences
) {
  let generation = 0;
  let pending: Promise<void> = Promise.resolve();
  const persistedByOwner = new Map<string, boolean>();

  return {
    hydrate(ownerKey: string, enabled: boolean) {
      generation += 1;
      persistedByOwner.set(ownerKey, enabled);
    },
    invalidate() {
      generation += 1;
    },
    writeLatest(ownerKey: string, enabled: boolean) {
      const requestGeneration = generation + 1;
      generation = requestGeneration;
      let result = {
        current: false,
        persisted: persistedByOwner.get(ownerKey) ?? false,
        error: null as unknown,
      };
      pending = pending.catch(() => undefined).then(async () => {
        if (requestGeneration !== generation) return;
        try {
          await preferences.writeLowEnergyMode(ownerKey, enabled);
          persistedByOwner.set(ownerKey, enabled);
          result = {
            current: requestGeneration === generation,
            persisted: enabled,
            error: null,
          };
        } catch (error) {
          result = {
            current: requestGeneration === generation,
            persisted: persistedByOwner.get(ownerKey) ?? false,
            error,
          };
        }
      });
      return pending.then(() => result);
    },
  };
}

export const dashboardPreferences = createDashboardPreferences(AsyncStorage);
