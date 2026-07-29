import { describe, expect, it } from 'vitest';
import {
  BOOK_LIBRARY_ITEMS,
  filterLibraryItems,
  STORY_LIBRARY_ITEMS,
  UNIFIED_LIBRARY,
  VIDEO_LIBRARY_ITEMS,
} from '../../lib/library/content';

describe('unified library catalog', () => {
  it('combines every reviewed book, video, and story without id collisions', () => {
    expect(BOOK_LIBRARY_ITEMS).toHaveLength(58);
    expect(VIDEO_LIBRARY_ITEMS).toHaveLength(35);
    expect(STORY_LIBRARY_ITEMS).toHaveLength(14);
    expect(UNIFIED_LIBRARY).toHaveLength(107);
    expect(new Set(UNIFIED_LIBRARY.map(({ id }) => id)).size).toBe(107);
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
});
