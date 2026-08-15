import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AdvisorRecommendation } from './advisor-core';

const STORAGE_PREFIX = 'mhtoolkit.advisor_action.v1';

export type AdvisorActionStatus = 'accepted' | 'in_progress' | 'needs_recovery';
export type AdvisorActionCheckInResult = 'partial' | 'not_done';
export type AdvisorActionRecoveryReason =
  | 'time'
  | 'energy'
  | 'unclear'
  | 'priority'
  | 'other';

export type AdvisorActionInstance = {
  version: 2;
  id: string;
  recommendationId: string;
  action: string;
  smallerAction: string;
  route: AdvisorRecommendation['route'];
  sourceLabels: string[];
  observations: string[];
  changeSignalId: string | null;
  status: AdvisorActionStatus;
  acceptedAt: string;
  startedAt: string | null;
  reminderAt: string | null;
  followUpAt: string | null;
  lastCheckInAt: string | null;
  lastCheckInResult: AdvisorActionCheckInResult | null;
  recoveryReason: AdvisorActionRecoveryReason | null;
  recoveryCount: number;
  useSmallerStep: boolean;
  updatedAt: string;
};

export type AdvisorActionStorageAdapter = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};

type ActionTransitionResult = {
  action: AdvisorActionInstance | null;
  changed: boolean;
};

const VALID_ROUTES = new Set<AdvisorRecommendation['route']>([
  '/ground',
  '/goals',
  '/habits',
  '/(tabs)/tracker',
  '/plans',
  '/resources',
]);

export function advisorActionStorageKey(ownerKey: string): string {
  return `${STORAGE_PREFIX}:${encodeURIComponent(ownerKey)}`;
}

function validIso(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(new Date(value).getTime());
}

function validText(value: unknown, maxLength: number): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= maxLength;
}

function parseAdvisorAction(raw: string | null): AdvisorActionInstance | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    const row = parsed as Record<string, unknown>;
    if (
      (row.version !== 1 && row.version !== 2) ||
      !validText(row.id, 240) ||
      !validText(row.recommendationId, 180) ||
      !validText(row.action, 300) ||
      !validText(row.smallerAction, 300) ||
      typeof row.route !== 'string' ||
      !VALID_ROUTES.has(row.route as AdvisorRecommendation['route']) ||
      !Array.isArray(row.sourceLabels) ||
      !row.sourceLabels.every((label) => validText(label, 80)) ||
      !Array.isArray(row.observations) ||
      !row.observations.every((observation) => validText(observation, 240)) ||
      !(row.changeSignalId === null || validText(row.changeSignalId, 160)) ||
      (row.status !== 'accepted' &&
        row.status !== 'in_progress' &&
        row.status !== 'needs_recovery') ||
      !validIso(row.acceptedAt) ||
      !(row.startedAt === null || validIso(row.startedAt)) ||
      !(row.reminderAt === null || validIso(row.reminderAt)) ||
      typeof row.useSmallerStep !== 'boolean' ||
      !validIso(row.updatedAt)
    ) {
      return null;
    }
    if (row.version === 1) {
      return {
        ...(row as Omit<AdvisorActionInstance, 'version' | 'followUpAt' | 'lastCheckInAt' | 'lastCheckInResult' | 'recoveryReason' | 'recoveryCount'>),
        version: 2,
        followUpAt: row.reminderAt as string | null,
        lastCheckInAt: null,
        lastCheckInResult: null,
        recoveryReason: null,
        recoveryCount: 0,
      };
    }
    if (
      !(row.followUpAt === null || validIso(row.followUpAt)) ||
      !(row.lastCheckInAt === null || validIso(row.lastCheckInAt)) ||
      !(
        row.lastCheckInResult === null ||
        row.lastCheckInResult === 'partial' ||
        row.lastCheckInResult === 'not_done'
      ) ||
      !(
        row.recoveryReason === null ||
        row.recoveryReason === 'time' ||
        row.recoveryReason === 'energy' ||
        row.recoveryReason === 'unclear' ||
        row.recoveryReason === 'priority' ||
        row.recoveryReason === 'other'
      ) ||
      typeof row.recoveryCount !== 'number' ||
      !Number.isInteger(row.recoveryCount) ||
      row.recoveryCount < 0 ||
      row.recoveryCount > 10_000
    ) {
      return null;
    }
    return row as AdvisorActionInstance;
  } catch {
    return null;
  }
}

function operationDate(nowIso: string | undefined, clock: () => Date): Date {
  if (nowIso) {
    const supplied = new Date(nowIso);
    if (Number.isFinite(supplied.getTime())) return supplied;
  }
  return clock();
}

export function createAdvisorActionStorage(
  storage: AdvisorActionStorageAdapter,
  clock: () => Date = () => new Date()
) {
  const queues = new Map<string, Promise<void>>();

  function serialize<T>(ownerKey: string, operation: () => Promise<T>): Promise<T> {
    const previous = queues.get(ownerKey) ?? Promise.resolve();
    const next = previous.catch(() => undefined).then(operation);
    const settled = next.then(
      () => undefined,
      () => undefined
    );
    queues.set(ownerKey, settled);
    void settled.finally(() => {
      if (queues.get(ownerKey) === settled) queues.delete(ownerKey);
    });
    return next;
  }

  async function read(ownerKey: string): Promise<AdvisorActionInstance | null> {
    const key = advisorActionStorageKey(ownerKey);
    const parsed = parseAdvisorAction(await storage.getItem(key));
    if (!parsed) await storage.removeItem(key);
    return parsed;
  }

  async function loadAdvisorAction(
    ownerKey: string | null
  ): Promise<AdvisorActionInstance | null> {
    if (!ownerKey) return null;
    try {
      return await serialize(ownerKey, () => read(ownerKey));
    } catch {
      return null;
    }
  }

  async function acceptAdvisorAction(
    ownerKey: string | null,
    recommendation: AdvisorRecommendation,
    options: { replace?: boolean; useSmallerStep?: boolean; nowIso?: string } = {}
  ): Promise<ActionTransitionResult> {
    if (!ownerKey) return { action: null, changed: false };
    return serialize(ownerKey, async () => {
      const existing = await read(ownerKey);
      if (existing && !options.replace) return { action: existing, changed: false };
      const now = operationDate(options.nowIso, clock).toISOString();
      const next: AdvisorActionInstance = {
        version: 2,
        id: `${recommendation.id}:${now}`,
        recommendationId: recommendation.id,
        action: recommendation.action,
        smallerAction: recommendation.smallerAction,
        route: recommendation.route,
        sourceLabels: [...recommendation.sourceLabels],
        observations: recommendation.observations.slice(0, 3),
        changeSignalId: recommendation.changeSignal?.id ?? null,
        status: 'accepted',
        acceptedAt: now,
        startedAt: null,
        reminderAt: null,
        followUpAt: null,
        lastCheckInAt: null,
        lastCheckInResult: null,
        recoveryReason: null,
        recoveryCount: 0,
        useSmallerStep: options.useSmallerStep === true,
        updatedAt: now,
      };
      await storage.setItem(advisorActionStorageKey(ownerKey), JSON.stringify(next));
      return { action: next, changed: true };
    });
  }

  async function updateAdvisorAction(
    ownerKey: string | null,
    actionId: string,
    update: (action: AdvisorActionInstance, now: string) => AdvisorActionInstance,
    nowIso?: string
  ): Promise<ActionTransitionResult> {
    if (!ownerKey || !actionId.trim()) return { action: null, changed: false };
    return serialize(ownerKey, async () => {
      const existing = await read(ownerKey);
      if (!existing || existing.id !== actionId) {
        return { action: existing, changed: false };
      }
      const now = operationDate(nowIso, clock).toISOString();
      const next = update(existing, now);
      await storage.setItem(advisorActionStorageKey(ownerKey), JSON.stringify(next));
      return { action: next, changed: true };
    });
  }

  const startAdvisorAction = (
    ownerKey: string | null,
    actionId: string,
    nowIso?: string
  ) => updateAdvisorAction(
    ownerKey,
    actionId,
    (action, now) => ({
      ...action,
      status: 'in_progress',
      startedAt: action.startedAt ?? now,
      recoveryReason: null,
      updatedAt: now,
    }),
    nowIso
  );

  const resizeAdvisorAction = (
    ownerKey: string | null,
    actionId: string,
    useSmallerStep: boolean,
    nowIso?: string
  ) => updateAdvisorAction(
    ownerKey,
    actionId,
    (action, now) => ({ ...action, useSmallerStep, updatedAt: now }),
    nowIso
  );

  const setAdvisorActionReminder = (
    ownerKey: string | null,
    actionId: string,
    reminderAt: string | null,
    nowIso?: string
  ) => updateAdvisorAction(
    ownerKey,
    actionId,
    (action, now) => ({
      ...action,
      reminderAt: reminderAt && validIso(reminderAt) ? reminderAt : null,
      updatedAt: now,
    }),
    nowIso
  );

  const setAdvisorActionFollowUp = (
    ownerKey: string | null,
    actionId: string,
    followUpAt: string | null,
    reminderAt: string | null = followUpAt,
    nowIso?: string
  ) => updateAdvisorAction(
    ownerKey,
    actionId,
    (action, now) => ({
      ...action,
      followUpAt: followUpAt && validIso(followUpAt) ? followUpAt : null,
      reminderAt: reminderAt && validIso(reminderAt) ? reminderAt : null,
      updatedAt: now,
    }),
    nowIso
  );

  const recordAdvisorActionCheckIn = (
    ownerKey: string | null,
    actionId: string,
    result: AdvisorActionCheckInResult,
    recoveryReason: AdvisorActionRecoveryReason | null = null,
    nowIso?: string
  ) => updateAdvisorAction(
    ownerKey,
    actionId,
    (action, now) => {
      if (
        action.lastCheckInAt === now &&
        action.lastCheckInResult === result &&
        action.recoveryReason === recoveryReason
      ) {
        return action;
      }
      return {
        ...action,
        status: 'needs_recovery',
        reminderAt: null,
        followUpAt: null,
        lastCheckInAt: now,
        lastCheckInResult: result,
        recoveryReason,
        recoveryCount: action.recoveryCount + 1,
        useSmallerStep: result === 'partial' ? true : action.useSmallerStep,
        updatedAt: now,
      };
    },
    nowIso
  );

  async function clearAdvisorAction(
    ownerKey: string | null,
    actionId?: string
  ): Promise<boolean> {
    if (!ownerKey) return false;
    return serialize(ownerKey, async () => {
      if (actionId) {
        const existing = await read(ownerKey);
        if (!existing || existing.id !== actionId) return false;
      }
      await storage.removeItem(advisorActionStorageKey(ownerKey));
      return true;
    });
  }

  return {
    loadAdvisorAction,
    acceptAdvisorAction,
    startAdvisorAction,
    resizeAdvisorAction,
    setAdvisorActionReminder,
    setAdvisorActionFollowUp,
    recordAdvisorActionCheckIn,
    clearAdvisorAction,
  };
}

const advisorActionStorage = createAdvisorActionStorage(AsyncStorage);

export const loadAdvisorAction = advisorActionStorage.loadAdvisorAction;
export const acceptAdvisorAction = advisorActionStorage.acceptAdvisorAction;
export const startAdvisorAction = advisorActionStorage.startAdvisorAction;
export const resizeAdvisorAction = advisorActionStorage.resizeAdvisorAction;
export const setAdvisorActionReminder = advisorActionStorage.setAdvisorActionReminder;
export const setAdvisorActionFollowUp = advisorActionStorage.setAdvisorActionFollowUp;
export const recordAdvisorActionCheckIn = advisorActionStorage.recordAdvisorActionCheckIn;
export const clearAdvisorAction = advisorActionStorage.clearAdvisorAction;
