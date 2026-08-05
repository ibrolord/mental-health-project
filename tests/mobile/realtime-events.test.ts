import { describe, expect, it } from 'vitest';
import {
  classifyRealtimeEvent,
  parseRealtimeEvent,
} from '../../mobile/lib/realtime-events';

describe('mobile Realtime event handling', () => {
  it('parses text events and rejects invalid or binary frames', () => {
    expect(parseRealtimeEvent('{"type":"response.created"}')).toEqual({
      type: 'response.created',
    });
    expect(parseRealtimeEvent('not json')).toBeNull();
    expect(parseRealtimeEvent(new ArrayBuffer(2))).toBeNull();
  });

  it.each([
    [
      { type: 'conversation.item.input_audio_transcription.completed', transcript: '  hello  ' },
      { type: 'user_transcript', text: 'hello' },
    ],
    [{ type: 'input_audio_buffer.speech_started' }, { type: 'speech_started' }],
    [{ type: 'input_audio_buffer.speech_stopped' }, { type: 'speech_stopped' }],
    [
      { type: 'conversation.item.input_audio_transcription.failed' },
      {
        type: 'transcription_failed',
        message: 'I could not transcribe that turn safely. Please try again.',
      },
    ],
    [
      { type: 'error', error: { message: 'connection failed' } },
      { type: 'error', message: 'connection failed' },
    ],
  ])('classifies %s', (event, expected) => {
    expect(classifyRealtimeEvent(event)).toEqual(expected);
  });

  it('resumes safely when a completed transcript is empty', () => {
    expect(
      classifyRealtimeEvent({
        type: 'conversation.item.input_audio_transcription.completed',
        transcript: '   ',
      })
    ).toEqual({ type: 'transcription_empty' });
  });
});
