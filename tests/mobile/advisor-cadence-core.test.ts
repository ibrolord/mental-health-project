import { describe, expect, it } from 'vitest';
import {
  advisorCadenceLabel,
  advisorDayPart,
  createAdvisorReminderChoices,
} from '../../mobile/lib/advisor-cadence-core';

describe('Advisor cadence', () => {
  it('uses calm day-part copy and keeps an active step stable', () => {
    const morning = new Date(2026, 7, 15, 9, 0);
    const afternoon = new Date(2026, 7, 15, 14, 0);
    const evening = new Date(2026, 7, 15, 19, 0);

    expect(advisorDayPart(morning)).toBe('morning');
    expect(advisorDayPart(afternoon)).toBe('afternoon');
    expect(advisorDayPart(evening)).toBe('evening');
    expect(advisorCadenceLabel(morning, false)).toContain('morning');
    expect(advisorCadenceLabel(morning, true)).toContain('stays here');
  });

  it('offers explicit reminders without scheduling inside quiet hours', () => {
    const choices = createAdvisorReminderChoices(new Date(2026, 7, 15, 20, 30));

    expect(choices.map((choice) => choice.id)).toEqual(['later', 'evening']);
    expect(choices.every((choice) => choice.date.getTime() > new Date(2026, 7, 15, 20, 30).getTime())).toBe(true);
    expect(choices.every((choice) => choice.date.getHours() >= 8 && choice.date.getHours() < 21)).toBe(true);
    expect(choices[0].date.getHours()).toBe(9);
    expect(choices[0].date.getDate()).toBe(16);
    expect(choices[0].label).toBe('Tomorrow morning');
    expect(choices[1].label).toBe('Tomorrow evening');
    expect(new Set(choices.map((choice) => choice.date.getTime())).size).toBe(
      choices.length
    );
  });
});
