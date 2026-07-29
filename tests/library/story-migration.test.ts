import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SOURCED_QUOTE_FALLBACKS } from '../../lib/affirmations';

const migration = readFileSync(
  join(
    process.cwd(),
    'supabase/migrations/20260729121123_add_attributed_quotes_and_library_stories.sql'
  ),
  'utf8'
);

describe('quote and story migration', () => {
  it('requires quote attribution and an HTTPS source', () => {
    expect(migration).toContain("kind IN ('affirmation', 'quote')");
    expect(migration).toContain('affirmation_quote_provenance_check');
    expect(migration).toContain('attribution_name IS NOT NULL');
    expect(migration).toContain('source_title IS NOT NULL');
    expect(migration).toContain('source_url IS NOT NULL');
    expect(migration).toContain(
      "btrim(source_url) ~ '^https://[^[:space:]]+$'"
    );
    expect(migration.match(/'quote',/g)).toHaveLength(12);

    for (const quote of SOURCED_QUOTE_FALLBACKS) {
      expect(migration).toContain(`'${quote.id}'`);
      expect(migration).toContain(
        `'${quote.source_title?.replaceAll("'", "''")}'`
      );
      expect(migration).toContain(`'${quote.source_url}'`);
    }
  });

  it('expands private library and journal constraints for stories', () => {
    expect(migration).toContain("media_type IN ('book', 'video', 'story')");
    expect(migration).toContain(
      "linked_media_type IS NULL OR linked_media_type IN ('book', 'video', 'story')"
    );
    expect(migration).toContain(
      "entry_kind IN ('freeform', 'guided', 'book_note', 'video_note', 'story_note')"
    );
    expect(migration).toContain('journal_library_note_consistency_check');
    expect(migration).toContain(
      'normalize_journal_library_note_media_type_before_write'
    );
    expect(migration).toContain('IF NEW.linked_media_type IS NULL');
    expect(migration).toContain("entry_kind = 'story_note'");
    expect(migration.match(/linked_media_type IS NOT NULL/g)).toHaveLength(3);
    expect(migration).toContain("linked_media_type = 'story'");
    expect(migration).toContain(
      "linked_book_id = 'legacy-journal-' || id::text"
    );
    expect(migration).toContain('linked_book_title = NULL');
  });
});
