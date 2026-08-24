import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  formatJournalAudioDuration,
  journalAudioLocalPath,
  MAX_JOURNAL_AUDIO_BYTES,
  MAX_JOURNAL_AUDIO_DURATION_MS,
  validateJournalAudio,
} from '../../mobile/lib/journal-audio-details';

const migration = readFileSync(
  resolve(
    process.cwd(),
    'supabase/migrations/20260824182936_add_private_journal_audio.sql'
  ),
  'utf8'
);
const journalScreen = readFileSync(
  resolve(process.cwd(), 'mobile/app/journal.tsx'),
  'utf8'
);
const recorder = readFileSync(
  resolve(process.cwd(), 'mobile/components/JournalVoiceRecorder.tsx'),
  'utf8'
);
const journalAudioLifecycle = readFileSync(
  resolve(process.cwd(), 'mobile/lib/journal-audio.ts'),
  'utf8'
);
const authContext = readFileSync(
  resolve(process.cwd(), 'mobile/lib/auth-context.tsx'),
  'utf8'
);
const settings = readFileSync(
  resolve(process.cwd(), 'mobile/app/settings.tsx'),
  'utf8'
);
const exportRoute = readFileSync(
  resolve(process.cwd(), 'app/api/data/export/route.ts'),
  'utf8'
);

describe('local voice journal persistence', () => {
  it('builds a private, user- and entry-scoped iOS Documents path', () => {
    expect(
      journalAudioLocalPath(
        'file:///private/documents/',
        'user-1',
        'entry-2',
        'recording-3'
      )
    ).toBe(
      'file:///private/documents/journal-audio-v1/user-1/entry-2/recording-3.m4a'
    );
    expect(() =>
      journalAudioLocalPath('file:///documents/', '../user', 'entry-2', 'recording-3')
    ).toThrow('stored safely');
  });

  it('validates duration, size, and the persisted iOS format', () => {
    expect(
      validateJournalAudio({
        durationMs: 30_000,
        sizeBytes: 400_000,
        mimeType: 'audio/m4a',
      })
    ).toBeNull();
    expect(
      validateJournalAudio({
        durationMs: 999,
        sizeBytes: 400_000,
        mimeType: 'audio/m4a',
      })
    ).toContain('at least one second');
    expect(
      validateJournalAudio({
        durationMs: MAX_JOURNAL_AUDIO_DURATION_MS + 1,
        sizeBytes: 400_000,
        mimeType: 'audio/m4a',
      })
    ).toContain('under 10 minutes');
    expect(
      validateJournalAudio({
        durationMs: 30_000,
        sizeBytes: MAX_JOURNAL_AUDIO_BYTES + 1,
        mimeType: 'audio/m4a',
      })
    ).toContain('under 4 MB');
    expect(formatJournalAudioDuration(65_000)).toBe('1:05');
  });

  it('keeps the database limited to a voice-only entry flag', () => {
    expect(migration).toContain('has_voice_recording BOOLEAN NOT NULL DEFAULT FALSE');
    expect(migration).toContain('OR has_voice_recording');
    expect(migration).not.toContain('journal_audio_recordings');
    expect(migration).not.toContain('storage.buckets');
    expect(migration).not.toContain('storage.objects');
  });

  it('copies recordings into local Documents storage and maintains owner-scoped metadata', () => {
    expect(journalAudioLifecycle).toContain('FileSystem.documentDirectory');
    expect(journalAudioLifecycle).toContain('FileSystem.copyAsync');
    expect(journalAudioLifecycle).toContain('AsyncStorage.setItem');
    expect(journalAudioLifecycle).toContain('loadJournalAudioRecordings');
    expect(journalAudioLifecycle).toContain('deleteJournalAudioRecording');
    expect(journalAudioLifecycle).toContain('clearJournalAudioForUser');
    expect(journalAudioLifecycle).toContain('moveJournalAudioForUser');
    expect(journalAudioLifecycle).not.toContain('supabase.storage');
    expect(journalAudioLifecycle).not.toContain('journal_audio_recordings');
  });

  it('saves, loads, replaces, and deletes local audio without a storage upload', () => {
    expect(journalScreen).toContain('loadJournalAudioRecordings(ownerId)');
    expect(journalScreen).toContain('stageJournalAudioRecording');
    expect(journalScreen).toContain('deleteJournalAudioRecording');
    expect(journalScreen).toContain('has_voice_recording: true');
    expect(journalScreen).not.toContain('journal_audio_recordings');
    expect(journalScreen).not.toContain('supabase.storage');
    expect(journalScreen).not.toContain('save_journal_entry_with_audio');
  });

  it('keeps transcription explicit and supports local playback and a user-controlled copy', () => {
    for (const label of [
      'Start voice journal recording',
      'Stop voice journal recording',
      'Transcribe voice journal recording',
      'Play voice journal recording',
      'Replace voice journal recording',
      'Delete voice journal recording',
      'Save a copy of voice journal recording',
    ]) {
      expect(recorder).toContain(label);
    }
    expect(recorder).toContain('ensureAiDataSharingConsent');
    expect(recorder).toContain('savedRecording.local_uri');
    expect(recorder).toContain('Sharing.shareAsync');
    expect(recorder).not.toContain('createSignedUrl');
    expect(recorder).not.toContain('supabase.storage');
    expect(recorder).not.toContain('await transcribe(nextRecording)');
  });

  it('retains a measured recording duration when iOS reports zero after unloading', () => {
    expect(recorder).toContain('Math.max(durationMs, finalStatus.durationMillis)');
  });

  it('moves anonymous audio during account upgrade and clears it on deletion', () => {
    expect(authContext).toContain('moveJournalAudioForUser(sourceUserId, targetUserId)');
    expect(authContext).toContain('clearJournalAudioForUser(user.id)');
    expect(authContext).toContain('clearJournalAudioForUser(deletedOwnerId)');
    expect(settings).toContain('clearJournalAudioForUser(expectedOwnerId)');
  });

  it('does not upload local recordings through the server data export', () => {
    expect(exportRoute).not.toContain('journal_audio_recordings');
    expect(exportRoute).not.toContain('JOURNAL_AUDIO_BUCKET');
  });
});
