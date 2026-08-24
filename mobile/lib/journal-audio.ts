import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import * as Crypto from 'expo-crypto';
import {
  journalAudioLocalPath,
  MAX_JOURNAL_AUDIO_BYTES,
  type JournalAudioDraft,
  type JournalAudioRecording,
  validateJournalAudio,
} from '@/lib/journal-audio-details';

export * from '@/lib/journal-audio-details';

const AUDIO_INDEX_KEY_PREFIX = 'mhtoolkit.journal-audio.v1';

type AudioIndex = Record<string, JournalAudioRecording>;

function audioIndexKey(userId: string): string {
  return `${AUDIO_INDEX_KEY_PREFIX}:${userId}`;
}

function isOwnedRecording(userId: string, value: unknown): value is JournalAudioRecording {
  if (!value || typeof value !== 'object') return false;
  const recording = value as Partial<JournalAudioRecording>;
  return (
    recording.user_id === userId &&
    typeof recording.id === 'string' &&
    typeof recording.journal_entry_id === 'string' &&
    typeof recording.local_uri === 'string' &&
    recording.local_uri.includes(`/journal-audio-v1/${userId}/`) &&
    typeof recording.mime_type === 'string' &&
    typeof recording.size_bytes === 'number' &&
    typeof recording.duration_ms === 'number' &&
    typeof recording.created_at === 'string' &&
    typeof recording.updated_at === 'string'
  );
}

async function readIndex(userId: string): Promise<AudioIndex> {
  try {
    const raw = await AsyncStorage.getItem(audioIndexKey(userId));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return Object.fromEntries(
      Object.entries(parsed).filter(([, recording]) => isOwnedRecording(userId, recording))
    ) as AudioIndex;
  } catch {
    return {};
  }
}

async function writeIndex(userId: string, index: AudioIndex): Promise<void> {
  if (Object.keys(index).length === 0) {
    await AsyncStorage.removeItem(audioIndexKey(userId));
    return;
  }
  await AsyncStorage.setItem(audioIndexKey(userId), JSON.stringify(index));
}

async function removeFile(uri: string): Promise<void> {
  await FileSystem.deleteAsync(uri, { idempotent: true });
}

export async function loadJournalAudioRecordings(
  userId: string
): Promise<Record<string, JournalAudioRecording>> {
  const index = await readIndex(userId);
  const current: AudioIndex = {};
  let changed = false;
  for (const [entryId, recording] of Object.entries(index)) {
    const info = await FileSystem.getInfoAsync(recording.local_uri);
    if (info.exists) {
      current[entryId] = recording;
    } else {
      changed = true;
    }
  }
  if (changed) await writeIndex(userId, current);
  return current;
}

export type StagedJournalAudio = {
  recording: JournalAudioRecording;
  commit: () => Promise<void>;
  discard: () => Promise<void>;
};

export async function stageJournalAudioRecording(input: {
  userId: string;
  journalEntryId: string;
  draft: JournalAudioDraft;
}): Promise<StagedJournalAudio> {
  const validationError = validateJournalAudio(input.draft);
  if (validationError) throw new Error(validationError);
  if (!FileSystem.documentDirectory) {
    throw new Error('Private on-device storage is unavailable.');
  }

  const recordingId = Crypto.randomUUID();
  const localUri = journalAudioLocalPath(
    FileSystem.documentDirectory,
    input.userId,
    input.journalEntryId,
    recordingId
  );
  const directory = localUri.slice(0, localUri.lastIndexOf('/'));
  await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
  await FileSystem.copyAsync({ from: input.draft.uri, to: localUri });

  const copied = await FileSystem.getInfoAsync(localUri);
  if (!copied.exists || typeof copied.size !== 'number') {
    await removeFile(localUri).catch(() => {});
    throw new Error('The recording could not be saved on this iPhone.');
  }
  if (copied.size > MAX_JOURNAL_AUDIO_BYTES) {
    await removeFile(localUri).catch(() => {});
    throw new Error('That recording is too large. Keep it under 4 MB.');
  }

  const now = new Date().toISOString();
  const recording: JournalAudioRecording = {
    id: recordingId,
    journal_entry_id: input.journalEntryId,
    user_id: input.userId,
    local_uri: localUri,
    mime_type: input.draft.mimeType,
    size_bytes: copied.size,
    duration_ms: input.draft.durationMs,
    created_at: now,
    updated_at: now,
  };

  return {
    recording,
    commit: async () => {
      const index = await readIndex(input.userId);
      const previous = index[input.journalEntryId];
      index[input.journalEntryId] = recording;
      await writeIndex(input.userId, index);
      if (previous && previous.local_uri !== recording.local_uri) {
        await removeFile(previous.local_uri).catch(() => {});
      }
    },
    discard: () => removeFile(localUri).catch(() => {}),
  };
}

export async function deleteJournalAudioRecording(
  userId: string,
  journalEntryId: string
): Promise<void> {
  const index = await readIndex(userId);
  const recording = index[journalEntryId];
  if (!recording) return;

  // Keep the index until the file deletion succeeds so a retry can still find it.
  await removeFile(recording.local_uri);
  delete index[journalEntryId];
  await writeIndex(userId, index);
}

export async function clearJournalAudioForUser(userId: string): Promise<void> {
  const index = await readIndex(userId);
  await Promise.all(Object.values(index).map((recording) => removeFile(recording.local_uri)));
  await AsyncStorage.removeItem(audioIndexKey(userId));
  if (FileSystem.documentDirectory) {
    const directory = `${FileSystem.documentDirectory}journal-audio-v1/${userId}`;
    await FileSystem.deleteAsync(directory, { idempotent: true });
  }
}

export async function moveJournalAudioForUser(
  sourceUserId: string,
  targetUserId: string
): Promise<void> {
  if (sourceUserId === targetUserId) return;
  const source = await loadJournalAudioRecordings(sourceUserId);
  if (Object.keys(source).length === 0) return;
  if (!FileSystem.documentDirectory) {
    throw new Error('Private on-device storage is unavailable.');
  }

  const target = await readIndex(targetUserId);
  const copied: string[] = [];
  try {
    for (const [entryId, recording] of Object.entries(source)) {
      if (target[entryId]) continue;
      const localUri = journalAudioLocalPath(
        FileSystem.documentDirectory,
        targetUserId,
        entryId,
        recording.id
      );
      await FileSystem.makeDirectoryAsync(localUri.slice(0, localUri.lastIndexOf('/')), {
        intermediates: true,
      });
      await FileSystem.copyAsync({ from: recording.local_uri, to: localUri });
      copied.push(localUri);
      target[entryId] = {
        ...recording,
        user_id: targetUserId,
        local_uri: localUri,
        updated_at: new Date().toISOString(),
      };
    }
    await writeIndex(targetUserId, target);
    await Promise.all(
      Object.values(source).map((recording) => removeFile(recording.local_uri).catch(() => {}))
    );
    await AsyncStorage.removeItem(audioIndexKey(sourceUserId));
  } catch (error) {
    await Promise.all(copied.map((uri) => removeFile(uri).catch(() => {})));
    throw error;
  }
}
