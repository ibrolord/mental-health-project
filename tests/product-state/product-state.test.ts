import { describe, expect, it } from 'vitest';
import { UNIFIED_LIBRARY } from '../../lib/library/content';
import { MEDITATION_PRACTICES } from '../../lib/meditation';
import {
  PracticeProgressConflictError,
  clearPausedPracticeProgress,
  composeSavedCollection,
  parsePracticeProgressRow,
  pausedProgressFromTimer,
  pausedTimerFromProgress,
  savePausedPracticeProgress,
  type ImportantJournalStateRow,
  type PracticeProgressRow,
} from '../../lib/product-state';

const practice = MEDITATION_PRACTICES[0];

function progressRow(
  patch: Partial<PracticeProgressRow> = {}
): PracticeProgressRow {
  return {
    user_id: 'owner-1',
    practice_type: 'meditation',
    practice_id: practice.id,
    route: '/meditate',
    step_index: 0,
    step_elapsed_seconds: 5,
    version: 1,
    created_at: '2026-08-08T20:00:00.000Z',
    updated_at: '2026-08-08T20:00:00.000Z',
    ...patch,
  };
}

describe('paused practice product state', () => {
  it('creates snapshots only for valid paused, incomplete progress', () => {
    expect(
      pausedProgressFromTimer('meditation', practice.id, {
        stepIndex: 0,
        elapsed: 5,
        running: false,
        complete: false,
      })
    ).toEqual({
      practice_type: 'meditation',
      practice_id: practice.id,
      route: '/meditate',
      step_index: 0,
      step_elapsed_seconds: 5,
    });
    expect(
      pausedProgressFromTimer('meditation', practice.id, {
        stepIndex: 0,
        elapsed: 5,
        running: true,
        complete: false,
      })
    ).toBeNull();
    expect(
      pausedProgressFromTimer('meditation', practice.id, {
        stepIndex: 0,
        elapsed: practice.steps[0].seconds,
        running: false,
        complete: true,
      })
    ).toBeNull();
    expect(
      pausedProgressFromTimer('meditation', practice.id, {
        stepIndex: 0,
        elapsed: 0,
        running: false,
        complete: false,
      })
    ).toBeNull();
  });

  it('rejects unallowlisted identities and always restores paused', () => {
    expect(parsePracticeProgressRow(progressRow({ route: '/journal' as '/meditate' }))).toBeNull();
    expect(parsePracticeProgressRow(progressRow({ practice_id: 'arbitrary-id' }))).toBeNull();
    expect(
      parsePracticeProgressRow(
        progressRow({ step_elapsed_seconds: practice.steps[0].seconds })
      )
    ).toBeNull();
    expect(pausedTimerFromProgress(progressRow())).toEqual({
      stepIndex: 0,
      elapsed: 5,
      running: false,
      complete: false,
    });
  });

  it('classifies optimistic concurrency rejection deterministically', async () => {
    const draft = pausedProgressFromTimer('meditation', practice.id, {
      stepIndex: 0,
      elapsed: 5,
      running: false,
      complete: false,
    });
    expect(draft).not.toBeNull();

    await expect(
      savePausedPracticeProgress(
        async () => ({
          data: null,
          error: { code: 'P0001', message: 'practice_progress_conflict' },
        }),
        'owner-1',
        draft!,
        1
      )
    ).rejects.toBeInstanceOf(PracticeProgressConflictError);
  });

  it('binds save and clear RPCs to the captured owner identity', async () => {
    const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
    const rpc = async (name: string, args: Record<string, unknown>) => {
      calls.push({ name, args });
      return name === 'save_practice_progress'
        ? { data: progressRow(), error: null }
        : { data: true, error: null };
    };
    const draft = pausedProgressFromTimer('meditation', practice.id, {
      stepIndex: 0,
      elapsed: 5,
      running: false,
      complete: false,
    });

    await savePausedPracticeProgress(rpc, 'owner-1', draft!, 0);
    await clearPausedPracticeProgress(rpc, 'owner-1', progressRow());

    expect(calls).toHaveLength(2);
    expect(calls[0].args.p_expected_user_id).toBe('owner-1');
    expect(calls[1].args.p_expected_user_id).toBe('owner-1');
    await expect(
      clearPausedPracticeProgress(rpc, 'owner-2', progressRow())
    ).rejects.toThrow('another owner');
  });
});

describe('Saved composition', () => {
  it('composes released library metadata and opaque journal markers only', () => {
    const [upNextItem, savedItem] = UNIFIED_LIBRARY;
    const journalRows: Array<ImportantJournalStateRow & { title: string; content: string }> = [
      {
        id: 'journal-1',
        is_favorite: true,
        created_at: '2026-08-07T10:00:00.000Z',
        updated_at: '2026-08-08T10:00:00.000Z',
        title: 'Private title',
        content: 'Private writing',
      },
    ];

    const collection = composeSavedCollection(
      UNIFIED_LIBRARY,
      [
        {
          content_id: upNextItem.id,
          media_type: upNextItem.mediaType,
          is_saved: true,
          priority: 'next',
          updated_at: '2026-08-08T12:00:00.000Z',
        },
        {
          content_id: savedItem.id,
          media_type: savedItem.mediaType,
          is_saved: true,
          priority: 'none',
          updated_at: '2026-08-08T11:00:00.000Z',
        },
        {
          content_id: 'not-in-the-released-catalog',
          media_type: 'book',
          is_saved: true,
          priority: 'next',
          updated_at: '2026-08-08T13:00:00.000Z',
        },
      ],
      journalRows
    );

    expect(collection.upNext.map(({ id }) => id)).toEqual([upNextItem.id]);
    expect(collection.saved.map(({ id }) => id)).toEqual([savedItem.id]);
    expect(collection.importantJournal).toEqual([
      {
        kind: 'journal',
        id: 'journal-1',
        label: 'Important journal entry',
        route: '/journal?entry=journal-1',
        createdAt: '2026-08-07T10:00:00.000Z',
        updatedAt: '2026-08-08T10:00:00.000Z',
      },
    ]);
    expect(collection.importantJournal[0]).not.toHaveProperty('title');
    expect(collection.importantJournal[0]).not.toHaveProperty('content');
    expect(collection.upNext[0].route).toBe(
      `/library?item=${encodeURIComponent(upNextItem.id)}`
    );
  });
});
