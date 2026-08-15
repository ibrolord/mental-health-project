import type {
  AdvisorActionCheckInResult,
  AdvisorActionInstance,
  AdvisorActionRecoveryReason,
} from './advisor-action-storage';

const STORAGE_PREFIX = 'mhtoolkit.advisor_lifecycle.v1';

export type AdvisorLifecycleStorageAdapter = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};

type AdvisorLifecycleOperation = 'start' | 'complete' | 'recover' | 'replace';

type PendingAdvisorLifecycle = {
  version: 1;
  operation: AdvisorLifecycleOperation;
  actionId: string;
  recommendationId: string;
  startedAt: string;
  changeSignalId: string | null;
  result: AdvisorActionCheckInResult | null;
  resolution: 'completed' | 'partial' | 'skipped' | null;
  barrier: AdvisorActionRecoveryReason | null;
  cancelReminder: boolean;
  createdAt: string;
};

export type AdvisorLifecycleDependencies = {
  loadAction(ownerKey: string): Promise<AdvisorActionInstance | null>;
  startAction(
    ownerKey: string,
    actionId: string,
    nowIso: string
  ): Promise<{ action: AdvisorActionInstance | null }>;
  clearAction(ownerKey: string, actionId: string): Promise<boolean>;
  recordCheckIn(
    ownerKey: string,
    actionId: string,
    result: AdvisorActionCheckInResult,
    barrier: AdvisorActionRecoveryReason | null,
    nowIso: string
  ): Promise<{ action: AdvisorActionInstance | null }>;
  recordOffered(
    ownerKey: string,
    recommendation: { id: string; actionId: string },
    nowIso: string
  ): Promise<void>;
  markStarted(
    ownerKey: string,
    actionId: string,
    nowIso: string,
    changeSignalId: string | null
  ): Promise<void>;
  resolveOutcome(
    ownerKey: string,
    actionId: string,
    resolution: 'completed' | 'partial' | 'skipped',
    barrier: AdvisorActionRecoveryReason | null,
    nowIso: string
  ): Promise<void>;
  cancelReminder(): Promise<void>;
};

export function advisorLifecycleStorageKey(ownerKey: string): string {
  return `${STORAGE_PREFIX}:${encodeURIComponent(ownerKey)}`;
}

function validIso(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(new Date(value).getTime());
}

function validText(value: unknown, maxLength: number): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= maxLength;
}

function parsePendingLifecycle(raw: string | null): PendingAdvisorLifecycle | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const row = value as Record<string, unknown>;
    if (
      row.version !== 1 ||
      (row.operation !== 'start' &&
        row.operation !== 'complete' &&
        row.operation !== 'recover' &&
        row.operation !== 'replace') ||
      !validText(row.actionId, 256) ||
      !validText(row.recommendationId, 180) ||
      !validIso(row.startedAt) ||
      !(row.changeSignalId === null || validText(row.changeSignalId, 160)) ||
      !(
        row.result === null ||
        row.result === 'partial' ||
        row.result === 'not_done'
      ) ||
      !(
        row.resolution === null ||
        row.resolution === 'completed' ||
        row.resolution === 'partial' ||
        row.resolution === 'skipped'
      ) ||
      !(
        row.barrier === null ||
        row.barrier === 'time' ||
        row.barrier === 'energy' ||
        row.barrier === 'unclear' ||
        row.barrier === 'priority' ||
        row.barrier === 'other'
      ) ||
      typeof row.cancelReminder !== 'boolean' ||
      !validIso(row.createdAt)
    ) {
      return null;
    }
    return row as PendingAdvisorLifecycle;
  } catch {
    return null;
  }
}

export function createAdvisorLifecycleCoordinator(
  storage: AdvisorLifecycleStorageAdapter,
  dependencies: AdvisorLifecycleDependencies,
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

  async function read(ownerKey: string): Promise<PendingAdvisorLifecycle | null> {
    const key = advisorLifecycleStorageKey(ownerKey);
    const raw = await storage.getItem(key);
    const pending = parsePendingLifecycle(raw);
    if (raw && !pending) await storage.removeItem(key);
    return pending;
  }

  async function execute(
    ownerKey: string,
    pending: PendingAdvisorLifecycle
  ): Promise<AdvisorActionInstance | null> {
    const reference = {
      id: pending.recommendationId,
      actionId: pending.actionId,
    };
    if (pending.operation === 'start') {
      await dependencies.startAction(ownerKey, pending.actionId, pending.startedAt);
      await dependencies.recordOffered(ownerKey, reference, pending.createdAt);
      await dependencies.markStarted(
        ownerKey,
        pending.actionId,
        pending.startedAt,
        pending.changeSignalId
      );
    } else {
      if (pending.operation !== 'replace' || pending.resolution === 'skipped') {
        await dependencies.recordOffered(ownerKey, reference, pending.createdAt);
        await dependencies.markStarted(
          ownerKey,
          pending.actionId,
          pending.startedAt,
          pending.changeSignalId
        );
      }
      if (pending.resolution) {
        await dependencies.resolveOutcome(
          ownerKey,
          pending.actionId,
          pending.resolution,
          pending.barrier,
          pending.createdAt
        );
      }
      if (pending.operation === 'recover' && pending.result) {
        await dependencies.recordCheckIn(
          ownerKey,
          pending.actionId,
          pending.result,
          pending.barrier,
          pending.createdAt
        );
      } else if (pending.operation === 'complete' || pending.operation === 'replace') {
        await dependencies.clearAction(ownerKey, pending.actionId);
      }
    }
    if (pending.cancelReminder) await dependencies.cancelReminder();
    await storage.removeItem(advisorLifecycleStorageKey(ownerKey));
    return dependencies.loadAction(ownerKey);
  }

  async function reconcileUnlocked(ownerKey: string): Promise<AdvisorActionInstance | null> {
    const pending = await read(ownerKey);
    if (!pending) return dependencies.loadAction(ownerKey);
    return execute(ownerKey, pending);
  }

  async function begin(
    ownerKey: string,
    pending: Omit<PendingAdvisorLifecycle, 'version'>
  ): Promise<AdvisorActionInstance | null> {
    return serialize(ownerKey, async () => {
      await reconcileUnlocked(ownerKey);
      const operation: PendingAdvisorLifecycle = { version: 1, ...pending };
      await storage.setItem(
        advisorLifecycleStorageKey(ownerKey),
        JSON.stringify(operation)
      );
      return execute(ownerKey, operation);
    });
  }

  async function reconcileAdvisorLifecycle(
    ownerKey: string | null
  ): Promise<AdvisorActionInstance | null> {
    if (!ownerKey) return null;
    return serialize(ownerKey, () => reconcileUnlocked(ownerKey));
  }

  async function startAdvisorLifecycle(
    ownerKey: string | null,
    action: AdvisorActionInstance
  ): Promise<AdvisorActionInstance | null> {
    if (!ownerKey) return null;
    const createdAt = clock().toISOString();
    return begin(ownerKey, {
      operation: 'start',
      actionId: action.id,
      recommendationId: action.recommendationId,
      startedAt: action.startedAt ?? createdAt,
      changeSignalId: action.changeSignalId,
      result: null,
      resolution: null,
      barrier: null,
      cancelReminder: false,
      createdAt,
    });
  }

  async function completeAdvisorLifecycle(
    ownerKey: string | null,
    action: AdvisorActionInstance
  ): Promise<AdvisorActionInstance | null> {
    if (!ownerKey) return null;
    const createdAt = clock().toISOString();
    return begin(ownerKey, {
      operation: 'complete',
      actionId: action.id,
      recommendationId: action.recommendationId,
      startedAt: action.startedAt ?? action.acceptedAt,
      changeSignalId: action.changeSignalId,
      result: null,
      resolution: 'completed',
      barrier: null,
      cancelReminder: true,
      createdAt,
    });
  }

  async function recoverAdvisorLifecycle(
    ownerKey: string | null,
    action: AdvisorActionInstance,
    result: AdvisorActionCheckInResult,
    barrier: AdvisorActionRecoveryReason | null
  ): Promise<AdvisorActionInstance | null> {
    if (!ownerKey) return null;
    const createdAt = clock().toISOString();
    return begin(ownerKey, {
      operation: 'recover',
      actionId: action.id,
      recommendationId: action.recommendationId,
      startedAt: action.startedAt ?? action.acceptedAt,
      changeSignalId: action.changeSignalId,
      result,
      resolution: result === 'partial' ? 'partial' : 'skipped',
      barrier,
      cancelReminder: true,
      createdAt,
    });
  }

  async function replaceAdvisorLifecycle(
    ownerKey: string | null,
    action: AdvisorActionInstance
  ): Promise<AdvisorActionInstance | null> {
    if (!ownerKey) return null;
    const createdAt = clock().toISOString();
    const wasStarted = action.status === 'in_progress' && Boolean(action.startedAt);
    return begin(ownerKey, {
      operation: 'replace',
      actionId: action.id,
      recommendationId: action.recommendationId,
      startedAt: action.startedAt ?? action.acceptedAt,
      changeSignalId: action.changeSignalId,
      result: null,
      resolution: wasStarted ? 'skipped' : null,
      barrier: wasStarted ? 'priority' : null,
      cancelReminder: true,
      createdAt,
    });
  }

  async function clearAdvisorLifecycleJournal(ownerKey: string | null): Promise<void> {
    if (!ownerKey) return;
    await serialize(ownerKey, () =>
      storage.removeItem(advisorLifecycleStorageKey(ownerKey))
    );
  }

  return {
    reconcileAdvisorLifecycle,
    startAdvisorLifecycle,
    completeAdvisorLifecycle,
    recoverAdvisorLifecycle,
    replaceAdvisorLifecycle,
    clearAdvisorLifecycleJournal,
  };
}
