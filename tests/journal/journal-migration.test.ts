import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  resolve(
    process.cwd(),
    'supabase/migrations/20260726212513_add_private_journal_entries.sql'
  ),
  'utf8'
);

const privilegeFix = readFileSync(
  resolve(
    process.cwd(),
    'supabase/migrations/20260726212644_restrict_journal_table_privileges.sql'
  ),
  'utf8'
);

describe('private journal migration', () => {
  it('uses authenticated-only grants and owner-scoped RLS for every operation', () => {
    expect(migration).toContain(
      'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.journal_entries TO authenticated'
    );
    expect(migration).toContain(
      'FROM PUBLIC, anon, authenticated, service_role'
    );
    expect(privilegeFix).toContain(
      'FROM PUBLIC, anon, authenticated, service_role'
    );
    expect(privilegeFix).not.toMatch(/\bTRUNCATE\b/);
    expect(migration).toContain(
      'ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY'
    );
    expect(migration.match(/\(SELECT auth\.uid\(\)\) = user_id/g)).toHaveLength(5);
    expect(migration).toContain('FOR UPDATE');
    expect(migration).toContain('WITH CHECK ((SELECT auth.uid()) = user_id)');
  });

  it('keeps journal content in the account deletion transaction', () => {
    expect(migration).toContain(
      'DELETE FROM public.journal_entries WHERE user_id = p_user_id'
    );
    expect(migration).toContain('SET search_path =');
    expect(migration).toContain('GRANT EXECUTE ON FUNCTION public.delete_owned_data');
  });

  it('constrains user-authored content at the database boundary', () => {
    expect(migration).toContain('journal_title_length');
    expect(migration).toContain('journal_content_length');
    expect(migration).toContain('journal_prompt_length');
    expect(migration).toContain("entry_kind IN ('freeform', 'guided', 'book_note')");
    expect(migration).toContain('cardinality(tags) <= 12');
  });
});
