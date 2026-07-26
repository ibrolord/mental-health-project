import { describe, expect, it } from 'vitest';
import {
  applyEditorialReview,
  CURATED_LIBRARY,
  type BookRecord,
} from '../../lib/library/editorial';
import {
  applyEditorialReview as applyMobileEditorialReview,
  CURATED_LIBRARY as MOBILE_CURATED_LIBRARY,
} from '../../mobile/lib/library/editorial';

const seededTitles = [
  'Atomic Habits',
  'The Happiness Trap',
  'Feeling Good',
  'When the Body Says No',
  'Burnout: The Secret to Unlocking the Stress Cycle',
  'The Gifts of Imperfection',
  'The Body Keeps the Score',
  'Mindset',
];

function book(title: string): BookRecord {
  return {
    id: title,
    title,
    author: 'Author',
    summary: 'Unsafe database summary',
    takeaways: ['Unsafe database takeaway'],
    quote: 'Unverified quote',
    action_step: 'Unsafe database action',
    tags: ['raw', 'database', 'tags'],
    read_time_minutes: 5,
  };
}

describe('library editorial review', () => {
  it('has a reviewed override for every seeded book and removes quotes', () => {
    for (const title of seededTitles) {
      const reviewed = applyEditorialReview(book(title));
      expect(reviewed).not.toBeNull();
      expect(reviewed?.summary).not.toContain('Unsafe database');
      expect(reviewed?.quote).toBeNull();
      expect(reviewed?.displayTags.length).toBeGreaterThan(0);
      expect(reviewed?.editorialNote).toBeTruthy();
      expect(reviewed?.centralPremise.length).toBeGreaterThan(120);
      expect(reviewed?.corePremises).toHaveLength(4);
      expect(reviewed?.practicalTakeaways).toHaveLength(3);
      expect(reviewed?.reflectionPrompts).toHaveLength(3);
      expect(reviewed?.sources.length).toBeGreaterThanOrEqual(2);
      expect(reviewed?.sources.every(({ url }) => url.startsWith('https://'))).toBe(true);
      expect(reviewed?.integrations.map(({ actionType }) => actionType).sort()).toEqual([
        'goal',
        'habit',
        'journal',
      ]);
    }
  });

  it('fails closed for unreviewed database additions', () => {
    expect(applyEditorialReview(book('Unreviewed title'))).toBeNull();
  });

  it('ships a complete reviewed catalog without a network dependency', () => {
    expect(CURATED_LIBRARY.map(({ title }) => title)).toEqual([...seededTitles].sort());
    expect(CURATED_LIBRARY.every(({ quote }) => quote === null)).toBe(true);
    expect(CURATED_LIBRARY.every(({ read_time_minutes }) => read_time_minutes >= 15)).toBe(true);
    expect(MOBILE_CURATED_LIBRARY).toEqual(CURATED_LIBRARY);
  });

  it('flags debated medical claims instead of presenting them as fact', () => {
    const reviewed = applyEditorialReview(book('When the Body Says No'));
    expect(reviewed?.summary).toContain('debated');
    expect(reviewed?.summary).toContain('medical evaluation');
  });

  it('keeps mobile and web editorial content aligned', () => {
    for (const title of seededTitles) {
      expect(applyMobileEditorialReview(book(title))).toEqual(applyEditorialReview(book(title)));
    }
  });
});
