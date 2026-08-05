import type { RealtimeTranscriptionSessionCreateRequest } from 'openai/resources/realtime/realtime';

export const REALTIME_TRANSCRIPTION_MODEL =
  process.env.OPENAI_REALTIME_TRANSCRIPTION_MODEL?.trim() ||
  'gpt-4o-transcribe';
// Vercel Hobby functions have a five-minute ceiling. Keep enough time for
// setup and the documented server-side hangup request to finish reliably.
export const REALTIME_SESSION_SECONDS = 4 * 60;

const OPENAI_REALTIME_CALLS_URL = 'https://api.openai.com/v1/realtime/calls';
const REALTIME_CALL_ID_PATTERN = /^rtc_[A-Za-z0-9_-]{1,120}$/;

export function createRealtimeSessionConfig(): RealtimeTranscriptionSessionCreateRequest {
  return {
    type: 'transcription',
    audio: {
      input: {
        noise_reduction: { type: 'near_field' },
        transcription: {
          model: REALTIME_TRANSCRIPTION_MODEL,
        },
        turn_detection: {
          type: 'server_vad',
          create_response: false,
          interrupt_response: false,
          prefix_padding_ms: 300,
          silence_duration_ms: 550,
          threshold: 0.5,
        },
      },
    },
  };
}

export interface RealtimeTranscriptionCall {
  answerSdp: string;
  callId: string;
  model: string;
}

function callIdFromLocation(value: string | null): string {
  if (!value) throw new Error('OpenAI Realtime response omitted the call ID');

  let pathname: string;
  try {
    pathname = new URL(value, OPENAI_REALTIME_CALLS_URL).pathname;
  } catch {
    throw new Error('OpenAI Realtime returned an invalid call location');
  }
  const callId = pathname.split('/').filter(Boolean).at(-1) || '';
  if (!REALTIME_CALL_ID_PATTERN.test(callId)) {
    throw new Error('OpenAI Realtime returned an invalid call ID');
  }
  return callId;
}

export async function createRealtimeTranscriptionCall(input: {
  offerSdp: string;
  safetyIdentifier: string;
  signal?: AbortSignal;
}): Promise<RealtimeTranscriptionCall> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new Error('OpenAI Realtime is not configured');

  const form = new FormData();
  form.set('sdp', input.offerSdp);
  form.set('session', JSON.stringify(createRealtimeSessionConfig()));

  const response = await fetch(OPENAI_REALTIME_CALLS_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'OpenAI-Safety-Identifier': input.safetyIdentifier,
    },
    body: form,
    signal: input.signal,
  });
  if (!response.ok) {
    throw new Error(`OpenAI Realtime call failed with status ${response.status}`);
  }

  const callId = callIdFromLocation(response.headers.get('location'));
  const answerSdp = (await response.text()).trim();
  if (!answerSdp.startsWith('v=0') || !answerSdp.includes('m=audio')) {
    throw new Error('OpenAI returned an invalid Realtime answer');
  }

  return { answerSdp, callId, model: REALTIME_TRANSCRIPTION_MODEL };
}

export async function hangupRealtimeCall(
  callId: string,
  signal?: AbortSignal
): Promise<'requested' | 'already_ended'> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new Error('OpenAI Realtime is not configured');
  if (!REALTIME_CALL_ID_PATTERN.test(callId)) {
    throw new Error('Invalid OpenAI Realtime call ID');
  }

  const response = await fetch(
    `${OPENAI_REALTIME_CALLS_URL}/${encodeURIComponent(callId)}/hangup`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      signal,
    }
  );
  if (response.ok) return 'requested';
  if (response.status === 404 || response.status === 409) return 'already_ended';
  throw new Error(`OpenAI Realtime hangup failed with status ${response.status}`);
}
