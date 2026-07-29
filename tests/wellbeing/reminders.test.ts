import { describe, expect, it } from 'vitest';
import {
  localPartsAt,
  reminderDeliveryKey,
  type ReminderSchedule,
} from '../../lib/wellbeing/reminders';

const recurring: ReminderSchedule = {
  id: 'reminder',
  user_id: 'user',
  label: 'Review',
  route: '/planner',
  timezone: 'America/Toronto',
  days_of_week: [1],
  local_time: '09:00',
  scheduled_at: null,
  enabled: true,
};

describe('reminder scheduling', () => {
  it('converts an instant into the requested local timezone', () => {
    expect(localPartsAt(new Date('2026-07-20T13:00:00.000Z'), 'America/Toronto')).toEqual({
      date: '2026-07-20',
      weekday: 1,
      hour: 9,
      minute: 0,
    });
  });

  it('claims one stable key inside the delivery window', () => {
    expect(
      reminderDeliveryKey(
        recurring,
        new Date('2026-07-20T13:03:00.000Z'),
        4
      )
    ).toBe('repeat:2026-07-20:09:00');
  });

  it('does not claim before the time, after tolerance, or on the wrong day', () => {
    expect(
      reminderDeliveryKey(recurring, new Date('2026-07-20T12:59:00.000Z'), 4)
    ).toBeNull();
    expect(
      reminderDeliveryKey(recurring, new Date('2026-07-20T13:05:00.000Z'), 4)
    ).toBeNull();
    expect(
      reminderDeliveryKey(recurring, new Date('2026-07-21T13:00:00.000Z'), 4)
    ).toBeNull();
  });

  it('keeps the scheduled local day when the delivery window crosses midnight', () => {
    const lateMonday = {
      ...recurring,
      local_time: '23:58',
    };
    expect(
      reminderDeliveryKey(
        lateMonday,
        new Date('2026-07-21T04:03:00.000Z'),
        9
      )
    ).toBe('repeat:2026-07-20:23:58');
  });

  it('uses the scheduled instant for one-time reminders', () => {
    const oneTime = {
      ...recurring,
      local_time: null,
      scheduled_at: '2026-07-20T13:00:00.000Z',
    };
    expect(
      reminderDeliveryKey(oneTime, new Date('2026-07-20T13:02:00.000Z'), 4)
    ).toBe('once:2026-07-20T13:00:00.000Z');
    expect(
      reminderDeliveryKey(oneTime, new Date('2026-07-20T13:06:00.000Z'), 4)
    ).toBeNull();
  });

  it('fails closed for disabled reminders and invalid timezones', () => {
    expect(
      reminderDeliveryKey(
        { ...recurring, enabled: false },
        new Date('2026-07-20T13:00:00.000Z')
      )
    ).toBeNull();
    expect(localPartsAt(new Date(), 'Not/A_Timezone')).toBeNull();
  });
});
