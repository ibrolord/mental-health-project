import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MEDITATION_PRACTICES } from '../../lib/meditation';

const migrationsDirectory = resolve(process.cwd(), 'supabase/migrations');
const migrationName = '20260808233054_add_practice_progress.sql';
const migration = readFileSync(resolve(migrationsDirectory, migrationName), 'utf8');

describe('owner-only practice progress migration', () => {
  it('creates the owned table once and allowlists released identities and route', () => {
    const creators = readdirSync(migrationsDirectory).filter((file) =>
      readFileSync(resolve(migrationsDirectory, file), 'utf8').includes(
        'CREATE TABLE public.practice_progress'
      )
    );
    expect(creators).toEqual([migrationName]);
    expect(migration).toContain("practice_type = 'meditation'");
    expect(migration).toContain("route = '/meditate'");
    for (const practice of MEDITATION_PRACTICES) {
      expect(migration).toContain(`'${practice.id}'`);
    }

    const tableDefinition = migration.slice(
      0,
      migration.indexOf('COMMENT ON TABLE public.practice_progress')
    );
    expect(tableDefinition).not.toMatch(/\brunning\b/);
  });

  it('uses owner RLS and permits authenticated mutations only through RPCs', () => {
    expect(migration).toContain(
      'ALTER TABLE public.practice_progress ENABLE ROW LEVEL SECURITY'
    );
    expect(migration).toContain(
      'REVOKE ALL ON TABLE public.practice_progress\n  FROM PUBLIC, anon, authenticated, service_role'
    );
    expect(migration).toContain(
      'GRANT SELECT ON TABLE public.practice_progress TO authenticated'
    );
    expect(migration).not.toContain(
      'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.practice_progress TO authenticated'
    );
    expect(migration.match(/\(SELECT auth\.uid\(\)\) = user_id/g)).toHaveLength(5);
    expect(migration).toContain('TO authenticated;');
  });

  it('rejects stale inserts, updates, and clears with version checks', () => {
    expect(migration).toContain(
      'ON CONFLICT (user_id, practice_type) DO NOTHING'
    );
    expect(migration).toContain('version = version + 1');
    expect(migration).toContain('AND version = p_expected_version');
    expect(migration.match(/MESSAGE = 'practice_progress_conflict'/g)).toHaveLength(2);
    expect(migration).toContain('p_expected_version < 0');
    expect(migration).toContain('p_expected_version < 1');
    expect(migration).toContain('p_expected_user_id <> v_user_id');
    expect(
      migration.match(/MESSAGE = 'practice_progress_owner_changed'/g)
    ).toHaveLength(2);
  });

  it('keeps paused state in export, deletion, and anonymous retention lifecycle', () => {
    const exportRoute = readFileSync(
      resolve(process.cwd(), 'app/api/data/export/route.ts'),
      'utf8'
    );
    expect(exportRoute).toContain(".from('practice_progress')");
    expect(exportRoute).toContain('practice_progress: requireQuery(');
    expect(migration).toContain(
      'DELETE FROM public.practice_progress WHERE user_id = p_user_id'
    );
    expect(migration).toContain(
      'NOT EXISTS (SELECT 1 FROM public.practice_progress'
    );
    const liveLifecycle = readFileSync(
      resolve(process.cwd(), 'scripts/verify-live-data-lifecycle.mjs'),
      'utf8'
    );
    const partnerRls = readFileSync(
      resolve(process.cwd(), 'scripts/verify-partner-rls.sh'),
      'utf8'
    );
    expect(liveLifecycle).toContain("client.rpc('save_practice_progress'");
    expect(liveLifecycle).toContain("'practice_progress'");
    expect(partnerRls).toContain("B reads 0 of A's paused practice rows");
    expect(partnerRls).toContain('practice_progress_owner_changed');
    expect(partnerRls).toContain('practice_progress_conflict');
  });
});
