import {
  summarizeAppleHealthWindow,
  type AppleHealthSnapshot,
  type MoodTimestamp,
} from './apple-health-core';
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
  routineSlot?: 'morning' | 'afternoon' | 'evening' | 'anytime';
  streakCount?: number;
};

export type AdvisorNotificationContext = {
  enabled: boolean;
  enabledCategories: readonly string[];
  reminderTimes: readonly number[];
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
  recent: {
    coverageDays: number;
    exerciseMinutes: number;
    mindfulMinutes: number;
    workoutCount: number;
    eligibleForSuggestion: boolean;
    availableCategoryCount: number;
  };
  history: {
    coverageDays: number;
    workoutCount: number;
    stateOfMindCount: number;
    moodOverlapDays: number;
    moodComparison: string;
  };
};

export type AdvisorContext = {
  nowIso: string;
  intent?: 'general' | 'health-reflection';
  lowEnergyMode?: boolean;
  mood: { emoji: MoodEmoji; localDate: string } | null;
  goals: readonly AdvisorGoal[];
  habits: readonly AdvisorHabit[];
  health: AdvisorHealthFeatures | null;
  habitWeek?: {
    habitId: string;
    completedDays: number;
    habitAgeDays: number;
  } | null;
  habitTrend?: {
    recentCompleted: number;
    recentOpportunities: number;
    previousCompleted: number;
    previousOpportunities: number;
  } | null;
  checkInTrend?: {
    recentDays: number;
    previousDays: number;
  } | null;
  momentumProgress?: {
    totalPoints: number;
    recentPoints: number;
    previousPoints: number;
  } | null;
  momentumAvailability?: 'available' | 'unavailable' | 'signed-out';
  notifications?: AdvisorNotificationContext | null;
};

export type AdvisorTrendLevel = 'changed' | 'similar' | 'available' | 'learning';

export type AdvisorTrendArea = {
  id: 'habits' | 'sleep' | 'movement' | 'check-ins';
  label: string;
  level: AdvisorTrendLevel;
  detail: string;
  meter: {
    kind: 'progress' | 'baseline';
    position: number;
    label: string;
  } | null;
};

export type AdvisorMomentumGame = {
  availability: 'available' | 'unavailable' | 'signed-out';
  points: number;
  level: number;
  weeklyPoints: number;
  delta: number | null;
  nextMilestone: number;
  pointsToNextMilestone: number;
  milestoneProgress: number;
  unlockedMilestone: number;
  status: string;
};

export type AdvisorTrendSummary = {
  level: AdvisorTrendLevel;
  label: string;
  summary: string;
  showsCaution: boolean;
  momentum: AdvisorMomentumGame;
  areas: readonly AdvisorTrendArea[];
};

export type AdvisorChangeSignal = {
  id: string;
  stream: 'sleep' | 'steps' | 'habit' | 'goal' | 'feedback';
  direction: 'up' | 'down' | 'due' | 'stalled' | 'steady';
  severity: 'notable' | 'minor';
  line: string;
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
  observations: readonly string[];
  changeSignal: AdvisorChangeSignal | null;
};

type AdvisorRecommendationCandidate = Omit<
  AdvisorRecommendation,
  'observations' | 'changeSignal'
>;

export type AdvisorRecentRecommendation =
  | string
  | {
      recommendationId: string;
      offeredAt?: string | null;
      helpful?: boolean | null;
    };

export type AdvisorSelectionOptions = {
  preserveToday?: boolean;
  excludeRecommendationId?: string;
  candidateFamily?: string;
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
const UNSAFE_ACTION_FRAGMENT = /\b(?:suicid(?:e|al)|self[ -]?harm|die(?:\s+(?:today|tonight|now))?|end\s+my\s+life|take\s+my\s+life|cut\s+myself|kill\s+(?:myself|someone|somebody|him|her|them)|murder\s+(?:myself|someone|somebody|him|her|them)|assassinate\s+(?:someone|somebody|him|her|them)|hurt\s+(?:myself|someone|somebody|him|her|them)|harm\s+(?:myself|someone|somebody|him|her|them)|overdose|take\s+(?:extra|too\s+many|all\s+(?:of\s+)?my)\s+(?:pills|tablets|medications?)|shoot\s+(?:myself|someone|somebody|him|her|them)|stab\s+(?:myself|someone|somebody|him|her|them)|hang\s+myself|drown\s+myself|poison\s+(?:myself|someone|somebody|him|her|them))\b/i;

function average(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function isValidHealthValue(value: number | null): value is number {
  return value !== null && Number.isFinite(value) && value >= 0;
}

function metric(
  snapshot: AppleHealthSnapshot,
  read: (day: AppleHealthSnapshot['days'][number]) => number | null
): AdvisorHealthMetric {
  // The final snapshot entry is today. Exclude that unfinished day from
  // personal-baseline comparisons while keeping it available to the UI summary.
  const completeDays = snapshot.days.slice(0, -1);
  const recent = completeDays.slice(-7).flatMap((day) => {
    const value = read(day);
    return isValidHealthValue(value) ? [value] : [];
  });
  const baseline = completeDays.slice(0, -7).flatMap((day) => {
    const value = read(day);
    return isValidHealthValue(value) ? [value] : [];
  });
  return {
    recentAverage: average(recent),
    baselineAverage: average(baseline),
    recentCoverageDays: recent.length,
    baselineCoverageDays: baseline.length,
  };
}

export function createAdvisorHealthFeatures(
  snapshot: AppleHealthSnapshot,
  _moods: readonly MoodTimestamp[] = []
): AdvisorHealthFeatures {
  const recent = summarizeAppleHealthWindow(snapshot.days, 7);
  const history = summarizeAppleHealthWindow(snapshot.days, 30);
  const recentDays = snapshot.days.slice(-7);
  const lastTwoDays = recentDays.slice(-2);
  const sleepDays = recentDays.filter((day) => isValidHealthValue(day.sleepMinutes)).length;
  const stepDays = recentDays.filter((day) => isValidHealthValue(day.steps)).length;
  const exerciseDays = recentDays.filter(
    (day) => (day.exerciseMinutes ?? 0) > 0 || day.workoutCount > 0
  ).length;
  const mindfulDays = recentDays.filter((day) => (day.mindfulMinutes ?? 0) > 0).length;
  const recentSleep = lastTwoDays.some((day) => isValidHealthValue(day.sleepMinutes));
  const recentSteps = lastTwoDays.some((day) => isValidHealthValue(day.steps));
  const recentExercise = lastTwoDays.some(
    (day) => (day.exerciseMinutes ?? 0) > 0 || day.workoutCount > 0
  );
  const recentMindfulness = lastTwoDays.some(
    (day) => (day.mindfulMinutes ?? 0) > 0
  );
  const availableCategoryCount = [sleepDays, stepDays, exerciseDays, mindfulDays].filter(
    (days) => days > 0
  ).length;
  return {
    sleepMinutes: metric(snapshot, (day) => day.sleepMinutes),
    steps: metric(snapshot, (day) => day.steps),
    recent: {
      coverageDays: recent.coverageDays,
      exerciseMinutes: recent.exerciseMinutes,
      mindfulMinutes: recent.mindfulMinutes,
      workoutCount: recent.workoutCount,
      eligibleForSuggestion:
        (sleepDays >= 4 && recentSleep) ||
        (stepDays >= 4 && recentSteps) ||
        (exerciseDays >= 2 && recentExercise) ||
        (mindfulDays >= 2 && recentMindfulness),
      availableCategoryCount,
    },
    history: {
      coverageDays: history.coverageDays,
      workoutCount: history.workoutCount,
      stateOfMindCount: history.stateOfMindCount,
      moodOverlapDays: 0,
      moodComparison: 'Mood check-ins are not compared with Apple Health.',
    },
  };
}

function dueSoon(goal: AdvisorGoal, now: Date): boolean {
  if (!goal.dueAt) return false;
  const due = new Date(goal.dueAt);
  if (!Number.isFinite(due.getTime())) return false;
  const delta = localDayOrdinal(due) - localDayOrdinal(now);
  return delta >= 0 && delta <= 3;
}

function localDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function localDayOrdinal(date: Date): number {
  return Math.floor(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / DAY_MS
  );
}

function validDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

function relativeMoodDay(localDate: string, now: Date): string {
  const today = localDateKey(now);
  if (localDate === today) return 'today';

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (localDate === localDateKey(yesterday)) return 'yesterday';
  return 'earlier this week';
}

function sortableDueAt(value: string | null): number {
  if (!value) return Number.POSITIVE_INFINITY;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : Number.POSITIVE_INFINITY;
}

function isUnsafeActionText(value: string): boolean {
  const normalized = value
    .normalize('NFKC')
    .replace(/[\u200B-\u200D\u2060\uFEFF]/g, '')
    .replace(/[\u0000-\u001F\u007F-\u009F\u202A-\u202E\u2066-\u2069]/g, ' ');
  return (
    hasExplicitUrgentSafetyLanguage(normalized) ||
    UNSAFE_ACTION_FRAGMENT.test(normalized)
  );
}

function sanitizeDisplayText(value: string): string {
  const normalized = value
    .normalize('NFKC')
    .replace(
      /[\u0000-\u001F\u007F-\u009F\u200B-\u200D\u202A-\u202E\u2060\u2066-\u2069\uFEFF]/g,
      ' '
    )
    .replace(/\s+/g, ' ')
    .trim();
  return Array.from(normalized).slice(0, 80).join('');
}

function quotedActionTitle(value: string): string {
  const characters = Array.from(value);
  const title = characters.length <= 54
    ? value
    : `${characters.slice(0, 53).join('').trimEnd()}…`;
  return `“${title}”`;
}

export function createAdvisorContextSnapshot(context: AdvisorContext): AdvisorContext {
  const goals = [...context.goals]
    .filter((goal) => goal.id && sanitizeDisplayText(goal.title))
    .sort(
      (left, right) =>
        sortableDueAt(left.dueAt) - sortableDueAt(right.dueAt) ||
        left.id.localeCompare(right.id)
    )
    .slice(0, 3)
    .map((goal) => ({ ...goal, title: sanitizeDisplayText(goal.title) }));
  const habits = [...context.habits]
    .filter(
      (habit) =>
        habit.id && sanitizeDisplayText(habit.name) && !habit.completedToday
    )
    .sort((left, right) => left.id.localeCompare(right.id))
    .slice(0, 3)
    .map((habit) => ({
      ...habit,
      name: sanitizeDisplayText(habit.name),
      tinyStep: habit.tinyStep
        ? sanitizeDisplayText(habit.tinyStep) || null
        : null,
      routineSlot:
        habit.routineSlot === 'morning' ||
        habit.routineSlot === 'afternoon' ||
        habit.routineSlot === 'evening' ||
        habit.routineSlot === 'anytime'
          ? habit.routineSlot
          : 'anytime',
      streakCount: boundedCount(habit.streakCount ?? 0),
    }));
  const momentumProgress = context.momentumProgress
    ? {
        totalPoints: boundedCount(context.momentumProgress.totalPoints),
        recentPoints: boundedCount(context.momentumProgress.recentPoints),
        previousPoints: boundedCount(context.momentumProgress.previousPoints),
      }
    : null;
  return { ...context, goals, habits, momentumProgress };
}

function safetyRecommendation(): AdvisorRecommendationCandidate {
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

function lowMoodCandidates(
  context: AdvisorContext,
  goal: AdvisorGoal | null
): AdvisorRecommendationCandidate[] {
  const now = validDate(context.nowIso) ?? new Date(0);
  const moodDescription = context.mood
    ? `${MOOD_LABELS[context.mood.emoji]} ${relativeMoodDay(context.mood.localDate, now)}`
    : 'Low today';
  if (goal) {
    const title = quotedActionTitle(goal.title);
    return [
      {
        id: `low-goal:${goal.id}`,
        kind: 'standard',
        observation: `Your most recent check-in was ${moodDescription}, and you have an active goal.`,
        action: `Open ${title} and work on the easiest part for two minutes.`,
        smallerAction: `Open ${title} and only choose the first step.`,
        route: '/goals',
        sourceLabels: ['Mood check-in', 'Goal'],
        resourceLabel: 'Open goal',
      },
      {
        id: `low-goal:${goal.id}:alternate`,
        kind: 'standard',
        observation: `Your most recent check-in was ${moodDescription}, so the goal can stay small.`,
        action: `Spend one minute choosing the next visible step for ${title}.`,
        smallerAction: `Open ${title} without asking yourself to start yet.`,
        route: '/goals',
        sourceLabels: ['Mood check-in', 'Goal'],
        resourceLabel: 'Open goal',
      },
    ];
  }
  return [
    {
      id: 'low-grounding',
      kind: 'standard',
      observation: `Your most recent check-in was ${moodDescription}.`,
      action: 'Take 90 seconds to notice your breathing and what is around you.',
      smallerAction: 'Name one thing you can see and one thing you can feel.',
      route: '/ground',
      sourceLabels: ['Mood check-in'],
      resourceLabel: 'Start grounding',
    },
    {
      id: 'low-grounding:alternate',
      kind: 'standard',
      observation: `Your most recent check-in was ${moodDescription}.`,
      action: 'Pause for one minute and slowly name five things around you.',
      smallerAction: 'Notice one color in the room.',
      route: '/ground',
      sourceLabels: ['Mood check-in'],
      resourceLabel: 'Start grounding',
    },
  ];
}

function goalCandidates(
  goal: AdvisorGoal,
  state: 'active' | 'due' | 'overdue'
): AdvisorRecommendationCandidate[] {
  const title = quotedActionTitle(goal.title);
  if (state !== 'active') {
    const overdue = state === 'overdue';
    return [
      {
        id: `due-goal:${goal.id}`,
        kind: 'standard',
        observation: overdue
          ? `${title} is past its date.`
          : `${title} has a due date in the next few days.`,
        action: overdue
          ? `Open ${title} and either start small or move its date.`
          : `Give ${title} five focused minutes, then decide what comes next.`,
        smallerAction: overdue
          ? `Move the date for ${title} to something workable.`
          : `Open ${title} and write down only the next action.`,
        route: '/goals',
        sourceLabels: ['Goal'],
        resourceLabel: 'Open goal',
      },
      {
        id: `due-goal:${goal.id}:alternate`,
        kind: 'standard',
        observation: overdue ? `${title} is past its date.` : `${title} is due soon.`,
        action: overdue
          ? `Choose a workable date for ${title}, or take one small step now.`
          : `Choose one concrete piece of ${title} to move forward now.`,
        smallerAction: overdue
          ? `Move the date for ${title} to something workable.`
          : `Open ${title} and identify the first unfinished piece.`,
        route: '/goals',
        sourceLabels: ['Goal'],
        resourceLabel: 'Open goal',
      },
    ];
  }
  return [
    {
      id: `goal:${goal.id}`,
      kind: 'standard',
      observation: `${title} is your active goal.`,
      action: `Give ${title} five focused minutes.`,
      smallerAction: `Open ${title} and only choose the next action.`,
      route: '/goals',
      sourceLabels: ['Goal'],
      resourceLabel: 'Open goal',
    },
    {
      id: `goal:${goal.id}:alternate`,
      kind: 'standard',
      observation: `${title} is available to move forward.`,
      action: `Complete one visible step for ${title}.`,
      smallerAction: `Write down one possible next step for ${title}.`,
      route: '/goals',
      sourceLabels: ['Goal'],
      resourceLabel: 'Open goal',
    },
  ];
}

function habitCandidates(
  habit: AdvisorHabit,
  stalled: boolean
): AdvisorRecommendationCandidate[] {
  const title = quotedActionTitle(habit.name);
  const tinyStep = habit.tinyStep
    ? `Try this tiny step: ${habit.tinyStep}.`
    : `Set up the cue for ${title}.`;
  const primaryAction = stalled
    ? `Do the smallest version of ${title} once.`
    : `Do one small round of ${title}.`;
  return [
    {
      id: `habit:${habit.id}`,
      kind: 'standard',
      observation: `${title} is available for today.`,
      action: primaryAction,
      smallerAction: stalled ? primaryAction : tinyStep,
      route: '/habits',
      sourceLabels: ['Habit'],
      resourceLabel: 'Open habit',
    },
    {
      id: `habit:${habit.id}:alternate`,
      kind: 'standard',
      observation: `${title} is still incomplete today.`,
      action: stalled
        ? primaryAction
        : `Start ${title} once, with no streak or catch-up target.`,
      smallerAction: stalled ? primaryAction : tinyStep,
      route: '/habits',
      sourceLabels: ['Habit'],
      resourceLabel: 'Open habit',
    },
  ];
}

function healthCandidates(_health: AdvisorHealthFeatures): AdvisorRecommendationCandidate[] {
  return [
    {
      id: 'health-wellbeing',
      kind: 'standard',
      observation: 'Your recent Apple Health summary has enough to work with.',
      action: 'Take a short wellbeing pause for water, movement, or quiet breathing.',
      smallerAction: 'Stand up and take one slow breath.',
      route: '/ground',
      sourceLabels: ['Apple Health summary'],
      resourceLabel: 'Start pause',
    },
    {
      id: 'health-wellbeing:alternate',
      kind: 'standard',
      observation: 'Your authorized Apple Health summary has enough recent wellbeing data for a general pause.',
      action: 'Choose one brief wellbeing action that feels easy to do now.',
      smallerAction: 'Take a sip of water or stretch once.',
      route: '/ground',
      sourceLabels: ['Apple Health summary'],
      resourceLabel: 'Start pause',
    },
  ];
}

function fallbackCandidates(context: AdvisorContext): AdvisorRecommendationCandidate[] {
  if (!context.mood) {
    return [
      {
        id: 'check-in',
        kind: 'standard',
        observation: 'There is no recent mood check-in in the context you selected.',
        action: 'Take a quick check-in, then choose what would help right now.',
        smallerAction: 'Choose the emoji that feels closest. No note is required.',
        route: '/(tabs)/tracker',
        sourceLabels: [],
        resourceLabel: 'Check in',
      },
      {
        id: 'check-in:alternate',
        kind: 'standard',
        observation: 'A quick check-in can help you choose a next step.',
        action: 'Choose the emoji that feels closest today.',
        smallerAction: 'Open the check-in. No note is required.',
        route: '/(tabs)/tracker',
        sourceLabels: [],
        resourceLabel: 'Check in',
      },
    ];
  }
  return [
    {
      id: 'general-start',
      kind: 'standard',
      observation: 'There is not one clear priority in the context you selected.',
      action: 'Choose one thing that matters and spend two minutes starting it.',
      smallerAction: 'Write down only the first visible action.',
      route: '/plans',
      sourceLabels: ['Mood check-in'],
      resourceLabel: 'Open plans',
    },
    {
      id: 'general-start:alternate',
      kind: 'standard',
      observation: 'A small, visible action is enough for a start.',
      action: 'Pick one useful task and begin for one minute.',
      smallerAction: 'Name the task without starting it yet.',
      route: '/plans',
      sourceLabels: ['Mood check-in'],
      resourceLabel: 'Open plans',
    },
  ];
}

function habitWeekState(
  context: AdvisorContext,
  habit: AdvisorHabit | null
): 'stalled' | 'strong' | null {
  const week = context.habitWeek;
  if (
    !habit ||
    !week ||
    week.habitId !== habit.id ||
    !Number.isFinite(week.completedDays) ||
    !Number.isFinite(week.habitAgeDays) ||
    week.habitAgeDays < 7
  ) {
    return null;
  }
  if (week.completedDays <= 2) return 'stalled';
  if (week.completedDays >= 5) return 'strong';
  return null;
}

export function hasUnsafeAdvisorContext(context: AdvisorContext): boolean {
  return (
    context.goals.some((goal) => isUnsafeActionText(goal.title)) ||
    context.habits.some(
      (habit) =>
        isUnsafeActionText(habit.name) || isUnsafeActionText(habit.tinyStep ?? '')
    )
  );
}

function hasCurrentLowMood(context: AdvisorContext, now: Date): boolean {
  return context.mood !== null &&
    LOW_MOODS.has(context.mood.emoji) &&
    context.mood.localDate === localDateKey(now);
}

function recommendationCandidates(
  context: AdvisorContext
): AdvisorRecommendationCandidate[] {
  if (hasUnsafeAdvisorContext(context)) {
    return [safetyRecommendation()];
  }
  const now = new Date(context.nowIso);
  const safeNow = Number.isFinite(now.getTime()) ? now : new Date(0);
  const snapshot = createAdvisorContextSnapshot(context);
  const goal = snapshot.goals[0] ?? null;
  const habit = snapshot.habits[0] ?? null;
  const habitState = habitWeekState(snapshot, habit);
  if (context.lowEnergyMode) {
    return [
      {
        id: 'low-energy-grounding',
        kind: 'standard',
        observation: 'Low Energy mode is on, so this step stays short and simple.',
        action: 'Take 90 seconds to notice your breathing and what is around you.',
        smallerAction: 'Name one thing you can see and one thing you can feel.',
        route: '/ground',
        sourceLabels: [],
        resourceLabel: 'Start grounding',
      },
      {
        id: 'low-energy-grounding:alternate',
        kind: 'standard',
        observation: 'Low Energy mode is on, so there is no catch-up target.',
        action: 'Pause for one minute and slowly name five things around you.',
        smallerAction: 'Notice one sound near you.',
        route: '/ground',
        sourceLabels: [],
        resourceLabel: 'Start grounding',
      },
      ...fallbackCandidates(context),
    ];
  }
  const lowMood = hasCurrentLowMood(context, safeNow);
  const candidates: AdvisorRecommendationCandidate[] = [];
  if (lowMood) candidates.push(...lowMoodCandidates(context, goal));
  const goalDueAt = goal ? validDate(goal.dueAt) : null;
  const goalState = goalDueAt
    ? localDayOrdinal(goalDueAt) < localDayOrdinal(safeNow)
      ? 'overdue'
      : goal && dueSoon(goal, safeNow)
        ? 'due'
        : 'active'
    : 'active';
  if (goal && !lowMood && goalState !== 'active') {
    candidates.push(...goalCandidates(goal, goalState));
  }
  if (habit) candidates.push(...habitCandidates(habit, habitState === 'stalled'));
  if (
    context.health &&
    context.health.recent.eligibleForSuggestion
  ) {
    candidates.push(...healthCandidates(context.health));
  }
  if (goal && goalState === 'active') candidates.push(...goalCandidates(goal, 'active'));
  candidates.push(...fallbackCandidates(context));
  return candidates;
}

function boundedSignalTitle(value: string, suffix: string): string {
  const available = Math.max(1, 90 - Array.from(suffix).length - 2);
  const characters = Array.from(sanitizeDisplayText(value));
  if (characters.length <= available) return characters.join('');
  return `${characters.slice(0, Math.max(1, available - 1)).join('')}…`;
}

function titledSignalLine(title: string, suffix: string): string {
  return `“${boundedSignalTitle(title, suffix)}”${suffix}`;
}

function roundedSleepDifference(minutes: number): string {
  const rounded = Math.max(15, Math.round(minutes / 15) * 15);
  if (rounded % 60 === 0) {
    const hours = rounded / 60;
    return `${hours} ${hours === 1 ? 'hour' : 'hours'}`;
  }
  return `${rounded} minutes`;
}

function healthSignals(health: AdvisorHealthFeatures | null): AdvisorChangeSignal[] {
  if (!health) return [];
  const signals: AdvisorChangeSignal[] = [];
  const sleep = health.sleepMinutes;
  if (
    sleep.recentAverage !== null &&
    sleep.baselineAverage !== null &&
    isValidHealthValue(sleep.recentAverage) &&
    isValidHealthValue(sleep.baselineAverage) &&
    sleep.recentCoverageDays >= 4 &&
    sleep.baselineCoverageDays >= 7
  ) {
    if (
      sleep.recentAverage <= sleep.baselineAverage - 45 &&
      sleep.recentAverage <= sleep.baselineAverage * 0.88
    ) {
      signals.push({
        id: 'sleep-down',
        stream: 'sleep',
        direction: 'down',
        severity: 'notable',
        line: `Your sleep is averaging about ${roundedSleepDifference(
          sleep.baselineAverage - sleep.recentAverage
        )} less than usual this week.`,
      });
    } else if (
      sleep.recentAverage >= sleep.baselineAverage + 45 &&
      sleep.recentAverage >= sleep.baselineAverage * 1.12
    ) {
      signals.push({
        id: 'sleep-up',
        stream: 'sleep',
        direction: 'up',
        severity: 'minor',
        line: 'Your sleep has come back up this week.',
      });
    }
  }

  const steps = health.steps;
  if (
    steps.recentAverage !== null &&
    steps.baselineAverage !== null &&
    isValidHealthValue(steps.recentAverage) &&
    isValidHealthValue(steps.baselineAverage) &&
    steps.recentCoverageDays >= 4 &&
    steps.baselineCoverageDays >= 7
  ) {
    if (
      steps.recentAverage <= steps.baselineAverage - 1500 &&
      steps.recentAverage <= steps.baselineAverage * 0.8
    ) {
      signals.push({
        id: 'steps-down',
        stream: 'steps',
        direction: 'down',
        severity: 'minor',
        line: "You're moving less than your usual week.",
      });
    } else if (
      steps.recentAverage >= steps.baselineAverage + 1500 &&
      steps.recentAverage >= steps.baselineAverage * 1.2
    ) {
      signals.push({
        id: 'steps-up',
        stream: 'steps',
        direction: 'up',
        severity: 'minor',
        line: "You've been more active than your usual week.",
      });
    }
  }
  return signals;
}

function boundedCount(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

function boundedPosition(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function progressMeter(completed: number, opportunities: number, label: string) {
  return {
    kind: 'progress' as const,
    position: opportunities > 0 ? boundedPosition(completed / opportunities) : 0,
    label,
  };
}

function baselineMeter(recent: number, baseline: number, label: string) {
  const position = baseline > 0
    ? 0.5 + (recent - baseline) / baseline
    : recent > 0
      ? 1
      : 0.5;
  return {
    kind: 'baseline' as const,
    // The centre is the user's earlier baseline. A 50% change reaches an edge.
    position: boundedPosition(position),
    label,
  };
}

function formatSleepMinutes(minutes: number): string {
  const rounded = Math.max(0, Math.round(minutes));
  const hours = Math.floor(rounded / 60);
  const remainder = rounded % 60;
  return remainder === 0 ? `${hours}h` : `${hours}h ${remainder}m`;
}

function formatSteps(steps: number): string {
  return Math.max(0, Math.round(steps)).toLocaleString('en-US');
}

function habitTrendArea(context: AdvisorContext): AdvisorTrendArea {
  const trend = context.habitTrend;
  if (!trend) {
    return {
      id: 'habits',
      label: 'Habits',
      level: 'learning',
      detail: 'Complete a few habit days to establish your pattern.',
      meter: null,
    };
  }

  const recentOpportunities = boundedCount(trend.recentOpportunities);
  const previousOpportunities = boundedCount(trend.previousOpportunities);
  const recentCompleted = Math.min(
    boundedCount(trend.recentCompleted),
    recentOpportunities
  );
  const previousCompleted = Math.min(
    boundedCount(trend.previousCompleted),
    previousOpportunities
  );
  const meter = recentOpportunities > 0
    ? progressMeter(
        recentCompleted,
        recentOpportunities,
        `${recentCompleted} of ${recentOpportunities} scheduled check-offs`
      )
    : null;
  if (recentOpportunities < 7 || previousOpportunities < 7) {
    return {
      id: 'habits',
      label: 'Habits',
      level: meter ? 'available' : 'learning',
      detail: meter
        ? 'Your recorded follow-through for the latest complete 7-day window.'
        : 'A little more habit history is needed for a comparison.',
      meter,
    };
  }

  const recentRate = recentCompleted / recentOpportunities;
  const previousRate = previousCompleted / previousOpportunities;
  const change = recentRate - previousRate;
  if (
    Math.abs(change) >= 0.25 &&
    Math.abs(recentCompleted - previousCompleted) >= 2
  ) {
    const direction = change > 0 ? 'higher' : 'lower';
    return {
      id: 'habits',
      label: 'Habits',
      level: 'changed',
      detail: `The recorded habit check-off rate was ${direction} than in the previous 7-day window.`,
      meter,
    };
  }
  return {
    id: 'habits',
    label: 'Habits',
    level: 'similar',
    detail: 'The recorded habit check-off rate was similar across the two recent 7-day windows.',
    meter,
  };
}

function healthTrendArea(
  context: AdvisorContext,
  stream: 'sleep' | 'steps'
): AdvisorTrendArea {
  const isSleep = stream === 'sleep';
  const metric = context.health?.[isSleep ? 'sleepMinutes' : 'steps'] ?? null;
  const id = isSleep ? 'sleep' : 'movement';
  const label = isSleep ? 'Sleep rhythm' : 'Movement rhythm';
  const comparable = metric !== null &&
    metric.recentCoverageDays >= 4 &&
    metric.baselineCoverageDays >= 7 &&
    metric.recentAverage !== null &&
    metric.baselineAverage !== null &&
    Number.isFinite(metric.recentAverage) &&
    Number.isFinite(metric.baselineAverage) &&
    metric.recentAverage >= 0 &&
    metric.baselineAverage >= 0;
  if (!comparable || metric.recentAverage === null || metric.baselineAverage === null) {
    return {
      id,
      label,
      level: 'learning',
      detail: `More authorized ${isSleep ? 'sleep' : 'movement'} history is needed.`,
      meter: null,
    };
  }

  const signal = healthSignals(context.health).find((item) => item.stream === stream);
  const recentLabel = isSleep
    ? formatSleepMinutes(metric.recentAverage)
    : formatSteps(metric.recentAverage);
  const baselineLabel = isSleep
    ? formatSleepMinutes(metric.baselineAverage)
    : formatSteps(metric.baselineAverage);
  return {
    id,
    label,
    level: signal ? 'changed' : 'similar',
    detail: signal
      ? `Your recent average shifted from your earlier personal baseline.`
      : 'Your recent average was close to your earlier personal baseline.',
    meter: baselineMeter(
      metric.recentAverage,
      metric.baselineAverage,
      `${recentLabel} recent · ${baselineLabel} earlier`
    ),
  };
}

function checkInTrendArea(context: AdvisorContext): AdvisorTrendArea {
  const trend = context.checkInTrend;
  if (!trend) {
    return {
      id: 'check-ins',
      label: 'Check-ins',
      level: 'learning',
      detail: 'Check-ins add context; the feeling itself is never scored.',
      meter: null,
    };
  }
  const recentDays = Math.min(7, boundedCount(trend.recentDays));
  if (recentDays === 0) {
    return {
      id: 'check-ins',
      label: 'Check-ins',
      level: 'learning',
      detail: 'No recent check-ins are included. Check in only when it is useful; feelings are never scored.',
      meter: progressMeter(0, 7, '0 of 7 days'),
    };
  }
  return {
    id: 'check-ins',
    label: 'Check-ins',
    level: 'available',
    detail: `Check-ins from ${recentDays} recent ${recentDays === 1 ? 'day are' : 'days are'} available as context. Feelings are never scored.`,
    meter: progressMeter(recentDays, 7, `${recentDays} of 7 days`),
  };
}

function createMomentumGame(context: AdvisorContext): AdvisorMomentumGame {
  const progress = context.momentumProgress;
  const availability = context.momentumAvailability ?? (
    progress ? 'available' : 'unavailable'
  );
  const points = progress ? boundedCount(progress.totalPoints) : 0;
  const weeklyPoints = progress ? boundedCount(progress.recentPoints) : 0;
  const comparisonReady = Boolean(
    progress &&
    context.habitTrend &&
    boundedCount(context.habitTrend.previousOpportunities) > 0
  );
  const previousWeeklyPoints = comparisonReady && progress
    ? boundedCount(progress.previousPoints)
    : null;
  const delta = previousWeeklyPoints === null
    ? null
    : weeklyPoints - previousWeeklyPoints;
  const level = Math.floor(points / 25) + 1;
  const unlockedMilestone = Math.floor(points / 25) * 25;
  const nextMilestone = level * 25;
  const pointsToNextMilestone = nextMilestone - points;

  return {
    availability,
    points,
    level,
    weeklyPoints,
    delta,
    nextMilestone,
    pointsToNextMilestone,
    milestoneProgress: boundedPosition((points % 25) / 25),
    unlockedMilestone,
    status: availability === 'signed-out'
      ? 'Sign in to earn XP'
      : availability === 'unavailable'
        ? 'XP is unavailable'
        : `Level ${level}`,
  };
}

export function createAdvisorTrendSummary(
  context: AdvisorContext
): AdvisorTrendSummary {
  const areas = [
    habitTrendArea(context),
    healthTrendArea(context, 'sleep'),
    healthTrendArea(context, 'steps'),
    checkInTrendArea(context),
  ] as const;
  const availableCount = areas.filter((area) => area.meter !== null).length;
  const momentum = createMomentumGame(context);

  return {
    level: availableCount > 0 || momentum.points > 0 ? 'available' : 'learning',
    label: 'Momentum',
    summary: momentum.availability !== 'available'
      ? 'Momentum points are not available for this session.'
      : momentum.points > 0
      ? `${momentum.points} lifetime XP from saved habit check-offs.`
      : 'Complete a planned habit to start building momentum.',
    showsCaution: false,
    momentum,
    areas,
  };
}

function goalSignal(goal: AdvisorGoal | null, now: Date): AdvisorChangeSignal | null {
  if (!goal) return null;
  const due = validDate(goal.dueAt);
  if (!due) return null;
  const dayDelta = localDayOrdinal(due) - localDayOrdinal(now);
  if (dayDelta < 0) {
    const suffix = ' is due and the date has passed.';
    return {
      id: `goal-overdue:${goal.id}`,
      stream: 'goal',
      direction: 'due',
      severity: 'notable',
      line: titledSignalLine(goal.title, suffix),
    };
  }
  if (!dueSoon(goal, now)) return null;

  const days = Math.max(0, dayDelta);
  const suffix = days === 0
    ? ' is due today.'
    : ` is due in ${days} ${days === 1 ? 'day' : 'days'}.`;
  return {
    id: `goal-due:${goal.id}`,
    stream: 'goal',
    direction: 'due',
    severity: 'notable',
    line: titledSignalLine(goal.title, suffix),
  };
}

function habitSignal(
  context: AdvisorContext,
  habit: AdvisorHabit | null
): AdvisorChangeSignal | null {
  const state = habitWeekState(context, habit);
  const week = context.habitWeek;
  if (!habit || !week || !state) return null;
  const completedDays = Math.max(0, Math.min(7, Math.floor(week.completedDays)));
  const suffix = ` has happened ${completedDays} of the last 7 days.`;
  return {
    id: `habit-${state}:${habit.id}`,
    stream: 'habit',
    direction: state === 'stalled' ? 'stalled' : 'up',
    severity: state === 'stalled' ? 'notable' : 'minor',
    line: titledSignalLine(habit.name, suffix),
  };
}

function feedbackSignal(
  recent: readonly AdvisorRecentRecommendation[],
  now: Date
): AdvisorChangeSignal | null {
  if (recent.length < 3) return null;
  const counts = new Map<string, number>();
  for (const item of recent) {
    if (typeof item === 'string' || item.helpful !== false) continue;
    const offered = validDate(item.offeredAt);
    if (!offered) continue;
    const age = now.getTime() - offered.getTime();
    if (age < 0 || age > 14 * DAY_MS) continue;
    const family = item.recommendationId.split(':')[0];
    if (!family) continue;
    counts.set(family, (counts.get(family) ?? 0) + 1);
  }
  if (![...counts.values()].some((count) => count >= 2)) return null;
  return {
    id: 'feedback-shift',
    stream: 'feedback',
    direction: 'steady',
    severity: 'minor',
    line: "The last few suggestions haven't landed, so this one is different.",
  };
}

const SIGNAL_RANK: Readonly<Record<string, number>> = {
  'goal-overdue': 0,
  'goal-due': 1,
  'habit-stalled': 2,
  'sleep-down': 3,
  'feedback-shift': 4,
  'habit-strong': 5,
  'sleep-up': 6,
  'steps-down': 7,
  'steps-up': 7,
};

function signalRank(signal: AdvisorChangeSignal): number {
  const stableId = signal.id.replace(/:(?:.*)$/, '');
  return SIGNAL_RANK[stableId] ?? Number.POSITIVE_INFINITY;
}

export function getAdvisorChangeSignals(
  context: AdvisorContext,
  recent: readonly AdvisorRecentRecommendation[] = []
): AdvisorChangeSignal[] {
  const now = validDate(context.nowIso) ?? new Date(0);
  if (
    hasUnsafeAdvisorContext(context) ||
    context.lowEnergyMode ||
    hasCurrentLowMood(context, now)
  ) {
    return [];
  }
  const snapshot = createAdvisorContextSnapshot(context);
  const signals = [
    goalSignal(snapshot.goals[0] ?? null, now),
    habitSignal(snapshot, snapshot.habits[0] ?? null),
    ...healthSignals(snapshot.health),
    feedbackSignal(recent, now),
  ].filter((signal): signal is AdvisorChangeSignal => signal !== null);
  return signals.sort(
    (left, right) => signalRank(left) - signalRank(right) || left.id.localeCompare(right.id)
  );
}

type ObservationStream = AdvisorChangeSignal['stream'] | 'mood' | 'health' | 'general';

function candidateStream(candidate: AdvisorRecommendationCandidate): ObservationStream {
  if (candidate.id.startsWith('low-') || candidate.sourceLabels.includes('Mood check-in')) {
    return 'mood';
  }
  if (candidate.id.startsWith('due-goal:') || candidate.id.startsWith('goal:')) {
    return 'goal';
  }
  if (candidate.id.startsWith('habit:')) return 'habit';
  if (candidate.id.startsWith('health-')) return 'health';
  return 'general';
}

function signalSourceLabel(signal: AdvisorChangeSignal): string {
  if (signal.stream === 'sleep' || signal.stream === 'steps') {
    return 'Apple Health summary';
  }
  if (signal.stream === 'feedback') return 'Your feedback';
  if (signal.stream === 'goal') return 'Goal';
  return 'Habit';
}

function appendSourceLabel(labels: string[], label: string): void {
  if (!labels.includes(label)) labels.push(label);
}

function boundedObservation(value: string): string {
  const normalized = value
    .normalize('NFKC')
    .replace(
      /[\u0000-\u001F\u007F-\u009F\u200B-\u200D\u202A-\u202E\u2060\u2066-\u2069\uFEFF]/g,
      ' '
    )
    .replace(/\s+/g, ' ')
    .trim();
  const characters = Array.from(normalized);
  if (characters.length <= 120) return normalized;
  return `${characters.slice(0, 119).join('').trimEnd()}.`;
}

function latestHelpfulFamily(
  recent: readonly AdvisorRecentRecommendation[]
): string | null {
  const latestByFamily = new Map<
    string,
    { time: number; helpful: boolean | null }
  >();
  for (const item of recent) {
    if (typeof item === 'string') continue;
    const time = validDate(item.offeredAt)?.getTime() ?? Number.NEGATIVE_INFINITY;
    const family = item.recommendationId.split(':')[0];
    if (!family) continue;
    const current = latestByFamily.get(family);
    if (!current || time > current.time) {
      latestByFamily.set(family, { time, helpful: item.helpful ?? null });
    }
  }
  let newestHelpful: { family: string; time: number } | null = null;
  for (const [family, outcome] of latestByFamily) {
    if (outcome.helpful !== true) continue;
    if (!newestHelpful || outcome.time > newestHelpful.time) {
      newestHelpful = { family, time: outcome.time };
    }
  }
  return newestHelpful?.family ?? null;
}

function synthesizeRecommendation(
  context: AdvisorContext,
  recent: readonly AdvisorRecentRecommendation[],
  candidate: AdvisorRecommendationCandidate
): AdvisorRecommendation {
  if (candidate.kind === 'safety' || context.lowEnergyMode) {
    return { ...candidate, observations: [], changeSignal: null };
  }

  const now = validDate(context.nowIso) ?? new Date(0);
  const lowMood = hasCurrentLowMood(context, now);
  if (lowMood) {
    const observation = boundedObservation(candidate.observation);
    return {
      ...candidate,
      observation,
      observations: [observation],
      changeSignal: null,
    };
  }

  const stateStream = candidateStream(candidate);
  const signals = getAdvisorChangeSignals(context, recent);
  const observations: string[] = [];
  const streams = new Set<ObservationStream>();
  const sourceLabels = [...candidate.sourceLabels];
  const topSignal = signals[0] ?? null;
  if (topSignal) {
    observations.push(boundedObservation(topSignal.line));
    streams.add(topSignal.stream);
    appendSourceLabel(sourceLabels, signalSourceLabel(topSignal));
  }

  const healthStreamAlreadyUsed =
    stateStream === 'health' && (streams.has('sleep') || streams.has('steps'));
  if (!streams.has(stateStream) && !healthStreamAlreadyUsed) {
    observations.push(boundedObservation(candidate.observation));
    streams.add(stateStream);
  }

  const hasHealthObservation = streams.has('sleep') || streams.has('steps');
  const positiveSignal = signals.find(
    (signal) =>
      (signal.direction === 'up' || signal.id.startsWith('habit-strong:')) &&
      !streams.has(signal.stream) &&
      (!(signal.stream === 'sleep' || signal.stream === 'steps') ||
        !hasHealthObservation)
  );
  if (positiveSignal && observations.length < 3) {
    observations.push(boundedObservation(positiveSignal.line));
    streams.add(positiveSignal.stream);
    appendSourceLabel(sourceLabels, signalSourceLabel(positiveSignal));
  } else if (
    observations.length < 3 &&
    !streams.has('feedback') &&
    latestHelpfulFamily(recent) === candidate.id.split(':')[0]
  ) {
    observations.push('That helped last time, so this one is similar.');
    appendSourceLabel(sourceLabels, 'Your feedback');
  }

  const bounded = observations.slice(0, 3);
  const observation = bounded[0] ?? boundedObservation(candidate.observation);
  return {
    ...candidate,
    observation,
    observations: bounded.length > 0 ? bounded : [observation],
    changeSignal: topSignal?.severity === 'notable' ? topSignal : null,
    sourceLabels,
  };
}

function recommendationOfferedToday(
  context: AdvisorContext,
  recent: readonly AdvisorRecentRecommendation[],
  candidates: readonly AdvisorRecommendationCandidate[],
  nowIso: string
): AdvisorRecommendationCandidate | null {
  const now = new Date(nowIso);
  if (!Number.isFinite(now.getTime())) return null;
  for (const item of recent) {
    if (typeof item === 'string' || !item.offeredAt) continue;
    const offered = new Date(item.offeredAt);
    if (!Number.isFinite(offered.getTime())) continue;
    if (localDateKey(offered) !== localDateKey(now)) continue;
    const match = candidates.find(
      (candidate) => candidate.id === item.recommendationId
    );
    if (!match) continue;
    const currentLowMood =
      context.mood !== null &&
      LOW_MOODS.has(context.mood.emoji) &&
      context.mood.localDate === localDateKey(now);
    if (context.lowEnergyMode && !match.id.startsWith('low-energy-')) continue;
    if (currentLowMood && !match.id.startsWith('low-')) continue;
    return match;
  }
  return null;
}

function suppressedRecommendationIds(
  recent: readonly AdvisorRecentRecommendation[],
  nowIso: string
): Set<string> {
  const now = new Date(nowIso).getTime();
  const safeNow = Number.isFinite(now) ? now : 0;
  const threeDays = 3 * 24 * 60 * 60 * 1000;
  const fourteenDays = 14 * 24 * 60 * 60 * 1000;
  const suppressed = new Set<string>();
  for (const item of recent) {
    if (typeof item === 'string') {
      suppressed.add(item);
      continue;
    }
    if (!item.recommendationId) continue;
    const offeredAt = item.offeredAt ? new Date(item.offeredAt).getTime() : NaN;
    if (!Number.isFinite(offeredAt)) continue;
    const age = safeNow - offeredAt;
    if (age >= 0 && age <= threeDays) suppressed.add(item.recommendationId);
    if (item.helpful === false && age >= 0 && age <= fourteenDays) {
      suppressed.add(item.recommendationId);
    }
  }
  return suppressed;
}

export function selectAdvisorRecommendation(
  context: AdvisorContext,
  recent: readonly AdvisorRecentRecommendation[] = [],
  options: AdvisorSelectionOptions = {}
): AdvisorRecommendation {
  const allCandidates = recommendationCandidates(context);
  const familyCandidates = options.candidateFamily
    ? allCandidates.filter(
        (candidate) => candidate.id.split(':')[0] === options.candidateFamily
      )
    : [];
  const candidates = familyCandidates.length > 0 ? familyCandidates : allCandidates;
  if (candidates[0]?.kind === 'safety') {
    return synthesizeRecommendation(context, recent, candidates[0]);
  }
  if (options.preserveToday !== false) {
    const offeredToday = recommendationOfferedToday(
      context,
      recent,
      candidates,
      context.nowIso
    );
    if (offeredToday) {
      return synthesizeRecommendation(context, recent, offeredToday);
    }
  }
  const suppressed = suppressedRecommendationIds(recent, context.nowIso);
  const unsuppressed = candidates.find(
    (candidate) =>
      candidate.id !== options.excludeRecommendationId &&
      !suppressed.has(candidate.id)
  );
  if (unsuppressed) {
    return synthesizeRecommendation(context, recent, unsuppressed);
  }

  // An explicit "try another" should still change the visible action after the
  // normal anti-repetition window has exhausted every candidate.
  const fallback = (
    candidates.find(
      (candidate) => candidate.id !== options.excludeRecommendationId
    ) ?? candidates[0]
  );
  return synthesizeRecommendation(context, recent, fallback);
}

export function createAdvisorRecommendation(
  context: AdvisorContext,
  recent: readonly AdvisorRecentRecommendation[] = [],
  options: AdvisorSelectionOptions = {}
): AdvisorRecommendation {
  return selectAdvisorRecommendation(context, recent, options);
}

export function createAdvisorCandidateSet(
  context: AdvisorContext,
  recent: readonly AdvisorRecentRecommendation[] = [],
  options: AdvisorSelectionOptions = {},
  limit = 3
): AdvisorRecommendation[] {
  const first = selectAdvisorRecommendation(context, recent, options);
  const candidates = [first];
  const boundedLimit = Math.max(1, Math.min(3, Math.floor(limit)));
  if (first.kind === 'safety' || boundedLimit === 1) return candidates;

  while (candidates.length < boundedLimit) {
    const next = selectAdvisorRecommendation(
      context,
      [
        ...recent,
        ...candidates.map((candidate) => candidate.id),
      ],
      {
        ...options,
        preserveToday: false,
        excludeRecommendationId: candidates[candidates.length - 1].id,
      }
    );
    if (candidates.some((candidate) => candidate.id === next.id)) break;
    candidates.push(next);
  }
  return candidates;
}
