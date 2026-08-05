export type RealtimeEventAction =
  | { type: 'error'; message: string }
  | { type: 'speech_started' }
  | { type: 'speech_stopped' }
  | { type: 'transcription_empty' }
  | { type: 'transcription_failed'; message: string }
  | { type: 'user_transcript'; text: string }
  | { type: 'unknown' };

interface RealtimeEvent {
  type?: unknown;
  transcript?: unknown;
  delta?: unknown;
  error?: { message?: unknown };
}

export function parseRealtimeEvent(data: unknown): RealtimeEvent | null {
  if (typeof data !== 'string') return null;
  try {
    const parsed = JSON.parse(data);
    return parsed && typeof parsed === 'object'
      ? (parsed as RealtimeEvent)
      : null;
  } catch {
    return null;
  }
}

export function classifyRealtimeEvent(event: RealtimeEvent): RealtimeEventAction {
  switch (event.type) {
    case 'conversation.item.input_audio_transcription.completed':
      return typeof event.transcript === 'string' && event.transcript.trim()
        ? { type: 'user_transcript', text: event.transcript.trim() }
        : { type: 'transcription_empty' };
    case 'conversation.item.input_audio_transcription.failed':
      return {
        type: 'transcription_failed',
        message: 'I could not transcribe that turn safely. Please try again.',
      };
    case 'input_audio_buffer.speech_started':
      return { type: 'speech_started' };
    case 'input_audio_buffer.speech_stopped':
      return { type: 'speech_stopped' };
    case 'error':
      return {
        type: 'error',
        message:
          typeof event.error?.message === 'string'
            ? event.error.message
            : 'The live conversation encountered an error.',
      };
    default:
      return { type: 'unknown' };
  }
}
