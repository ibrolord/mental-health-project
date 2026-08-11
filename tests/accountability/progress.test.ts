import { describe, expect, it } from 'vitest';

import { calculateDaysShownUp } from '../../lib/accountability/progress';

describe('calculateDaysShownUp', () => {
  it('returns an empty 14-day window when there are no check-ins', () => {
    expect(calculateDaysShownUp([], '2026-08-11')).toEqual({
      daysShownUp: 0,
      windowDays: 14,
      windowStart: '2026-07-29',
      windowEnd: '2026-08-11',
    });
  });

  it('counts both inclusive window boundaries', () => {
    expect(
      calculateDaysShownUp(['2026-07-29', '2026-08-11'], '2026-08-11')
    ).toMatchObject({ daysShownUp: 2 });
  });

  it('counts unique calendar days without requiring a streak', () => {
    const dates = ['2026-08-11', '2026-08-11', '2026-08-04', '2026-07-30'];
    const original = [...dates];

    expect(calculateDaysShownUp(dates, '2026-08-11').daysShownUp).toBe(3);
    expect(dates).toEqual(original);
  });

  it('is independent of check-in ordering', () => {
    const ascending = ['2026-07-29', '2026-08-04', '2026-08-11'];

    expect(calculateDaysShownUp(ascending, '2026-08-11')).toEqual(
      calculateDaysShownUp([...ascending].reverse(), '2026-08-11')
    );
  });

  it('excludes dates before the window and after the as-of date', () => {
    expect(
      calculateDaysShownUp(
        ['2026-07-28', '2026-07-29', '2026-08-11', '2026-08-12'],
        '2026-08-11'
      ).daysShownUp
    ).toBe(2);
  });

  it('handles a window crossing leap day', () => {
    expect(calculateDaysShownUp(['2024-02-29'], '2024-03-05')).toEqual({
      daysShownUp: 1,
      windowDays: 14,
      windowStart: '2024-02-21',
      windowEnd: '2024-03-05',
    });
  });

  it.each(['2026/08/11', '2026-02-30', ''])('rejects invalid as-of date %j', (date) => {
    expect(() => calculateDaysShownUp([], date)).toThrow('Invalid asOfDate');
  });

  it.each(['2026/08/10', '2026-02-30', ''])('rejects invalid check-in date %j', (date) => {
    expect(() => calculateDaysShownUp([date], '2026-08-11')).toThrow(
      'Invalid check-in date'
    );
  });
});
