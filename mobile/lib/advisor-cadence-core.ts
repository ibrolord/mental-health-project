export type AdvisorDayPart = 'morning' | 'afternoon' | 'evening';

export type AdvisorReminderChoice = {
  id: 'later' | 'evening' | 'tomorrow';
  label: string;
  date: Date;
};

export function advisorDayPart(now: Date): AdvisorDayPart {
  const hour = now.getHours();
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'evening';
}

export function advisorCadenceLabel(
  now: Date,
  hasActiveAction: boolean
): string {
  if (hasActiveAction) return 'Your current step stays here until you finish or change it.';
  const part = advisorDayPart(now);
  if (part === 'morning') return 'A clear next step for this morning.';
  if (part === 'afternoon') return 'A practical next step for this afternoon.';
  return 'A lighter next step for this evening.';
}

function atLocalHour(base: Date, dayOffset: number, hour: number): Date {
  const date = new Date(base);
  date.setDate(date.getDate() + dayOffset);
  date.setHours(hour, 0, 0, 0);
  return date;
}

export function createAdvisorReminderChoices(now: Date): AdvisorReminderChoice[] {
  const later = new Date(now.getTime() + 2 * 60 * 60 * 1000);
  let laterLabel = 'In 2 hours';
  if (later.getHours() >= 21 || later.getHours() < 8) {
    later.setTime(atLocalHour(now, 1, 9).getTime());
    laterLabel = 'Tomorrow morning';
  }

  const eveningToday = atLocalHour(now, 0, 19);
  const evening = eveningToday.getTime() > now.getTime() + 30 * 60 * 1000
    ? eveningToday
    : atLocalHour(now, 1, 19);
  const eveningLabel = evening.getDate() === now.getDate()
    ? 'This evening'
    : 'Tomorrow evening';

  const candidates: AdvisorReminderChoice[] = [
    { id: 'later', label: laterLabel, date: later },
    { id: 'evening', label: eveningLabel, date: evening },
    { id: 'tomorrow', label: 'Tomorrow morning', date: atLocalHour(now, 1, 9) },
  ];
  const seen = new Set<number>();
  return candidates.filter((choice) => {
    const timestamp = choice.date.getTime();
    if (seen.has(timestamp)) return false;
    seen.add(timestamp);
    return true;
  });
}
