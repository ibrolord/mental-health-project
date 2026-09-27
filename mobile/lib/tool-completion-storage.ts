export const TOOL_COMPLETION_KINDS = [
  'grounding', 'meditation', 'yoga', 'game', 'journal', 'reflection', 'focus',
] as const;
export type ToolCompletionKind = typeof TOOL_COMPLETION_KINDS[number];

export const TOOL_COMPLETION_LABELS: Record<ToolCompletionKind, string> = {
  grounding: 'Grounding complete.',
  meditation: 'Meditation complete.',
  yoga: 'Yoga practice complete.',
  game: 'Practice complete.',
  journal: 'Journal entry saved.',
  reflection: 'Reflection saved.',
  focus: 'Focus session complete.',
};

export type ToolCompletion = {
  id: string;
  kind: ToolCompletionKind;
  itemId: string;
  startedAt: string;
  completedAt: string;
  sourceStepId: string | null;
  partial: boolean;
  synced: boolean;
};

type Storage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};
const RETENTION_MS = 90 * 24 * 60 * 60 * 1000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function toolCompletionsStorageKey(ownerKey: string): string {
  return `mhtoolkit.tool_completions.v1:${encodeURIComponent(ownerKey)}`;
}

export function toolCompletionDeletionKey(ownerKey: string): string {
  return `mhtoolkit.tool_completions.deleting.v1:${encodeURIComponent(ownerKey)}`;
}

export function isToolCompletion(value: unknown): value is ToolCompletion {
  if (!value || typeof value !== 'object') return false;
  const row = value as Record<string, unknown>;
  const started = typeof row.startedAt === 'string' ? Date.parse(row.startedAt) : NaN;
  const completed = typeof row.completedAt === 'string' ? Date.parse(row.completedAt) : NaN;
  return typeof row.id === 'string' && UUID.test(row.id) &&
    TOOL_COMPLETION_KINDS.includes(row.kind as ToolCompletionKind) &&
    typeof row.itemId === 'string' && row.itemId.trim().length > 0 && row.itemId.length <= 180 &&
    Number.isFinite(started) && Number.isFinite(completed) && completed >= started &&
    (row.sourceStepId === null || (typeof row.sourceStepId === 'string' &&
      row.sourceStepId.length > 0 && row.sourceStepId.length <= 256)) &&
    typeof row.partial === 'boolean' && typeof row.synced === 'boolean';
}

export function latestToolCompletionToday(rows: ToolCompletion[], now = new Date()): ToolCompletion | null {
  return rows.filter((row) => !row.partial && new Date(row.completedAt).toDateString() === now.toDateString() &&
    Date.parse(row.completedAt) <= now.getTime())
    .sort((a, b) => Date.parse(b.completedAt) - Date.parse(a.completedAt))[0] ?? null;
}

/** Serialized per profile so retries, sync acknowledgements and clears cannot lose writes. */
export function createToolCompletionStorage(storage: Storage, clock = () => new Date()) {
  const queues = new Map<string, Promise<unknown>>();
  const generations = new Map<string, number>();
  const activeDeletions = new Set<string>();
  const generation = (owner: string) => generations.get(owner) ?? 0;
  const invalidate = (owner: string) => generations.set(owner, generation(owner) + 1);
  function serial<T>(owner: string, task: () => Promise<T>): Promise<T> {
    const next = (queues.get(owner) ?? Promise.resolve()).catch(() => {}).then(task);
    queues.set(owner, next);
    void next.finally(() => { if (queues.get(owner) === next) queues.delete(owner); }).catch(() => {});
    return next;
  }
  function retain(rows: ToolCompletion[]): ToolCompletion[] {
    const now = clock().getTime();
    return rows.filter((row) => Date.parse(row.completedAt) >= now - RETENTION_MS &&
      Date.parse(row.completedAt) <= now).sort((a, b) => Date.parse(b.completedAt) - Date.parse(a.completedAt));
  }
  async function read(owner: string): Promise<ToolCompletion[]> {
    // If the process died after server deletion, the old mirror must never upload again.
    if (!activeDeletions.has(owner) && await storage.getItem(toolCompletionDeletionKey(owner))) {
      await storage.removeItem(toolCompletionsStorageKey(owner));
      await storage.removeItem(toolCompletionDeletionKey(owner));
      return [];
    }
    const raw = await storage.getItem(toolCompletionsStorageKey(owner));
    if (!raw) return [];
    try {
      const rows: unknown = JSON.parse(raw);
      return Array.isArray(rows) ? retain(rows.filter(isToolCompletion)) : [];
    } catch { return []; }
  }
  async function write(owner: string, rows: ToolCompletion[]) {
    await storage.setItem(toolCompletionsStorageKey(owner), JSON.stringify(retain(rows)));
  }
  return {
    generation,
    invalidate,
    async beginDeletion(owner: string) {
      activeDeletions.add(owner);
      try {
        await storage.setItem(toolCompletionDeletionKey(owner), 'pending');
      } catch (error) {
        activeDeletions.delete(owner);
        throw error;
      }
    },
    async endDeletion(owner: string) {
      await storage.removeItem(toolCompletionDeletionKey(owner));
      activeDeletions.delete(owner);
    },
    list: (owner: string) => serial(owner, () => read(owner)),
    add(owner: string, row: ToolCompletion, expectedGeneration = generation(owner)) {
      if (!isToolCompletion(row)) return Promise.reject(new Error('Invalid tool completion.'));
      return serial(owner, async () => {
        if (generation(owner) !== expectedGeneration) return false;
        const rows = await read(owner);
        if (rows.some((item) => item.id === row.id)) return true;
        await write(owner, [row, ...rows]);
        return true;
      });
    },
    markSynced(owner: string, ids: string[], expectedGeneration = generation(owner)) {
      return serial(owner, async () => {
        if (generation(owner) !== expectedGeneration) return;
        const wanted = new Set(ids);
        await write(owner, (await read(owner)).map((row) => wanted.has(row.id) ? { ...row, synced: true } : row));
      });
    },
    merge(owner: string, incoming: ToolCompletion[], expectedGeneration = generation(owner)) {
      return serial(owner, async () => {
        if (generation(owner) !== expectedGeneration) return;
        const rows = await read(owner);
        const known = new Set(rows.map((row) => row.id));
        await write(owner, [...rows, ...incoming.filter((row) => isToolCompletion(row) && !known.has(row.id))]);
      });
    },
    clear(owner: string) {
      invalidate(owner);
      return serial(owner, () => storage.removeItem(toolCompletionsStorageKey(owner)));
    },
    retainPending(owner: string) {
      return serial(owner, async () => write(owner, (await read(owner)).filter((row) => !row.synced)));
    },
  };
}
