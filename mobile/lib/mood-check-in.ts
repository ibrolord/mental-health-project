import type { MoodEmoji } from './types';

export const MOOD_EMOTION_PREFIX = 'mood-emotion:';
export const MOOD_CUSTOM_EMOTION_PREFIX = 'mood-custom-emotion:';
export const MOOD_SUPPORT_PREFIX = 'mood-support:';
export const MAX_MOOD_EMOTIONS = 3;

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
  '\u{1F604}': ['joyful', 'energized', 'proud', 'excited', 'grateful', 'hopeful'],
  '\u{1F642}': ['calm', 'content', 'relieved', 'connected', 'focused', 'optimistic'],
  '\u{1F610}': ['steady', 'neutral', 'not-sure', 'tired', 'distracted', 'restless'],
  '\u{1F61E}': ['sad', 'anxious', 'frustrated', 'lonely', 'drained', 'discouraged'],
  '\u{1F622}': ['overwhelmed', 'numb', 'afraid', 'exhausted', 'isolated', 'empty'],
};

const MOOD_SUPPORT_IDS: Record<MoodEmoji, readonly MoodSupport[]> = {
  '\u{1F604}': ['savor', 'share', 'keep-going', 'note-what-helped'],
  '\u{1F642}': ['savor', 'connect', 'move', 'keep-going'],
  '\u{1F610}': ['pause', 'rest', 'connect', 'choose-one-step'],
  '\u{1F61E}': ['rest', 'connect', 'gentle-move', 'steady-myself'],
  '\u{1F622}': ['steady-myself', 'reach-out', 'breathe', 'smallest-step'],
};

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

export function getMoodEmotionOptions(mood: MoodEmoji) {
  const allowed = new Set<MoodEmotion>(MOOD_EMOTION_IDS[mood]);
  return MOOD_EMOTIONS.filter(({ id }) => allowed.has(id));
}

export function getMoodSupportOptions(mood: MoodEmoji) {
  const allowed = new Set<MoodSupport>(MOOD_SUPPORT_IDS[mood]);
  return MOOD_SUPPORTS.filter(({ id }) => allowed.has(id));
}

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

export function parseMoodMetadata(tags: string[]): MoodMetadata {
  const emotions: MoodEmotion[] = [];
  let customEmotions: string[] = [];
  const visibleTags: string[] = [];
  let support: MoodSupport | null = null;

  for (const tag of tags) {
    if (tag.startsWith(MOOD_EMOTION_PREFIX)) {
      const id = tag.slice(MOOD_EMOTION_PREFIX.length);
      if (
        emotionIds.has(id) &&
        !emotions.includes(id as MoodEmotion) &&
        emotions.length + customEmotions.length < MAX_MOOD_EMOTIONS
      ) {
        emotions.push(id as MoodEmotion);
      }
      continue;
    }

    if (tag.startsWith(MOOD_CUSTOM_EMOTION_PREFIX)) {
      customEmotions = addCustomMoodEmotion(
        customEmotions,
        tag.slice(MOOD_CUSTOM_EMOTION_PREFIX.length),
        emotions.length
      );
      continue;
    }

    if (tag.startsWith(MOOD_SUPPORT_PREFIX)) {
      const id = tag.slice(MOOD_SUPPORT_PREFIX.length);
      if (supportIds.has(id) && support === null) support = id as MoodSupport;
      continue;
    }

    visibleTags.push(tag);
  }

  return { emotions, customEmotions, support, visibleTags };
}

export function composeMoodTags(metadata: MoodMetadata): string[] {
  const tags = [
    ...new Set(metadata.visibleTags.map((tag) => tag.trim()).filter(Boolean)),
  ];
  const emotions = [...new Set(metadata.emotions)].slice(0, MAX_MOOD_EMOTIONS);
  tags.push(...emotions.map((emotion) => `${MOOD_EMOTION_PREFIX}${emotion}`));

  let customEmotions: string[] = [];
  for (const customEmotion of metadata.customEmotions) {
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
  if (metadata.support) tags.push(`${MOOD_SUPPORT_PREFIX}${metadata.support}`);
  return tags;
}

export function reconcileMoodTagsForMood(
  tags: string[],
  mood: MoodEmoji
): string[] {
  const metadata = parseMoodMetadata(tags);
  const allowedEmotions = new Set(
    getMoodEmotionOptions(mood).map(({ id }) => id)
  );
  const allowedSupports = new Set(
    getMoodSupportOptions(mood).map(({ id }) => id)
  );

  return composeMoodTags({
    emotions: metadata.emotions.filter((emotion) => allowedEmotions.has(emotion)),
    customEmotions: metadata.customEmotions,
    support:
      metadata.support && allowedSupports.has(metadata.support)
        ? metadata.support
        : null,
    visibleTags: metadata.visibleTags,
  });
}

export function getMoodMetadataLabels(tags: string[]): string[] {
  const metadata = parseMoodMetadata(tags);
  const labels: string[] = metadata.emotions.map(
    (emotion) => MOOD_EMOTIONS.find(({ id }) => id === emotion)?.label ?? emotion
  );
  labels.push(...metadata.customEmotions);

  const supportLabel = metadata.support
    ? MOOD_SUPPORTS.find(({ id }) => id === metadata.support)?.label
    : null;
  if (supportLabel) labels.push(supportLabel);
  return labels;
}
