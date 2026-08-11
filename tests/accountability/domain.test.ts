import { describe, expect, it } from 'vitest';

import {
  isAccountabilityNudgeKind,
  isAccountabilityPriority,
  isCalendarDate,
  AccountabilityValidationError,
  requireBoundedText,
} from '../../lib/accountability/domain';

describe('accountability domain validation', () => {
  it.each(['encouragement', 'gentle_reminder', 'celebrate_progress'])(
    'accepts fixed nudge kind %s',
    (kind) => expect(isAccountabilityNudgeKind(kind)).toBe(true)
  );

  it.each(['custom text', '', null])('rejects free-form nudge kind %j', (kind) => {
    expect(isAccountabilityNudgeKind(kind)).toBe(false);
  });

  it.each(['high', 'medium', 'low'])('accepts priority %s', (priority) => {
    expect(isAccountabilityPriority(priority)).toBe(true);
  });

  it('validates real calendar dates rather than shape alone', () => {
    expect(isCalendarDate('2026-08-11')).toBe(true);
    expect(isCalendarDate('2026-02-30')).toBe(false);
  });

  it('trims bounded text', () => {
    expect(requireBoundedText('  show up  ', 'title', 20)).toBe('show up');
  });

  it.each(['', '   ', 'too long'])('rejects invalid bounded text %j', (value) => {
    expect(() => requireBoundedText(value, 'title', 4)).toThrow(/title/);
  });

  it('marks bounded-text failures as client validation errors', () => {
    try {
      requireBoundedText('', 'title', 4);
    } catch (error) {
      expect(error).toBeInstanceOf(AccountabilityValidationError);
      expect((error as AccountabilityValidationError).status).toBe(400);
    }
  });
});
