import type { GuidedTimerState } from './guided-timer';
import type { LibraryItem, LibraryMediaType } from './library/content';
import { MEDITATION_PRACTICES } from './meditation';

export const PRACTICE_ROUTES = {
  meditation: '/meditate',
} as const;

export type PracticeType = keyof typeof PRACTICE_ROUTES;
export type PracticeRoute = (typeof PRACTICE_ROUTES)[PracticeType];

const meditationById = new Map(
  MEDITATION_PRACTICES.map((practice) => [practice.id, practice] as const)
);

export const PRACTICE_ID_ALLOWLIST = {
  meditation: new Set(MEDITATION_PRACTICES.map(({ id }) => id)),
} as const;

export interface PracticeProgressRow {
  user_id: string;
  practice_type: PracticeType;
  practice_id: string;
  route: PracticeRoute;
  step_index: number;
  step_elapsed_seconds: number;
  version: number;
  created_at: string;
  updated_at: string;
}

export type PausedPracticeProgress = Pick<
  PracticeProgressRow,
  | 'practice_type'
  | 'practice_id'
  | 'route'
  | 'step_index'
  | 'step_elapsed_seconds'
>;

type RpcError = {
  code?: string;
  message?: string;
};

export type ProductStateRpc = (
  name: 'save_practice_progress' | 'clear_practice_progress',
  args: Record<string, unknown>
) => PromiseLike<{ data: unknown; error: RpcError | null }>;

export class PracticeProgressConflictError extends Error {
  constructor() {
    super('Practice progress changed in another session.');
    this.name = 'PracticeProgressConflictError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function practiceFor(type: PracticeType, id: string) {
  if (type !== 'meditation') return null;
  return meditationById.get(id) ?? null;
}

export function isAllowedPracticeIdentity(
  practiceType: unknown,
  practiceId: unknown,
  route: unknown
): practiceType is PracticeType {
  return (
    practiceType === 'meditation' &&
    typeof practiceId === 'string' &&
    PRACTICE_ID_ALLOWLIST.meditation.has(practiceId) &&
    route === PRACTICE_ROUTES.meditation
  );
}

function isValidPausedPosition(
  practiceType: PracticeType,
  practiceId: string,
  stepIndex: number,
  stepElapsedSeconds: number
): boolean {
  const practice = practiceFor(practiceType, practiceId);
  const step = practice?.steps[stepIndex];
  return Boolean(
    step &&
      Number.isInteger(stepIndex) &&
      stepIndex >= 0 &&
      Number.isInteger(stepElapsedSeconds) &&
      stepElapsedSeconds >= 0 &&
      stepElapsedSeconds < step.seconds &&
      (stepIndex > 0 || stepElapsedSeconds > 0)
  );
}

export function pausedProgressFromTimer(
  practiceType: PracticeType,
  practiceId: string,
  timer: GuidedTimerState
): PausedPracticeProgress | null {
  if (timer.running || timer.complete) return null;
  if (
    !isValidPausedPosition(
      practiceType,
      practiceId,
      timer.stepIndex,
      timer.elapsed
    )
  ) {
    return null;
  }

  return {
    practice_type: practiceType,
    practice_id: practiceId,
    route: PRACTICE_ROUTES[practiceType],
    step_index: timer.stepIndex,
    step_elapsed_seconds: timer.elapsed,
  };
}

export function parsePracticeProgressRow(
  value: unknown
): PracticeProgressRow | null {
  if (!isRecord(value)) return null;
  if (
    !isAllowedPracticeIdentity(
      value.practice_type,
      value.practice_id,
      value.route
    ) ||
    !isNonEmptyString(value.user_id) ||
    !Number.isInteger(value.step_index) ||
    !Number.isInteger(value.step_elapsed_seconds) ||
    !Number.isInteger(value.version) ||
    (value.version as number) < 1 ||
    !isNonEmptyString(value.created_at) ||
    !isNonEmptyString(value.updated_at)
  ) {
    return null;
  }

  const practiceType = value.practice_type;
  const practiceId = value.practice_id as string;
  const stepIndex = value.step_index as number;
  const stepElapsedSeconds = value.step_elapsed_seconds as number;
  if (
    !isValidPausedPosition(
      practiceType,
      practiceId,
      stepIndex,
      stepElapsedSeconds
    )
  ) {
    return null;
  }

  return {
    user_id: value.user_id,
    practice_type: practiceType,
    practice_id: practiceId,
    route: PRACTICE_ROUTES[practiceType],
    step_index: stepIndex,
    step_elapsed_seconds: stepElapsedSeconds,
    version: value.version as number,
    created_at: value.created_at,
    updated_at: value.updated_at,
  };
}

export function pausedTimerFromProgress(
  progress: PracticeProgressRow
): GuidedTimerState {
  return {
    stepIndex: progress.step_index,
    elapsed: progress.step_elapsed_seconds,
    running: false,
    complete: false,
  };
}

function resultRow(data: unknown): unknown {
  return Array.isArray(data) ? data[0] : data;
}

function throwRpcError(error: RpcError): never {
  if (
    error.message?.includes('practice_progress_conflict') ||
    error.code === 'P0001'
  ) {
    throw new PracticeProgressConflictError();
  }
  throw new Error(error.message || 'Practice progress could not be saved.');
}

export async function savePausedPracticeProgress(
  rpc: ProductStateRpc,
  expectedUserId: string,
  progress: PausedPracticeProgress,
  expectedVersion: number
): Promise<PracticeProgressRow> {
  if (!isNonEmptyString(expectedUserId)) {
    throw new Error('Expected practice progress owner is required.');
  }
  if (!Number.isInteger(expectedVersion) || expectedVersion < 0) {
    throw new Error('Expected practice progress version must be non-negative.');
  }
  if (
    !isAllowedPracticeIdentity(
      progress.practice_type,
      progress.practice_id,
      progress.route
    ) ||
    !isValidPausedPosition(
      progress.practice_type,
      progress.practice_id,
      progress.step_index,
      progress.step_elapsed_seconds
    )
  ) {
    throw new Error('Refusing to save invalid practice progress.');
  }

  const { data, error } = await rpc('save_practice_progress', {
    p_expected_user_id: expectedUserId,
    p_practice_type: progress.practice_type,
    p_practice_id: progress.practice_id,
    p_route: progress.route,
    p_step_index: progress.step_index,
    p_step_elapsed_seconds: progress.step_elapsed_seconds,
    p_expected_version: expectedVersion,
  });
  if (error) throwRpcError(error);

  const saved = parsePracticeProgressRow(resultRow(data));
  if (
    !saved ||
    saved.user_id !== expectedUserId ||
    saved.version !== expectedVersion + 1
  ) {
    throw new Error('Practice progress returned an invalid version.');
  }
  return saved;
}

export async function clearPausedPracticeProgress(
  rpc: ProductStateRpc,
  expectedUserId: string,
  progress: PracticeProgressRow
): Promise<void> {
  const parsed = parsePracticeProgressRow(progress);
  if (!parsed) throw new Error('Refusing to clear invalid practice progress.');
  if (!isNonEmptyString(expectedUserId) || parsed.user_id !== expectedUserId) {
    throw new Error('Refusing to clear progress for another owner.');
  }

  const { data, error } = await rpc('clear_practice_progress', {
    p_expected_user_id: expectedUserId,
    p_practice_type: parsed.practice_type,
    p_practice_id: parsed.practice_id,
    p_route: parsed.route,
    p_expected_version: parsed.version,
  });
  if (error) throwRpcError(error);
  if (data !== true) throw new Error('Practice progress was not cleared.');
}

export type SavedLibraryStateRow = {
  content_id: string;
  media_type: LibraryMediaType;
  is_saved: boolean;
  priority: 'none' | 'next';
  updated_at: string;
};

export type ImportantJournalStateRow = {
  id: string;
  is_favorite: boolean;
  created_at: string;
  updated_at: string;
};

export type SavedLibraryViewItem = {
  kind: 'library';
  id: string;
  title: string;
  creator: string;
  mediaType: LibraryMediaType;
  durationLabel: string;
  topic: string;
  route: `/library?item=${string}`;
  updatedAt: string;
};

export type ImportantJournalViewItem = {
  kind: 'journal';
  id: string;
  label: 'Important journal entry';
  route: `/journal?entry=${string}`;
  createdAt: string;
  updatedAt: string;
};

export type SavedCollection = {
  upNext: SavedLibraryViewItem[];
  saved: SavedLibraryViewItem[];
  importantJournal: ImportantJournalViewItem[];
};

function savedLibraryItem(
  item: LibraryItem,
  row: SavedLibraryStateRow
): SavedLibraryViewItem {
  return {
    kind: 'library',
    id: item.id,
    title: item.title,
    creator: item.creator,
    mediaType: item.mediaType,
    durationLabel: item.durationLabel,
    topic: item.topic,
    route: `/library?item=${encodeURIComponent(item.id)}`,
    updatedAt: row.updated_at,
  };
}

export function composeSavedCollection(
  catalog: readonly LibraryItem[],
  libraryRows: readonly SavedLibraryStateRow[],
  journalRows: readonly ImportantJournalStateRow[]
): SavedCollection {
  const catalogById = new Map(catalog.map((item) => [item.id, item] as const));
  const upNext: SavedLibraryViewItem[] = [];
  const saved: SavedLibraryViewItem[] = [];

  for (const row of [...libraryRows].sort((a, b) =>
    b.updated_at.localeCompare(a.updated_at)
  )) {
    const item = catalogById.get(row.content_id);
    if (!item || item.mediaType !== row.media_type) continue;
    if (row.priority === 'next') {
      upNext.push(savedLibraryItem(item, row));
    } else if (row.is_saved) {
      saved.push(savedLibraryItem(item, row));
    }
  }

  const importantJournal = journalRows
    .filter(
      (row) =>
        row.is_favorite &&
        isNonEmptyString(row.id) &&
        isNonEmptyString(row.created_at) &&
        isNonEmptyString(row.updated_at)
    )
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
    .map(
      (row): ImportantJournalViewItem => ({
        kind: 'journal',
        id: row.id,
        label: 'Important journal entry',
        route: `/journal?entry=${encodeURIComponent(row.id)}`,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      })
    );

  return { upNext, saved, importantJournal };
}
