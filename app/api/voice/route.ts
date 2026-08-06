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

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

const MAX_TTS_CHARACTERS = 1_200;
const MULTIPART_OVERHEAD_BYTES = 64 * 1024;

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: corsHeaders() });
}

export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth.valid) return unauthorizedResponse();

    const contentType = request.headers.get('content-type') || '';
    const declaredLength = Number(request.headers.get('content-length') || '0');
    
    // Handle text-to-speech
    if (contentType.includes('application/json')) {
      if (Number.isFinite(declaredLength) && declaredLength > 16 * 1024) {
        return jsonResponse({ error: 'Text is too long' }, 413);
      }
      const body = (await request.json()) as { text?: unknown };
      const text = typeof body.text === 'string' ? body.text.trim() : '';

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
    console.error('Voice API error:', error);
    return jsonResponse({ error: 'Failed to process voice request' }, 500);
  }
}
