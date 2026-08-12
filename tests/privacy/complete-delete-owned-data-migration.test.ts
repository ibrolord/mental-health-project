import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { OWNED_DATA_SOURCES } from '../../lib/data/owned-data-inventory';

const migration = readFileSync(
  resolve(
    process.cwd(),
    'supabase/migrations/20260812095352_restore_complete_owned_data_deletion.sql'
  ),
  'utf8'
);

describe('complete owned-data deletion migration', () => {
  it('preserves every registered owned-data deletion after accountability cleanup', () => {
    for (const { table } of OWNED_DATA_SOURCES) {
      expect(migration).toContain(`DELETE FROM public.${table}`);
    }

    expect(migration).toContain('DELETE FROM public.accountability_memberships');
    expect(migration).toContain('DELETE FROM public.accountability_comments');
    expect(migration).toContain('DELETE FROM public.accountability_nudges');
    expect(migration).toContain('DELETE FROM public.accountability_commitments');
    expect(migration).toContain('DELETE FROM public.accountability_scope_controls');
    expect(migration).toContain('DELETE FROM public.accountability_blocks');
  });

  it('removes migrated anonymous ownership and keeps the RPC service-only', () => {
    expect(migration).toContain('v_migrated_session_ids TEXT[]');
    expect(migration).toContain('session.session_id = ANY(v_migrated_session_ids)');
    expect(migration).toContain(
      'REVOKE ALL ON FUNCTION public.delete_owned_data(UUID, TEXT)'
    );
    expect(migration).toContain('FROM PUBLIC, anon, authenticated, service_role');
    expect(migration).toContain(
      'GRANT EXECUTE ON FUNCTION public.delete_owned_data(UUID, TEXT)'
    );
    expect(migration).toContain('TO service_role');
  });
});
