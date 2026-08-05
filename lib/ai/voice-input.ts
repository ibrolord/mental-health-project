type ReadableFormData = {
  get(name: string): unknown;
};

export { MAX_VOICE_AUDIO_BYTES } from './voice-limits';
import { MAX_VOICE_AUDIO_BYTES } from './voice-limits';

const AUDIO_EXTENSIONS: Record<string, string> = {
  'audio/aac': 'aac',
  'audio/flac': 'flac',
  'audio/m4a': 'm4a',
  'audio/mp4': 'm4a',
  'audio/mpeg': 'mp3',
  'audio/ogg': 'ogg',
  'audio/wav': 'wav',
  'audio/webm': 'webm',
  'audio/x-m4a': 'm4a',
  'audio/x-wav': 'wav',
};

function hasFormDataGetter(value: unknown): value is ReadableFormData {
  return typeof value === 'object'
    && value !== null
    && 'get' in value
    && typeof value.get === 'function';
}

export function getAudioFile(formData: unknown): File | null {
  if (!hasFormDataGetter(formData)) return null;
  const candidate = formData.get('audio');
  if (!(candidate instanceof File)) return null;
  const mediaType = candidate.type.trim().toLowerCase();
  return candidate.size > 0 &&
    candidate.size <= MAX_VOICE_AUDIO_BYTES &&
    mediaType in AUDIO_EXTENSIONS
    ? candidate
    : null;
}

export function createAudioFile(blob: Blob, contentType: string): File | null {
  const mediaType = contentType.split(';', 1)[0].trim().toLowerCase();
  if (
    !blob.size ||
    blob.size > MAX_VOICE_AUDIO_BYTES ||
    !(mediaType in AUDIO_EXTENSIONS)
  ) {
    return null;
  }

  const extension = AUDIO_EXTENSIONS[mediaType];
  return new File([blob], `voice.${extension}`, { type: mediaType });
}
