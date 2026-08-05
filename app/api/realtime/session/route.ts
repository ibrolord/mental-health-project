import { after, NextRequest, NextResponse } from 'next/server';
import {
  createRealtimeTranscriptionCall,
  hangupRealtimeCall,
  REALTIME_SESSION_SECONDS,
} from '@/lib/ai/realtime';
import {
  cancelRealtimeVoiceSession,
  claimRealtimeVoiceSession,
  completeRealtimeVoiceSession,
  confirmRealtimeVoiceSession,
  realtimeVoiceSubjectHashForAuth,
  registerRealtimeVoiceSession,
  releaseRealtimeVoiceSession,
} from '@/lib/ai/realtime-limit';
import { corsHeaders, unauthorizedResponse, verifyAuth } from '@/lib/api/auth';

const MAX_SDP_BYTES = 64 * 1024;
const PROVIDER_TIMEOUT_MS = 15_000;
const HANGUP_TIMEOUT_MS = 10_000;

// after() shares the function lifetime. This stays below Vercel Hobby's
// five-minute maximum while leaving room for setup and provider termination.
export const maxDuration = 290;

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

function validAudioOffer(value: string): boolean {
  return (
    value.startsWith('v=0') &&
    value.includes('m=audio') &&
    !value.includes('m=video')
  );
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function validGrantId(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value
    )
  );
}

async function readGrantId(request: NextRequest): Promise<string | null> {
  const declaredLength = Number(request.headers.get('content-length') || '0');
  if (Number.isFinite(declaredLength) && declaredLength > 1_024) return null;
  try {
    const body = (await request.json()) as { grantId?: unknown };
    return validGrantId(body.grantId) ? body.grantId : null;
  } catch {
    return null;
  }
}

async function enforceSessionExpiry(input: {
  callId: string;
  grantId: string;
  subjectHash: string;
}) {
  await wait(REALTIME_SESSION_SECONDS * 1_000);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), HANGUP_TIMEOUT_MS);
  let endReason:
    | 'server_hangup_requested'
    | 'provider_already_ended'
    | 'server_hangup_failed' = 'server_hangup_failed';
  try {
    const result = await hangupRealtimeCall(input.callId, controller.signal);
    endReason =
      result === 'requested'
        ? 'server_hangup_requested'
        : 'provider_already_ended';
  } catch (error) {
    console.error('Realtime server hangup failed:', error);
  } finally {
    clearTimeout(timeout);
  }

  try {
    await completeRealtimeVoiceSession(
      input.grantId,
      input.subjectHash,
      endReason
    );
  } catch (error) {
    console.error('Realtime completion audit failed:', error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth.valid) return unauthorizedResponse();
    if (process.env.ENABLE_REALTIME_TRANSCRIPTION !== 'true') {
      return NextResponse.json(
        { error: 'Live transcription is not enabled' },
        { status: 503, headers: corsHeaders() }
      );
    }

    const declaredLength = Number(request.headers.get('content-length') || '0');
    if (Number.isFinite(declaredLength) && declaredLength > MAX_SDP_BYTES) {
      return NextResponse.json(
        { error: 'Realtime offer is too large' },
        { status: 413, headers: corsHeaders() }
      );
    }

    const offerSdp = (await request.text()).trim();
    if (
      Buffer.byteLength(offerSdp, 'utf8') > MAX_SDP_BYTES ||
      !validAudioOffer(offerSdp)
    ) {
      return NextResponse.json(
        { error: 'Invalid audio-only Realtime offer' },
        { status: 400, headers: corsHeaders() }
      );
    }

    const claim = await claimRealtimeVoiceSession(auth);
    if (!claim.allowed) {
      return NextResponse.json(
        {
          error:
            claim.reason === 'hourly_limit'
              ? 'Live voice has reached its hourly limit. Try again later.'
              : 'Live voice has reached its daily limit. Try again tomorrow.',
        },
        {
          status: 429,
          headers:
            claim.reason === 'hourly_limit'
              ? { ...corsHeaders(), 'Retry-After': '3600' }
              : corsHeaders(),
        }
      );
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS);
    let providerCallId: string | null = null;
    try {
      const call = await createRealtimeTranscriptionCall({
        offerSdp,
        safetyIdentifier: claim.subjectHash,
        signal: controller.signal,
      });
      providerCallId = call.callId;
      await registerRealtimeVoiceSession(
        claim.grantId,
        claim.subjectHash,
        call.callId,
        REALTIME_SESSION_SECONDS
      );
      after(() =>
        enforceSessionExpiry({
          callId: call.callId,
          grantId: claim.grantId,
          subjectHash: claim.subjectHash,
        })
      );
      return new NextResponse(call.answerSdp, {
        headers: {
          ...corsHeaders(),
          'Cache-Control': 'no-store',
          'Content-Type': 'application/sdp',
          'X-Realtime-Max-Seconds': String(REALTIME_SESSION_SECONDS),
          'X-Realtime-Model': call.model,
          'X-Realtime-Session-Id': claim.grantId,
        },
      });
    } catch (error) {
      if (providerCallId) {
        try {
          await hangupRealtimeCall(providerCallId);
        } catch (hangupError) {
          console.error('Realtime failed-call hangup failed:', hangupError);
        }
      }
      try {
        await releaseRealtimeVoiceSession(claim.grantId, claim.subjectHash);
      } catch (releaseError) {
        console.error('Realtime quota reservation release failed:', releaseError);
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  } catch (error) {
    console.error('Realtime session error:', error);
    return NextResponse.json(
      { error: 'Live voice is temporarily unavailable' },
      { status: 503, headers: corsHeaders() }
    );
  }
}


export async function PATCH(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth.valid) return unauthorizedResponse();
    const grantId = await readGrantId(request);
    if (!grantId) {
      return NextResponse.json(
        { error: 'Invalid Realtime session' },
        { status: 400, headers: corsHeaders() }
      );
    }

    const subjectHash = realtimeVoiceSubjectHashForAuth(auth);
    const result = await confirmRealtimeVoiceSession(grantId, subjectHash);
    if (result === 'not_found') {
      return NextResponse.json(
        { error: 'Realtime session is no longer available' },
        { status: 409, headers: corsHeaders() }
      );
    }
    return new NextResponse(null, { status: 204, headers: corsHeaders() });
  } catch (error) {
    console.error('Realtime session confirmation error:', error);
    return NextResponse.json(
      { error: 'Live voice is temporarily unavailable' },
      { status: 503, headers: corsHeaders() }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth.valid) return unauthorizedResponse();
    const grantId = await readGrantId(request);
    if (!grantId) {
      return NextResponse.json(
        { error: 'Invalid Realtime session' },
        { status: 400, headers: corsHeaders() }
      );
    }

    const subjectHash = realtimeVoiceSubjectHashForAuth(auth);
    const providerCallId = await cancelRealtimeVoiceSession(
      grantId,
      subjectHash
    );
    if (!providerCallId) {
      return NextResponse.json(
        { error: 'Realtime session is already active or ended' },
        { status: 409, headers: corsHeaders() }
      );
    }

    try {
      await hangupRealtimeCall(providerCallId);
    } catch (error) {
      // The expiry task still has the call ID and will retry at the hard cap.
      console.error('Realtime cancelled-call hangup failed:', error);
    }
    return new NextResponse(null, { status: 204, headers: corsHeaders() });
  } catch (error) {
    console.error('Realtime session cancellation error:', error);
    return NextResponse.json(
      { error: 'Live voice is temporarily unavailable' },
      { status: 503, headers: corsHeaders() }
    );
  }
}
