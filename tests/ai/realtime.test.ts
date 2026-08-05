import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createRealtimeSessionConfig,
  createRealtimeTranscriptionCall,
  hangupRealtimeCall,
  REALTIME_SESSION_SECONDS,
  REALTIME_TRANSCRIPTION_MODEL,
} from '../../lib/ai/realtime';

const originalApiKey = process.env.OPENAI_API_KEY;

afterEach(() => {
  vi.unstubAllGlobals();
  if (originalApiKey === undefined) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = originalApiKey;
});

describe('Realtime transcription configuration', () => {
  it('creates a transcription-only session that cannot generate model responses', () => {
    const config = createRealtimeSessionConfig();
    const turnDetection = config.audio?.input?.turn_detection;

    expect(config.type).toBe('transcription');
    expect(config.audio?.input?.transcription?.model).toBe(
      REALTIME_TRANSCRIPTION_MODEL
    );
    expect(turnDetection).toMatchObject({
      type: 'server_vad',
      create_response: false,
      interrupt_response: false,
    });
    expect(config).not.toHaveProperty('output_modalities');
    expect(config).not.toHaveProperty('instructions');
  });

  it('keeps the app session bounded and language detection automatic', () => {
    const config = createRealtimeSessionConfig();

    expect(REALTIME_SESSION_SECONDS).toBe(240);
    expect(config.audio?.input?.transcription?.language).toBeUndefined();
  });

  it('creates the provider call on the server with a pseudonymous safety ID', async () => {
    process.env.OPENAI_API_KEY = 'server-only-key';
    const fetchMock = vi.fn().mockResolvedValue(
      new Response('v=0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\n', {
        headers: { Location: '/v1/realtime/calls/rtc_test-call_123' },
        status: 200,
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await createRealtimeTranscriptionCall({
      offerSdp: 'v=0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\n',
      safetyIdentifier: 'a'.repeat(64),
    });

    expect(result).toMatchObject({
      callId: 'rtc_test-call_123',
      model: REALTIME_TRANSCRIPTION_MODEL,
    });
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.headers).toMatchObject({
      Authorization: 'Bearer server-only-key',
      'OpenAI-Safety-Identifier': 'a'.repeat(64),
    });
    const form = init.body as FormData;
    expect(form.get('sdp')).toContain('m=audio');
    expect(JSON.parse(String(form.get('session')))).toMatchObject({
      type: 'transcription',
    });
  });

  it('fails closed when OpenAI is not configured', async () => {
    delete process.env.OPENAI_API_KEY;

    await expect(
      createRealtimeTranscriptionCall({
        offerSdp: 'v=0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\n',
        safetyIdentifier: 'a'.repeat(64),
      })
    ).rejects.toThrow('OpenAI Realtime is not configured');
  });

  it('fails closed when the provider omits or corrupts the call location', async () => {
    process.env.OPENAI_API_KEY = 'server-only-key';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response('v=0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\n', {
          status: 200,
        })
      )
    );

    await expect(
      createRealtimeTranscriptionCall({
        offerSdp: 'v=0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\n',
        safetyIdentifier: 'a'.repeat(64),
      })
    ).rejects.toThrow('omitted the call ID');
  });

  it('hangs up a validated call and treats an ended call as idempotent', async () => {
    process.env.OPENAI_API_KEY = 'server-only-key';
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 404 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(hangupRealtimeCall('rtc_live_123')).resolves.toBe('requested');
    await expect(hangupRealtimeCall('rtc_live_123')).resolves.toBe(
      'already_ended'
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'https://api.openai.com/v1/realtime/calls/rtc_live_123/hangup',
      expect.objectContaining({ method: 'POST' })
    );
    await expect(hangupRealtimeCall('../other-call')).rejects.toThrow(
      'Invalid OpenAI Realtime call ID'
    );
  });
});
