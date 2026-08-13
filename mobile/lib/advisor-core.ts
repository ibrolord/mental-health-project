import type { AppleHealthSnapshot } from './apple-health-core';
import { hasExplicitUrgentSafetyLanguage } from './local-safety';
import type { MoodEmoji } from './types';

export type AdvisorSourceKey = 'mood' | 'health' | 'goals' | 'habits';

export type AdvisorGoal = {
  id: string;
  title: string;
  dueAt: string | null;
};

export type AdvisorHabit = {
  id: string;
  name: string;
  tinyStep: string | null;
  completedToday: boolean;
};

export type AdvisorHealthMetric = {
  recentAverage: number | null;
  baselineAverage: number | null;
  recentCoverageDays: number;
  baselineCoverageDays: number;
};

export type AdvisorHealthFeatures = {
  sleepMinutes: AdvisorHealthMetric;
  steps: AdvisorHealthMetric;
};

export type AdvisorContext = {
  nowIso: string;
  mood: { emoji: MoodEmoji; localDate: string } | null;
  goals: readonly AdvisorGoal[];
  habits: readonly AdvisorHabit[];
  health: AdvisorHealthFeatures | null;
};

export type AdvisorRecommendation = {
  id: string;
  kind: 'standard' | 'safety';
  observation: string;
  action: string;
  smallerAction: string;
  route: '/ground' | '/goals' | '/habits' | '/(tabs)/tracker' | '/plans' | '/resources';
  sourceLabels: readonly string[];
  resourceLabel: string;
};

const LOW_MOODS = new Set<MoodEmoji>(['😞', '😢']);
const MOOD_LABELS: Record<MoodEmoji, string> = {
  '😄': 'Great',
  '🙂': 'Good',
  '😐': 'Okay',
  '😞': 'Low',
  '😢': 'Very low',
};

// Advisor can turn user-authored text into an imperative, reminder, or shared
// commitment. Fail closed on explicit high-risk action fragments before doing so.
const UNSAFE_ACTION_FRAGMENT = /\b(?:suicid(?:e|al)|self[ -]?harm|die(?:\s+(?:today|tonight|now))?|end\s+my\s+life|take\s+my\s+life|cut\s+myself|kill\s+(?:myself|someone|somebody|him|her|them)|hurt\s+(?:myself|someone|somebody|him|her|them)|harm\s+(?:myself|someone|somebody|him|her|them)|overdose|take\s+(?:extra|too\s+many|all\s+(?:of\s+)?my)\s+(?:pills|tablets|medications?)|shoot\s+(?:myself|someone|somebody|him|her|them)|stab\s+(?:myself|someone|somebody|him|her|them)|hang\s+myself|drown\s+myself|poison\s+(?:myself|someone|somebody|him|her|them))\b/i;

function average(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function metric(
  snapshot: AppleHealthSnapshot,
  read: (day: AppleHealthSnapshot['days'][number]) => number | null
): AdvisorHealthMetric {
  const recent = snapshot.days.slice(-7).flatMap((day) => {
    const value = read(day);
    return value === null || !Number.isFinite(value) ? [] : [value];
  });
  const baseline = snapshot.days.slice(0, -7).flatMap((day) => {
    const value = read(day);
    return value === null || !Number.isFinite(value) ? [] : [value];
  });
  return {
    recentAverage: average(recent),
    baselineAverage: average(baseline),
    recentCoverageDays: recent.length,
    baselineCoverageDays: baseline.length,
  };
}

export function createAdvisorHealthFeatures(
  snapshot: AppleHealthSnapshot
): AdvisorHealthFeatures {
  return {
    sleepMinutes: metric(snapshot, (day) => day.sleepMinutes),
    steps: metric(snapshot, (day) => day.steps),
  };
}

function dueSoon(goal: AdvisorGoal, now: Date): boolean {
  if (!goal.dueAt) return false;
  const due = new Date(goal.dueAt);
  if (!Number.isFinite(due.getTime())) return false;
  const delta = due.getTime() - now.getTime();
  return delta >= 0 && delta <= 3 * 24 * 60 * 60 * 1000;
}

function localDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function sortableDueAt(value: string | null): number {
  if (!value) return Number.POSITIVE_INFINITY;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : Number.POSITIVE_INFINITY;
}

function isUnsafeActionText(value: string): boolean {
  return hasExplicitUrgentSafetyLanguage(value) || UNSAFE_ACTION_FRAGMENT.test(value);
}

export function createAdvisorContextSnapshot(context: AdvisorContext): AdvisorContext {
  const goals = [...context.goals]
    .filter((goal) => goal.id && goal.title.trim())
    .sort(
      (left, right) =>
        sortableDueAt(left.dueAt) - sortableDueAt(right.dueAt) ||
        left.id.localeCompare(right.id)
    )
    .slice(0, 1);
  const habits = [...context.habits]
    .filter((habit) => habit.id && habit.name.trim() && !habit.completedToday)
    .sort((left, right) => left.id.localeCompare(right.id))
    .slice(0, 1);
  return { ...context, goals, habits };
}

export function createAdvisorRecommendation(
  context: AdvisorContext
): AdvisorRecommendation {
  const now = new Date(context.nowIso);
  const safeNow = Number.isFinite(now.getTime()) ? now : new Date(0);
  if (
    context.goals.some((goal) => isUnsafeActionText(goal.title)) ||
    context.habits.some(
      (habit) => isUnsafeActionText(habit.name) || isUnsafeActionText(habit.tinyStep ?? '')
    )
  ) {
    return {
      id: 'safety-support',
      kind: 'safety',
      observation: 'This needs support beyond Advisor.',
      action: 'Open support options or contact someone you trust now.',
      smallerAction: 'Open support options now.',
      route: '/resources',
      sourceLabels: [],
      resourceLabel: 'Find support',
    };
  }

  const snapshot = createAdvisorContextSnapshot(context);
  const goals = snapshot.goals;
  const habits = snapshot.habits;
  const goal = goals[0] ?? null;
  const habit = habits[0] ?? null;
  const lowMood = context.mood
    ? LOW_MOODS.has(context.mood.emoji) && context.mood.localDate === localDateKey(safeNow)
    : false;
  const moodDescription = context.mood
    ? `${MOOD_LABELS[context.mood.emoji]} on ${context.mood.localDate}`
    : '';

  if (lowMood && goal) {
    return {
      id: `low-goal:${goal.id}`,
      kind: 'standard',
      observation: `Your most recent check-in was ${moodDescription}, and you have an active goal.`,
      action: 'Open your selected goal and work on the easiest part for two minutes.',
      smallerAction: 'Open your selected goal and only choose the first step.',
      route: '/goals',
      sourceLabels: ['Mood check-in', 'Goal'],
      resourceLabel: 'Open goal',
    };
  }

  if (lowMood) {
    return {
      id: 'low-grounding',
      kind: 'standard',
      observation: `Your most recent check-in was ${moodDescription}.`,
      action: 'Take 90 seconds to notice your breathing and what is around you.',
      smallerAction: 'Name one thing you can see and one thing you can feel.',
      route: '/ground',
      sourceLabels: ['Mood check-in'],
      resourceLabel: 'Start grounding',
    };
  }

  if (goal && dueSoon(goal, safeNow)) {
    return {
      id: `due-goal:${goal.id}`,
      kind: 'standard',
      observation: 'Your selected goal has a due date in the next few days.',
      action: 'Give your selected goal five focused minutes, then decide what comes next.',
      smallerAction: 'Open your selected goal and write down only the next action.',
      route: '/goals',
      sourceLabels: ['Goal'],
      resourceLabel: 'Open goal',
    };
  }

  if (habit) {
    return {
      id: `habit:${habit.id}`,
      kind: 'standard',
      observation: 'Your selected habit is available for today.',
      action: 'Open your selected habit and do its smallest version once.',
      smallerAction: 'Set up the cue for your selected habit without asking yourself to finish it.',
      route: '/habits',
      sourceLabels: ['Habit'],
      resourceLabel: 'Open habit',
    };
  }

  if (goal) {
    return {
      id: `goal:${goal.id}`,
      kind: 'standard',
      observation: 'You selected one of your active goals.',
      action: 'Give your selected goal five focused minutes.',
      smallerAction: 'Open your selected goal and only choose the next action.',
      route: '/goals',
      sourceLabels: ['Goal'],
      resourceLabel: 'Open goal',
    };
  }

  if (!context.mood) {
    return {
      id: 'check-in',
      kind: 'standard',
      observation: 'There is no recent mood check-in in the context you selected.',
      action: 'Take a quick check-in, then choose what would help right now.',
      smallerAction: 'Choose the emoji that feels closest. No note is required.',
      route: '/(tabs)/tracker',
      sourceLabels: [],
      resourceLabel: 'Check in',
    };
  }

  return {
    id: 'general-start',
    kind: 'standard',
    observation: 'There is not one clear priority in the context you selected.',
    action: 'Choose one thing that matters and spend two minutes starting it.',
    smallerAction: 'Write down only the first visible action.',
    route: '/plans',
    sourceLabels: ['Mood check-in'],
    resourceLabel: 'Open plans',
  };
}
