import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AdvisorChangeSignal } from './advisor-core';

const STORAGE_PREFIX = 'mhtoolkit.advisor_observation_ledger.v1';
const RETENTION_DAYS = 90;
const COOLDOWN_DAYS = 7;
const WEEKLY_SIGNAL_LIMIT = 2;
const SUPPRESSION_DAYS = 14;

type LedgerEntry = {
  signalId: string;
  state: 'firing' | 'clear';
  lastEvaluatedDay: string;
  consecutiveClearDays: number;
  lastShownAt: string | null;
  shownCount: number;
};

type SignalSuppression = {
  signalId: string;
  suppressedUntilDay: string;
};

type LedgerState = {
  lastOperationDay: string | null;
  entries: LedgerEntry[];
  suppressions: SignalSuppression[];
};

export type AdvisorObservationLedgerStorageAdapter = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};

export function keepAdvisorChangeSignalVisible(
  previousVisible: boolean,
  previousSignalId: string | null,
  nextSignalId: string | null,
  becameVisible: boolean
): boolean {
  return Boolean(
    nextSignalId &&
      (becameVisible || (previousVisible && previousSignalId === nextSignalId))
  );
}

type EvaluateAdvisorChangeSignal = {
  (
    ownerKey: string | null,
    activeSignals: readonly AdvisorChangeSignal[],
    promotedSignalId: string | null,
    nowIso?: string
  ): Promise<boolean>;
  (
    ownerKey: string | null,
    signal: AdvisorChangeSignal | null,
    nowIso?: string
  ): Promise<boolean>;
};

const ownerQueues = new Map<string, Promise<void>>();

function storageKey(ownerKey: string): string {
  return `${STORAGE_PREFIX}:${encodeURIComponent(ownerKey)}`;
}

function validOwnerKey(ownerKey: string | null): ownerKey is string {
  return typeof ownerKey === 'string' && ownerKey.trim().length > 0;
}

function validIso(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(new Date(value).getTime());
}

function dayOrdinal(value: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return Math.floor(date.getTime() / (24 * 60 * 60 * 1000));
}

function dayKeyFromOrdinal(ordinal: number): string {
  return new Date(ordinal * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function localDayKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseLedgerEntry(value: unknown): LedgerEntry | null {
  if (!value || typeof value !== 'object') return null;
  const row = value as Record<string, unknown>;
  if (
    typeof row.signalId !== 'string' ||
    !row.signalId.trim() ||
    (row.state !== 'firing' && row.state !== 'clear') ||
    typeof row.lastEvaluatedDay !== 'string' ||
    dayOrdinal(row.lastEvaluatedDay) === null ||
    !Number.isInteger(row.consecutiveClearDays) ||
    (row.consecutiveClearDays as number) < 0 ||
    !(row.lastShownAt === null || validIso(row.lastShownAt)) ||
    !Number.isInteger(row.shownCount) ||
    (row.shownCount as number) < 0
  ) {
    return null;
  }
  return {
    signalId: row.signalId,
    state: row.state,
    lastEvaluatedDay: row.lastEvaluatedDay,
    consecutiveClearDays: row.consecutiveClearDays as number,
    lastShownAt: row.lastShownAt,
    shownCount: row.shownCount as number,
  };
}

function parseEntries(values: unknown): LedgerEntry[] | null {
  if (!Array.isArray(values)) return null;
  const entries: LedgerEntry[] = [];
  for (const value of values) {
    const entry = parseLedgerEntry(value);
    if (!entry) return null;
    entries.push(entry);
  }
  return new Set(entries.map((entry) => entry.signalId)).size === entries.length
    ? entries
    : null;
}

function parseSuppressions(values: unknown): SignalSuppression[] | null {
  if (!Array.isArray(values)) return null;
  const suppressions: SignalSuppression[] = [];
  for (const value of values) {
    if (!value || typeof value !== 'object') return null;
    const row = value as Record<string, unknown>;
    if (
      typeof row.signalId !== 'string' ||
      !row.signalId.trim() ||
      typeof row.suppressedUntilDay !== 'string' ||
      dayOrdinal(row.suppressedUntilDay) === null
    ) {
      return null;
    }
    suppressions.push({
      signalId: row.signalId,
      suppressedUntilDay: row.suppressedUntilDay,
    });
  }
  return new Set(suppressions.map((item) => item.signalId)).size === suppressions.length
    ? suppressions
    : null;
}

function parseState(raw: string | null): LedgerState | null {
  if (raw === null) {
    return { lastOperationDay: null, entries: [], suppressions: [] };
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    // Read the original array payload so existing installs migrate in place.
    if (Array.isArray(parsed)) {
      const entries = parseEntries(parsed);
      if (!entries) return null;
      const lastOperationDay = entries.reduce<string | null>(
        (latest, entry) =>
          latest === null || entry.lastEvaluatedDay > latest
            ? entry.lastEvaluatedDay
            : latest,
        null
      );
      return { lastOperationDay, entries, suppressions: [] };
    }
    if (!parsed || typeof parsed !== 'object') return null;
    const row = parsed as Record<string, unknown>;
    if (
      !(row.lastOperationDay === null ||
        (typeof row.lastOperationDay === 'string' &&
          dayOrdinal(row.lastOperationDay) !== null))
    ) {
      return null;
    }
    const entries = parseEntries(row.entries);
    const suppressions = parseSuppressions(row.suppressions);
    if (!entries || !suppressions) return null;
    return {
      lastOperationDay: row.lastOperationDay,
      entries,
      suppressions,
    };
  } catch {
    return null;
  }
}

function retainedEntries(entries: LedgerEntry[], todayOrdinal: number): LedgerEntry[] {
  return entries.filter((entry) => {
    const evaluatedOrdinal = dayOrdinal(entry.lastEvaluatedDay);
    if (evaluatedOrdinal === null) return false;
    const age = todayOrdinal - evaluatedOrdinal;
    return age < 0 || age <= RETENTION_DAYS;
  });
}

function activeSuppressions(
  suppressions: SignalSuppression[],
  todayOrdinal: number
): SignalSuppression[] {
  return suppressions.filter((suppression) => {
    const untilOrdinal = dayOrdinal(suppression.suppressedUntilDay);
    return untilOrdinal !== null && untilOrdinal > todayOrdinal;
  });
}

function shownDayAge(entry: LedgerEntry, todayOrdinal: number): number | null {
  if (!entry.lastShownAt) return null;
  const shownOrdinal = dayOrdinal(localDayKey(new Date(entry.lastShownAt)));
  return shownOrdinal === null ? null : todayOrdinal - shownOrdinal;
}

function isGoalOverdue(signalId: string): boolean {
  return signalId.startsWith('goal-overdue:');
}

function operationDate(nowIso?: string): Date | null {
  if (nowIso !== undefined && !validIso(nowIso)) return null;
  const date = nowIso === undefined ? new Date() : new Date(nowIso);
  return Number.isFinite(date.getTime()) ? date : null;
}

function validSignal(signal: unknown): signal is AdvisorChangeSignal {
  if (!signal || typeof signal !== 'object') return false;
  const row = signal as Record<string, unknown>;
  return (
    typeof row.id === 'string' &&
    row.id.trim().length > 0 &&
    (row.stream === 'sleep' ||
      row.stream === 'steps' ||
      row.stream === 'habit' ||
      row.stream === 'goal' ||
      row.stream === 'feedback') &&
    (row.direction === 'up' ||
      row.direction === 'down' ||
      row.direction === 'due' ||
      row.direction === 'stalled' ||
      row.direction === 'steady') &&
    (row.severity === 'notable' || row.severity === 'minor') &&
    typeof row.line === 'string'
  );
}

function serialize<T>(ownerKey: string, operation: () => Promise<T>): Promise<T> {
  const previous = ownerQueues.get(ownerKey) ?? Promise.resolve();
  const next = previous.catch(() => undefined).then(operation);
  const settled = next.then(
    () => undefined,
    () => undefined
  );
  ownerQueues.set(ownerKey, settled);
  void settled.finally(() => {
    if (ownerQueues.get(ownerKey) === settled) ownerQueues.delete(ownerKey);
  });
  return next;
}

async function writeState(
  storage: AdvisorObservationLedgerStorageAdapter,
  ownerKey: string,
  state: LedgerState
): Promise<void> {
  await storage.setItem(storageKey(ownerKey), JSON.stringify(state));
}

async function evaluateSetWithStorage(
  storage: AdvisorObservationLedgerStorageAdapter,
  ownerKey: string | null,
  activeSignals: readonly AdvisorChangeSignal[],
  promotedSignalId: string | null,
  nowIso?: string
): Promise<boolean> {
  let now: Date | null;
  try {
    if (
      !validOwnerKey(ownerKey) ||
      !Array.isArray(activeSignals) ||
      !activeSignals.every(validSignal) ||
      new Set(activeSignals.map((signal) => signal.id)).size !== activeSignals.length ||
      !(promotedSignalId === null ||
        (typeof promotedSignalId === 'string' && promotedSignalId.trim().length > 0))
    ) {
      return false;
    }
    now = operationDate(nowIso);
  } catch {
    return false;
  }
  if (!now) return false;

  try {
    return await serialize(ownerKey, async () => {
      const key = storageKey(ownerKey);
      const state = parseState(await storage.getItem(key));
      if (state === null) {
        await storage.removeItem(key);
        return false;
      }

      const today = localDayKey(now);
      const todayOrdinal = dayOrdinal(today);
      const lastOperationOrdinal =
        state.lastOperationDay === null ? null : dayOrdinal(state.lastOperationDay);
      if (
        todayOrdinal === null ||
        (lastOperationOrdinal !== null && lastOperationOrdinal > todayOrdinal)
      ) {
        return false;
      }

      state.entries = retainedEntries(state.entries, todayOrdinal);
      state.suppressions = activeSuppressions(state.suppressions, todayOrdinal);
      const activeById = new Map(activeSignals.map((signal) => [signal.id, signal]));
      const transitionedToFiring = new Set<string>();

      for (const entry of state.entries) {
        // Signals can appear later in the same day. Keep already-evaluated
        // entries stable while still admitting newly active signals below.
        if (entry.lastEvaluatedDay === today) continue;

        if (activeById.has(entry.signalId)) {
          if (entry.state === 'clear') transitionedToFiring.add(entry.signalId);
          entry.state = 'firing';
          entry.lastEvaluatedDay = today;
          entry.consecutiveClearDays = 0;
          continue;
        }

        const previousDayOrdinal = dayOrdinal(entry.lastEvaluatedDay);
        entry.lastEvaluatedDay = today;
        if (entry.state === 'firing') {
          entry.consecutiveClearDays =
            entry.consecutiveClearDays > 0 &&
            previousDayOrdinal !== null &&
            todayOrdinal - previousDayOrdinal === 1
              ? entry.consecutiveClearDays + 1
              : 1;
          if (entry.consecutiveClearDays >= 2) entry.state = 'clear';
        } else {
          entry.consecutiveClearDays = 0;
        }
      }

      const existingIds = new Set(state.entries.map((entry) => entry.signalId));
      for (const signal of activeSignals) {
        if (existingIds.has(signal.id)) continue;
        state.entries.push({
          signalId: signal.id,
          state: 'firing',
          lastEvaluatedDay: today,
          consecutiveClearDays: 0,
          lastShownAt: null,
          shownCount: 0,
        });
        transitionedToFiring.add(signal.id);
      }
      state.lastOperationDay = today;

      const promotedSignal =
        promotedSignalId === null ? null : activeById.get(promotedSignalId) ?? null;
      let shown = false;
      if (
        promotedSignal &&
        promotedSignal.severity === 'notable' &&
        transitionedToFiring.has(promotedSignal.id)
      ) {
        const promotedEntry = state.entries.find(
          (entry) => entry.signalId === promotedSignal.id
        );
        const suppressed = state.suppressions.some(
          (suppression) => suppression.signalId === promotedSignal.id
        );
        const lastShownAge = promotedEntry
          ? shownDayAge(promotedEntry, todayOrdinal)
          : null;
        const inCooldown =
          lastShownAge !== null && lastShownAge >= 0 && lastShownAge < COOLDOWN_DAYS;
        const ordinarySignalsShown = new Set(
          state.entries.flatMap((entry) => {
            const age = shownDayAge(entry, todayOrdinal);
            return age !== null &&
              age >= 0 &&
              age < COOLDOWN_DAYS &&
              !isGoalOverdue(entry.signalId)
              ? [entry.signalId]
              : [];
          })
        ).size;
        const weeklyCapReached =
          !isGoalOverdue(promotedSignal.id) &&
          ordinarySignalsShown >= WEEKLY_SIGNAL_LIMIT;
        shown = !suppressed && !inCooldown && !weeklyCapReached;
        if (shown && promotedEntry) {
          promotedEntry.lastShownAt = now.toISOString();
          promotedEntry.shownCount += 1;
        }
      }

      await writeState(storage, ownerKey, state);
      return shown;
    });
  } catch {
    return false;
  }
}

function createEvaluateMethod(
  storage: AdvisorObservationLedgerStorageAdapter
): EvaluateAdvisorChangeSignal {
  return ((
    ownerKey: string | null,
    signalsOrSignal: readonly AdvisorChangeSignal[] | AdvisorChangeSignal | null,
    promotedSignalIdOrNowIso?: string | null,
    nowIso?: string
  ) => {
    if (Array.isArray(signalsOrSignal)) {
      return evaluateSetWithStorage(
        storage,
        ownerKey,
        signalsOrSignal,
        promotedSignalIdOrNowIso ?? null,
        nowIso
      );
    }
    const signal = signalsOrSignal as AdvisorChangeSignal | null;
    return evaluateSetWithStorage(
      storage,
      ownerKey,
      signal ? [signal] : [],
      signal?.id ?? null,
      promotedSignalIdOrNowIso ?? undefined
    );
  }) as EvaluateAdvisorChangeSignal;
}

async function suppressWithStorage(
  storage: AdvisorObservationLedgerStorageAdapter,
  ownerKey: string | null,
  signalId: string,
  nowIso?: string
): Promise<void> {
  let now: Date | null;
  try {
    if (!validOwnerKey(ownerKey) || typeof signalId !== 'string' || !signalId.trim()) return;
    now = operationDate(nowIso);
  } catch {
    return;
  }
  if (!now) return;

  try {
    await serialize(ownerKey, async () => {
      const key = storageKey(ownerKey);
      const state = parseState(await storage.getItem(key));
      if (state === null) {
        await storage.removeItem(key);
        return;
      }
      const todayOrdinal = dayOrdinal(localDayKey(now));
      if (todayOrdinal === null) return;
      const suppression: SignalSuppression = {
        signalId,
        suppressedUntilDay: dayKeyFromOrdinal(todayOrdinal + SUPPRESSION_DAYS),
      };
      state.suppressions = state.suppressions.filter((item) => item.signalId !== signalId);
      state.suppressions.push(suppression);
      await writeState(storage, ownerKey, state);
    });
  } catch {
    // Suppression must never make Advisor unavailable.
  }
}

async function clearWithStorage(
  storage: AdvisorObservationLedgerStorageAdapter,
  ownerKey: string | null
): Promise<void> {
  if (!validOwnerKey(ownerKey)) return;
  try {
    await serialize(ownerKey, () => storage.removeItem(storageKey(ownerKey)));
  } catch {
    // Clearing is best-effort and must not reject a public caller.
  }
}

export function createAdvisorObservationLedger(
  storage: AdvisorObservationLedgerStorageAdapter
) {
  const evaluateAdvisorChangeSignal = createEvaluateMethod(storage);
  return {
    evaluateAdvisorChangeSignal,
    evaluateAdvisorChangeSignals: evaluateAdvisorChangeSignal,
    suppressAdvisorChangeSignal: (
      ownerKey: string | null,
      signalId: string,
      nowIso?: string
    ) => suppressWithStorage(storage, ownerKey, signalId, nowIso),
    clearAdvisorObservationLedger: (ownerKey: string | null) =>
      clearWithStorage(storage, ownerKey),
  };
}

const advisorObservationLedger = createAdvisorObservationLedger(AsyncStorage);

export const evaluateAdvisorChangeSignal =
  advisorObservationLedger.evaluateAdvisorChangeSignal;
export const evaluateAdvisorChangeSignals =
  advisorObservationLedger.evaluateAdvisorChangeSignals;
export const suppressAdvisorChangeSignal =
  advisorObservationLedger.suppressAdvisorChangeSignal;
export const clearAdvisorObservationLedger =
  advisorObservationLedger.clearAdvisorObservationLedger;
