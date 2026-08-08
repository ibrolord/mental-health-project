pyenv: cannot rehash: /Users/ibrobaba/.pyenv/shims isn't writable
pyenv: cannot rehash: /Users/ibrobaba/.pyenv/shims isn't writable
import { describe, expect, it } from 'vitest';
import {
  BOOK_PRACTICE_TEMPLATES,
  BOOK_LIBRARY_ITEMS,
  filterBookPracticeTemplates,
  filterLibraryItems,
  practiceDestinationFor,
  STORY_LIBRARY_ITEMS,
  UNIFIED_LIBRARY,
  VIDEO_LIBRARY_ITEMS,
} from '../../lib/library/content';
import {
  BOOK_PRACTICE_TEMPLATES as MOBILE_BOOK_PRACTICE_TEMPLATES,
} from '../../mobile/lib/library/content';
import { ROUTINE_TEMPLATES } from '../../lib/wellbeing/habits';
import { ROUTINE_TEMPLATES as MOBILE_ROUTINE_TEMPLATES } from '../../mobile/lib/wellbeing/habits';

describe('unified library catalog', () => {
  it('combines every reviewed book, video, and story without id collisions', () => {
    expect(BOOK_LIBRARY_ITEMS).toHaveLength(59);
    expect(VIDEO_LIBRARY_ITEMS).toHaveLength(35);
    expect(STORY_LIBRARY_ITEMS).toHaveLength(14);
    expect(UNIFIED_LIBRARY).toHaveLength(108);
    expect(new Set(UNIFIED_LIBRARY.map(({ id }) => id)).size).toBe(108);
  });

  it('filters by media, need, and useful content rather than title alone', () => {
    const anxietyVideos = filterLibraryItems(UNIFIED_LIBRARY, {
      query: '',
      topic: 'Anxiety & stress',
      media: 'video',
    });
    expect(anxietyVideos).toHaveLength(5);
    expect(anxietyVideos.every(({ mediaType }) => mediaType === 'video')).toBe(true);

    const creatorMatch = filterLibraryItems(UNIFIED_LIBRARY, {
      query: 'Kelly McGonigal',
      topic: 'All',
      media: 'all',
    });
    expect(creatorMatch.some(({ title }) => title === 'How to make stress your friend')).toBe(true);

    const takeawayMatch = filterLibraryItems(UNIFIED_LIBRARY, {
      query: 'reduce isolation',
      topic: 'All',
      media: 'all',
    });
    expect(takeawayMatch.map(({ title }) => title)).toContain('How to make stress your friend');

    const africanStories = filterLibraryItems(UNIFIED_LIBRARY, {
      query: 'South Africa',
      topic: 'All',
      media: 'story',
    });
    expect(africanStories.length).toBeGreaterThanOrEqual(2);
    expect(africanStories.every(({ mediaType }) => mediaType === 'story')).toBe(true);

    const narrativeMatch = filterLibraryItems(UNIFIED_LIBRARY, {
      query: 'next right move',
      topic: 'All',
      media: 'story',
    });
    expect(narrativeMatch.map(({ creator }) => creator)).toContain('Oprah Winfrey');
  });

  it('keeps saved and up-next views tied to explicit user state', () => {
    const savedIds = new Set(['atomic-habits', 'video-anxiety-stress-friend']);
    const nextIds = new Set(['video-anxiety-stress-friend']);

    expect(
      filterLibraryItems(UNIFIED_LIBRARY, {
        query: '',
        topic: 'All',
        media: 'saved',
        savedIds,
        nextIds,
      }).map(({ id }) => id)
    ).toEqual(expect.arrayContaining([...savedIds]));

    expect(
      filterLibraryItems(UNIFIED_LIBRARY, {
        query: '',
        topic: 'All',
        media: 'next',
        savedIds,
        nextIds,
      }).map(({ id }) => id)
    ).toEqual(['video-anxiety-stress-friend']);
  });

  it('publishes only curated, source-attributed tools with varied destinations', () => {
    expect(BOOK_PRACTICE_TEMPLATES).toHaveLength(25);
    expect(new Set(BOOK_PRACTICE_TEMPLATES.map(({ id }) => id)).size).toBe(25);
    expect(new Set(BOOK_PRACTICE_TEMPLATES.map(({ book }) => book.id))).toHaveLength(9);

    const actionsByBook = new Set(
      [...new Set(BOOK_PRACTICE_TEMPLATES.map(({ book }) => book.id))].map((bookId) =>
        BOOK_PRACTICE_TEMPLATES.filter(({ book }) => book.id === bookId)
          .map(({ integration }) => integration.actionType)
          .sort()
          .join(',')
      )
    );
    expect(actionsByBook.size).toBeGreaterThan(3);

    const genericTitles = [
      'Connect the guide to your experience',
      'Choose one next step',
      'Practice before expanding',
    ];
    expect(
      BOOK_PRACTICE_TEMPLATES.some(({ integration }) =>
        genericTitles.includes(integration.title)
      )
    ).toBe(false);

    for (const { book, integration } of BOOK_PRACTICE_TEMPLATES) {
      expect(book.mediaType).toBe('book');
      expect(book.title).toBeTruthy();
      expect(book.author).toBeTruthy();

      if (integration.actionType === 'journal') expect(integration.prompt?.trim()).toBeTruthy();
      if (integration.actionType === 'goal') expect(integration.goalContent?.trim()).toBeTruthy();
      if (integration.actionType === 'habit') expect(integration.habitName?.trim()).toBeTruthy();
      if (integration.actionType === 'routine') {
        expect(integration.routineId?.trim()).toBeTruthy();
        expect(ROUTINE_TEMPLATES.some(({ id }) => id === integration.routineId)).toBe(true);
      }

      const prefill =
        integration.prompt ??
        integration.goalContent ??
        integration.habitDescription ??
        integration.habitName ??
        '';
      const params = new URLSearchParams({
        source: 'library',
        item: book.id,
        itemTitle: book.title,
        mediaType: 'book',
        book: book.id,
        bookTitle: book.title,
        prefill,
      });
      expect(params.toString().length).toBeLessThan(1800);
    }

    expect(MOBILE_BOOK_PRACTICE_TEMPLATES).toEqual(BOOK_PRACTICE_TEMPLATES);
    expect(MOBILE_ROUTINE_TEMPLATES).toEqual(ROUTINE_TEMPLATES);
  });

  it('filters practice templates by action, topic, source book, and template content', () => {
    const defusion = filterBookPracticeTemplates(BOOK_PRACTICE_TEMPLATES, {
      query: 'Practice defusion on paper',
      topic: 'All',
      action: 'journal',
    });
    expect(defusion).toHaveLength(1);
    expect(defusion[0].book.title).toBe('The Happiness Trap');

    const recoveryRoutines = filterBookPracticeTemplates(BOOK_PRACTICE_TEMPLATES, {
      query: '',
      topic: 'Burnout & recovery',
      action: 'routine',
    });
    expect(recoveryRoutines).toHaveLength(1);
    expect(recoveryRoutines[0].integration.routineId).toBe('burnout-recovery-reset');
  });

  it('routes each tool type to its matching product flow', () => {
    const destinationByAction = Object.fromEntries(
      BOOK_PRACTICE_TEMPLATES.map(({ integration }) => [
        integration.actionType,
        practiceDestinationFor(integration),
      ])
    );

    expect(destinationByAction.journal?.pathname).toBe('/journal');
    expect(destinationByAction.goal?.pathname).toBe('/goals');
    expect(destinationByAction.habit?.pathname).toBe('/habits');
    expect(destinationByAction.routine).toEqual({
      pathname: '/habits',
      params: {
        view: 'routines',
        template: expect.stringMatching(
          /^(atomic-habit-loop|burnout-recovery-reset|motivation-restart|evening-wind-down)$/
        ),
      },
    });
  });
});
