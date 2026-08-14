export const APPLE_HEALTH_WINDOW_DAYS = 30;

export interface DatedValue {
  date: Date;
  value: number | null;
}

export interface HealthInterval {
  startDate: Date;
  endDate: Date;
  value?: number;
}

export interface StateOfMindValue {
  date: Date;
  valence: number;
}

export interface AppleHealthRawData {
  steps: readonly DatedValue[];
  exerciseMinutes: readonly DatedValue[];
  sleep: readonly HealthInterval[];
  mindfulSessions: readonly HealthInterval[];
  workouts: readonly { date: Date }[];
  statesOfMind: readonly StateOfMindValue[];
}

export interface AppleHealthDay {
  date: string;
  steps: number | null;
  exerciseMinutes: number | null;
  sleepMinutes: number | null;
  mindfulMinutes: number | null;
  workoutCount: number;
  stateOfMindCount: number;
  stateOfMindValence: number | null;
}

export interface AppleHealthSnapshot {
  generatedAt: string;
  days: AppleHealthDay[];
}

export interface AppleHealthWindowSummary {
  days: number;
  coverageDays: number;
  averageSteps: number | null;
  averageSleepMinutes: number | null;
  exerciseMinutes: number;
  mindfulMinutes: number;
  workoutCount: number;
  stateOfMindCount: number;
}

export interface MoodTimestamp {
  emoji: string;
  created_at: string;
  local_date?: string | null;
}

export interface AppleHealthOverview {
  sevenDay: AppleHealthWindowSummary;
  thirtyDay: AppleHealthWindowSummary;
  pattern: string;
}

export interface AppleHealthAiWindowSummary {
  coverageDays: number;
  averageSteps: number | null;
  averageSleepMinutes: number | null;
  exerciseMinutes: number;
  mindfulMinutes: number;
  workoutCount: number;
  stateOfMindCount: number;
}

export interface AppleHealthAiSummary {
  sevenDay: AppleHealthAiWindowSummary;
  thirtyDay: AppleHealthAiWindowSummary;
  moodComparison: string;
}

export async function runAppleHealthQuery<T>(
  query: () => Promise<readonly T[]>
): Promise<readonly T[]> {
  try {
    return await query();
  } catch {
    // One unavailable, denied, or malformed category must not hide the rest.
    return [];
  }
}

const MOOD_SCORE: Record<string, number> = {
  '😢': 1,
  '😞': 2,
  '😐': 3,
  '🙂': 4,
  '😄': 5,
};

export function localDayKey(date: Date): string {
  if (!Number.isFinite(date.getTime())) throw new Error('Invalid Apple Health date.');
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function safeLocalDayKey(date: Date): string | null {
  return Number.isFinite(date.getTime()) ? localDayKey(date) : null;
}

function moodLocalDayKey(mood: MoodTimestamp): string | null {
  if (mood.local_date && /^\d{4}-\d{2}-\d{2}$/.test(mood.local_date)) {
    return mood.local_date;
  }
  const date = new Date(mood.created_at);
  return safeLocalDayKey(date);
}

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function appleHealthDateRange(
  days = APPLE_HEALTH_WINDOW_DAYS,
  now = new Date()
): { start: Date; end: Date; keys: string[] } {
  if (!Number.isInteger(days) || days < 1 || days > 90) {
    throw new Error('Apple Health day range must be between 1 and 90.');
  }
  if (!Number.isFinite(now.getTime())) throw new Error('Invalid Apple Health end date.');

  const end = new Date(now);
  const start = startOfLocalDay(end);
  start.setDate(start.getDate() - (days - 1));
  const keys: string[] = [];
  for (let offset = 0; offset < days; offset += 1) {
    const date = new Date(start);
    date.setDate(start.getDate() + offset);
    keys.push(localDayKey(date));
  }
  return { start, end, keys };
}

function finiteNonNegative(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? value
    : null;
}

function mergeDurationMinutes(intervals: readonly HealthInterval[]): number | null {
  const normalized = intervals
    .map(({ startDate, endDate }) => [startDate.getTime(), endDate.getTime()] as const)
    .filter(([start, end]) => Number.isFinite(start) && Number.isFinite(end) && end > start)
    .sort((left, right) => left[0] - right[0]);
  if (normalized.length === 0) return null;

  let totalMs = 0;
  let [currentStart, currentEnd] = normalized[0];
  for (const [start, end] of normalized.slice(1)) {
    if (start <= currentEnd) {
      currentEnd = Math.max(currentEnd, end);
      continue;
    }
    totalMs += currentEnd - currentStart;
    currentStart = start;
    currentEnd = end;
  }
  totalMs += currentEnd - currentStart;
  return Math.min(24 * 60, Math.round(totalMs / 60_000));
}

function average(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function buildAppleHealthSnapshot(
  raw: AppleHealthRawData,
  now = new Date(),
  days = APPLE_HEALTH_WINDOW_DAYS
): AppleHealthSnapshot {
  const range = appleHealthDateRange(days, now);
  const allowed = new Set(range.keys);
  const byDay = new Map<string, AppleHealthDay>(
    range.keys.map((date) => [
      date,
      {
        date,
        steps: null,
        exerciseMinutes: null,
        sleepMinutes: null,
        mindfulMinutes: null,
        workoutCount: 0,
        stateOfMindCount: 0,
        stateOfMindValence: null,
      },
    ])
  );

  for (const item of raw.steps) {
    const key = safeLocalDayKey(item.date);
    const value = finiteNonNegative(item.value);
    const day = key ? byDay.get(key) : undefined;
    if (day && value !== null) day.steps = Math.round(value);
  }
  for (const item of raw.exerciseMinutes) {
    const key = safeLocalDayKey(item.date);
    const value = finiteNonNegative(item.value);
    const day = key ? byDay.get(key) : undefined;
    if (day && value !== null) day.exerciseMinutes = Math.round(value);
  }

  const sleepByDay = new Map<string, HealthInterval[]>();
  for (const interval of raw.sleep) {
    const key = safeLocalDayKey(interval.endDate);
    if (!key || !allowed.has(key)) continue;
    sleepByDay.set(key, [...(sleepByDay.get(key) ?? []), interval]);
  }
  for (const [key, intervals] of sleepByDay) {
    const day = byDay.get(key);
    if (day) day.sleepMinutes = mergeDurationMinutes(intervals);
  }

  const mindfulByDay = new Map<string, HealthInterval[]>();
  for (const interval of raw.mindfulSessions) {
    const key = safeLocalDayKey(interval.startDate);
    if (!key || !allowed.has(key)) continue;
    mindfulByDay.set(key, [...(mindfulByDay.get(key) ?? []), interval]);
  }
  for (const [key, intervals] of mindfulByDay) {
    const day = byDay.get(key);
    if (day) day.mindfulMinutes = mergeDurationMinutes(intervals);
  }

  for (const workout of raw.workouts) {
    const key = safeLocalDayKey(workout.date);
    const day = key ? byDay.get(key) : undefined;
    if (day) day.workoutCount += 1;
  }

  const valenceByDay = new Map<string, number[]>();
  for (const state of raw.statesOfMind) {
    if (!Number.isFinite(state.valence) || state.valence < -1 || state.valence > 1) continue;
    const key = safeLocalDayKey(state.date);
    if (!key || !allowed.has(key)) continue;
    valenceByDay.set(key, [...(valenceByDay.get(key) ?? []), state.valence]);
  }
  for (const [key, values] of valenceByDay) {
    const day = byDay.get(key);
    if (!day) continue;
    day.stateOfMindCount = values.length;
    day.stateOfMindValence = average(values);
  }

  return {
    generatedAt: now.toISOString(),
    days: range.keys.map((key) => byDay.get(key)!),
  };
}

export function summarizeAppleHealthWindow(
  days: readonly AppleHealthDay[],
  windowDays: number
): AppleHealthWindowSummary {
  const selected = days.slice(-windowDays);
  const steps = selected.flatMap((day) => (day.steps === null ? [] : [day.steps]));
  const sleep = selected.flatMap((day) =>
    day.sleepMinutes === null ? [] : [day.sleepMinutes]
  );
  const hasData = (day: AppleHealthDay) =>
    day.steps !== null ||
    day.exerciseMinutes !== null ||
    day.sleepMinutes !== null ||
    day.mindfulMinutes !== null ||
    day.workoutCount > 0 ||
    day.stateOfMindCount > 0;

  return {
    days: selected.length,
    coverageDays: selected.filter(hasData).length,
    averageSteps: steps.length ? Math.round(average(steps)!) : null,
    averageSleepMinutes: sleep.length ? Math.round(average(sleep)!) : null,
    exerciseMinutes: Math.round(
      selected.reduce((sum, day) => sum + (day.exerciseMinutes ?? 0), 0)
    ),
    mindfulMinutes: Math.round(
      selected.reduce((sum, day) => sum + (day.mindfulMinutes ?? 0), 0)
    ),
    workoutCount: selected.reduce((sum, day) => sum + day.workoutCount, 0),
    stateOfMindCount: selected.reduce((sum, day) => sum + day.stateOfMindCount, 0),
  };
}

function meanForMoodGroup(
  metric: (day: AppleHealthDay) => number | null,
  daysByDate: Map<string, AppleHealthDay>,
  moodByDate: Map<string, number>,
  predicate: (mood: number) => boolean
): number[] {
  const values: number[] = [];
  for (const [date, mood] of moodByDate) {
    if (!predicate(mood)) continue;
    const day = daysByDate.get(date);
    if (!day) continue;
    const value = metric(day);
    if (value !== null && Number.isFinite(value)) values.push(value);
  }
  return values;
}

export function createAppleHealthPattern(
  days: readonly AppleHealthDay[],
  moods: readonly MoodTimestamp[]
): string {
  const daysByDate = new Map(days.map((day) => [day.date, day]));
  const moodSamples = new Map<string, number[]>();
  for (const mood of moods) {
    const score = MOOD_SCORE[mood.emoji];
    const key = moodLocalDayKey(mood);
    if (!score || !key) continue;
    if (!daysByDate.has(key)) continue;
    moodSamples.set(key, [...(moodSamples.get(key) ?? []), score]);
  }
  const moodByDate = new Map(
    [...moodSamples].map(([date, values]) => [date, average(values)!])
  );

  const comparisons = [
    {
      metric: (day: AppleHealthDay) => day.sleepMinutes,
      format: (value: number) => `${(value / 60).toFixed(1)} hr sleep`,
    },
    {
      metric: (day: AppleHealthDay) => day.steps,
      format: (value: number) => `${Math.round(value).toLocaleString()} steps`,
    },
    {
      metric: (day: AppleHealthDay) => day.exerciseMinutes,
      format: (value: number) => `${Math.round(value)} min exercise`,
    },
  ];

  for (const comparison of comparisons) {
    const higher = meanForMoodGroup(
      comparison.metric,
      daysByDate,
      moodByDate,
      (mood) => mood >= 4
    );
    const lower = meanForMoodGroup(
      comparison.metric,
      daysByDate,
      moodByDate,
      (mood) => mood <= 2
    );
    if (higher.length >= 2 && lower.length >= 2) {
      return `Higher-mood check-in days averaged ${comparison.format(
        average(higher)!
      )}; lower-mood days averaged ${comparison.format(average(lower)!)}.`;
    }
  }

  const overlappingDays = [...moodByDate.keys()].filter((date) => {
    const day = daysByDate.get(date);
    if (!day) return false;
    return (
      day.steps !== null ||
      day.exerciseMinutes !== null ||
      day.sleepMinutes !== null ||
      day.mindfulMinutes !== null ||
      day.workoutCount > 0 ||
      day.stateOfMindCount > 0
    );
  }).length;
  if (overlappingDays > 0) {
    return `Mood and Apple Health overlap on ${overlappingDays} of the last 30 days.`;
  }
  return 'Keep checking in to compare mood with sleep, movement, and mindfulness.';
}

export function countAppleHealthMoodOverlap(
  days: readonly AppleHealthDay[],
  moods: readonly MoodTimestamp[]
): number {
  const daysWithHealthData = new Set(
    days
      .filter(
        (day) =>
          day.steps !== null ||
          day.exerciseMinutes !== null ||
          day.sleepMinutes !== null ||
          day.mindfulMinutes !== null ||
          day.workoutCount > 0 ||
          day.stateOfMindCount > 0
      )
      .map((day) => day.date)
  );
  const overlappingDays = new Set<string>();
  for (const mood of moods) {
    if (!MOOD_SCORE[mood.emoji]) continue;
    const key = moodLocalDayKey(mood);
    if (!key) continue;
    if (daysWithHealthData.has(key)) overlappingDays.add(key);
  }
  return overlappingDays.size;
}

export function createAppleHealthOverview(
  snapshot: AppleHealthSnapshot,
  _moods: readonly MoodTimestamp[] = []
): AppleHealthOverview {
  const thirtyDay = summarizeAppleHealthWindow(snapshot.days, 30);
  return {
    sevenDay: summarizeAppleHealthWindow(snapshot.days, 7),
    thirtyDay,
    pattern:
      thirtyDay.coverageDays > 0
        ? `Health data is available on ${thirtyDay.coverageDays} of the last 30 days.`
        : 'No Health data is available from the last 30 days.',
  };
}

function createAiWindowSummary(
  summary: AppleHealthWindowSummary
): AppleHealthAiWindowSummary {
  return {
    coverageDays: summary.coverageDays,
    averageSteps: summary.averageSteps,
    averageSleepMinutes: summary.averageSleepMinutes,
    exerciseMinutes: summary.exerciseMinutes,
    mindfulMinutes: summary.mindfulMinutes,
    workoutCount: summary.workoutCount,
    stateOfMindCount: summary.stateOfMindCount,
  };
}

/**
 * Produces the only Apple Health shape allowed to leave the device. It contains
 * aggregate windows only: no samples, dates, source devices, or identifiers.
 */
export function createAppleHealthAiSummary(
  overview: AppleHealthOverview
): AppleHealthAiSummary {
  return {
    sevenDay: createAiWindowSummary(overview.sevenDay),
    thirtyDay: createAiWindowSummary(overview.thirtyDay),
    moodComparison: overview.pattern.slice(0, 240),
  };
}

export function formatHealthMinutes(minutes: number | null): string {
  if (minutes === null) return '—';
  const roundedMinutes = Math.round(minutes);
  if (roundedMinutes < 60) return `${roundedMinutes}m`;
  const hours = Math.floor(roundedMinutes / 60);
  const remainder = roundedMinutes % 60;
  return remainder ? `${hours}h ${remainder}m` : `${hours}h`;
}
