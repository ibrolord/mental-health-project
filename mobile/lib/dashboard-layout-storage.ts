import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  defaultDashboardLayout,
  normalizeDashboardLayout,
  type DashboardLayout,
} from './dashboard-layout';

interface LayoutStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

const LAYOUT_PREFIX = 'mhtoolkit.dashboard.layout.';

function layoutKey(ownerKey: string): string {
  return `${LAYOUT_PREFIX}${ownerKey}`;
}

export function createDashboardLayoutStorage(storage: LayoutStorage) {
  return {
    async readLayout(ownerKey: string): Promise<DashboardLayout> {
      const storedValue = await storage.getItem(layoutKey(ownerKey));
      if (!storedValue) return defaultDashboardLayout();

      let parsed: unknown;
      try {
        parsed = JSON.parse(storedValue);
      } catch {
        parsed = null;
      }

      const layout = normalizeDashboardLayout(parsed);
      const normalizedValue = JSON.stringify(layout);
      if (normalizedValue !== storedValue) {
        await storage.setItem(layoutKey(ownerKey), normalizedValue);
      }
      return layout;
    },

    async writeLayout(ownerKey: string, layout: DashboardLayout): Promise<void> {
      await storage.setItem(
        layoutKey(ownerKey),
        JSON.stringify(normalizeDashboardLayout(layout))
      );
    },
  };
}

export const dashboardLayoutStorage = createDashboardLayoutStorage(AsyncStorage);

export function createDashboardLayoutWriter(
  storage: ReturnType<typeof createDashboardLayoutStorage>
) {
  const generations = new Map<string, number>();
  let pending: Promise<void> = Promise.resolve();

  return {
    writeLatest(ownerKey: string, layout: DashboardLayout) {
      const generation = (generations.get(ownerKey) ?? 0) + 1;
      generations.set(ownerKey, generation);
      let result = { current: false, error: null as unknown };

      pending = pending.catch(() => undefined).then(async () => {
        if (generations.get(ownerKey) !== generation) return;
        try {
          await storage.writeLayout(ownerKey, layout);
          result = {
            current: generations.get(ownerKey) === generation,
            error: null,
          };
        } catch (error) {
          result = {
            current: generations.get(ownerKey) === generation,
            error,
          };
        }
      });

      return pending.then(() => result);
    },
  };
}

export const dashboardLayoutWriter = createDashboardLayoutWriter(
  dashboardLayoutStorage
);
