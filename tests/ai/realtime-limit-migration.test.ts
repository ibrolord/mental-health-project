import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  resolve(
    process.cwd(),
    'supabase/migrations/20260803090000_bound_realtime_voice_sessions.sql'
  ),
  'utf8'
);
const grantTableDefinition =
  migration
    .split('CREATE TABLE IF NOT EXISTS public.realtime_voice_session_grants (')[1]
    ?.split(');')[0] ?? '';

describe('Realtime voice quota migration', () => {
  it('stores no wellbeing content or reversible user identifier', () => {
    expect(grantTableDefinition).toContain('subject_hash TEXT NOT NULL');
    expect(grantTableDefinition).not.toMatch(
      /transcript|audio_data|message_content/i
    );
  });

  it('expires failed reservations quickly and activates only completed calls', () => {
    expect(grantTableDefinition).toContain(
      "status IN ('pending', 'active', 'ended')"
    );
    expect(grantTableDefinition).toContain("INTERVAL '2 minutes'");
    expect(grantTableDefinition).toContain('session_expires_at TIMESTAMPTZ');
    expect(grantTableDefinition).toContain('ended_at TIMESTAMPTZ');
    expect(grantTableDefinition).toContain('provider_call_id TEXT UNIQUE');
    expect(migration).toContain('register_realtime_voice_session');
    expect(migration).toContain('p_session_seconds INTEGER');
    expect(migration).toContain('confirm_realtime_voice_session');
    expect(migration).toContain('cancel_realtime_voice_session');
    expect(migration).toContain('complete_realtime_voice_session');
    expect(migration).toContain("expires_at = NOW() + INTERVAL '24 hours'");
    expect(migration).toContain('release_realtime_voice_session');
  });

  it('keeps the grant table inaccessible to application roles', () => {
    expect(migration).toContain(
      'ALTER TABLE public.realtime_voice_session_grants ENABLE ROW LEVEL SECURITY'
    );
    expect(migration).toContain(
      'REVOKE ALL ON TABLE public.realtime_voice_session_grants FROM PUBLIC, anon, authenticated'
    );
  });

  it('serializes concurrent claims and restricts the function to service role', () => {
    expect(migration).toContain('pg_advisory_xact_lock');
    expect(migration).toContain('SECURITY DEFINER');
    expect(migration).toContain('SET search_path =');
    expect(migration).toContain('TO service_role');
    expect(migration).toContain(
      'REVOKE ALL ON FUNCTION public.register_realtime_voice_session(UUID, TEXT, TEXT, INTEGER)'
    );
    expect(migration).toContain(
      'REVOKE ALL ON FUNCTION public.confirm_realtime_voice_session(UUID, TEXT)'
    );
    expect(migration).toContain(
      'REVOKE ALL ON FUNCTION public.complete_realtime_voice_session(UUID, TEXT, TEXT)'
    );
  });
});
