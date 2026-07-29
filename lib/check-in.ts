export interface LocalCheckInFields {
  local_date: string;
  utc_offset_minutes: number;
}

export interface TimestampedCheckIn {
  created_at: string;
}

export function getLocalCheckInFields(date = new Date()): LocalCheckInFields {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return {
    local_date: `${year}-${month}-${day}`,
    utc_offset_minutes: -date.getTimezoneOffset(),
  };
}

export function getSevenDayHistoryStart(now = new Date()): string {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - 6);
  return start.toISOString();
}

export function getLatestCheckInForDate<T extends TimestampedCheckIn>(
  entries: T[],
  date: Date
): T | undefined {
  const localDate = getLocalCheckInFields(date).local_date;

  return entries.reduce<T | undefined>((latest, entry) => {
    const entryDate = new Date(entry.created_at);
    if (
      Number.isNaN(entryDate.getTime()) ||
      getLocalCheckInFields(entryDate).local_date !== localDate
    ) {
      return latest;
    }

    if (!latest) return entry;
    return entryDate.getTime() > new Date(latest.created_at).getTime()
      ? entry
      : latest;
  }, undefined);
}
