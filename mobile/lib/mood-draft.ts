import {
  addCustomMoodEmotion,
  getMoodEmotionOptions,
  getMoodSupportOptions,
  MAX_MOOD_EMOTIONS,
  parseMoodMetadata,
  type MoodEmotion,
  type MoodSupport,
} from './mood-check-in';
import type { MoodEmoji } from './types';

export interface MoodCheckInDraft {
  mood: MoodEmoji | null;
  note: string;
  emotions: MoodEmotion[];
  customEmotions: string[];
  support: MoodSupport | null;
  visibleTags: string[];
  detailsOpen: boolean;
}

export interface MoodDraftSecureStore {
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string): Promise<void>;
  deleteItemAsync(key: string): Promise<void>;
}

export interface MoodDraftStorage {
  read(ownerId: string): Promise<MoodCheckInDraft | null>;
  write(ownerId: string, draft: MoodCheckInDraft): Promise<void>;
  clear(ownerId: string): Promise<void>;
}

const DRAFT_PREFIX = 'mhtoolkit.mood-draft.';
const MOODS = new Set<MoodEmoji>(['😄', '🙂', '😐', '😞', '😢']);

function draftKey(ownerId: string): string {
  const safeOwnerId = ownerId.replace(/[^a-zA-Z0-9._-]/g, '_');
  return `${DRAFT_PREFIX}${safeOwnerId}`;
}

export function emptyMoodCheckInDraft(): MoodCheckInDraft {
  return {
    mood: null,
    note: '',
    emotions: [],
    customEmotions: [],
    support: null,
    visibleTags: [],
    detailsOpen: false,
  };
}

export function hasMoodCheckInDraft(draft: MoodCheckInDraft): boolean {
  return Boolean(
    draft.mood ||
      draft.note.trim() ||
      draft.emotions.length ||
      draft.customEmotions.length ||
      draft.support
  );
}

export function parseMoodCheckInDraft(value: unknown): MoodCheckInDraft | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  const mood = MOODS.has(raw.mood as MoodEmoji) ? (raw.mood as MoodEmoji) : null;
  if (!mood) return null;

  const allowedEmotions = new Set(
    getMoodEmotionOptions(mood).map(({ id }) => id)
  );
  const emotions = Array.isArray(raw.emotions)
    ? [...new Set(raw.emotions)]
        .filter(
          (emotion): emotion is MoodEmotion =>
            typeof emotion === 'string' &&
            allowedEmotions.has(emotion as MoodEmotion)
        )
        .slice(0, MAX_MOOD_EMOTIONS)
    : [];

  let customEmotions: string[] = [];
  if (Array.isArray(raw.customEmotions)) {
    for (const emotion of raw.customEmotions) {
      if (typeof emotion !== 'string') continue;
      customEmotions = addCustomMoodEmotion(
        customEmotions,
        emotion,
        emotions.length
      );
    }
  }

  const allowedSupports = new Set(
    getMoodSupportOptions(mood).map(({ id }) => id)
  );
  const support =
    typeof raw.support === 'string' &&
    allowedSupports.has(raw.support as MoodSupport)
      ? (raw.support as MoodSupport)
      : null;

  return {
    mood,
    note: typeof raw.note === 'string' ? raw.note.slice(0, 500) : '',
    emotions,
    customEmotions,
    support,
    visibleTags: parseMoodMetadata(
      Array.isArray(raw.visibleTags)
        ? raw.visibleTags.filter((tag): tag is string => typeof tag === 'string')
        : []
    ).visibleTags,
    detailsOpen: raw.detailsOpen === true,
  };
}

export function createMoodDraftStorage(secureStore: MoodDraftSecureStore) {
  return {
    async read(ownerId: string): Promise<MoodCheckInDraft | null> {
      const raw = await secureStore.getItemAsync(draftKey(ownerId));
      if (!raw) return null;
      try {
        return parseMoodCheckInDraft(JSON.parse(raw));
      } catch {
        return null;
      }
    },
    async write(ownerId: string, draft: MoodCheckInDraft): Promise<void> {
      await secureStore.setItemAsync(draftKey(ownerId), JSON.stringify(draft));
    },
    async clear(ownerId: string): Promise<void> {
      await secureStore.deleteItemAsync(draftKey(ownerId));
    },
  };
}

export function createMoodDraftPersistenceQueue(storage: MoodDraftStorage) {
  let generation = 0;
  let pending: Promise<void> = Promise.resolve();

  const enqueue = (operation: () => Promise<void>) => {
    pending = pending.catch(() => undefined).then(operation);
    return pending;
  };

  return {
    invalidatePendingWrites() {
      generation += 1;
    },
    write(ownerId: string, draft: MoodCheckInDraft) {
      const writeGeneration = generation;
      return enqueue(async () => {
        if (writeGeneration !== generation) return;
        await storage.write(ownerId, draft);
      });
    },
    clear(ownerId: string) {
      generation += 1;
      return enqueue(() => storage.clear(ownerId));
    },
    settled() {
      return pending.catch(() => undefined);
    },
  };
}
