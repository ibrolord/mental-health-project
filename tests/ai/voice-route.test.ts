import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createAudioFile, getAudioFile } from '../../lib/ai/voice-input';
import { POST } from '../../app/api/voice/route';

const mocks = vi.hoisted(() => ({
  generateVoiceResponse: vi.fn(),
  transcribeAudio: vi.fn(),
}));

vi.mock('@/lib/ai/voice-chat', () => ({
  generateVoiceResponse: mocks.generateVoiceResponse,
  transcribeAudio: mocks.transcribeAudio,
  VOICE_NAMES: ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'],
}));

vi.mock('@/lib/api/auth', () => ({
  corsHeaders: vi.fn(() => ({
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Session-Id',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Origin': '*',
  })),
  unauthorizedResponse: vi.fn(),
  verifyAuth: vi.fn(async () => ({ valid: true })),
}));

describe('voice API multipart validation', () => {
  beforeEach(() => {
    mocks.generateVoiceResponse.mockReset();
    mocks.generateVoiceResponse.mockResolvedValue(
      new Response(new Uint8Array([1, 2, 3]), { headers: { 'content-type': 'audio/mpeg' } })
    );
    mocks.transcribeAudio.mockReset();
    mocks.transcribeAudio.mockResolvedValue('transcribed audio');
  });

  it('rejects a non-file audio field before transcription', () => {
    expect(getAudioFile({ get: () => 'not an audio file' })).toBeNull();
    expect(getAudioFile({ get: () => null })).toBeNull();
  });

  it('passes a valid audio file to transcription', () => {
    const audio = new File(['audio-bytes'], 'voice.m4a', { type: 'audio/mp4' });
    expect(getAudioFile({ get: () => audio })).toBe(audio);
  });

  it('wraps a non-empty raw audio body as a named file', () => {
    const audio = createAudioFile(
      new Blob(['audio-bytes'], { type: 'audio/webm' }),
      'audio/webm; codecs=opus'
    );

    expect(audio).toBeInstanceOf(File);
    expect(audio?.name).toBe('voice.webm');
    expect(audio?.type).toBe('audio/webm');
  });

  it('rejects empty or non-audio raw bodies', () => {
    expect(createAudioFile(new Blob([]), 'audio/mpeg')).toBeNull();
    expect(createAudioFile(new Blob(['text']), 'text/plain')).toBeNull();
    expect(createAudioFile(new Blob(['bytes']), 'audio/unknown')).toBeNull();
  });

  it('transcribes multipart audio through the route', async () => {
    const body = new FormData();
    body.set('audio', new File(['multipart-audio'], 'voice.m4a', { type: 'audio/mp4' }));

    const response = await POST(new NextRequest('https://mhtoolkit.test/api/voice', {
      body,
      method: 'POST',
    }));

    expect(response.status).toBe(200);
    expect(response.headers.get('access-control-allow-origin')).toBe('*');
    await expect(response.json()).resolves.toEqual({ transcription: 'transcribed audio' });
    expect(mocks.transcribeAudio).toHaveBeenCalledOnce();
    expect(mocks.transcribeAudio.mock.calls[0][0]).toBeInstanceOf(File);
  });

  it('transcribes a raw audio body through the route', async () => {
    const response = await POST(new NextRequest('https://mhtoolkit.test/api/voice', {
      body: new Blob(['raw-audio'], { type: 'audio/webm' }),
      headers: { 'content-type': 'audio/webm; codecs=opus' },
      method: 'POST',
    }));

    expect(response.status).toBe(200);
    expect(response.headers.get('access-control-allow-origin')).toBe('*');
    await expect(response.json()).resolves.toEqual({ transcription: 'transcribed audio' });
    const uploaded = mocks.transcribeAudio.mock.calls[0][0] as File;
    expect(uploaded).toBeInstanceOf(File);
    expect(uploaded.name).toBe('voice.webm');
    expect(uploaded.type).toBe('audio/webm');
  });

  it('returns 400 for an empty raw audio body', async () => {
    const response = await POST(new NextRequest('https://mhtoolkit.test/api/voice', {
      body: new Blob([], { type: 'audio/mpeg' }),
      headers: { 'content-type': 'audio/mpeg' },
      method: 'POST',
    }));

    expect(response.status).toBe(400);
    expect(response.headers.get('access-control-allow-origin')).toBe('*');
    await expect(response.json()).resolves.toEqual({ error: 'Audio file is required' });
    expect(mocks.transcribeAudio).not.toHaveBeenCalled();
  });

  it('returns CORS headers with generated voice audio', async () => {
    const response = await POST(new NextRequest('https://mhtoolkit.test/api/voice', {
      body: JSON.stringify({ text: 'Take one slow breath.', voice: 'nova' }),
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    }));

    expect(response.status).toBe(200);
    expect(response.headers.get('access-control-allow-origin')).toBe('*');
    expect(response.headers.get('content-type')).toBe('audio/mpeg');
    expect(mocks.generateVoiceResponse).toHaveBeenCalledWith(
      'Take one slow breath.',
      'nova'
    );
  });

  it('rejects unbounded speech text and unsupported voices before provider use', async () => {
    const oversized = await POST(
      new NextRequest('https://mhtoolkit.test/api/voice', {
        body: JSON.stringify({ text: 'a'.repeat(1_201), voice: 'nova' }),
        headers: { 'content-type': 'application/json' },
        method: 'POST',
      })
    );
    const invalidVoice = await POST(
      new NextRequest('https://mhtoolkit.test/api/voice', {
        body: JSON.stringify({ text: 'Hello', voice: 'not-a-real-voice' }),
        headers: { 'content-type': 'application/json' },
        method: 'POST',
      })
    );

    expect(oversized.status).toBe(413);
    expect(invalidVoice.status).toBe(400);
    expect(mocks.generateVoiceResponse).not.toHaveBeenCalled();
  });

  it('rejects declared audio uploads above the bounded request size', async () => {
    const response = await POST(
      new NextRequest('https://mhtoolkit.test/api/voice', {
        body: new Blob(['small'], { type: 'audio/mpeg' }),
        headers: {
          'content-length': String(10 * 1024 * 1024 + 1),
          'content-type': 'audio/mpeg',
        },
        method: 'POST',
      })
    );

    expect(response.status).toBe(413);
    expect(mocks.transcribeAudio).not.toHaveBeenCalled();
  });

  it('returns CORS headers on validation and processing errors', async () => {
    const invalid = await POST(new NextRequest('https://mhtoolkit.test/api/voice', {
      body: 'plain text',
      headers: { 'content-type': 'text/plain' },
      method: 'POST',
    }));
    expect(invalid.status).toBe(400);
    expect(invalid.headers.get('access-control-allow-origin')).toBe('*');

    mocks.transcribeAudio.mockRejectedValueOnce(new Error('provider unavailable'));
    const failed = await POST(new NextRequest('https://mhtoolkit.test/api/voice', {
      body: new Blob(['raw-audio'], { type: 'audio/webm' }),
      headers: { 'content-type': 'audio/webm' },
      method: 'POST',
    }));
    expect(failed.status).toBe(500);
    expect(failed.headers.get('access-control-allow-origin')).toBe('*');
  });
});
