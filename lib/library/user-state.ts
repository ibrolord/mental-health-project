import type { LibraryMediaType } from './content';

export const LIBRARY_NOTE_LIMIT = 4000;

export type LibraryPriority = 'none' | 'next';

export interface LibraryItemState {
  id: string;
  user_id: string;
  content_id: string;
  media_type: LibraryMediaType;
  is_saved: boolean;
  priority: LibraryPriority;
  custom_notes: string;
  created_at: string;
  updated_at: string;
}

export type LibraryItemStateDraft = Pick<
  LibraryItemState,
  'media_type' | 'is_saved' | 'priority' | 'custom_notes'
>;

export const EMPTY_LIBRARY_ITEM_STATE: LibraryItemStateDraft = {
  media_type: 'book',
  is_saved: false,
  priority: 'none',
  custom_notes: '',
};

export function normalizeLibraryNote(value: string): string {
  return value.trim().slice(0, LIBRARY_NOTE_LIMIT);
}

export function indexLibraryItemStates(
  rows: readonly LibraryItemState[]
): Record<string, LibraryItemState> {
  return Object.fromEntries(rows.map((row) => [row.content_id, row]));
}

export function hasMeaningfulLibraryState(
  state: Pick<LibraryItemStateDraft, 'is_saved' | 'priority' | 'custom_notes'>
): boolean {
  return (
    state.is_saved ||
    state.priority !== 'none' ||
    normalizeLibraryNote(state.custom_notes).length > 0
  );
}

export function nextLibraryState(
  current: LibraryItemStateDraft | undefined,
  mediaType: LibraryMediaType,
  patch: Partial<LibraryItemStateDraft>
): LibraryItemStateDraft {
  const next = {
    ...EMPTY_LIBRARY_ITEM_STATE,
    ...current,
    media_type: mediaType,
    ...patch,
  };

  if (next.priority === 'next') {
    next.is_saved = true;
  }

  next.custom_notes = normalizeLibraryNote(next.custom_notes);
  return next;
}
