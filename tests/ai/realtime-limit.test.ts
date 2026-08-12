import { createHmac } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  getSupabaseAdmin: () => ({
    rpc: mocks.rpc,
  }),
}));

import {
  cancelRealtimeVoiceSession,
  claimRealtimeVoiceSession,
  completeRealtimeVoiceSession,
  confirmRealtimeVoiceSession,
  registerRealtimeVoiceSession,
  releaseRealtimeVoiceSession,
} from '../../lib/ai/realtime-limit';

const originalReportSecret = process.env.AI_REPORT_SIGNING_SECRET;
const originalServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

describe('Realtime voice quota identity', () => {
  beforeEach(() => {
    mocks.rpc.mockReset();
    mocks.rpc.mockResolvedValue({
      data: { grant_id: 'grant-1', status: 'allowed' },
      error: null,
    });
    process.env.AI_REPORT_SIGNING_SECRET = 'test-secret-that-is-long-and-private';
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  });

  afterEach(() => {
    if (originalReportSecret === undefined) {
      delete process.env.AI_REPORT_SIGNING_SECRET;
    } else {
      process.env.AI_REPORT_SIGNING_SECRET = originalReportSecret;
    }
    if (originalServiceKey === undefined) {
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    } else {
      process.env.SUPABASE_SERVICE_ROLE_KEY = originalServiceKey;
    }
  });

  it('stores a server-keyed pseudonym instead of a reversible user identifier', async () => {
    const result = await claimRealtimeVoiceSession({ userId: 'user-123' });
    const expectedHash = createHmac(
      'sha256',
      'test-secret-that-is-long-and-private'
    )
      .update('realtime-voice:user:user-123', 'utf8')
      .digest('hex');

    expect(result).toEqual({
      allowed: true,
      grantId: 'grant-1',
      subjectHash: expectedHash,
    });
    expect(mocks.rpc).toHaveBeenCalledWith('claim_realtime_voice_session', {
      p_daily_limit: 4,
      p_hourly_limit: 2,
      p_subject_hash: expectedHash,
    });
    expect(expectedHash).not.toContain('user-123');
  });

  it('fails closed when no server-side hashing key is configured', async () => {
    delete process.env.AI_REPORT_SIGNING_SECRET;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    await expect(
      claimRealtimeVoiceSession({ userId: 'user-123' })
    ).rejects.toThrow('Voice session hashing is not configured');
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it('requires the database to register, confirm, complete, and release sessions', async () => {
    mocks.rpc.mockResolvedValueOnce({ data: true, error: null });
    await expect(
      registerRealtimeVoiceSession(
        'grant-1',
        'a'.repeat(64),
        'rtc_call_1',
        240
      )
    ).resolves.toBeUndefined();
    expect(mocks.rpc).toHaveBeenLastCalledWith(
      'register_realtime_voice_session',
      {
        p_grant_id: 'grant-1',
        p_provider_call_id: 'rtc_call_1',
        p_session_seconds: 240,
        p_subject_hash: 'a'.repeat(64),
      }
    );

    mocks.rpc.mockResolvedValueOnce({ data: 'confirmed', error: null });
    await expect(
      confirmRealtimeVoiceSession('grant-1', 'a'.repeat(64))
    ).resolves.toBe('confirmed');

    mocks.rpc.mockResolvedValueOnce({ data: 'active_ended', error: null });
    await expect(
      completeRealtimeVoiceSession(
        'grant-1',
        'a'.repeat(64),
        'server_hangup_requested'
      )
    ).resolves.toBe('active_ended');

    mocks.rpc.mockResolvedValueOnce({ data: 'rtc_call_1', error: null });
    await expect(
      cancelRealtimeVoiceSession('grant-1', 'a'.repeat(64))
    ).resolves.toBe('rtc_call_1');

    mocks.rpc.mockResolvedValueOnce({ data: false, error: null });
    await expect(
      releaseRealtimeVoiceSession('grant-1', 'a'.repeat(64))
    ).rejects.toThrow('grant not found');
  });
});
