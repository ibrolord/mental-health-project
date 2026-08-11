import {
  ACCOUNTABILITY_NUDGE_KINDS,
  ACCOUNTABILITY_PRIORITIES,
  type AccountabilityNudgeKind,
  type AccountabilityPriority,
} from './types';

export const ACCOUNTABILITY_LIMITS = {
  comment: 1_000,
  commitmentTitle: 240,
  note: 2_000,
  reward: 500,
} as const;

export class AccountabilityValidationError extends Error {
  readonly status = 400;
}

export function isAccountabilityNudgeKind(value: unknown): value is AccountabilityNudgeKind {
  return typeof value === 'string'
    && (ACCOUNTABILITY_NUDGE_KINDS as readonly string[]).includes(value);
}

export function isAccountabilityPriority(value: unknown): value is AccountabilityPriority {
  return typeof value === 'string'
    && (ACCOUNTABILITY_PRIORITIES as readonly string[]).includes(value);
}

export function isCalendarDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function requireBoundedText(value: unknown, field: string, maxLength: number): string {
  if (typeof value !== 'string') {
    throw new AccountabilityValidationError(`${field} must be text`);
  }

  const normalized = value.trim();
  if (normalized.length === 0 || normalized.length > maxLength) {
    throw new AccountabilityValidationError(`${field} must be between 1 and ${maxLength} characters`);
  }
  return normalized;
}
