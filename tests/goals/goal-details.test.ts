import { describe, expect, it } from 'vitest';
import {
  goalAttachmentPath,
  inferReminderPreset,
  reminderForPreset,
  safeAttachmentName,
  validateGoalAttachment,
} from '../../lib/goals/details';

describe('goal detail helpers', () => {
  it('derives privacy-safe reminder timestamps from the due time', () => {
    const dueAt = '2026-08-12T18:00:00.000Z';
    expect(reminderForPreset(dueAt, 'day-before')).toBe('2026-08-11T18:00:00.000Z');
    expect(reminderForPreset(dueAt, 'hour-before')).toBe('2026-08-12T17:00:00.000Z');
    expect(reminderForPreset(dueAt, 'at-time')).toBe(dueAt);
    expect(reminderForPreset(dueAt, 'off')).toBeNull();
    expect(inferReminderPreset(dueAt, '2026-08-11T18:00:00.000Z')).toBe('day-before');
  });

  it('keeps a day-before reminder at the same local time across daylight saving', () => {
    const previousTimezone = process.env.TZ;
    process.env.TZ = 'America/Toronto';

    try {
      const dueAt = '2026-11-01T09:00:00-05:00';
      const reminderAt = reminderForPreset(dueAt, 'day-before');

      expect(reminderAt).toBe('2026-10-31T13:00:00.000Z');
      expect(inferReminderPreset(dueAt, reminderAt)).toBe('day-before');
    } finally {
      if (previousTimezone === undefined) delete process.env.TZ;
      else process.env.TZ = previousTimezone;
    }
  });

  it('keeps storage paths inside the authenticated user folder', () => {
    expect(safeAttachmentName('../../Plan draft (final).pdf')).toBe('Plan-draft-final.pdf');
    expect(goalAttachmentPath('user-1', 'goal-1', 'Plan draft.pdf', 'file-1')).toBe(
      'user-1/goal-1/file-1-Plan-draft.pdf'
    );
  });

  it('rejects oversized and unsupported files', () => {
    expect(validateGoalAttachment({ name: 'plan.pdf', type: 'application/pdf', size: 1024 })).toBeNull();
    expect(validateGoalAttachment({ name: 'clip.mp4', type: 'video/mp4', size: 1024 })).toContain('PDF');
    expect(validateGoalAttachment({ name: 'large.pdf', type: 'application/pdf', size: 7 * 1024 * 1024 })).toContain('6 MB');
  });
});
