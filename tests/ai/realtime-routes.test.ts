import { NextRequest, NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DELETE as cancelSession,
  PATCH as confirmSession,
  POST as createSession,
} from '../../app/api/realtime/session/route';
import { POST as checkSafety } from '../../app/api/realtime/safety/route';

const OFFER_SDP = 'v=0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\nm=application 9 UDP/DTLS/SCTP webrtc-datachannel\r\n';
const ANSWER_SDP = 'v=0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\n';
const GRANT_ID = '018f47a2-986d-4b22-8da3-9a6cd882e1d3';

const mocks = vi.hoisted(() => ({
  after: vi.fn(),
  cancelRealtimeVoiceSession: vi.fn(),
  claimRealtimeVoiceSession: vi.fn(),
  completeRealtimeVoiceSession: vi.fn(),
  confirmRealtimeVoiceSession: vi.fn(),
  createRealtimeTranscriptionCall: vi.fn(),
  hangupRealtimeCall: vi.fn(),
  realtimeVoiceSubjectHashForAuth: vi.fn(),
  registerRealtimeVoiceSession: vi.fn(),
  releaseRealtimeVoiceSession: vi.fn(),
  verifyAuth: vi.fn(),
}));

vi.mock('next/server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next/server')>();
  return { ...actual, after: mocks.after };
});

vi.mock('@/lib/ai/realtime', () => ({
  createRealtimeTranscriptionCall: mocks.createRealtimeTranscriptionCall,
  hangupRealtimeCall: mocks.hangupRealtimeCall,
  REALTIME_SESSION_SECONDS: 240,
}));

vi.mock('@/lib/ai/realtime-limit', () => ({
  cancelRealtimeVoiceSession: mocks.cancelRealtimeVoiceSession,
  claimRealtimeVoiceSession: mocks.claimRealtimeVoiceSession,
  completeRealtimeVoiceSession: mocks.completeRealtimeVoiceSession,
  confirmRealtimeVoiceSession: mocks.confirmRealtimeVoiceSession,
  realtimeVoiceSubjectHashForAuth: mocks.realtimeVoiceSubjectHashForAuth,
  registerRealtimeVoiceSession: mocks.registerRealtimeVoiceSession,
  releaseRealtimeVoiceSession: mocks.releaseRealtimeVoiceSession,
}));

vi.mock('@/lib/api/auth', () => ({
  corsHeaders: () => ({ 'Access-Control-Allow-Origin': '*' }),
  unauthorizedResponse: () =>
    NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
  verifyAuth: mocks.verifyAuth,
}));

function jsonRequest(path: string, body: unknown) {
  return new NextRequest(`https://mhtoolkit.test${path}`, {
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
    method: 'POST',
  });
}

function sdpRequest(body = OFFER_SDP) {
  return new NextRequest('https://mhtoolkit.test/api/realtime/session', {
    body,
    headers: { 'content-type': 'application/sdp' },
    method: 'POST',
  });
}

describe('Realtime voice routes', () => {
  beforeEach(() => {
    vi.useRealTimers();
    process.env.ENABLE_REALTIME_TRANSCRIPTION = 'true';
    mocks.after.mockReset();
    mocks.verifyAuth.mockReset();
    mocks.verifyAuth.mockResolvedValue({ valid: true, userId: 'user-1' });
    mocks.claimRealtimeVoiceSession.mockReset();
    mocks.claimRealtimeVoiceSession.mockResolvedValue({
      allowed: true,
      grantId: GRANT_ID,
      subjectHash: 'a'.repeat(64),
    });
    mocks.createRealtimeTranscriptionCall.mockReset();
    mocks.createRealtimeTranscriptionCall.mockResolvedValue({
      answerSdp: ANSWER_SDP,
      callId: 'rtc_call_1',
      model: 'gpt-4o-transcribe',
    });
    mocks.registerRealtimeVoiceSession.mockReset();
    mocks.registerRealtimeVoiceSession.mockResolvedValue(undefined);
    mocks.completeRealtimeVoiceSession.mockReset();
    mocks.completeRealtimeVoiceSession.mockResolvedValue('active_ended');
    mocks.confirmRealtimeVoiceSession.mockReset();
    mocks.confirmRealtimeVoiceSession.mockResolvedValue('confirmed');
    mocks.cancelRealtimeVoiceSession.mockReset();
    mocks.cancelRealtimeVoiceSession.mockResolvedValue('rtc_call_1');
    mocks.realtimeVoiceSubjectHashForAuth.mockReset();
    mocks.realtimeVoiceSubjectHashForAuth.mockReturnValue('a'.repeat(64));
    mocks.hangupRealtimeCall.mockReset();
    mocks.hangupRealtimeCall.mockResolvedValue('requested');
    mocks.releaseRealtimeVoiceSession.mockReset();
    mocks.releaseRealtimeVoiceSession.mockResolvedValue(undefined);
  });

  it('fails closed before quota or provider access when live transcription is disabled', async () => {
    process.env.ENABLE_REALTIME_TRANSCRIPTION = 'false';

    const response = await createSession(sdpRequest());

    expect(response.status).toBe(503);
    expect(mocks.claimRealtimeVoiceSession).not.toHaveBeenCalled();
    expect(mocks.createRealtimeTranscriptionCall).not.toHaveBeenCalled();
  });

  it('proxies one authenticated audio-only SDP call without exposing a credential', async () => {
    const response = await createSession(sdpRequest());

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('content-type')).toContain('application/sdp');
    expect(response.headers.get('x-realtime-max-seconds')).toBe('240');
    expect(response.headers.get('x-realtime-session-id')).toBe(GRANT_ID);
    expect(await response.text()).toBe(ANSWER_SDP);
    expect(mocks.createRealtimeTranscriptionCall).toHaveBeenCalledWith(
      expect.objectContaining({
        offerSdp: OFFER_SDP.trim(),
        safetyIdentifier: 'a'.repeat(64),
      })
    );
    expect(mocks.registerRealtimeVoiceSession).toHaveBeenCalledWith(
      GRANT_ID,
      'a'.repeat(64),
      'rtc_call_1',
      240
    );
    expect(mocks.after).toHaveBeenCalledTimes(1);
  });

  it('server-hangs up the provider call at expiry and audits completion', async () => {
    vi.useFakeTimers();
    const response = await createSession(sdpRequest());
    expect(response.status).toBe(200);

    const expiryTask = mocks.after.mock.calls[0]?.[0] as
      | (() => Promise<void>)
      | undefined;
    expect(expiryTask).toBeTypeOf('function');
    const pending = expiryTask!();
    await vi.advanceTimersByTimeAsync(240_000);
    await pending;

    expect(mocks.hangupRealtimeCall).toHaveBeenCalledWith(
      'rtc_call_1',
      expect.any(AbortSignal)
    );
    expect(mocks.completeRealtimeVoiceSession).toHaveBeenCalledWith(
      GRANT_ID,
      'a'.repeat(64),
      'server_hangup_requested'
    );
    vi.useRealTimers();
  });

  it('does not call the provider for an unauthenticated request', async () => {
    mocks.verifyAuth.mockResolvedValueOnce({ valid: false });

    const response = await createSession(sdpRequest());

    expect(response.status).toBe(401);
    expect(mocks.claimRealtimeVoiceSession).not.toHaveBeenCalled();
    expect(mocks.createRealtimeTranscriptionCall).not.toHaveBeenCalled();
  });

  it('rejects non-audio and oversized offers before claiming quota', async () => {
    const video = await createSession(
      sdpRequest('v=0\r\nm=video 9 UDP/TLS/RTP/SAVPF 96\r\n')
    );
    const oversized = await createSession(sdpRequest(`v=0\r\nm=audio ${'a'.repeat(70_000)}`));

    expect(video.status).toBe(400);
    expect(oversized.status).toBe(400);
    expect(mocks.claimRealtimeVoiceSession).not.toHaveBeenCalled();
  });

  it('does not call the provider after the database quota is reached', async () => {
    mocks.claimRealtimeVoiceSession.mockResolvedValueOnce({
      allowed: false,
      reason: 'daily_limit',
    });

    const response = await createSession(sdpRequest());

    expect(response.status).toBe(429);
    expect(response.headers.get('retry-after')).toBeNull();
    expect(mocks.createRealtimeTranscriptionCall).not.toHaveBeenCalled();
  });

  it('adds one-hour retry guidance only for the hourly quota', async () => {
    mocks.claimRealtimeVoiceSession.mockResolvedValueOnce({
      allowed: false,
      reason: 'hourly_limit',
    });

    const response = await createSession(sdpRequest());

    expect(response.status).toBe(429);
    expect(response.headers.get('retry-after')).toBe('3600');
    expect(mocks.createRealtimeTranscriptionCall).not.toHaveBeenCalled();
  });

  it('releases a pending grant when provider creation or finalization fails', async () => {
    mocks.createRealtimeTranscriptionCall.mockRejectedValueOnce(
      new Error('provider unavailable')
    );
    const providerFailure = await createSession(sdpRequest());

    mocks.createRealtimeTranscriptionCall.mockResolvedValueOnce({
      answerSdp: ANSWER_SDP,
      callId: 'rtc_call_2',
      model: 'gpt-4o-transcribe',
    });
    mocks.registerRealtimeVoiceSession.mockRejectedValueOnce(
      new Error('database unavailable')
    );
    const finalizeFailure = await createSession(sdpRequest());

    expect(providerFailure.status).toBe(503);
    expect(finalizeFailure.status).toBe(503);
    expect(mocks.releaseRealtimeVoiceSession).toHaveBeenCalledTimes(2);
    expect(mocks.hangupRealtimeCall).toHaveBeenCalledWith('rtc_call_2');
  });

  it('confirms a connected session idempotently for the same authenticated subject', async () => {
    mocks.confirmRealtimeVoiceSession.mockResolvedValueOnce('already_active');

    const response = await confirmSession(
      jsonRequest('/api/realtime/session', { grantId: GRANT_ID })
    );

    expect(response.status).toBe(204);
    expect(mocks.confirmRealtimeVoiceSession).toHaveBeenCalledWith(
      GRANT_ID,
      'a'.repeat(64)
    );
  });

  it('cancels an unconnected call, releases its slot, and hangs up the provider', async () => {
    const response = await cancelSession(
      jsonRequest('/api/realtime/session', { grantId: GRANT_ID })
    );

    expect(response.status).toBe(204);
    expect(mocks.cancelRealtimeVoiceSession).toHaveBeenCalledWith(
      GRANT_ID,
      'a'.repeat(64)
    );
    expect(mocks.hangupRealtimeCall).toHaveBeenCalledWith('rtc_call_1');
  });

  it('does not cancel another subject or an already-active session', async () => {
    mocks.cancelRealtimeVoiceSession.mockResolvedValueOnce(null);

    const response = await cancelSession(
      jsonRequest('/api/realtime/session', { grantId: GRANT_ID })
    );

    expect(response.status).toBe(409);
    expect(mocks.hangupRealtimeCall).not.toHaveBeenCalled();
  });

  it('allows an ordinary transcript to continue to server-side chat', async () => {
    const response = await checkSafety(
      jsonRequest('/api/realtime/safety', {
        transcript: 'I had a difficult day and want to talk it through.',
      })
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    await expect(response.json()).resolves.toEqual({ action: 'respond' });
  });

  it('replaces explicit crisis language with deterministic urgent guidance', async () => {
    const response = await checkSafety(
      jsonRequest('/api/realtime/safety', {
        transcript: 'I am planning to kill myself tonight.',
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.action).toBe('crisis');
    expect(body.response).toContain('local emergency number');
    expect(body.response).toContain('988');
  });

  it('rejects malformed and oversized transcripts', async () => {
    const malformed = await checkSafety(
      jsonRequest('/api/realtime/safety', { transcript: '' })
    );
    const oversized = await checkSafety(
      jsonRequest('/api/realtime/safety', { transcript: 'a'.repeat(9_000) })
    );

    expect(malformed.status).toBe(400);
    expect(oversized.status).toBe(413);
  });
});
