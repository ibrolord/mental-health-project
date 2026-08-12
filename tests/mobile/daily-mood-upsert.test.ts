import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const nonDestructiveRollout = readFileSync(
  resolve(
    process.cwd(),
    'supabase/migrations/20260810150010_install_non_destructive_daily_mood_patch.sql'
  ),
  'utf8'
);
const acquisition = readFileSync(
  resolve(process.cwd(), 'mobile/lib/acquisition.ts'),
  'utf8'
);
const webAcquisition = readFileSync(
  resolve(process.cwd(), 'lib/acquisition.ts'),
  'utf8'
);

describe('daily mood upsert contract', () => {
  it('patches one owner-day without deleting legacy mood rows', () => {
    expect(nonDestructiveRollout).toContain(
      'CREATE OR REPLACE FUNCTION public.patch_daily_mood_check_in'
    );
    expect(nonDestructiveRollout).toContain('p_update_note BOOLEAN');
    expect(nonDestructiveRollout).toContain('p_update_tags BOOLEAN');
    expect(nonDestructiveRollout).toContain('pg_advisory_xact_lock');
    expect(nonDestructiveRollout).toContain('FOR UPDATE');
    expect(nonDestructiveRollout).toContain('IF v_mood_id IS NULL THEN');
    expect(nonDestructiveRollout).not.toContain('DELETE FROM public.moods');
    expect(nonDestructiveRollout).not.toContain('DROP INDEX');
    expect(nonDestructiveRollout).not.toContain('CREATE UNIQUE INDEX');
  });

  it('routes web and mobile through the patch RPC with explicit field intent', () => {
    for (const source of [acquisition, webAcquisition]) {
      expect(source).toContain(".rpc('patch_daily_mood_check_in'");
      expect(source).toContain("hasOwnProperty.call(checkIn, 'note')");
      expect(source).toContain("hasOwnProperty.call(checkIn, 'tags')");
      expect(source).toContain('): Promise<string>');
      expect(source).toContain("typeof data !== 'string'");
      expect(source).toContain('return data;');
    }
  });
});
