import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  generateContent: vi.fn(),
  speechCreate: vi.fn(),
  transcriptionCreate: vi.fn(),
}));

vi.mock('@google/genai', () => ({
  GoogleGenAI: vi.fn(() => ({
    models: { generateContent: mocks.generateContent },
  })),
  Modality: { AUDIO: 'AUDIO' },
}));

vi.mock('openai', () => ({
  default: vi.fn(() => ({
    audio: {
      speech: { create: mocks.speechCreate },
      transcriptions: { create: mocks.transcriptionCreate },
    },
  })),
}));

import {
  generateVoiceResponse,
  transcribeAudio,
} from '../../lib/ai/voice-chat';

const originalGoogleKey = process.env.GOOGLE_API_KEY;
const originalOpenAiKey = process.env.OPENAI_API_KEY;
const originalGeminiModel = process.env.GEMINI_MODEL;
const originalTranscriptionModel = process.env.GEMINI_TRANSCRIPTION_MODEL;

describe('voice transcription providers', () => {
  beforeEach(() => {
    process.env.GOOGLE_API_KEY = 'google-test-key';
    process.env.OPENAI_API_KEY = 'openai-test-key';
    delete process.env.GEMINI_MODEL;
    delete process.env.GEMINI_TRANSCRIPTION_MODEL;
    mocks.generateContent.mockReset();
    mocks.speechCreate.mockReset();
    mocks.transcriptionCreate.mockReset();
    mocks.generateContent.mockResolvedValue({ text: '  Hello from the recording.  ' });
    mocks.speechCreate.mockResolvedValue(new Response(new Uint8Array([1, 2, 3])));
    mocks.transcriptionCreate.mockResolvedValue({ text: 'OpenAI transcript' });
  });

  afterEach(() => {
    if (originalGoogleKey === undefined) delete process.env.GOOGLE_API_KEY;
    else process.env.GOOGLE_API_KEY = originalGoogleKey;
    if (originalOpenAiKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = originalOpenAiKey;
    if (originalGeminiModel === undefined) delete process.env.GEMINI_MODEL;
    else process.env.GEMINI_MODEL = originalGeminiModel;
    if (originalTranscriptionModel === undefined) {
      delete process.env.GEMINI_TRANSCRIPTION_MODEL;
    } else {
      process.env.GEMINI_TRANSCRIPTION_MODEL = originalTranscriptionModel;
    }
  });

  it('uses Gemini first for a supported WAV recording', async () => {
    const audio = new File([new Uint8Array([1, 2, 3])], 'voice.wav', {
      type: 'audio/wav',
    });

    await expect(transcribeAudio(audio)).resolves.toBe(
      'Hello from the recording.'
    );
    expect(mocks.generateContent).toHaveBeenCalledWith({
      model: 'gemini-3.5-flash',
      contents: [{
        role: 'user',
        parts: [
          expect.objectContaining({ text: expect.stringContaining('Return only the transcript') }),
          { inlineData: { data: 'AQID', mimeType: 'audio/wav' } },
        ],
      }],
      config: {
        abortSignal: expect.any(AbortSignal),
        temperature: 0,
      },
    });
    expect(mocks.transcriptionCreate).not.toHaveBeenCalled();
  });

  it('generates quality-optimized speech with the preferred natural voice', async () => {
    mocks.generateContent.mockResolvedValueOnce({
      data: Buffer.from([1, 2, 3, 4]).toString('base64'),
    });
    const response = await generateVoiceResponse('Take one slow breath.');

    expect(mocks.generateContent).toHaveBeenCalledWith({
      model: 'gemini-3.1-flash-tts-preview',
      contents: [{
        role: 'user',
        parts: [{ text: expect.stringContaining('Take one slow breath.') }],
      }],
      config: {
        abortSignal: expect.any(AbortSignal),
        responseModalities: ['AUDIO'],
        speechConfig: {
          languageCode: 'en-US',
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Sulafat' },
          },
        },
      },
    });
    expect(mocks.speechCreate).not.toHaveBeenCalled();
    expect(response.headers.get('content-type')).toBe('audio/wav');
    const wav = Buffer.from(await response.arrayBuffer());
    expect(wav.subarray(0, 4).toString('ascii')).toBe('RIFF');
    expect(wav.subarray(8, 12).toString('ascii')).toBe('WAVE');
  });

  it('falls back to quality-optimized OpenAI speech when Gemini TTS fails', async () => {
    mocks.generateContent.mockRejectedValueOnce(new Error('Gemini TTS unavailable'));

    await generateVoiceResponse('Take one slow breath.');

    expect(mocks.speechCreate).toHaveBeenCalledWith(
      {
        model: 'tts-1-hd',
        voice: 'marin',
        input: 'Take one slow breath.',
        response_format: 'mp3',
        speed: 0.96,
      },
      { maxRetries: 0, timeout: 12_000 }
    );
  });

  it('uses Gemini for Android AAC without requiring OpenAI', async () => {
    delete process.env.OPENAI_API_KEY;
    const audio = new File([new Uint8Array([1, 2, 3])], 'voice.aac', {
      type: 'audio/aac',
    });

    await expect(transcribeAudio(audio)).resolves.toBe(
      'Hello from the recording.'
    );
    expect(mocks.generateContent).toHaveBeenCalledWith(
      expect.objectContaining({
        contents: [expect.objectContaining({
          parts: expect.arrayContaining([
            { inlineData: { data: 'AQID', mimeType: 'audio/aac' } },
          ]),
        })],
      })
    );
    expect(mocks.transcriptionCreate).not.toHaveBeenCalled();
  });

  it('honors the dedicated transcription model override', async () => {
    process.env.GEMINI_TRANSCRIPTION_MODEL = 'gemini-audio-model';

    await transcribeAudio(new File(['audio'], 'voice.wav', { type: 'audio/wav' }));

    expect(mocks.generateContent).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'gemini-audio-model' })
    );
  });

  it('falls back to OpenAI when Gemini fails', async () => {
    mocks.generateContent.mockRejectedValueOnce(new Error('Gemini unavailable'));

    await expect(
      transcribeAudio(new File(['audio'], 'voice.wav', { type: 'audio/wav' }))
    ).resolves.toBe('OpenAI transcript');
    expect(mocks.transcriptionCreate).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'gpt-4o-mini-transcribe' }),
      { maxRetries: 0, timeout: 12_000 }
    );
  });

  it('uses OpenAI directly for formats Gemini does not accept', async () => {
    await expect(
      transcribeAudio(new File(['audio'], 'voice.webm', { type: 'audio/webm' }))
    ).resolves.toBe('OpenAI transcript');
    expect(mocks.generateContent).not.toHaveBeenCalled();
  });

  it('does not send unsupported raw AAC to the OpenAI fallback', async () => {
    mocks.generateContent.mockRejectedValueOnce(new Error('Gemini unavailable'));

    await expect(
      transcribeAudio(new File(['audio'], 'voice.aac', { type: 'audio/aac' }))
    ).rejects.toThrow('Failed to transcribe audio');
    expect(mocks.transcriptionCreate).not.toHaveBeenCalled();
  });

  it('fails closed when neither provider can return a transcript', async () => {
    mocks.generateContent.mockResolvedValueOnce({ text: '   ' });
    mocks.transcriptionCreate.mockRejectedValueOnce(new Error('OpenAI unavailable'));

    await expect(
      transcribeAudio(new File(['audio'], 'voice.wav', { type: 'audio/wav' }))
    ).rejects.toThrow('Failed to transcribe audio');
  });
});
