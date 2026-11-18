import { NextRequest, NextResponse } from 'next/server';
import {
  generateVoiceResponse,
  transcribeAudio,
} from '@/lib/ai/voice-chat';
import {
  createAudioFile,
  getAudioFile,
  MAX_VOICE_AUDIO_BYTES,
} from '@/lib/ai/voice-input';
import { verifyAuth, unauthorizedResponse, corsHeaders } from '@/lib/api/auth';
import { readBoundedJson, RequestBodyError } from '@/lib/ai/request-body';
import { AI_USAGE_RULES, enforceAiUsage } from '@/lib/ai/usage-limit';

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

const MAX_TTS_CHARACTERS = 1_200;
const MAX_TTS_REQUEST_BYTES = 16 * 1024;
const MULTIPART_OVERHEAD_BYTES = 64 * 1024;

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: corsHeaders() });
}

export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth.valid) return unauthorizedResponse();

    // Transcription and playback both call a provider; neither is free text
    // the server can crisis-check (the transcript is checked by /api/chat).
    const limited = await enforceAiUsage(AI_USAGE_RULES.voice, auth, request);
    if (limited) return limited;

    const contentType = request.headers.get('content-type') || '';
    const declaredLength = Number(request.headers.get('content-length') || '0');
    
    // Handle text-to-speech
    if (contentType.includes('application/json')) {
      if (Number.isFinite(declaredLength) && declaredLength > MAX_TTS_REQUEST_BYTES) {
        return jsonResponse({ error: 'Text is too long' }, 413);
      }
      const body = (await readBoundedJson(request, MAX_TTS_REQUEST_BYTES)) as { text?: unknown } | null;
      const text = typeof body?.text === 'string' ? body.text.trim() : '';

      if (!text) {
        return jsonResponse({ error: 'Text is required' }, 400);
      }
      if (text.length > MAX_TTS_CHARACTERS) {
        return jsonResponse({ error: 'Text is too long' }, 413);
      }

      const audioResponse = await generateVoiceResponse(text);
      const buffer = Buffer.from(await audioResponse.arrayBuffer());
      const audioContentType =
        audioResponse.headers.get('content-type')?.split(';', 1)[0]
        || 'audio/mpeg';

      return new NextResponse(buffer, {
        headers: {
          ...corsHeaders(),
          'Content-Type': audioContentType,
          'Content-Length': buffer.length.toString(),
        },
      });
    }
    
    // Handle speech-to-text
    if (contentType.includes('multipart/form-data')) {
      if (
        Number.isFinite(declaredLength) &&
        declaredLength > MAX_VOICE_AUDIO_BYTES + MULTIPART_OVERHEAD_BYTES
      ) {
        return jsonResponse({ error: 'Audio file is too large' }, 413);
      }
      const formData = await request.formData();
      const audioFile = getAudioFile(formData);

      if (!audioFile) {
        return jsonResponse({ error: 'Audio file is required' }, 400);
      }

      const transcription = await transcribeAudio(audioFile);

      return jsonResponse({ transcription });
    }

    if (contentType.split(';', 1)[0].trim().toLowerCase().startsWith('audio/')) {
      if (
        Number.isFinite(declaredLength) &&
        declaredLength > MAX_VOICE_AUDIO_BYTES
      ) {
        return jsonResponse({ error: 'Audio file is too large' }, 413);
      }
      const audioFile = createAudioFile(await request.blob(), contentType);

      if (!audioFile) {
        return jsonResponse({ error: 'Audio file is required' }, 400);
      }

      const transcription = await transcribeAudio(audioFile);
      return jsonResponse({ transcription });
    }

    return jsonResponse({ error: 'Invalid content type' }, 400);
  } catch (error) {
    if (error instanceof RequestBodyError) {
      return jsonResponse({ error: error.status === 413 ? 'Text is too long' : error.message }, error.status);
    }
    console.error('Voice API error:', error);
    return jsonResponse({ error: 'Failed to process voice request' }, 500);
  }
}
