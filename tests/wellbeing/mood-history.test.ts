import { describe, expect, it } from 'vitest';
import {
  getLatestCheckInForDate,
  getSevenDayHistoryStart,
} from '../../lib/check-in';
import {
  getLatestCheckInForDate as getLatestMobileCheckInForDate,
  getSevenDayHistoryStart as getMobileSevenDayHistoryStart,
} from '../../mobile/lib/check-in';
import {
  collectMoodTags,
  filterMoodEntriesByTag,
} from '../../mobile/lib/mood-filter';

const implementations = [
  {
    name: 'web',
    getLatest: getLatestCheckInForDate,
    getStart: getSevenDayHistoryStart,
  },
  {
    name: 'mobile',
    getLatest: getLatestMobileCheckInForDate,
    getStart: getMobileSevenDayHistoryStart,
  },
];

describe.each(implementations)('$name mood history', ({ getLatest, getStart }) => {
  it('uses exactly seven local calendar days including today', () => {
    const now = new Date(2026, 6, 29, 17, 30, 0);
    const start = new Date(getStart(now));

    expect(start.getFullYear()).toBe(2026);
    expect(start.getMonth()).toBe(6);
    expect(start.getDate()).toBe(23);
    expect(start.getHours()).toBe(0);
  });

  it('returns the newest valid check-in for a local day', () => {
    const target = new Date(2026, 6, 29, 12, 0, 0);
    const entries = [
      { emoji: '😐', created_at: new Date(2026, 6, 29, 8, 0, 0).toISOString() },
      { emoji: '🙂', created_at: new Date(2026, 6, 29, 13, 0, 0).toISOString() },
      { emoji: '😄', created_at: new Date(2026, 6, 28, 23, 0, 0).toISOString() },
      { emoji: '😢', created_at: 'not-a-date' },
    ];

    expect(getLatest(entries, target)?.emoji).toBe('🙂');
  });
});

describe('mobile mood tag filtering', () => {
  const entries = [
    { id: 'one', tags: ['sleep', 'work'] },
    { id: 'two', tags: ['exercise'] },
    { id: 'three', tags: ['work'] },
  ];

  it('keeps the complete tag list independent of the active filter', () => {
    expect(collectMoodTags(entries)).toEqual(['sleep', 'work', 'exercise']);
  });

  it('returns only entries that contain the selected tag', () => {
    expect(filterMoodEntriesByTag(entries, 'work').map((entry) => entry.id)).toEqual([
      'one',
      'three',
    ]);
    expect(filterMoodEntriesByTag(entries, null)).toBe(entries);
  });
});
