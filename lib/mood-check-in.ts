import type { MoodEmoji } from './supabase/types';

export const MOOD_EMOTION_PREFIX = 'mood-emotion:';
export const MOOD_CUSTOM_EMOTION_PREFIX = 'mood-custom-emotion:';
export const MOOD_SUPPORT_PREFIX = 'mood-support:';
export const MAX_MOOD_EMOTIONS = 3;

export interface OwnerGeneration {
  ownerKey: string | null;
  generation: number;
}

export type MoodUndoPlan<T> =
  | { kind: 'delete'; savedEntry: T; resultingEntry: null }
  | { kind: 'restore'; savedEntry: T; previousEntry: T; resultingEntry: T };

export function createOwnerGeneration(ownerKey: string | null): OwnerGeneration {
  return { ownerKey, generation: 0 };
}

export function advanceOwnerGeneration(
  current: OwnerGeneration,
  ownerKey: string | null
): OwnerGeneration {
  return current.ownerKey === ownerKey
    ? current
    : { ownerKey, generation: current.generation + 1 };
}

export function isCurrentOwnerGeneration(
  current: OwnerGeneration,
  operation: OwnerGeneration
): boolean {
  return (
    current.ownerKey === operation.ownerKey &&
    current.generation === operation.generation
  );
}

export function createMoodUndoPlan<T>(
  previousEntry: T | null,
  savedEntry: T
): MoodUndoPlan<T> {
  return previousEntry
    ? {
        kind: 'restore',
        savedEntry,
        previousEntry,
        resultingEntry: previousEntry,
      }
    : { kind: 'delete', savedEntry, resultingEntry: null };
}

export const MOOD_EMOTIONS = [
  { id: 'joyful', label: 'Joyful' },
  { id: 'energized', label: 'Energized' },
  { id: 'proud', label: 'Proud' },
  { id: 'excited', label: 'Excited' },
  { id: 'grateful', label: 'Grateful' },
  { id: 'hopeful', label: 'Hopeful' },
  { id: 'calm', label: 'Calm' },
  { id: 'content', label: 'Content' },
  { id: 'relieved', label: 'Relieved' },
  { id: 'connected', label: 'Connected' },
  { id: 'focused', label: 'Focused' },
  { id: 'optimistic', label: 'Optimistic' },
  { id: 'steady', label: 'Steady' },
  { id: 'neutral', label: 'Neutral' },
  { id: 'distracted', label: 'Distracted' },
  { id: 'anxious', label: 'Anxious' },
  { id: 'tired', label: 'Tired' },
  { id: 'frustrated', label: 'Frustrated' },
  { id: 'numb', label: 'Numb' },
  { id: 'restless', label: 'Restless' },
  { id: 'not-sure', label: 'Not sure' },
  { id: 'sad', label: 'Sad' },
  { id: 'lonely', label: 'Lonely' },
  { id: 'drained', label: 'Drained' },
  { id: 'discouraged', label: 'Discouraged' },
  { id: 'overwhelmed', label: 'Overwhelmed' },
  { id: 'afraid', label: 'Afraid' },
  { id: 'exhausted', label: 'Exhausted' },
  { id: 'isolated', label: 'Isolated' },
  { id: 'empty', label: 'Empty' },
] as const;

export const MOOD_SUPPORTS = [
  { id: 'savor', label: 'Savor it' },
  { id: 'share', label: 'Share it' },
  { id: 'keep-going', label: 'Keep going' },
  { id: 'note-what-helped', label: 'Note what helped' },
  { id: 'pause', label: 'Pause' },
  { id: 'choose-one-step', label: 'Choose one step' },
  { id: 'rest', label: 'Rest' },
  { id: 'connect', label: 'Connect' },
  { id: 'move', label: 'Move' },
  { id: 'gentle-move', label: 'Move gently' },
  { id: 'steady-myself', label: 'Steady myself' },
  { id: 'reach-out', label: 'Reach out' },
  { id: 'breathe', label: 'Breathe' },
  { id: 'smallest-step', label: 'Smallest next step' },
] as const;

export type MoodEmotion = (typeof MOOD_EMOTIONS)[number]['id'];
export type MoodSupport = (typeof MOOD_SUPPORTS)[number]['id'];

const MOOD_EMOTION_IDS: Record<MoodEmoji, readonly MoodEmotion[]> = {
  '😄': ['joyful', 'energized', 'proud', 'excited', 'grateful', 'hopeful'],
  '🙂': ['calm', 'content', 'relieved', 'connected', 'focused', 'optimistic'],
  '😐': ['steady', 'neutral', 'not-sure', 'tired', 'distracted', 'restless'],
  '😞': ['sad', 'anxious', 'frustrated', 'lonely', 'drained', 'discouraged'],
  '😢': ['overwhelmed', 'numb', 'afraid', 'exhausted', 'isolated', 'empty'],
};

const MOOD_SUPPORT_IDS: Record<MoodEmoji, readonly MoodSupport[]> = {
  '😄': ['savor', 'share', 'keep-going', 'note-what-helped'],
  '🙂': ['savor', 'connect', 'move', 'keep-going'],
  '😐': ['pause', 'rest', 'connect', 'choose-one-step'],
  '😞': ['rest', 'connect', 'gentle-move', 'steady-myself'],
  '😢': ['steady-myself', 'reach-out', 'breathe', 'smallest-step'],
};

export function getMoodEmotionOptions(mood: MoodEmoji) {
  const allowed = new Set<MoodEmotion>(MOOD_EMOTION_IDS[mood]);
  return MOOD_EMOTIONS.filter(({ id }) => allowed.has(id));
}

export function getMoodSupportOptions(mood: MoodEmoji) {
  const allowed = new Set<MoodSupport>(MOOD_SUPPORT_IDS[mood]);
  return MOOD_SUPPORTS.filter(({ id }) => allowed.has(id));
}

export interface MoodDraft {
  emoji: MoodEmoji | null;
  emotions: MoodEmotion[];
  customEmotions: string[];
  support: MoodSupport | null;
  note: string;
  visibleTags: string[];
}

export interface MoodMetadata {
  emotions: MoodEmotion[];
  customEmotions: string[];
  support: MoodSupport | null;
  visibleTags: string[];
}

const emotionIds = new Set<string>(MOOD_EMOTIONS.map(({ id }) => id));
const emotionLabels = new Set(
  MOOD_EMOTIONS.map(({ label }) => label.toLocaleLowerCase())
);
const supportIds = new Set<string>(MOOD_SUPPORTS.map(({ id }) => id));

export function normalizeCustomMoodEmotion(value: string): string {
  return value.trim().replace(/\s+/g, ' ').slice(0, 32);
}

export function addCustomMoodEmotion(
  current: string[],
  value: string,
  occupiedSlots = 0
): string[] {
  const normalized = normalizeCustomMoodEmotion(value);
  const normalizedKey = normalized.toLocaleLowerCase();
  if (
    !normalized ||
    emotionLabels.has(normalizedKey) ||
    current.some((item) => item.toLocaleLowerCase() === normalizedKey) ||
    current.length + occupiedSlots >= MAX_MOOD_EMOTIONS
  ) {
    return current;
  }
  return [...current, normalized];
}

export function parseMoodMetadata(
  tags: ReadonlyArray<string> | null | undefined
): MoodMetadata {
  const emotions: MoodEmotion[] = [];
  let customEmotions: string[] = [];
  const visibleTags: string[] = [];
  let support: MoodSupport | null = null;

  for (const tag of tags ?? []) {
    if (tag.startsWith(MOOD_EMOTION_PREFIX)) {
      const id = tag.slice(MOOD_EMOTION_PREFIX.length);
      if (!emotionIds.has(id)) {
        visibleTags.push(tag);
      } else if (
        !emotions.includes(id as MoodEmotion) &&
        emotions.length + customEmotions.length < MAX_MOOD_EMOTIONS
      ) {
        emotions.push(id as MoodEmotion);
      }
      continue;
    }

    if (tag.startsWith(MOOD_CUSTOM_EMOTION_PREFIX)) {
      const normalized = normalizeCustomMoodEmotion(
        tag.slice(MOOD_CUSTOM_EMOTION_PREFIX.length)
      );
      const normalizedKey = normalized.toLocaleLowerCase();
      if (
        !normalized ||
        emotionLabels.has(normalizedKey) ||
        customEmotions.some(
          (item) => item.toLocaleLowerCase() === normalizedKey
        )
      ) {
        visibleTags.push(tag);
      } else if (
        emotions.length + customEmotions.length < MAX_MOOD_EMOTIONS
      ) {
        customEmotions = [...customEmotions, normalized];
      }
      continue;
    }

    if (tag.startsWith(MOOD_SUPPORT_PREFIX)) {
      const id = tag.slice(MOOD_SUPPORT_PREFIX.length);
      if (!supportIds.has(id)) {
        visibleTags.push(tag);
      } else if (support === null) {
        support = id as MoodSupport;
      }
      continue;
    }

    visibleTags.push(tag);
  }

  return {
    emotions: [...new Set(emotions)],
    customEmotions,
    support,
    visibleTags,
  };
}

export function composeMoodTags(
  draft: Pick<
    MoodDraft,
    'emotions' | 'customEmotions' | 'support' | 'visibleTags'
  >
): string[] {
  const tags = [...new Set(draft.visibleTags.map((tag) => tag.trim()).filter(Boolean))];
  const emotions = [...new Set(draft.emotions)].slice(0, MAX_MOOD_EMOTIONS);
  tags.push(...emotions.map((emotion) => `${MOOD_EMOTION_PREFIX}${emotion}`));

  let customEmotions: string[] = [];
  for (const customEmotion of draft.customEmotions) {
    customEmotions = addCustomMoodEmotion(
      customEmotions,
      customEmotion,
      emotions.length
    );
  }
  tags.push(
    ...customEmotions.map(
      (emotion) => `${MOOD_CUSTOM_EMOTION_PREFIX}${emotion}`
    )
  );
  if (draft.support) tags.push(`${MOOD_SUPPORT_PREFIX}${draft.support}`);
  return tags;
}

export function toggleMoodEmotion(
  current: MoodEmotion[],
  emotion: MoodEmotion,
  occupiedSlots = 0
): MoodEmotion[] {
  if (current.includes(emotion)) {
    return current.filter((item) => item !== emotion);
  }
  if (current.length + occupiedSlots >= MAX_MOOD_EMOTIONS) return current;
  return [...current, emotion];
}

export function moodDraftFromEntry(entry: {
  emoji: MoodEmoji;
  note: string | null;
  tags: string[] | null;
} | null): MoodDraft {
  const metadata = parseMoodMetadata(entry?.tags ?? []);
  return {
    emoji: entry?.emoji ?? null,
    emotions: metadata.emotions,
    customEmotions: metadata.customEmotions,
    support: metadata.support,
    note: entry?.note ?? '',
    visibleTags: metadata.visibleTags,
  };
}

export function serializeMoodDraft(draft: MoodDraft): string {
  return JSON.stringify({
    emoji: draft.emoji,
    emotions: draft.emotions,
    customEmotions: draft.customEmotions,
    support: draft.support,
    note: draft.note.trim(),
    visibleTags: draft.visibleTags,
  });
}

export function getMoodMetadataLabels(
  tags: ReadonlyArray<string> | null | undefined
): string[] {
  const metadata = parseMoodMetadata(tags);
  const emotionLabels = metadata.emotions.map(
    (emotion) => MOOD_EMOTIONS.find(({ id }) => id === emotion)?.label ?? emotion
  );
  const supportLabel = metadata.support
    ? MOOD_SUPPORTS.find(({ id }) => id === metadata.support)?.label
    : null;
  const labels = [...emotionLabels, ...metadata.customEmotions];
  return supportLabel ? [...labels, supportLabel] : labels;
}

export function getMoodExportLabels(
  tags: ReadonlyArray<string> | null | undefined
): string[] {
  const metadata = parseMoodMetadata(tags);
  return [...getMoodMetadataLabels(tags), ...metadata.visibleTags];
}

export function escapeMoodCsvCell(value: string): string {
  const safeValue = /^\s*[=+\-@]/.test(value) ? `'${value}` : value;
  return `"${safeValue.replaceAll('"', '""')}"`;
}
