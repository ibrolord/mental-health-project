import { describe, expect, it } from 'vitest';
import {
  hasMeaningfulLibraryState,
  indexLibraryItemStates,
  LIBRARY_NOTE_LIMIT,
  nextLibraryState,
  normalizeLibraryNote,
  type LibraryItemState,
} from '../../lib/library/user-state';

describe('private library state', () => {
  it('normalizes private notes at the shared application and database limit', () => {
    expect(normalizeLibraryNote('  useful note  ')).toBe('useful note');
    expect(normalizeLibraryNote(`  ${'x'.repeat(LIBRARY_NOTE_LIMIT + 10)}  `)).toHaveLength(
      LIBRARY_NOTE_LIMIT
    );
  });

  it('automatically saves anything marked up next', () => {
    expect(
      nextLibraryState(undefined, 'video', {
        priority: 'next',
      })
    ).toEqual({
      media_type: 'video',
      is_saved: true,
      priority: 'next',
      custom_notes: '',
    });
  });

  it('preserves story media type when a story is marked up next', () => {
    expect(
      nextLibraryState(undefined, 'story', {
        priority: 'next',
      })
    ).toMatchObject({
      media_type: 'story',
      is_saved: true,
      priority: 'next',
    });
  });

  it('retains note-only rows but removes completely empty state', () => {
    expect(
      hasMeaningfulLibraryState({
        is_saved: false,
        priority: 'none',
        custom_notes: 'private context',
      })
    ).toBe(true);
    expect(
      hasMeaningfulLibraryState({
        is_saved: false,
        priority: 'none',
        custom_notes: '   ',
      })
    ).toBe(false);
  });

  it('indexes rows by stable catalog id', () => {
    const row: LibraryItemState = {
      id: 'row-id',
      user_id: 'user-id',
      content_id: 'atomic-habits',
      media_type: 'book',
      is_saved: true,
      priority: 'none',
      custom_notes: '',
      created_at: '2026-07-28T00:00:00.000Z',
      updated_at: '2026-07-28T00:00:00.000Z',
    };

    expect(indexLibraryItemStates([row])).toEqual({ 'atomic-habits': row });
  });
});
