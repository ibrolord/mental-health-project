import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (path: string) =>
  readFileSync(resolve(process.cwd(), path), 'utf8');

const acquisition = read('mobile/lib/acquisition.ts');
const webAcquisition = read('lib/acquisition.ts');
const lifecycleVerifier = read('scripts/verify-live-data-lifecycle.mjs');
const tracker = read('mobile/app/(tabs)/tracker.tsx');
const today = read('mobile/app/(tabs)/index.tsx');
const migration = read(
  'supabase/migrations/20260809021500_bind_check_in_to_expected_owner.sql'
);

describe('iOS check-in owner binding', () => {
  it('passes the initiating owner through the delayed attribution read', () => {
    expect(acquisition).toMatch(
      /saveCheckInWithAttribution\(\s*expectedUserId: string,\s*checkIn:/
    );
    expect(acquisition).toContain('const attribution = await readAttribution()');
    expect(acquisition).toContain('p_expected_user_id: expectedUserId');
    expect(webAcquisition).toMatch(
      /saveCheckInWithAttribution\(\s*expectedUserId: string,\s*checkIn:/
    );
    expect(webAcquisition).toContain('p_expected_user_id: expectedUserId');
    expect(lifecycleVerifier).toContain('p_expected_user_id: testUserId');

    for (const source of [tracker, today]) {
      expect(source).toContain('const expectedUserId = user');
      expect(source).toMatch(
        /saveCheckInWithAttribution\(\s*expectedUserId,/
      );
    }
  });

  it('replaces the unsafe RPC signature with an owner-bound transaction', () => {
    expect(migration).toMatch(
      /DROP FUNCTION IF EXISTS public\.save_check_in_with_attribution\(\s*public\.mood_emoji,/
    );
    expect(migration).toMatch(
      /CREATE FUNCTION public\.save_check_in_with_attribution\(\s*p_expected_user_id UUID,/
    );
    expect(migration).toContain(
      'p_expected_user_id IS NULL OR p_expected_user_id <> v_user_id'
    );
    expect(migration).toContain("USING ERRCODE = '42501'");
    expect(migration).toMatch(
      /REVOKE ALL ON FUNCTION public\.save_check_in_with_attribution\(\s*UUID,[\s\S]*FROM PUBLIC, anon, authenticated;/
    );
    expect(migration).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.save_check_in_with_attribution\(\s*UUID,[\s\S]*TO authenticated;/
    );
  });

  it('never renders owner-tagged tracker or Today state for a replacement owner', () => {
    expect(tracker).toContain('moodsOwnerKey === ownerKey ? moods : []');
    expect(tracker).toContain('draftOwnerKey === ownerKey');
    expect(tracker).toContain('visibleMoods.map');
    expect(tracker).not.toContain(
      'filterMoodEntriesByTag(moods, filterTag)'
    );

    expect(today).toContain('moodOwnerKey === ownerKey ? todayMood : null');
    expect(today).toContain('moodOwnerKey === ownerKey ? weekMoods : []');
    expect(today).toContain(
      'weeklyOwnerId === user?.id ? weeklySummary : null'
    );
    expect(today).toContain(
      'productOwnerId === user?.id ? savedItem : null'
    );
  });
});
