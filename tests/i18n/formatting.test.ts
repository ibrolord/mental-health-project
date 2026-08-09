import { describe, expect, it } from 'vitest';
import { formatLocalDate, formatLocalNumber } from '../../lib/i18n/core';

describe('locale-safe formatting', () => {
  it('formats dates and numbers through explicit locale helpers', () => {
    expect(
      formatLocalDate('2026-08-08T12:00:00.000Z', 'en-CA', {
        timeZone: 'UTC',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    ).toContain('2026');
    expect(formatLocalNumber(1250.5, 'en-CA')).toContain('1,250');
  });

  it('returns an empty label instead of throwing for an invalid date', () => {
    expect(formatLocalDate('not-a-date', 'en-CA')).toBe('');
  });
});
