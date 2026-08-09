export const WEEKLY_INSIGHT_FEATURES = [
  'checkInDays',
  'completedHabitDays',
  'completedFocusSessions',
  'journalEntries',
] as const;

export type WeeklyInsightFeature = (typeof WEEKLY_INSIGHT_FEATURES)[number];

export type WeeklyOwnerSummary = {
  weekStart: string;
  weekEnd: string;
  timeZone: string;
  checkInDays: number;
  completedHabitDays: number;
  completedFocusSessions: number;
  journalEntries: number;
};

export type WeeklyInsightCount = {
  feature: WeeklyInsightFeature;
  value: number;
  label: string;
};

export type WeeklyInsight = {
  heading: string;
  periodLabel: string;
  counts: WeeklyInsightCount[];
  totalObservations: number;
  activeFeatureCount: number;
  question: string | null;
};

export type WeeklySummaryRpcArgs = {
  p_week_start: string;
  p_timezone: string;
};

export type WeeklySummaryRpc = (
  args: WeeklySummaryRpcArgs
) => PromiseLike<{
  data: unknown;
  error: { message?: string } | null;
}>;

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

const FEATURE_COPY: Record<
  WeeklyInsightFeature,
  { singular: string; plural: string; question: string }
> = {
  checkInDays: {
    singular: 'check-in day',
    plural: 'check-in days',
    question: 'check-ins',
  },
  completedHabitDays: {
    singular: 'habit day',
    plural: 'habit days',
    question: 'habit completions',
  },
  completedFocusSessions: {
    singular: 'focus session',
    plural: 'focus sessions',
    question: 'focus sessions',
  },
  journalEntries: {
    singular: 'journal entry',
    plural: 'journal entries',
    question: 'journal entries',
  },
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseIsoDate(value: unknown, field: string): Date {
  if (typeof value !== 'string') {
    throw new Error(`Invalid weekly summary ${field}.`);
  }

  const match = ISO_DATE.exec(value);
  if (!match) throw new Error(`Invalid weekly summary ${field}.`);

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new Error(`Invalid weekly summary ${field}.`);
  }
  return date;
}

function formatUtcDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function readCount(
  source: Record<string, unknown>,
  key: string,
  maximum = Number.MAX_SAFE_INTEGER
): number {
  const value = source[key];
  if (!Number.isSafeInteger(value) || (value as number) < 0 || (value as number) > maximum) {
    throw new Error(`Invalid weekly summary ${key}.`);
  }
  return value as number;
}

export function resolveWeeklyTimeZone(timeZone?: string): string {
  const resolved = timeZone?.trim() ||
    Intl.DateTimeFormat().resolvedOptions().timeZone ||
    'UTC';

  try {
    new Intl.DateTimeFormat('en-US', { timeZone: resolved }).format();
  } catch {
    throw new Error('Invalid time zone.');
  }
  return resolved;
}

export function getWeeklyInsightWeekStart(
  timeZone: string,
  now: Date = new Date()
): string {
  const resolvedTimeZone = resolveWeeklyTimeZone(timeZone);
  if (!Number.isFinite(now.getTime())) throw new Error('Invalid current date.');

  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: resolvedTimeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const valueFor = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);
  const localDate = new Date(
    Date.UTC(valueFor('year'), valueFor('month') - 1, valueFor('day'))
  );
  const daysSinceMonday = (localDate.getUTCDay() + 6) % 7;
  localDate.setUTCDate(localDate.getUTCDate() - daysSinceMonday);
  return formatUtcDate(localDate);
}

export function parseWeeklyOwnerSummary(value: unknown): WeeklyOwnerSummary {
  if (!isRecord(value)) throw new Error('Invalid weekly summary response.');

  const weekStartDate = parseIsoDate(value.week_start, 'week_start');
  const weekEndDate = parseIsoDate(value.week_end, 'week_end');
  const expectedEnd = new Date(weekStartDate);
  expectedEnd.setUTCDate(expectedEnd.getUTCDate() + 6);
  if (
    weekStartDate.getUTCDay() !== 1 ||
    formatUtcDate(weekEndDate) !== formatUtcDate(expectedEnd)
  ) {
    throw new Error('Invalid weekly summary window.');
  }

  if (typeof value.timezone !== 'string') {
    throw new Error('Invalid weekly summary timezone.');
  }
  const timeZone = resolveWeeklyTimeZone(value.timezone);

  // Construct a new object from the allowlist; never forward the raw RPC payload.
  return {
    weekStart: formatUtcDate(weekStartDate),
    weekEnd: formatUtcDate(weekEndDate),
    timeZone,
    checkInDays: readCount(value, 'check_in_days', 7),
    completedHabitDays: readCount(value, 'completed_habit_days', 7),
    completedFocusSessions: readCount(value, 'completed_focus_sessions'),
    journalEntries: readCount(value, 'journal_entries'),
  };
}

function joinNatural(values: string[]): string {
  if (values.length === 2) return `${values[0]} and ${values[1]}`;
  return `${values.slice(0, -1).join(', ')}, and ${values.at(-1)}`;
}

export function createWeeklyInsight(summary: WeeklyOwnerSummary): WeeklyInsight {
  const values: Record<WeeklyInsightFeature, number> = {
    checkInDays: summary.checkInDays,
    completedHabitDays: summary.completedHabitDays,
    completedFocusSessions: summary.completedFocusSessions,
    journalEntries: summary.journalEntries,
  };
  const activeFeatures = WEEKLY_INSIGHT_FEATURES.filter(
    (feature) => values[feature] > 0
  );
  const totalObservations = WEEKLY_INSIGHT_FEATURES.reduce(
    (total, feature) => total + values[feature],
    0
  );
  const counts = activeFeatures.map((feature) => {
    const value = values[feature];
    const copy = FEATURE_COPY[feature];
    return {
      feature,
      value,
      label: value === 1 ? copy.singular : copy.plural,
    };
  });
  const canAskCrossFeatureQuestion =
    activeFeatures.length >= 2 && totalObservations >= 3;
  const questionFeatures = activeFeatures.map(
    (feature) => FEATURE_COPY[feature].question
  );

  return {
    heading: 'This week in brief',
    periodLabel: `Mon-Sun · ${summary.weekStart} to ${summary.weekEnd}`,
    counts,
    totalObservations,
    activeFeatureCount: activeFeatures.length,
    question: canAskCrossFeatureQuestion
      ? `What did you notice about ${joinNatural(questionFeatures)} this week?`
      : null,
  };
}

export async function loadWeeklyOwnerSummary(
  rpc: WeeklySummaryRpc,
  timeZone?: string,
  now: Date = new Date()
): Promise<WeeklyOwnerSummary> {
  const resolvedTimeZone = resolveWeeklyTimeZone(timeZone);
  const weekStart = getWeeklyInsightWeekStart(resolvedTimeZone, now);
  const { data, error } = await rpc({
    p_week_start: weekStart,
    p_timezone: resolvedTimeZone,
  });
  if (error) throw new Error('Unable to load weekly insight.');

  const summary = parseWeeklyOwnerSummary(data);
  if (summary.weekStart !== weekStart || summary.timeZone !== resolvedTimeZone) {
    throw new Error('Weekly summary response did not match the request.');
  }
  return summary;
}
