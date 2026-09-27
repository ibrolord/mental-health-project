import type { AdvisorActionInstance } from './advisor-action-storage';
import {
  createToolCompletionStorage, isToolCompletion, latestToolCompletionToday,
  type ToolCompletion, type ToolCompletionKind,
} from './tool-completion-storage';

export type ToolCompletionSession = {
  id: string;
  ownerKey: string;
  generation: number;
  kind: ToolCompletionKind;
  itemId: string;
  startedAt: string;
  sourceStepId: string | null;
};

type Dependencies = {
  storage: ReturnType<typeof createToolCompletionStorage>;
  currentOwner(): Promise<string | null>;
  upload(owner: string, rows: ToolCompletion[]): Promise<void>;
  download(owner: string, since: string): Promise<ToolCompletion[]>;
  reconcileAction(owner: string): Promise<AdvisorActionInstance | null>;
  completeAction(owner: string, action: AdvisorActionInstance): Promise<AdvisorActionInstance | null>;
  clearBrief(owner: string): Promise<void>;
};

/** A matching route alone is insufficient: only the exact started step may be closed. */
export function completionMatchesAction(row: ToolCompletion, action: AdvisorActionInstance): boolean {
  return !row.partial && row.sourceStepId === action.id &&
    (action.status === 'in_progress' || action.status === 'needs_recovery') &&
    row.kind === 'grounding' && action.route === '/ground' &&
    Date.parse(row.startedAt) >= Date.parse(action.startedAt ?? action.acceptedAt) &&
    Date.parse(row.completedAt) >= Date.parse(row.startedAt);
}

export function createToolCompletionCoordinator(deps: Dependencies, clock = () => new Date()) {
  const work = new Map<string, Promise<unknown>>();
  const syncing = new Map<string, Promise<void>>();
  const paused = new Map<string, number>();
  const deletionBlocked = new Set<string>();
  function serial<T>(owner: string, fn: () => Promise<T>): Promise<T> {
    const next = (work.get(owner) ?? Promise.resolve()).catch(() => {}).then(fn);
    work.set(owner, next);
    void next.finally(() => { if (work.get(owner) === next) work.delete(owner); }).catch(() => {});
    return next;
  }
  async function current(owner: string, generation = deps.storage.generation(owner)) {
    return !paused.has(owner) && !deletionBlocked.has(owner) && (await deps.currentOwner()) === owner &&
      generation === deps.storage.generation(owner) && !paused.has(owner) && !deletionBlocked.has(owner);
  }
  async function refreshLocal(owner: string) {
    if (!(await current(owner))) return { action: null, completion: null };
    let action = await deps.reconcileAction(owner);
    const rows = await deps.storage.list(owner);
    if (!(await current(owner))) return { action: null, completion: null };
    if (action && rows.some((row) => completionMatchesAction(row, action!))) {
      action = await deps.completeAction(owner, action);
      if (!action) await deps.clearBrief(owner);
    }
    return { action, completion: latestToolCompletionToday(rows, clock()) };
  }

  function sync(owner: string): Promise<void> {
    const existing = syncing.get(owner);
    if (existing) return existing;
    const epoch = deps.storage.generation(owner);
    const task = (async () => {
      if (!(await current(owner, epoch))) return;
      const pending = (await deps.storage.list(owner)).filter((row) => !row.synced);
      if (pending.length) {
        if (!(await current(owner, epoch))) return;
        await deps.upload(owner, pending);
        if (!(await current(owner, epoch))) return;
        await deps.storage.markSynced(owner, pending.map((row) => row.id), epoch);
      }
      if (!(await current(owner, epoch))) return;
      const since = new Date(clock().getTime() - 90 * 86400000).toISOString();
      const remote = await deps.download(owner, since);
      if (await current(owner, epoch)) await deps.storage.merge(owner, remote, epoch);
    })();
    syncing.set(owner, task);
    void task.finally(() => { if (syncing.get(owner) === task) syncing.delete(owner); }).catch(() => {});
    return task;
  }

  async function record(session: ToolCompletionSession, result: { id?: string; completedAt?: string } = {}) {
    const owner = session.ownerKey;
    const saved = await serial(owner, async () => {
      if (!(await current(owner, session.generation))) return false;
      const candidate: ToolCompletion = {
        id: result.id ?? session.id, kind: session.kind, itemId: session.itemId,
        startedAt: session.startedAt, completedAt: result.completedAt ?? clock().toISOString(),
        sourceStepId: session.sourceStepId, partial: false, synced: false,
      };
      if (!isToolCompletion(candidate) || Date.parse(candidate.completedAt) > clock().getTime()) {
        throw new Error('Invalid tool completion.');
      }
      // A deep-link parameter cannot complete a different tool or an unstarted step.
      if (candidate.sourceStepId) {
        const action = await deps.reconcileAction(owner);
        if (!action || !completionMatchesAction(candidate, action)) candidate.sourceStepId = null;
      }
      if (!(await current(owner, session.generation))) return false;
      const accepted = await deps.storage.add(owner, candidate, session.generation);
      if (accepted) {
        // The completion is already durable. A failed lifecycle transition replays on focus.
        await refreshLocal(owner).catch(() => {});
      }
      return accepted;
    });
    if (saved) void sync(owner).catch(() => {});
    return saved;
  }

  async function refresh(owner: string | null) {
    if (!owner) return { action: null, completion: null };
    const result = await serial(owner, () => refreshLocal(owner));
    void sync(owner).catch(() => {});
    return result;
  }

  /** Drain uploads before remote deletion, then erase the mirror so it cannot restore deleted data. */
  async function remove<T>(owner: string, operation: () => Promise<T>, eraseOnFailure = true): Promise<T> {
    paused.set(owner, (paused.get(owner) ?? 0) + 1);
    deps.storage.invalidate(owner);
    let deletionStarted = false;
    let cleared = false;
    try {
      await Promise.allSettled([work.get(owner), syncing.get(owner)]);
      if (eraseOnFailure) {
        await deps.storage.beginDeletion(owner);
        deletionStarted = true;
        deletionBlocked.add(owner);
      }
      let result: T;
      try {
        result = await operation();
      } catch (error) {
        // A timeout may mean the server deleted successfully. Never re-upload its old mirror.
        if (eraseOnFailure) {
          await deps.storage.clear(owner);
          cleared = true;
        }
        throw error;
      }
      await deps.storage.clear(owner);
      cleared = true;
      return result;
    } finally {
      try {
        if (deletionStarted && cleared) {
          await deps.storage.endDeletion(owner);
          deletionBlocked.delete(owner);
        }
      } finally {
        const remaining = (paused.get(owner) ?? 1) - 1;
        if (remaining) paused.set(owner, remaining); else paused.delete(owner);
      }
    }
  }

  /** Signing out hides this profile without discarding completions still awaiting upload. */
  async function suspend(owner: string) {
    paused.set(owner, (paused.get(owner) ?? 0) + 1);
    deps.storage.invalidate(owner);
    try {
      await Promise.allSettled([work.get(owner), syncing.get(owner)]);
      await deps.storage.retainPending(owner);
    } finally {
      const remaining = (paused.get(owner) ?? 1) - 1;
      if (remaining) paused.set(owner, remaining); else paused.delete(owner);
    }
  }

  return { record, refresh, sync, remove, suspend };
}
