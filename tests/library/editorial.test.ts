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
import { ADDITIONAL_BOOKS } from '../../mobile/lib/library/additional-books';

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
    const expectedTitles = [
      ...seededTitles,
      ...ADDITIONAL_BOOKS.map(({ title }) => title),
    ].sort((a, b) => a.localeCompare(b));

    expect(ADDITIONAL_BOOKS).toHaveLength(51);
    expect(CURATED_LIBRARY).toHaveLength(59);
    expect(CURATED_LIBRARY.map(({ title }) => title)).toEqual(expectedTitles);
    expect(CURATED_LIBRARY.every(({ quote }) => quote === null)).toBe(true);
    expect(CURATED_LIBRARY.every(({ read_time_minutes }) => read_time_minutes >= 13)).toBe(true);
    expect(MOBILE_CURATED_LIBRARY).toEqual(CURATED_LIBRARY);
  });

  it('keeps every supplemental guide substantial, source-backed, and actionable', () => {
    const ids = ADDITIONAL_BOOKS.map(({ id }) => id);
    const titles = ADDITIONAL_BOOKS.map(({ title }) => title);

    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(titles).size).toBe(titles.length);

    for (const draft of ADDITIONAL_BOOKS) {
      expect(draft.summary.length).toBeGreaterThan(120);
      expect(draft.centralPremise.length).toBeGreaterThan(120);
      expect(draft.corePremises).toHaveLength(3);
      expect(draft.practicalTakeaways).toHaveLength(3);
      expect(draft.reflectionPrompts).toHaveLength(3);
      expect(draft.sources.length).toBeGreaterThanOrEqual(1);
      expect(draft.sources.every(({ url }) => url.startsWith('https://'))).toBe(true);
      expect(draft.medicalCaveat?.length).toBeGreaterThan(100);

      for (const premise of draft.corePremises) {
        expect(premise.title.length).toBeGreaterThan(5);
        expect(premise.premise.length).toBeGreaterThan(80);
        expect(premise.whyItMatters.length).toBeGreaterThan(60);
        expect(premise.practice.length).toBeGreaterThan(50);
      }

      for (const takeaway of draft.practicalTakeaways) {
        expect(takeaway.description.length).toBeGreaterThan(45);
        expect(takeaway.nextStep.length).toBeGreaterThan(50);
      }

      const reviewed = applyEditorialReview(book(draft.title));
      expect(reviewed).not.toBeNull();
      expect(reviewed?.quote).toBeNull();
      expect(reviewed?.sources).toEqual(draft.sources);
      expect([...new Set(reviewed?.integrations.map(({ actionType }) => actionType))]).toEqual(
        expect.arrayContaining(['goal', 'habit', 'journal'])
      );
    }
  });

  it('flags debated medical claims instead of presenting them as fact', () => {
    const reviewed = applyEditorialReview(book('When the Body Says No'));
    expect(reviewed?.summary).toContain('debated');
    expect(reviewed?.summary).toContain('medical evaluation');

    const somaticGuide = applyEditorialReview(book('Waking the Tiger'));
    expect(somaticGuide?.medicalCaveat).toContain('debated');
    expect(somaticGuide?.medicalCaveat).toContain('Do not use sensation practices to recover memories');
  });

  it('ships the Julie Smith guide with distinct, routed tool templates', () => {
    const reviewed = applyEditorialReview(book('Why Has Nobody Told Me This Before?'));
    expect(reviewed?.integrations).toHaveLength(8);
    expect(new Set(reviewed?.integrations.map(({ actionType }) => actionType))).toEqual(
      new Set(['goal', 'habit', 'journal', 'routine'])
    );
    expect(reviewed?.integrations.map(({ title }) => title)).toEqual([
      'State snapshot',
      'Five-minute activation experiment',
      'Start before ready',
      'Thought distance check',
      'Motivation reset',
      'Sleep landing plan',
      'Confidence evidence log',
      'Support threshold plan',
    ]);
  });

  it('keeps mobile and web editorial content aligned', () => {
    for (const title of [
      ...seededTitles,
      ...ADDITIONAL_BOOKS.map(({ title }) => title),
    ]) {
      expect(applyMobileEditorialReview(book(title))).toEqual(applyEditorialReview(book(title)));
    }
  });
});
