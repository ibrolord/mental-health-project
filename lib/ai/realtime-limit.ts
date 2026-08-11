import { createHmac } from 'node:crypto';
import { subjectForAuth } from '@/lib/ai/report-token';
import { getSupabaseAdmin } from '@/lib/supabase/server';

export const REALTIME_HOURLY_SESSION_LIMIT = 2;
export const REALTIME_DAILY_SESSION_LIMIT = 4;

type VoiceSessionClaimResult =
  | { allowed: true; grantId: string; subjectHash: string }
  | { allowed: false; reason: 'daily_limit' | 'hourly_limit' };

interface ClaimPayload {
  grant_id?: unknown;
  status?: unknown;
}

export function realtimeVoiceSubjectHashForAuth(auth: {
  userId?: string;
  sessionId?: string;
}): string {
  const hashKey =
    process.env.AI_REPORT_SIGNING_SECRET?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!hashKey) throw new Error('Voice session hashing is not configured');

  return createHmac('sha256', hashKey)
    .update(`realtime-voice:${subjectForAuth(auth)}`, 'utf8')
    .digest('hex');
}

export async function claimRealtimeVoiceSession(auth: {
  userId?: string;
  sessionId?: string;
}): Promise<VoiceSessionClaimResult> {
  const subjectHash = realtimeVoiceSubjectHashForAuth(auth);
  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin.rpc('claim_realtime_voice_session', {
    p_daily_limit: REALTIME_DAILY_SESSION_LIMIT,
    p_hourly_limit: REALTIME_HOURLY_SESSION_LIMIT,
    p_subject_hash: subjectHash,
  });
  if (error) throw new Error(`Voice session limit check failed: ${error.message}`);

  const payload = data as ClaimPayload | null;
  if (payload?.status === 'hourly_limit' || payload?.status === 'daily_limit') {
    return { allowed: false, reason: payload.status };
  }
  if (payload?.status !== 'allowed' || typeof payload.grant_id !== 'string') {
    throw new Error('Voice session limit check returned an invalid result');
  }
  return { allowed: true, grantId: payload.grant_id, subjectHash };
}

export async function releaseRealtimeVoiceSession(
  grantId: string,
  subjectHash: string
): Promise<void> {
  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin.rpc(
    'release_realtime_voice_session',
    {
      p_grant_id: grantId,
      p_subject_hash: subjectHash,
    }
  );
  if (error || data !== true) {
    throw new Error(
      `Unable to release Realtime voice grant: ${error?.message || 'grant not found'}`
    );
  }
}

export async function registerRealtimeVoiceSession(
  grantId: string,
  subjectHash: string,
  providerCallId: string,
  sessionSeconds: number
): Promise<void> {
  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin.rpc(
    'register_realtime_voice_session',
    {
      p_grant_id: grantId,
      p_provider_call_id: providerCallId,
      p_session_seconds: sessionSeconds,
      p_subject_hash: subjectHash,
    }
  );
  if (error || data !== true) {
    throw new Error(
      `Unable to register Realtime voice grant: ${error?.message || 'grant not found'}`
    );
  }
}

export async function confirmRealtimeVoiceSession(
  grantId: string,
  subjectHash: string
): Promise<'confirmed' | 'already_active' | 'not_found'> {
  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin.rpc(
    'confirm_realtime_voice_session',
    {
      p_grant_id: grantId,
      p_subject_hash: subjectHash,
    }
  );
  if (error) {
    throw new Error(`Unable to confirm Realtime voice grant: ${error.message}`);
  }
  if (
    data !== 'confirmed' &&
    data !== 'already_active' &&
    data !== 'not_found'
  ) {
    throw new Error('Realtime voice confirmation returned an invalid result');
  }
  return data;
}

export async function cancelRealtimeVoiceSession(
  grantId: string,
  subjectHash: string
): Promise<string | null> {
  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin.rpc(
    'cancel_realtime_voice_session',
    {
      p_grant_id: grantId,
      p_subject_hash: subjectHash,
    }
  );
  if (error) {
    throw new Error(`Unable to cancel Realtime voice grant: ${error.message}`);
  }
  return typeof data === 'string' ? data : null;
}

export async function completeRealtimeVoiceSession(
  grantId: string,
  subjectHash: string,
  endReason:
    | 'server_hangup_requested'
    | 'provider_already_ended'
    | 'server_hangup_failed'
): Promise<'active_ended' | 'pending_released' | 'not_found'> {
  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin.rpc(
    'complete_realtime_voice_session',
    {
      p_end_reason: endReason,
      p_grant_id: grantId,
      p_subject_hash: subjectHash,
    }
  );
  if (error) {
    throw new Error(`Unable to complete Realtime voice grant: ${error.message}`);
  }
  if (
    data !== 'active_ended' &&
    data !== 'pending_released' &&
    data !== 'not_found'
  ) {
    throw new Error('Realtime voice completion returned an invalid result');
  }
  return data;
}
