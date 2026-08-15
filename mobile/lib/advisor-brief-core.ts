import type {
  AdvisorContext,
  AdvisorRecentRecommendation,
} from './advisor-core';
import type { AppleHealthAiSummary } from './apple-health-core';

export type AdvisorBriefFocus =
  | 'steady'
  | 'deadline'
  | 'routine'
  | 'baseline'
  | 'recover';

export type AdvisorBriefSignal = {
  id: string;
  kind: 'mood' | 'deadline' | 'routine' | 'streak' | 'health' | 'notifications';
  text: string;
};

export type AdvisorDailyBrief = {
  focus: AdvisorBriefFocus;
  headline: string;
  signals: readonly AdvisorBriefSignal[];
  usedAppleHealth: boolean;
};

const MOOD_LABELS: Record<string, 'Great' | 'Good' | 'Okay' | 'Low' | 'Very low'> = {
  '😄': 'Great',
  '🙂': 'Good',
  '😐': 'Okay',
  '😞': 'Low',
  '😢': 'Very low',
};

const NOTIFICATION_LABELS: Record<string, string> = {
  dailyPlanning: 'daily planning',
  goalReminders: 'goal reminders',
  planReminders: 'planner due dates',
  routineReminders: 'routine reminders',
  affirmations: 'affirmations',
  libraryPicks: 'library picks',
  advisorNudges: 'Advisor nudges',
};

function boundedSignal(value: string): string {
  return Array.from(value.trim().replace(/\s+/g, ' ')).slice(0, 240).join('');
}

function dayDistance(value: string | null, now: Date): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const due = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  const days = Math.round((due - today) / (24 * 60 * 60 * 1000));
  if (days < 0) return `${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} overdue`;
  if (days === 0) return 'due today';
  if (days === 1) return 'due tomorrow';
  return `due in ${days} days`;
}

function formatReminderHour(hour: number): string {
  const normalized = ((hour % 24) + 24) % 24;
  const display = normalized % 12 || 12;
  return `${display} ${normalized < 12 ? 'AM' : 'PM'}`;
}

export function advisorMoodLabel(emoji: string): 'Great' | 'Good' | 'Okay' | 'Low' | 'Very low' {
  return MOOD_LABELS[emoji] ?? 'Okay';
}

export function createAdvisorBriefSignals(
  context: AdvisorContext,
  appleHealthSummary: AppleHealthAiSummary | null = null
): AdvisorBriefSignal[] {
  const signals: AdvisorBriefSignal[] = [];
  const now = new Date(context.nowIso);
  const safeNow = Number.isFinite(now.getTime()) ? now : new Date(0);

  if (context.mood) {
    signals.push({
      id: 'mood-latest',
      kind: 'mood',
      text: boundedSignal(
        `Your latest mood check-in was ${advisorMoodLabel(context.mood.emoji)}.`
      ),
    });
  }
  context.goals.slice(0, 3).forEach((goal) => {
    const timing = dayDistance(goal.dueAt, safeNow);
    if (!timing) return;
    signals.push({
      id: `deadline:${goal.id}`,
      kind: 'deadline',
      text: boundedSignal(`“${goal.title}” is ${timing}.`),
    });
  });
  context.habits.slice(0, 3).forEach((habit) => {
    const routineSlot = habit.routineSlot ?? 'anytime';
    const slot = routineSlot === 'anytime'
      ? 'Today'
      : `${routineSlot[0].toUpperCase()}${routineSlot.slice(1)}`;
    signals.push({
      id: `routine:${habit.id}`,
      kind: 'routine',
      text: boundedSignal(`${slot} routine “${habit.name}” is still open.`),
    });
    const streakCount = Math.max(0, habit.streakCount ?? 0);
    if (streakCount > 0) {
      signals.push({
        id: `streak:${habit.id}`,
        kind: 'streak',
        text: boundedSignal(`“${habit.name}” has a ${streakCount}-day streak.`),
      });
    }
  });
  if (appleHealthSummary) {
    const recent = appleHealthSummary.sevenDay;
    const parts = [
      recent.averageSleepMinutes === null
        ? null
        : `${Math.round(recent.averageSleepMinutes / 6) / 10} hours average sleep`,
      recent.averageSteps === null
        ? null
        : `${Math.round(recent.averageSteps).toLocaleString()} average steps`,
      recent.exerciseMinutes > 0
        ? `${Math.round(recent.exerciseMinutes)} exercise minutes`
        : null,
    ].filter((value): value is string => Boolean(value));
    if (parts.length > 0) {
      signals.push({
        id: 'health-seven-day',
        kind: 'health',
        text: boundedSignal(
          `Your confirmed 7-day Apple Health summary shows ${parts.join(', ')}.`
        ),
      });
    }
  }
  if (context.notifications) {
    const categories = context.notifications.enabledCategories
      .map((category) => NOTIFICATION_LABELS[category] ?? category)
      .slice(0, 4);
    signals.push({
      id: 'notifications-current',
      kind: 'notifications',
      text: boundedSignal(
        context.notifications.enabled
          ? `Notifications are on for ${categories.join(', ') || 'your selected nudges'} at ${context.notifications.reminderTimes.map(formatReminderHour).join(', ')}.`
          : 'Notifications are currently off.'
      ),
    });
  }
  return signals.slice(0, 10);
}

function stableHash(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function localDateKey(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'invalid-date';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function createAdvisorBriefFingerprint(
  context: AdvisorContext,
  recent: readonly AdvisorRecentRecommendation[],
  appleHealthSummary: AppleHealthAiSummary | null = null
): string {
  return stableHash(JSON.stringify({
    date: localDateKey(context.nowIso),
    intent: context.intent,
    lowEnergyMode: context.lowEnergyMode,
    mood: context.mood,
    goals: context.goals,
    habits: context.habits,
    health: context.health,
    habitWeek: context.habitWeek,
    habitTrend: context.habitTrend,
    checkInTrend: context.checkInTrend,
    momentumProgress: context.momentumProgress,
    momentumAvailability: context.momentumAvailability,
    notifications: context.notifications,
    sourceAvailability: context.sourceAvailability,
    feedback: recent.slice(0, 5).map((item) =>
      typeof item === 'string'
        ? { recommendationId: item, helpful: null, resolution: null }
        : {
            recommendationId: item.recommendationId,
            helpful: item.helpful ?? null,
            resolution: item.resolution ?? (item.completedAt ? 'completed' : null),
          }
    ),
    appleHealthSummary,
  }));
}
