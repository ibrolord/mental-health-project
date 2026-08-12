import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260811213746_accountability_together.sql'),
  'utf8'
);

const tables = [
  'accountability_connections',
  'accountability_memberships',
  'accountability_scope_controls',
  'accountability_commitments',
  'accountability_check_ins',
  'accountability_commitment_notes',
  'accountability_check_in_notes',
  'accountability_comments',
  'accountability_nudges',
  'accountability_priority_suggestions',
  'accountability_rewards',
  'accountability_blocks',
] as const;

describe('accountability migration security contract', () => {
  it.each(tables)('creates and enables RLS on %s', (table) => {
    expect(migration).toMatch(new RegExp(`CREATE TABLE IF NOT EXISTS public\\.${table}`));
    expect(migration).toMatch(new RegExp(`ALTER TABLE public\\.${table} ENABLE ROW LEVEL SECURITY`));
  });

  it('distinguishes permanent users from anonymous authenticated users', () => {
    expect(migration).toContain("auth.jwt() ->> 'is_anonymous'");
    expect(migration).toContain('require_permanent_accountability_user');
  });

  it('stores invitation secrets only as server-side SHA-256 hashes', () => {
    expect(migration).toContain("extensions.digest(convert_to(p_invite_token, 'UTF8'), 'sha256')");
    expect(migration).toMatch(/invite_token_hash BYTEA/);
    expect(migration).not.toMatch(/CREATE TABLE[\s\S]{0,1600}\binvite_token\s+TEXT/);
  });

  it('makes one active membership per user a database constraint', () => {
    expect(migration).toMatch(/accountability_memberships[\s\S]*user_id UUID PRIMARY KEY/);
  });

  it('keeps check-in notes in an independently scoped table', () => {
    expect(migration).toMatch(/accountability_commitment_notes[\s\S]*shared_with_partner BOOLEAN NOT NULL DEFAULT false/);
    expect(migration).toMatch(/accountability_check_in_notes[\s\S]*shared_with_partner BOOLEAN NOT NULL DEFAULT false/);
    expect(migration).toMatch(/shares_notes BOOLEAN NOT NULL DEFAULT false/);
    expect(migration).toMatch(/shares_progress BOOLEAN NOT NULL DEFAULT true/);
    expect(migration).toMatch(/shares_commitment_titles BOOLEAN NOT NULL DEFAULT true/);
    expect(migration).toContain('get_accountability_check_in_dates');
    expect(migration).toMatch(/c\.owner_id = v_user OR s\.shares_progress/);
    expect(migration).toContain('set_accountability_commitment_note_sharing');
    expect(migration).toContain('set_accountability_check_in_note_sharing');
  });

  it('lets either connection member own commitments without granting partner updates', () => {
    expect(migration).toMatch(/commitment owner inserts[\s\S]*m\.user_id = \(SELECT auth\.uid\(\)\)/);
    expect(migration).not.toMatch(/commitment owner inserts[\s\S]{0,500}m\.role = 'owner'/);
    expect(migration).toContain('c.owner_id <> v_user');
  });

  it('stores explicit accountability commitments without exposing goal records', () => {
    expect(migration).toMatch(/accountability_commitments[\s\S]*cadence TEXT NOT NULL/);
    expect(migration).not.toMatch(/accountability_commitments[\s\S]*goal_id UUID/);
    expect(migration).not.toMatch(/\breflection\s+TEXT|goals\.reflection|SELECT[^;]*\breflection\b/i);
  });

  it('allows only fixed nudge templates and enforces database rate limits', () => {
    expect(migration).toContain("kind IN ('encouragement', 'gentle_reminder', 'celebrate_progress')");
    expect(migration).toContain("INTERVAL '24 hours'");
    expect(migration).toContain("INTERVAL '1 hour'");
    expect(migration).toContain("ERRCODE = 'P0001'");
    expect(migration).toContain('create_accountability_comment');
    expect(migration).not.toContain('CREATE POLICY "comment participants insert"');
  });

  it('invalidates invitation hashes after use or revocation', () => {
    expect(migration).toMatch(/invite_token_hash BYTEA(?! NOT NULL)/);
    expect(migration).toMatch(/invite_token_hash = NULL/);
  });

  it('revokes default table privileges before narrow authenticated grants', () => {
    expect(migration).toMatch(/REVOKE ALL ON public\.accountability_connections[\s\S]*FROM anon, authenticated/);
    expect(migration).not.toMatch(/GRANT INSERT[^;]*accountability_comments TO authenticated/);
    expect(migration).not.toMatch(/GRANT (INSERT|UPDATE)[^;]*accountability_(check_ins|rewards|scope_controls|commitment_notes)/);
    expect(migration).toContain('set_accountability_reward');
    expect(migration).toContain('update_accountability_scope');
  });

  it('serializes connection mutations with revocation and rechecks hidden scope', () => {
    expect(migration).toContain('pg_advisory_xact_lock(hashtextextended(p_connection_id::text, 0))');
    expect(migration).toMatch(/send_accountability_nudge[\s\S]*can_view_commitment\(p_commitment_id\)/);
    expect(migration).toMatch(/propose_accountability_priority[\s\S]*can_view_commitment\(p_commitment_id\)/);
  });

  it('uses locked-down security definer RPCs', () => {
    const functions = [...migration.matchAll(/CREATE OR REPLACE FUNCTION public\.[\s\S]*?\$\$;/g)];
    expect(functions.length).toBeGreaterThanOrEqual(6);
    for (const [sql] of functions) {
      expect(sql).toContain('SECURITY DEFINER');
      expect(sql).toContain("SET search_path = ''");
    }
    expect(migration).toMatch(/REVOKE ALL ON FUNCTION public\./);
  });

  it('does not alter policies on existing sensitive tables', () => {
    expect(migration).not.toMatch(/CREATE POLICY[\s\S]*?ON public\.(moods|assessments|chat_history|goals)\b/);
    expect(migration).not.toMatch(/ALTER TABLE public\.(moods|assessments|chat_history|goals)\b/);
  });

  it('adds accountability data to transactional deletion', () => {
    expect(migration).toContain('CREATE OR REPLACE FUNCTION public.delete_owned_data');
    expect(migration).toMatch(/DELETE FROM public\.accountability_connections\s+WHERE owner_id = p_user_id AND status = 'invited'/);
    expect(migration).toContain("SET status = 'revoked'");
    expect(migration).toContain('DELETE FROM public.accountability_commitments WHERE owner_id = p_user_id');
    expect(migration).toContain('DELETE FROM public.accountability_comments WHERE author_id = p_user_id');
    expect(migration).toMatch(/DELETE FROM public\.accountability_nudges\s+WHERE sender_id = p_user_id OR recipient_id = p_user_id/);
    expect(migration).not.toMatch(/DELETE FROM public\.accountability_connections WHERE owner_id = p_user_id OR partner_id = p_user_id/);
    expect(migration).toContain('DELETE FROM public.accountability_blocks');
  });

  it('archives commitments without cascading authored history', () => {
    expect(migration).toContain('archive_accountability_commitment');
    expect(migration).toMatch(/SET status = 'archived', updated_at = NOW\(\)/);
    expect(migration).toMatch(/c\.status <> 'archived' OR c\.owner_id = \(SELECT auth\.uid\(\)\)/);
    expect(migration).not.toContain('GRANT DELETE ON public.accountability_commitments');
  });

  it('preserves the other user records when one account is deleted', () => {
    expect(migration).toContain('owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL');
    expect(migration).toContain('partner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL');
  });

  it('invalidates reciprocal pending invites during creation, acceptance, and revocation', () => {
    expect(migration).toMatch(/create_accountability_invite[\s\S]*owner_id = v_partner[\s\S]*invitee_email_hash/);
    expect(migration).toMatch(/accept_accountability_invite[\s\S]*id <> v_connection\.id AND status = 'invited'/);
    expect(migration).toMatch(/end_accountability_connection[\s\S]*id <> p_connection_id AND status = 'invited'/);
  });
});
