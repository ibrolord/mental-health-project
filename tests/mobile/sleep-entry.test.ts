import { describe, expect, it } from 'vitest';
import {
  deviceTimezoneName,
  formatStoredSleepClock,
  nullableBoundedInteger,
  sleepLocalDateTimeToIso,
  timezoneOffsetForLocalDateTime,
  validSleepSequence,
} from '../../mobile/lib/sleep-entry';

describe('mobile sleep diary timeline', () => {
  it('uses the dates the user entered instead of inferring an overnight date', () => {
    const bed = sleepLocalDateTimeToIso('2026-08-05 23:00');
    const wake = sleepLocalDateTimeToIso('2026-08-06 07:00');
    expect(bed).toBeTruthy();
    expect(wake).toBeTruthy();
    expect(validSleepSequence([bed, wake])).toBe(true);
  });

  it('fails closed on invalid dates and times', () => {
    expect(sleepLocalDateTimeToIso('bad')).toBeNull();
    expect(sleepLocalDateTimeToIso('2026-08-05 25:00')).toBeNull();
    expect(sleepLocalDateTimeToIso('2026-02-30 12:00')).toBeNull();
  });

  it('rejects nonexistent and duplicated daylight-saving civil times', () => {
    const originalTimezone = process.env.TZ;
    process.env.TZ = 'America/Toronto';
    try {
      expect(sleepLocalDateTimeToIso('2026-03-08 02:30')).toBeNull();
      expect(sleepLocalDateTimeToIso('2026-11-01 01:30')).toBeNull();
    } finally {
      if (originalTimezone) process.env.TZ = originalTimezone;
      else delete process.env.TZ;
    }
  });

  it('renders each instant using the saved IANA timezone', () => {
    expect(
      formatStoredSleepClock(
        '2026-11-01T05:30:00.000Z',
        'America/Toronto',
        240
      )
    ).toBe('01:30');
    expect(
      formatStoredSleepClock(
        '2026-11-01T07:30:00.000Z',
        'America/Toronto',
        240
      )
    ).toBe('02:30');
    expect(formatStoredSleepClock('2026-08-05T23:00:00.000Z', null, null)).toBeNull();
    expect(deviceTimezoneName()).toMatch(/^(UTC|GMT|[^/]+\/.+)$/);
  });

  it('derives the timezone offset from the recorded local date', () => {
    expect(timezoneOffsetForLocalDateTime('2026-08-05 23:00')).toBe(
      new Date('2026-08-05T23:00:00').getTimezoneOffset()
    );
  });

  it('validates the complete factual sequence across midnight', () => {
    const values = [
      sleepLocalDateTimeToIso('2026-08-05 22:45'),
      sleepLocalDateTimeToIso('2026-08-05 23:00'),
      sleepLocalDateTimeToIso('2026-08-06 00:15'),
      sleepLocalDateTimeToIso('2026-08-06 07:00'),
      sleepLocalDateTimeToIso('2026-08-06 07:20'),
    ];
    expect(validSleepSequence(values)).toBe(true);
    expect(validSleepSequence([values[0], values[3], values[1]])).toBe(false);
  });

  it('keeps unanswered numeric fields null and rejects malformed values', () => {
    expect(nullableBoundedInteger('', 50)).toBeNull();
    expect(nullableBoundedInteger('0', 50)).toBe(0);
    expect(nullableBoundedInteger('51', 50)).toBeNull();
    expect(nullableBoundedInteger('1.5', 50)).toBeNull();
  });
});
