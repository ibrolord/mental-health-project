const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 24 * 60 * 60 * 1000;
const WINDOW_DAYS = 14;

export interface DaysShownUpProgress {
  daysShownUp: number;
  windowDays: 14;
  windowStart: string;
  windowEnd: string;
}

function parseCalendarDate(value: string, label: string): Date {
  if (!DATE_PATTERN.test(value)) {
    throw new Error(`Invalid ${label}: expected YYYY-MM-DD`);
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new Error(`Invalid ${label}: expected a real calendar date`);
  }

  return date;
}

function formatCalendarDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function calculateDaysShownUp(
  checkInDates: readonly string[],
  asOfDate: string
): DaysShownUpProgress {
  const windowEnd = parseCalendarDate(asOfDate, 'asOfDate');
  const windowStart = new Date(windowEnd.getTime() - (WINDOW_DAYS - 1) * DAY_MS);
  const datesInWindow = new Set<string>();

  for (const checkInDate of checkInDates) {
    const parsed = parseCalendarDate(checkInDate, 'check-in date');
    if (parsed >= windowStart && parsed <= windowEnd) {
      datesInWindow.add(checkInDate);
    }
  }

  return {
    daysShownUp: datesInWindow.size,
    windowDays: WINDOW_DAYS,
    windowStart: formatCalendarDate(windowStart),
    windowEnd: asOfDate,
  };
}
