import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (path: string) =>
  readFileSync(resolve(process.cwd(), path), 'utf8');

const migration = read(
  'supabase/migrations/20260728165145_harden_accountability_boundaries.sql'
);
const partnerPage = read('app/partner/page.tsx');
const exportRoute = read('app/api/data/export/route.ts');

const snapshotBody =
  migration
    .split('CREATE OR REPLACE FUNCTION public.partner_snapshot')[1]
    ?.split('CREATE OR REPLACE FUNCTION public.send_partner_celebration')[0] ?? '';

const acceptBody =
  migration
    .split('CREATE OR REPLACE FUNCTION public.accept_partner_invite')[1]
    ?.split('CREATE OR REPLACE FUNCTION public.partner_snapshot')[0] ?? '';

describe('accountability privacy hardening', () => {
  it('returns booleans and numeric aggregates without mood dates or emoji', () => {
    expect(snapshotBody).not.toContain("'mood_trend'");
    expect(snapshotBody).not.toContain("'emoji'");
    expect(snapshotBody).not.toContain('MODE()');
    expect(snapshotBody).not.toContain("'day'");
    expect(snapshotBody).not.toContain("'owner_id'");
    expect(snapshotBody).not.toContain('journal_entries');
    expect(snapshotBody).not.toContain('chat_history');
    expect(snapshotBody).not.toContain('assessments');
  });

  it('keeps the removed mood scope false at the database boundary', () => {
    expect(migration).toContain('partner_invites_mood_trend_disabled');
    expect(migration).toContain('partner_links_mood_trend_disabled');
    expect(migration.match(/CHECK \(share_mood_trend = FALSE\)/g)).toHaveLength(2);
    expect(partnerPage).not.toMatch(
      /const SCOPE_ORDER[\s\S]*?'share_mood_trend'[\s\S]*?\];/
    );
  });

  it('does not silently opt old relationships into new scopes', () => {
    expect(migration).toContain('share_streaks = FALSE');
    expect(migration).toContain('allow_celebrations = FALSE');
    expect(migration).toContain(
      "created_at < TIMESTAMPTZ '2026-07-28 16:15:48+00'"
    );
  });

  it('requires both relationship participants to be permanent accounts', () => {
    expect(migration).toContain(
      'private.accountability_participants_are_permanent'
    );
    expect(migration).toContain('owner_account.is_anonymous IS FALSE');
    expect(migration).toContain('partner_account.is_anonymous IS FALSE');
    expect(
      migration.match(/both accountability participants/g)?.length
    ).toBeGreaterThanOrEqual(3);
  });

  it('stores a second hash and never accepts the stored verifier directly', () => {
    expect(migration).toContain(
      "extensions.digest(NEW.token_hash, 'sha256')"
    );
    expect(acceptBody).toContain(
      "extensions.digest(p_token_hash, 'sha256')"
    );
    expect(migration).toContain('invite identity and verifier are immutable');
  });

  it('excludes the invite verifier from account exports', () => {
    const inviteQuery =
      exportRoute
        .split(".from('partner_invites')")[1]
        ?.split(".eq('owner_id'")[0] ?? '';

    expect(inviteQuery).not.toContain("select('*')");
    expect(inviteQuery).not.toContain('token_hash');
  });

  it('protects anonymous accounts with library-only private data', () => {
    const reaperBody =
      migration
        .split('CREATE OR REPLACE FUNCTION public.reap_stale_anonymous_users')[1]
        ?.split('REVOKE ALL ON FUNCTION public.accept_partner_invite')[0] ?? '';

    expect(reaperBody).toContain('public.user_library_items');
    expect(reaperBody).toContain('p_dry_run BOOLEAN DEFAULT TRUE');
  });
});
