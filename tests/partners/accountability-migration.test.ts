import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  resolve(
    process.cwd(),
    'supabase/migrations/20260728161548_expand_accountability_sharing.sql'
  ),
  'utf8'
);

const snapshotBody =
  migration
    .split('CREATE OR REPLACE FUNCTION public.partner_snapshot')[1]
    ?.split('CREATE OR REPLACE FUNCTION public.send_partner_celebration')[0] ?? '';

const celebrationTable =
  migration
    .split('CREATE TABLE public.partner_celebrations')[1]
    ?.split('CREATE INDEX partner_celebrations_owner_created_idx')[0] ?? '';

describe('expanded accountability migration', () => {
  it('keeps every private content table outside the partner snapshot', () => {
    expect(snapshotBody).not.toContain('journal_entries');
    expect(snapshotBody).not.toContain('chat_history');
    expect(snapshotBody).not.toContain('assessments');
    expect(snapshotBody).not.toContain('note');
    expect(snapshotBody).not.toContain('content');
  });

  it('adds distinct, owner-controlled count and interaction scopes', () => {
    expect(migration).toContain(
      'ADD COLUMN share_streaks BOOLEAN NOT NULL DEFAULT TRUE'
    );
    expect(migration).toContain(
      'ADD COLUMN allow_celebrations BOOLEAN NOT NULL DEFAULT TRUE'
    );
    expect(snapshotBody).toContain("'best_current'");
    expect(snapshotBody).toContain("'celebrations', v_link.allow_celebrations");
    expect(snapshotBody).not.toContain("'total'");
    expect(snapshotBody).not.toContain("'tracked'");
  });

  it('allows no free text in fixed-format celebrations', () => {
    expect(celebrationTable).not.toMatch(/\b(message|content|note|title)\b/i);
    expect(celebrationTable).toContain("kind IN ('cheer', 'reward')");
    expect(celebrationTable).toContain(
      "source IN ('habit_streak', 'goal_progress', 'general')"
    );
    expect(celebrationTable).toContain(
      'CONSTRAINT partner_celebrations_link_dedupe_key'
    );
  });

  it('rejects anonymous accounts in policies and every definer function', () => {
    expect(migration.match(/is_anonymous/g)?.length).toBeGreaterThanOrEqual(10);
    expect(migration).toContain("RAISE EXCEPTION 'a permanent account is required'");
    expect(migration.match(/SET search_path = ''/g)?.length).toBeGreaterThanOrEqual(5);
  });

  it('grants authenticated users read-only access to celebration rows', () => {
    expect(migration).toContain(
      'GRANT SELECT ON TABLE public.partner_celebrations TO authenticated'
    );
    expect(migration).not.toContain(
      'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.partner_celebrations\n  TO authenticated'
    );
    expect(migration).toContain(
      'GRANT EXECUTE ON FUNCTION public.send_partner_celebration(UUID, TEXT, TEXT, TEXT)'
    );
  });

  it('includes all relationship rows in transactional account deletion', () => {
    expect(migration).toContain('DELETE FROM public.partner_celebrations');
    expect(migration).toContain('DELETE FROM public.partner_links');
    expect(migration).toContain(
      'DELETE FROM public.partner_invites WHERE owner_id = p_user_id'
    );
  });
});
