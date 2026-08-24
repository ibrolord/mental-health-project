import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
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

const webJournalPage = readFileSync(
  resolve(process.cwd(), 'app/journal/page.tsx'),
  'utf8'
);
const mobileJournalPage = readFileSync(
  resolve(process.cwd(), 'mobile/app/journal.tsx'),
  'utf8'
);

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

  it('allows a voice-only draft only when a recording is ready to persist', () => {
    const emptyDraft = emptyJournalDraft();

    expect(validateJournalDraft(emptyDraft, { hasVoiceRecording: true })).not.toContain(
      'Write something before saving.'
    );
    expect(validateJournalDraft(emptyDraft)).toContain(
      'Write something before saving.'
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
      linkedMediaType: 'book',
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
      linked_media_type: 'book',
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
    const webPrepared = prepareJournalDraft(draft);
    expect(webPrepared.linked_media_type).toBeNull();
    expect(prepareMobileJournalDraft(draft)).toEqual(webPrepared);
  });

  it('prepares video notes as a distinct library journal entry', () => {
    const prepared = prepareJournalDraft({
      ...emptyJournalDraft(),
      content: 'One idea I want to test',
      entryKind: 'video_note',
      linkedBookId: 'video-anxiety-stress-friend',
      linkedBookTitle: 'How to make stress your friend',
      linkedMediaType: 'video',
    });

    expect(prepared.entry_kind).toBe('video_note');
    expect(prepared.linked_media_type).toBe('video');
  });

  it('prepares story notes as a distinct library journal entry', () => {
    const draft = {
      ...emptyJournalDraft(),
      content: 'A part of this story that stayed with me',
      entryKind: 'story_note' as const,
      linkedBookId: 'story-sangu-delle-mental-health',
      linkedBookTitle: "There's no shame in taking care of your mental health",
      linkedMediaType: 'story' as const,
    };

    const prepared = prepareJournalDraft(draft);
    expect(prepared.entry_kind).toBe('story_note');
    expect(prepared.linked_media_type).toBe('story');
    expect(prepareMobileJournalDraft(draft)).toEqual(prepared);
  });

  it('rejects library notes without a stable item id or with a mismatched source type', () => {
    expect(
      validateJournalDraft({
        ...emptyJournalDraft(),
        content: 'A useful reflection',
        entryKind: 'story_note',
        linkedMediaType: 'story',
      })
    ).toContain('Choose a library item before saving this note.');

    expect(
      validateJournalDraft({
        ...emptyJournalDraft(),
        content: 'A useful reflection',
        entryKind: 'story_note',
        linkedBookId: 'story-sangu-delle-mental-health',
        linkedMediaType: 'book',
      })
    ).toContain('This library note does not match its source type.');
  });

  it('clears stale library linkage from non-library entries', () => {
    const draft = {
      ...emptyJournalDraft(),
      content: 'A standalone note',
      linkedBookId: 'story-sangu-delle-mental-health',
      linkedBookTitle: 'A story',
      linkedMediaType: 'story' as const,
    };

    const prepared = prepareJournalDraft(draft);
    expect(prepared.linked_book_id).toBeNull();
    expect(prepared.linked_book_title).toBeNull();
    expect(prepared.linked_media_type).toBeNull();
    expect(prepareMobileJournalDraft(draft)).toEqual(prepared);
  });

  it('does not clear a linked draft when effects repeat for the same owner', () => {
    for (const source of [webJournalPage, mobileJournalPage]) {
      expect(source).toContain(
        'ownerIdentityRef.current?.userId === context.user_id'
      );
      expect(source).toContain(
        'ownerIdentityRef.current = { userId: context.user_id }'
      );
    }
  });
});
