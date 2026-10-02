import { describe, expect, it } from 'vitest';
import { automaticAdvisorFollowUpAt, createAdvisorReminderChoices } from '../../mobile/lib/advisor-cadence-core';

describe('in-app follow-up cadence', () => {
  it('waits two hours rather than immediately interrupting the step', () => {
    const now = new Date(2026, 9, 1, 10, 15);
    expect(new Date(automaticAdvisorFollowUpAt(now))).toEqual(new Date(2026, 9, 1, 12, 15));
  });

  it.each([
    [1, 0, 1, 9], [5, 0, 1, 9], [6, 0, 1, 8], [18, 59, 1, 20],
    [19, 0, 2, 9], [21, 30, 2, 9], [23, 30, 2, 9],
  ])('keeps a %i:%i start within the existing daytime check-in window', (hour, minute, day, dueHour) => {
    const now = new Date(2026, 9, 1, hour, minute);
    const due = new Date(automaticAdvisorFollowUpAt(now));
    expect(due.getDate()).toBe(day);
    expect(due.getHours()).toBe(dueHour);
    expect(due.getTime()).toBeGreaterThan(now.getTime());
  });

  it('does not add an extra day when quiet hours cross midnight or a month boundary', () => {
    const now = new Date(2026, 9, 31, 23, 30);
    expect(new Date(automaticAdvisorFollowUpAt(now))).toEqual(new Date(2026, 10, 1, 9));
    const dawn = createAdvisorReminderChoices(new Date(2026, 9, 1, 1))[0];
    expect(dawn.label).toBe('This morning');
    expect(dawn.date).toEqual(new Date(2026, 9, 1, 9));
  });
});
