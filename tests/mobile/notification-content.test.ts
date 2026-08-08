import { describe, expect, it } from 'vitest';
import { buildSmartReminderPlan } from '../../mobile/lib/notification-content-core';

const NOW = new Date(2026, 7, 7, 8, 30, 0);

describe('smart local reminder content', () => {
  it('creates one-time reminders for today and future Life Planner target dates', () => {
    const plan = buildSmartReminderPlan({
      now: NOW,
      reminderTimes: [9, 14, 20],
      goals: [{ content: 'Send the application', created_at: NOW.toISOString() }],
      lifePlans: [
        {
          id: 'plan-1',
          title: 'Finish my portfolio',
          next_step: 'Choose three projects',
          target_date: '2026-08-09',
        },
        {
          id: 'past-plan',
          title: 'Past target',
          next_step: '',
          target_date: '2026-08-06',
        },
      ],
      libraryStates: [
        { content_id: 'atomic-habits', is_saved: true, priority: 'next' },
      ],
      affirmations: [
        {
          id: 'affirmation-1',
          content: 'Start where you are.',
          category: 'growth',
          kind: 'quote',
          attribution_name: 'Arthur Ashe',
          source_title: 'Speech',
          source_url: 'https://example.com',
        },
      ],
    });

    expect(plan.daily).toEqual([
      expect.objectContaining({ screen: '/goals' }),
      expect.objectContaining({
        title: 'Daily affirmation',
        body: '“Start where you are.” — Arthur Ashe',
        screen: '/affirmations',
      }),
      expect.objectContaining({
        title: 'Your library pick',
        body: expect.stringContaining('Atomic Habits'),
        screen: '/library',
      }),
    ]);
    expect(plan.dueDates).toEqual([
      expect.objectContaining({
        title: 'Due today',
        body: 'Send the application',
        screen: '/goals',
        date: new Date(2026, 7, 7, 9),
      }),
      expect.objectContaining({
        title: 'Due Aug 9',
        body: 'Finish my portfolio · Next: Choose three projects',
        screen: '/planner',
        date: new Date(2026, 7, 9, 9),
      }),
    ]);
  });

  it('uses only future device times for a due-today notification', () => {
    const plan = buildSmartReminderPlan({
      now: NOW,
      reminderTimes: [7, 14],
      goals: [{ content: 'Review notes', created_at: NOW.toISOString() }],
      lifePlans: [],
      libraryStates: [],
      affirmations: [],
    });

    expect(plan.dueDates).toEqual([
      expect.objectContaining({ date: new Date(2026, 7, 7, 14) }),
    ]);
  });
});
