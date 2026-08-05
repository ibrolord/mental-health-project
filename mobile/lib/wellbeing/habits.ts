export type HabitType = 'build' | 'reduce';
export type HabitCategory =
  | 'wellbeing'
  | 'movement'
  | 'mindfulness'
  | 'nourishment'
  | 'sleep'
  | 'study'
  | 'home'
  | 'social'
  | 'substance'
  | 'custom';
export type RoutineSlot = 'morning' | 'afternoon' | 'evening' | 'anytime';

export type HabitDraft = {
  name: string;
  description: string;
  habitType: HabitType;
  category: HabitCategory;
  icon: string;
  cue: string;
  tinyStep: string;
  routineSlot: RoutineSlot;
  reward: string;
  rewardTarget: number;
  evidenceIds: string[];
};

export type RoutineTemplate = {
  id: string;
  title: string;
  eyebrow: string;
  description: string;
  slot: RoutineSlot;
  evidenceIds: string[];
  items: HabitDraft[];
  caution?: string;
};

export function isUnexpectedHabitInsertError(
  error: { code?: string } | null | undefined
): boolean {
  return Boolean(error && error.code !== '23505');
}

export const HABIT_CATEGORIES: {
  id: HabitCategory;
  label: string;
  icon: string;
}[] = [
  { id: 'wellbeing', label: 'Wellbeing', icon: 'sparkles' },
  { id: 'movement', label: 'Movement', icon: 'activity' },
  { id: 'mindfulness', label: 'Mindfulness', icon: 'wind' },
  { id: 'nourishment', label: 'Eat & hydrate', icon: 'apple' },
  { id: 'sleep', label: 'Sleep', icon: 'moon' },
  { id: 'study', label: 'Study & focus', icon: 'book' },
  { id: 'home', label: 'Home', icon: 'home' },
  { id: 'social', label: 'Connection', icon: 'users' },
  { id: 'substance', label: 'Reduce or quit', icon: 'shield' },
  { id: 'custom', label: 'Custom', icon: 'circle' },
];

const baseHabit = (
  fields: Pick<
    HabitDraft,
    'name' | 'description' | 'category' | 'icon' | 'cue' | 'tinyStep' | 'routineSlot'
  > &
    Partial<HabitDraft>
): HabitDraft => ({
  habitType: 'build',
  reward: '',
  rewardTarget: 7,
  evidenceIds: ['habit-repetition', 'implementation-intentions'],
  ...fields,
});

export const ROUTINE_TEMPLATES: RoutineTemplate[] = [
  {
    id: 'morning-anchor',
    title: 'Morning anchor',
    eyebrow: 'Start steady',
    description:
      'A short sequence that reduces morning decisions. Keep only the steps that fit your actual life.',
    slot: 'morning',
    evidenceIds: ['habit-repetition', 'implementation-intentions'],
    items: [
      baseHabit({
        name: 'Drink a glass of water',
        description: 'A simple first action, not a wellness test.',
        category: 'nourishment',
        icon: 'droplets',
        cue: 'After I get out of bed',
        tinyStep: 'Take three sips',
        routineSlot: 'morning',
      }),
      baseHabit({
        name: 'Choose today’s next useful step',
        description: 'Name one action that would make today feel less stuck.',
        category: 'study',
        icon: 'target',
        cue: 'After breakfast or my first drink',
        tinyStep: 'Write one verb and one noun',
        routineSlot: 'morning',
        evidenceIds: ['implementation-intentions', 'behavioral-activation'],
      }),
      baseHabit({
        name: 'Move for five minutes',
        description: 'Walk, stretch, or use any movement that is accessible to you.',
        category: 'movement',
        icon: 'activity',
        cue: 'Before I begin my main task',
        tinyStep: 'Stand up or move for 30 seconds',
        routineSlot: 'morning',
      }),
    ],
  },
  {
    id: 'afternoon-reset',
    title: 'Afternoon reset',
    eyebrow: 'Interrupt the drift',
    description:
      'A brief pause to recover energy and choose the next block without turning the day into a performance score.',
    slot: 'afternoon',
    evidenceIds: ['microbreaks', 'implementation-intentions'],
    items: [
      baseHabit({
        name: 'Take a real micro-break',
        description: 'Look away from work and change posture or location.',
        category: 'wellbeing',
        icon: 'coffee',
        cue: 'After my current task ends',
        tinyStep: 'Step away for two minutes',
        routineSlot: 'afternoon',
        evidenceIds: ['microbreaks'],
      }),
      baseHabit({
        name: 'Reset the next work block',
        description: 'Choose one concrete outcome for the next block.',
        category: 'study',
        icon: 'timer',
        cue: 'When I return from my break',
        tinyStep: 'Write the first visible action',
        routineSlot: 'afternoon',
        evidenceIds: ['implementation-intentions'],
      }),
    ],
  },
  {
    id: 'evening-wind-down',
    title: 'Night wind-down',
    eyebrow: 'Protect the landing',
    description:
      'A repeatable transition toward sleep. It supports a routine but does not replace CBT-I for persistent insomnia.',
    slot: 'evening',
    evidenceIds: ['habit-repetition', 'cbti'],
    caution:
      'If sleep difficulty lasts for months, affects daytime functioning, or feels unsafe, seek a clinician trained in CBT-I.',
    items: [
      baseHabit({
        name: 'Set tomorrow’s wake time',
        description: 'Choose a realistic, consistent wake time.',
        category: 'sleep',
        icon: 'alarm-clock',
        cue: 'When I begin winding down',
        tinyStep: 'Set one alarm',
        routineSlot: 'evening',
        evidenceIds: ['cbti'],
      }),
      baseHabit({
        name: 'Put unfinished tasks somewhere safe',
        description: 'Write the next step so your mind does not need to rehearse it.',
        category: 'study',
        icon: 'notebook',
        cue: 'Before I leave work for the night',
        tinyStep: 'Write one unfinished task',
        routineSlot: 'evening',
        evidenceIds: ['implementation-intentions'],
      }),
      baseHabit({
        name: 'Begin a quiet wind-down',
        description: 'Choose a low-stimulation activity you can repeat.',
        category: 'sleep',
        icon: 'moon',
        cue: 'At my chosen wind-down time',
        tinyStep: 'Dim one light and sit down',
        routineSlot: 'evening',
        evidenceIds: ['cbti', 'habit-repetition'],
      }),
    ],
  },
  {
    id: 'motivation-restart',
    title: 'When motivation is low',
    eyebrow: 'Start before ready',
    description:
      'Behavioral activation starts with a small scheduled action rather than waiting for motivation to appear.',
    slot: 'anytime',
    evidenceIds: ['behavioral-activation', 'implementation-intentions'],
    items: [
      baseHabit({
        name: 'Do the two-minute beginning',
        description: 'Open, prepare, or begin the smallest visible part.',
        category: 'wellbeing',
        icon: 'play',
        cue: 'When I notice I am waiting to feel motivated',
        tinyStep: 'Work for two minutes, then choose again',
        routineSlot: 'anytime',
        evidenceIds: ['behavioral-activation', 'implementation-intentions'],
      }),
      baseHabit({
        name: 'Schedule one meaningful activity',
        description: 'Pick something useful or personally rewarding that fits today.',
        category: 'wellbeing',
        icon: 'calendar-heart',
        cue: 'After I finish the two-minute beginning',
        tinyStep: 'Put one activity on today’s calendar',
        routineSlot: 'anytime',
        evidenceIds: ['behavioral-activation'],
      }),
    ],
  },
  {
    id: 'productivity-block',
    title: 'Productivity without overload',
    eyebrow: 'Make the work visible',
    description:
      'Define a small outcome, focus for a bounded period, then take a genuine break.',
    slot: 'anytime',
    evidenceIds: ['implementation-intentions', 'microbreaks'],
    items: [
      baseHabit({
        name: 'Define one focus-block outcome',
        description: 'A finish line for one block, not the whole project.',
        category: 'study',
        icon: 'focus',
        cue: 'Before I start a focus timer',
        tinyStep: 'Complete: “By the bell, I will…”',
        routineSlot: 'anytime',
        evidenceIds: ['implementation-intentions'],
      }),
      baseHabit({
        name: 'Take the planned break',
        description: 'Leave the task and let attention recover.',
        category: 'wellbeing',
        icon: 'coffee',
        cue: 'When the focus timer ends',
        tinyStep: 'Stand and look away from the screen',
        routineSlot: 'anytime',
        evidenceIds: ['microbreaks'],
      }),
    ],
  },
];

export function createHabitDedupeKey(name: string, slot: RoutineSlot): string {
  const normalizedName = name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 140);

  return `${slot}:${normalizedName || 'habit'}`;
}

export function habitMomentum(
  totalCompletions: number,
  currentStreak: number,
  bestStreak: number
): { xp: number; level: number; levelProgress: number; nextLevelXp: number } {
  const safeTotal = Math.max(0, totalCompletions);
  const safeCurrent = Math.max(0, currentStreak);
  const safeBest = Math.max(0, bestStreak);
  const xp = safeTotal * 10 + Math.min(safeCurrent, 30) * 2 + Math.min(safeBest, 30);
  const level = Math.floor(Math.sqrt(xp / 40)) + 1;
  const currentLevelXp = Math.pow(level - 1, 2) * 40;
  const nextLevelXp = Math.pow(level, 2) * 40;
  const levelProgress =
    nextLevelXp === currentLevelXp
      ? 100
      : ((xp - currentLevelXp) / (nextLevelXp - currentLevelXp)) * 100;

  return {
    xp,
    level,
    levelProgress: Math.max(0, Math.min(100, levelProgress)),
    nextLevelXp,
  };
}

export function isRewardUnlocked(streak: number, target: number, reward: string): boolean {
  return reward.trim().length > 0 && target > 0 && streak >= target;
}
