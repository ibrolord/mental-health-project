const LOCAL_DATE_TIME = /^(\d{4})-(\d{2})-(\d{2})[ T]((?:[01]\d|2[0-3])):([0-5]\d)$/;

type LocalParts = { year: number; month: number; day: number; hour: number; minute: number };

function sameLocalParts(date: Date, parts: LocalParts): boolean {
  return date.getFullYear() === parts.year && date.getMonth() === parts.month - 1 &&
    date.getDate() === parts.day && date.getHours() === parts.hour && date.getMinutes() === parts.minute;
}

function isAmbiguousLocalTime(date: Date, parts: LocalParts): boolean {
  for (let delta = -180; delta <= 180; delta += 15) {
    if (delta === 0) continue;
    const alternative = new Date(date.getTime() + delta * 60_000);
    if (alternative.getTimezoneOffset() !== date.getTimezoneOffset() && sameLocalParts(alternative, parts)) return true;
  }
  return false;
}

export function sleepLocalDateTimeToIso(value: string): string | null {
  if (!value.trim()) return null;
  const match = LOCAL_DATE_TIME.exec(value.trim());
  if (!match) return null;
  const parts: LocalParts = { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]), hour: Number(match[4]), minute: Number(match[5]) };
  const date = new Date(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, 0, 0);
  if (!sameLocalParts(date, parts) || isAmbiguousLocalTime(date, parts)) return null;
  return date.toISOString();
}

export function deviceTimezoneName(): string | null {
  try {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!timeZone || timeZone.length > 100) return null;
    new Intl.DateTimeFormat('en-CA', { timeZone }).format(new Date(0));
    return timeZone;
  } catch {
    return null;
  }
}

export function formatStoredSleepClock(value: string, timezoneName: string | null, timezoneOffsetMinutes: number | null): string | null {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  if (timezoneName) {
    try {
      const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezoneName, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(date);
      const hour = parts.find((part) => part.type === 'hour')?.value;
      const minute = parts.find((part) => part.type === 'minute')?.value;
      if (hour && minute) return `${hour}:${minute}`;
    } catch {
      // Fall back to the captured numeric offset for older rows.
    }
  }
  if (timezoneOffsetMinutes === null || !Number.isInteger(timezoneOffsetMinutes) || timezoneOffsetMinutes < -840 || timezoneOffsetMinutes > 840) return null;
  const captured = new Date(date.getTime() - timezoneOffsetMinutes * 60_000);
  return `${String(captured.getUTCHours()).padStart(2, '0')}:${String(captured.getUTCMinutes()).padStart(2, '0')}`;
}

export function timezoneOffsetForLocalDateTime(value: string): number | null {
  const iso = sleepLocalDateTimeToIso(value);
  return iso ? new Date(iso).getTimezoneOffset() : null;
}

export function nullableBoundedInteger(value: string, max: number): number | null {
  if (!value.trim()) return null;
  if (!/^\d+$/.test(value.trim())) return null;
  const parsed = Number.parseInt(value, 10);
  return parsed >= 0 && parsed <= max ? parsed : null;
}

export function validSleepTimeline(bedtime: string | null, wakeTime: string | null): boolean {
  return !bedtime || !wakeTime || Date.parse(wakeTime) >= Date.parse(bedtime);
}

export function validSleepSequence(values: (string | null)[]): boolean {
  const entered = values.filter((value): value is string => Boolean(value));
  return entered.every((value, index) => {
    if (!Number.isFinite(Date.parse(value))) return false;
    return index === 0 || Date.parse(value) >= Date.parse(entered[index - 1]);
  });
}
