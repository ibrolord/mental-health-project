export const MAX_JOURNAL_AUDIO_BYTES = 4 * 1024 * 1024;
export const MIN_JOURNAL_AUDIO_DURATION_MS = 1000;
export const MAX_JOURNAL_AUDIO_DURATION_MS = 10 * 60 * 1000;

export type JournalAudioDraft = {
  uri: string;
  mimeType: 'audio/m4a';
  fileName: string;
  sizeBytes: number;
  durationMs: number;
};

export type JournalAudioRecording = {
  id: string;
  journal_entry_id: string;
  user_id: string;
  local_uri: string;
  mime_type: string;
  size_bytes: number;
  duration_ms: number;
  created_at: string;
  updated_at: string;
};

function isSafePathSegment(value: string): boolean {
  return /^[a-zA-Z0-9-]+$/.test(value);
}

export function journalAudioLocalPath(
  documentDirectory: string,
  userId: string,
  journalEntryId: string,
  recordingId: string
): string {
  if (![userId, journalEntryId, recordingId].every(isSafePathSegment)) {
    throw new Error('The recording could not be stored safely.');
  }
  const base = documentDirectory.endsWith('/')
    ? documentDirectory
    : `${documentDirectory}/`;
  return `${base}journal-audio-v1/${userId}/${journalEntryId}/${recordingId}.m4a`;
}

export function validateJournalAudio(input: {
  sizeBytes: number;
  durationMs: number;
  mimeType: string;
}): string | null {
  if (!Number.isFinite(input.durationMs) || input.durationMs < MIN_JOURNAL_AUDIO_DURATION_MS) {
    return 'Record at least one second before saving.';
  }
  if (input.durationMs > MAX_JOURNAL_AUDIO_DURATION_MS) {
    return 'Keep voice entries under 10 minutes.';
  }
  if (!Number.isFinite(input.sizeBytes) || input.sizeBytes < 1) {
    return 'That recording could not be read.';
  }
  if (input.sizeBytes > MAX_JOURNAL_AUDIO_BYTES) {
    return 'That recording is too large. Keep it under 4 MB.';
  }
  if (input.mimeType !== 'audio/m4a') {
    return 'That recording format is not supported.';
  }
  return null;
}

export function formatJournalAudioDuration(durationMs: number): string {
  const totalSeconds = Math.max(0, Math.round(durationMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}
