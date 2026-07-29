export type ReminderSchedule = {
  id: string;
  user_id: string;
  label: string;
  route: string;
  timezone: string;
  days_of_week: number[];
  local_time: string | null;
  scheduled_at: string | null;
  enabled: boolean;
};

type LocalParts = {
  date: string;
  weekday: number;
  hour: number;
  minute: number;
};

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

export function localPartsAt(date: Date, timezone: string): LocalParts | null {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(date);
    const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    const weekday = WEEKDAY_INDEX[byType.weekday];
    if (weekday === undefined) return null;
    return {
      date: `${byType.year}-${byType.month}-${byType.day}`,
      weekday,
      hour: Number(byType.hour),
      minute: Number(byType.minute),
    };
  } catch {
    return null;
  }
}

function minutesFromTime(value: string): number | null {
  const match = /^(\d{2}):(\d{2})/.exec(value);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

export function reminderDeliveryKey(
  reminder: ReminderSchedule,
  now: Date,
  toleranceMinutes = 4
): string | null {
  if (!reminder.enabled) return null;
  const safeTolerance = Math.max(0, Math.floor(toleranceMinutes));

  if (reminder.scheduled_at) {
    const scheduled = new Date(reminder.scheduled_at);
    const delta = now.getTime() - scheduled.getTime();
    if (delta < 0 || delta > safeTolerance * 60_000) return null;
    return `once:${scheduled.toISOString()}`;
  }

  if (!reminder.local_time) return null;
  const scheduledMinute = minutesFromTime(reminder.local_time);
  if (scheduledMinute === null) return null;

  // Walk the actual elapsed-minute window so reminders immediately before
  // midnight and daylight-saving transitions still match the correct local day.
  for (let offset = 0; offset <= safeTolerance; offset += 1) {
    const candidate = new Date(now.getTime() - offset * 60_000);
    const local = localPartsAt(candidate, reminder.timezone);
    if (
      local &&
      reminder.days_of_week.includes(local.weekday) &&
      local.hour * 60 + local.minute === scheduledMinute
    ) {
      return `repeat:${local.date}:${reminder.local_time.slice(0, 5)}`;
    }
  }

  return null;
}
