export type AccountabilityPreset = 'daily' | 'weekdays' | 'weekly';

export const DAILY_ACCOUNTABILITY_DAYS = [0, 1, 2, 3, 4, 5, 6] as const;
export const WEEKDAY_ACCOUNTABILITY_DAYS = [1, 2, 3, 4, 5] as const;

export function accountabilityPresetForDays(
  days: number[]
): AccountabilityPreset {
  if (days.length === 1) return 'weekly';
  const normalized = [...new Set(days)].sort((a, b) => a - b);
  return normalized.join(',') === WEEKDAY_ACCOUNTABILITY_DAYS.join(',')
    ? 'weekdays'
    : 'daily';
}

export function accountabilityDaysForPreset(
  preset: AccountabilityPreset,
  weekday: number
): number[] {
  if (preset === 'weekdays') return [...WEEKDAY_ACCOUNTABILITY_DAYS];
  if (preset === 'weekly') {
    return [Math.max(0, Math.min(6, Math.trunc(weekday)))];
  }
  return [...DAILY_ACCOUNTABILITY_DAYS];
}
