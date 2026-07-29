import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  resolve(
    process.cwd(),
    'supabase/migrations/20260728151316_add_user_library_items.sql'
  ),
  'utf8'
);

describe('private unified library migration', () => {
  it('uses explicit grants and owner-scoped RLS for every write path', () => {
    expect(migration).toContain(
      'ALTER TABLE public.user_library_items ENABLE ROW LEVEL SECURITY'
    );
    expect(migration).toContain(
      'REVOKE ALL ON TABLE public.user_library_items\n  FROM PUBLIC, anon, authenticated, service_role'
    );
    expect(migration).toContain(
      'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.user_library_items\n  TO authenticated'
    );
    expect(migration.match(/\(SELECT auth\.uid\(\)\) = user_id/g)).toHaveLength(5);
    expect(migration).toContain('FOR UPDATE');
    expect(migration).toContain('WITH CHECK ((SELECT auth.uid()) = user_id)');
  });

  it('constrains ids, media, priority, notes, and per-user uniqueness', () => {
    expect(migration).toContain('user_library_content_id_length');
    expect(migration).toContain("media_type IN ('book', 'video')");
    expect(migration).toContain("priority IN ('none', 'next')");
    expect(migration).toContain('char_length(custom_notes) <= 4000');
    expect(migration).toContain('UNIQUE (user_id, content_id)');
  });

  it('adds video notes without invalidating released mobile book-note writes', () => {
    expect(migration).toContain('ADD COLUMN linked_media_type TEXT');
    expect(migration).toContain(
      "linked_media_type IS NULL OR linked_media_type IN ('book', 'video')"
    );
    expect(migration).toContain(
      "entry_kind IN ('freeform', 'guided', 'book_note', 'video_note')"
    );
    expect(migration).not.toContain('linked_media_type TEXT NOT NULL');
  });

  it('keeps private library state inside transactional account deletion', () => {
    expect(migration).toContain(
      'DELETE FROM public.user_library_items WHERE user_id = p_user_id'
    );
    expect(migration).toContain("SET search_path = ''");
    expect(migration).toContain(
      'GRANT EXECUTE ON FUNCTION public.delete_owned_data(uuid, text) TO service_role'
    );
  });
});
