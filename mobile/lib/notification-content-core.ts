import { format } from 'date-fns';
import {
  SOURCED_QUOTE_FALLBACKS,
  type AffirmationDisplayRecord,
} from './affirmations';
import {
  UNIFIED_LIBRARY,
  type LibraryItem,
} from './library/content';
import type {
  DueDateReminder,
  ReminderContent,
  ReminderSchedulePlan,
} from './notifications-core';

export type TodayGoal = {
  content: string;
  created_at: string;
};

export type LifePlanItem = {
  id: string;
  title: string;
  next_step: string;
  target_date: string | null;
};

export type LibraryState = {
  content_id: string;
  is_saved: boolean;
  priority: 'none' | 'next';
};

export type SmartReminderPlanInput = {
  now: Date;
  reminderTimes: readonly number[];
  goals: readonly TodayGoal[];
  lifePlans: readonly LifePlanItem[];
  libraryStates: readonly LibraryState[];
  affirmations: readonly AffirmationDisplayRecord[];
};

const MAX_DUE_DATE_REMINDERS = 24;

function truncate(value: string, maxLength: number): string {
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

function stableIndex(seed: string, length: number): number {
  if (length === 0) return 0;
  let hash = 0;
  for (const character of seed) {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  }
  return hash % length;
}

function pickForDay<T>(values: readonly T[], day: string, key: string): T | null {
  if (values.length === 0) return null;
  return values[stableIndex(`${day}:${key}`, values.length)] ?? null;
}

function localDateAt(dateValue: string, hour: number): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateValue);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day, hour, 0, 0, 0);
  return date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
    ? date
    : null;
}

function earliestFutureTimeForDate(
  dateValue: string,
  reminderTimes: readonly number[],
  now: Date
): Date | null {
  const hours = Array.from(new Set(reminderTimes))
    .filter((hour) => Number.isInteger(hour) && hour >= 0 && hour <= 23)
    .sort((a, b) => a - b);

  for (const hour of hours) {
    const candidate = localDateAt(dateValue, hour);
    if (candidate && candidate.getTime() > now.getTime()) return candidate;
  }
  return null;
}

function dueDateLabel(date: Date, today: string): string {
  return format(date, 'yyyy-MM-dd') === today
    ? 'Due today'
    : `Due ${format(date, 'MMM d')}`;
}

function notificationForAffirmation(
  affirmation: AffirmationDisplayRecord | null
): ReminderContent {
  if (!affirmation) {
    return {
      title: 'A moment for you',
      body: 'Pause and choose one small, kind next step.',
      screen: '/affirmations',
    };
  }

  const attribution = affirmation.attribution_name
    ? ` — ${truncate(affirmation.attribution_name, 42)}`
    : '';
  return {
    title: 'Daily affirmation',
    body: `“${truncate(affirmation.content, 125)}”${attribution}`,
    screen: '/affirmations',
  };
}

function libraryRecommendation(
  states: readonly LibraryState[],
  today: string
): LibraryItem | null {
  const stateByContentId = new Map(
    states.map((state) => [state.content_id, state])
  );
  const prioritized = UNIFIED_LIBRARY.filter(
    (item) => stateByContentId.get(item.id)?.priority === 'next'
  );
  const saved = UNIFIED_LIBRARY.filter(
    (item) => stateByContentId.get(item.id)?.is_saved
  );
  const pool = prioritized.length > 0
    ? prioritized
    : saved.length > 0
      ? saved
      : UNIFIED_LIBRARY;
  return pickForDay(pool, today, 'library');
}

function notificationForLibrary(item: LibraryItem | null): ReminderContent {
  if (!item) {
    return {
      title: 'A useful next step',
      body: 'Open the library for a guide, talk, or story you can use today.',
      screen: '/library',
    };
  }

  return {
    title: 'Your library pick',
    body: 'A library recommendation is ready. Open MHtoolkit when you are ready.',
    screen: '/library',
  };
}

function dueReminder(
  targetDate: string,
  reminderTimes: readonly number[],
  now: Date,
  today: string,
  screen: '/goals' | '/planner'
): DueDateReminder | null {
  const date = earliestFutureTimeForDate(targetDate, reminderTimes, now);
  if (!date) return null;

  return {
    title: dueDateLabel(date, today),
    body:
      screen === '/goals'
        ? 'A goal is due. Open MHtoolkit when you are ready.'
        : 'A plan item is due. Open MHtoolkit to review it.',
    screen,
    date,
  };
}

export function buildSmartReminderPlan({
  now,
  reminderTimes,
  goals,
  lifePlans,
  libraryStates,
  affirmations,
}: SmartReminderPlanInput): ReminderSchedulePlan {
  const today = format(now, 'yyyy-MM-dd');
  const dueDates: DueDateReminder[] = [];
  const firstGoal = goals[0];
  if (firstGoal) {
    const reminder = dueReminder(
      today,
      reminderTimes,
      now,
      today,
      '/goals'
    );
    if (reminder) dueDates.push(reminder);
  }

  const activePlans = lifePlans
    .filter((item) => item.target_date)
    .sort((a, b) => (a.target_date ?? '').localeCompare(b.target_date ?? ''));
  for (const plan of activePlans) {
    if (dueDates.length >= MAX_DUE_DATE_REMINDERS || !plan.target_date) break;
    const reminder = dueReminder(
      plan.target_date,
      reminderTimes,
      now,
      today,
      '/planner'
    );
    if (reminder) dueDates.push(reminder);
  }

  const affirmation = pickForDay(
    affirmations.length > 0 ? affirmations : SOURCED_QUOTE_FALLBACKS,
    today,
    'affirmation'
  );
  const library = libraryRecommendation(libraryStates, today);

  return {
    daily: [
      {
        title: 'Plan your next step',
        body: 'Open your goals and choose one realistic priority for today.',
        screen: '/goals',
      },
      notificationForAffirmation(affirmation),
      notificationForLibrary(library),
    ],
    dueDates,
  };
}
