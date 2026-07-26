import { describe, expect, it } from 'vitest';
import {
  deriveJournalTitle,
  emptyJournalDraft,
  JOURNAL_LIMITS,
  JOURNAL_PROMPTS,
  normalizeJournalTags,
  prepareJournalDraft,
  validateJournalDraft,
} from '../../lib/journal';
import {
  JOURNAL_LIMITS as MOBILE_JOURNAL_LIMITS,
  JOURNAL_PROMPTS as MOBILE_JOURNAL_PROMPTS,
  prepareJournalDraft as prepareMobileJournalDraft,
} from '../../mobile/lib/journal';

describe('journal helpers', () => {
  it('derives a title from the first meaningful line', () => {
    expect(deriveJournalTitle('', '\n  A useful first line  \nMore detail')).toBe(
      'A useful first line'
    );
  });

  it('normalizes, deduplicates, and caps tags', () => {
    const tags = normalizeJournalTags(
      ['Work', ' work ', ...Array.from({ length: 20 }, (_, index) => `tag-${index}`)].join(',')
    );

    expect(tags[0]).toBe('Work');
    expect(tags).toHaveLength(JOURNAL_LIMITS.tags);
    expect(tags.filter((tag) => tag.toLocaleLowerCase() === 'work')).toHaveLength(1);
  });

  it('rejects empty and oversized entries before a database write', () => {
    expect(validateJournalDraft(emptyJournalDraft())).toContain(
      'Write something before saving.'
    );

    expect(
      validateJournalDraft({
        ...emptyJournalDraft(),
        content: 'x'.repeat(JOURNAL_LIMITS.content + 1),
      })
    ).toContain(
      `Keep the entry under ${JOURNAL_LIMITS.content.toLocaleString()} characters.`
    );
  });

  it('prepares a private book note with normalized nullable fields', () => {
    const prepared = prepareJournalDraft({
      ...emptyJournalDraft(),
      content: '  My reflection  ',
      prompt: '  What matters?  ',
      entryKind: 'book_note',
      linkedBookId: ' atomic-habits ',
      linkedBookTitle: ' Atomic Habits ',
      tags: 'habits, Habits, next step',
      isFavorite: true,
    });

    expect(prepared).toEqual({
      title: 'My reflection',
      content: 'My reflection',
      prompt: 'What matters?',
      entry_kind: 'book_note',
      linked_book_id: 'atomic-habits',
      linked_book_title: 'Atomic Habits',
      tags: ['habits', 'next step'],
      is_favorite: true,
    });
  });

  it('keeps mobile and web journal behavior aligned', () => {
    const draft = {
      ...emptyJournalDraft(),
      content: 'Aligned entry',
      tags: 'one, two',
    };

    expect(MOBILE_JOURNAL_LIMITS).toEqual(JOURNAL_LIMITS);
    expect(MOBILE_JOURNAL_PROMPTS).toEqual(JOURNAL_PROMPTS);
    expect(prepareMobileJournalDraft(draft)).toEqual(prepareJournalDraft(draft));
  });
});
