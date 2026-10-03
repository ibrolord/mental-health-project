import type { AdvisorActionInstance } from './advisor-action-storage';

export type AdvisorClientPreferences = {
  enabled: boolean;
  quietStartHour: number;
  quietEndHour: number;
  pausedUntil: string | null;
};

export const DEFAULT_ADVISOR_CLIENT_PREFERENCES: AdvisorClientPreferences = {
  enabled: false, quietStartHour: 21, quietEndHour: 8, pausedUntil: null,
};

export function parseAdvisorClientPreferences(raw: string | null): AdvisorClientPreferences {
  try {
    const value: unknown = JSON.parse(raw ?? 'null');
    if (!value || typeof value !== 'object') return { ...DEFAULT_ADVISOR_CLIENT_PREFERENCES };
    const prefs = value as Record<string, unknown>;
    const validHour = (hour: unknown): hour is number => typeof hour === 'number' && Number.isInteger(hour) && hour >= 0 && hour <= 23;
    if (typeof prefs.enabled !== 'boolean' || !validHour(prefs.quietStartHour) || !validHour(prefs.quietEndHour) ||
      prefs.quietStartHour === prefs.quietEndHour ||
      (prefs.pausedUntil !== null && (typeof prefs.pausedUntil !== 'string' || !Number.isFinite(Date.parse(prefs.pausedUntil))))) {
      return { ...DEFAULT_ADVISOR_CLIENT_PREFERENCES };
    }
    return prefs as AdvisorClientPreferences;
  } catch { return { ...DEFAULT_ADVISOR_CLIENT_PREFERENCES }; }
}

export function advisorClientIsActive(prefs: AdvisorClientPreferences, now: Date) {
  return prefs.enabled && (!prefs.pausedUntil || Date.parse(prefs.pausedUntil) <= now.getTime());
}

export type AdvisorClientSnapshot = {
  action: AdvisorActionInstance | null;
  safety: boolean;
  targetCompleted: boolean;
};

export async function loadAdvisorClientSnapshot(
  remote: () => Promise<AdvisorClientSnapshot>,
  localAction: () => Promise<AdvisorActionInstance | null>,
  timeoutMs = 4_000,
): Promise<AdvisorClientSnapshot> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      remote(),
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('Context unavailable')), timeoutMs); }),
    ]);
  } catch {
    // A previously started step can still have a local reminder while offline.
    // No new recommendation or completion is inferred from missing remote data.
    return { action: await localAction(), safety: false, targetCompleted: false };
  } finally { if (timer) clearTimeout(timer); }
}

type Dependencies = {
  currentOwner: () => Promise<string | null>;
  read: (owner: string) => Promise<AdvisorClientPreferences>;
  write: (owner: string, preferences: AdvisorClientPreferences) => Promise<void>;
  load: (owner: string) => Promise<AdvisorClientSnapshot>;
  loadAction: (owner: string) => Promise<AdvisorActionInstance | null>;
  refreshCompletions: (owner: string) => Promise<void>;
  complete: (owner: string, action: AdvisorActionInstance) => Promise<void>;
  schedule: (input: {ownerKey: string; actionId: string; followUpAt: string; quietStartHour: number; quietEndHour: number}, isCurrent: () => Promise<boolean>) => Promise<unknown>;
  cancel: (owner: string) => Promise<void>;
  clearHistory: (owner: string) => Promise<void>;
  syncBackground: (enabled: boolean) => Promise<unknown>;
  emit: (owner: string, kind: 'changed' | 'refreshed') => void;
  now?: () => Date;
};

export function createAdvisorClientCoordinator(deps: Dependencies) {
  let queue: Promise<unknown> = Promise.resolve();
  const generations = new Map<string, number>();
  const refreshVersions = new Map<string, number>();
  const suspended = new Set<string>();
  const now = deps.now ?? (() => new Date());
  const serialize = <T>(operation: () => Promise<T>): Promise<T> => {
    const result = queue.then(operation, operation);
    queue = result.catch(() => {});
    return result;
  };
  const invalidate = (owner: string) => generations.set(owner, (generations.get(owner) ?? 0) + 1);

  async function applyReminder(owner: string, prefs: AdvisorClientPreferences, current: () => Promise<boolean>) {
    if (!await current()) return;
    const action = await deps.loadAction(owner);
    if (!await current()) return;
    if (!advisorClientIsActive(prefs, now()) || !action || action.status !== 'in_progress' ||
      !action.startedAt || !action.followUpAt || action.reminderAt) {
      await deps.cancel(owner);
      return;
    }
    const expected = action;
    await deps.schedule({ ownerKey: owner, actionId: action.id, followUpAt: action.followUpAt,
      quietStartHour: prefs.quietStartHour, quietEndHour: prefs.quietEndHour }, async () => {
      if (!await current()) return false;
      const latest = await deps.loadAction(owner);
      return await current() && latest?.id === expected.id && latest.status === 'in_progress' &&
        latest.followUpAt === expected.followUpAt && !latest.reminderAt;
    });
  }

  async function refresh() {
    // Capture before enqueueing; work queued by one account cannot become work for another.
    const owner = await deps.currentOwner();
    if (!owner || suspended.has(owner)) return;
    const generation = generations.get(owner) ?? 0;
    // Network snapshots may finish out of order. Only the newest refresh may
    // mutate this profile's lifecycle or reminders.
    const refreshVersion = (refreshVersions.get(owner) ?? 0) + 1;
    refreshVersions.set(owner, refreshVersion);
    const owned = async () => await deps.currentOwner() === owner && !suspended.has(owner) &&
      (generations.get(owner) ?? 0) === generation && refreshVersions.get(owner) === refreshVersion;
    if (!await owned()) return;
    const active = await serialize(async () => {
      if (!await owned()) return false;
      const prefs = await deps.read(owner);
      if (!await owned()) return false;
      if (!advisorClientIsActive(prefs, now())) {
        await deps.cancel(owner);
        if (!await owned()) return false;
        await deps.syncBackground(prefs.enabled);
        return false;
      }
      return true;
    });
    if (!active) return;
    const current = async () => {
      if (!await owned()) return false;
      const latest = await deps.read(owner);
      return await owned() && advisorClientIsActive(latest, now());
    };
    // Remote reads never hold the mutation queue: pause/disable/deletion can
    // cancel a pending native reminder even while context retrieval is stalled.
    const snapshot = await deps.load(owner);
    if (!await current()) return;
    return serialize(async () => {
      if (!await owned()) return;
      // A refresh can begin while a settings write is queued. Read committed
      // preferences in the same queue that applies native changes.
      const prefs = await deps.read(owner);
      if (!await current()) return;
      // A paused registration may wake again after the pause expires. It does no work during the pause.
      await deps.syncBackground(prefs.enabled);
      if (!await owned()) return;
      if (!await current()) return;
      if (snapshot.safety) { await deps.cancel(owner); deps.emit(owner, 'refreshed'); return; }
      await deps.refreshCompletions(owner);
      if (!await current()) return;
      const action = await deps.loadAction(owner);
      if (!await current()) return;
      if (snapshot.targetCompleted && action?.id === snapshot.action?.id && action) {
        await deps.complete(owner, action);
        if (!await current()) return;
      }
      if (!await current()) return;
      await applyReminder(owner, prefs, current);
      if (await current()) deps.emit(owner, 'refreshed');
    });
  }

  async function update(owner: string, patch: Partial<AdvisorClientPreferences>) {
    invalidate(owner);
    const generation = generations.get(owner);
    await serialize(async () => {
      const current = async () => await deps.currentOwner() === owner && generations.get(owner) === generation;
      if (!await current()) throw new Error('Your profile changed. Open Settings again.');
      const merged = { ...await deps.read(owner), ...patch };
      const parsed = parseAdvisorClientPreferences(JSON.stringify(merged));
      if (JSON.stringify(parsed) !== JSON.stringify(merged)) throw new Error('Choose different quiet-hour start and end times.');
      if (!await current()) throw new Error('Your profile changed. Open Settings again.');
      await deps.write(owner, parsed);
      if (!await current()) return;
      suspended.delete(owner);
      // Apply quiet-hour edits, pause, and opt-in to local native state before
      // reporting success. This path never needs a database or model request.
      await applyReminder(owner, parsed, current);
      if (!await current()) return;
      await deps.syncBackground(parsed.enabled);
      deps.emit(owner, 'changed');
    });
    // The mounted client loop handles the emitted change. Saving preferences must
    // not wait on remote context queries, which may be offline or slow.
  }

  function clear(owner: string) {
    // Invalidate synchronously, then drain background writes before erasing other profile stores.
    suspended.add(owner);
    invalidate(owner);
    return serialize(async () => {
      await deps.write(owner, { ...DEFAULT_ADVISOR_CLIENT_PREFERENCES });
      await deps.cancel(owner);
      await deps.clearHistory(owner);
      const currentOwner = await deps.currentOwner();
      if (!currentOwner || currentOwner === owner) await deps.syncBackground(false);
    });
  }
  return { refresh, update, clear };
}
