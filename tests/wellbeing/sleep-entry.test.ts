import { describe, expect, it } from 'vitest';
import {
  formatStoredSleepClock,
  parseSleepLocalDateTime,
  validSleepSequence,
} from '../../lib/wellbeing/sleep-entry';

describe('web sleep diary civil time', () => {
  it('round-trips valid input and rejects impossible calendar dates', () => {
    expect(parseSleepLocalDateTime('2026-08-05T23:00')).toMatchObject({
      iso: expect.any(String),
      timezoneOffsetMinutes: expect.any(Number),
    });
    expect(parseSleepLocalDateTime('2026-02-30T12:00')).toBeNull();
    expect(parseSleepLocalDateTime('2026-08-05T25:00')).toBeNull();
  });

  it('rejects DST gaps and folds rather than choosing an arbitrary instant', () => {
    const originalTimezone = process.env.TZ;
    process.env.TZ = 'America/Toronto';
    try {
      expect(parseSleepLocalDateTime('2026-03-08T02:30')).toBeNull();
      expect(parseSleepLocalDateTime('2026-11-01T01:30')).toBeNull();
    } finally {
      if (originalTimezone) process.env.TZ = originalTimezone;
      else delete process.env.TZ;
    }
  });

  it('uses the saved zone across an offset change and never guesses the viewer zone', () => {
    expect(formatStoredSleepClock('2026-11-01T05:30:00Z', 'America/Toronto', 240)).toBe('01:30');
    expect(formatStoredSleepClock('2026-11-01T07:30:00Z', 'America/Toronto', 240)).toBe('02:30');
    expect(formatStoredSleepClock('2026-11-01T07:30:00Z', null, null)).toBeNull();
  });

  it('checks all entered timestamps in field order even when fields are skipped', () => {
    expect(validSleepSequence([
      '2026-08-06T07:00:00Z',
      null,
      '2026-08-06T01:00:00Z',
    ])).toBe(false);
  });
});
