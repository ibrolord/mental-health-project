import { describe, expect, it } from 'vitest';
import {
  accountabilityDaysForPreset,
  accountabilityPresetForDays,
} from '../../lib/wellbeing/habit-accountability';

describe('habit accountability schedule', () => {
  it('maps the supported rhythms to deterministic weekday sets', () => {
    expect(accountabilityDaysForPreset('daily', 2)).toEqual([
      0, 1, 2, 3, 4, 5, 6,
    ]);
    expect(accountabilityDaysForPreset('weekdays', 0)).toEqual([
      1, 2, 3, 4, 5,
    ]);
    expect(accountabilityDaysForPreset('weekly', 4)).toEqual([4]);
  });

  it('clamps malformed weekly values and recognizes persisted presets', () => {
    expect(accountabilityDaysForPreset('weekly', 99)).toEqual([6]);
    expect(accountabilityDaysForPreset('weekly', -10)).toEqual([0]);
    expect(accountabilityPresetForDays([5, 1, 4, 2, 3])).toBe('weekdays');
    expect(accountabilityPresetForDays([2])).toBe('weekly');
    expect(accountabilityPresetForDays([0, 2, 4])).toBe('daily');
  });
});
