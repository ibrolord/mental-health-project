import { describe, expect, it } from 'vitest';
import { buildSmartReminderPlan } from '../../mobile/lib/notification-content-core';

const NOW = new Date(2026, 7, 7, 8, 30, 0);

describe('smart local reminder content', () => {
  it('creates one-time reminders for today and future Life Planner target dates', () => {
    const plan = buildSmartReminderPlan({
      now: NOW,
      reminderTimes: [9, 14, 20],
      goals: [{
        content: 'Send the application',
        created_at: NOW.toISOString(),
        due_at: new Date(2026, 7, 7, 18).toISOString(),
        reminder_at: new Date(2026, 7, 7, 9).toISOString(),
      }],
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
      expect.objectContaining({
        title: 'Time for your daily brief',
        screen: '/advisor',
      }),
      expect.objectContaining({ screen: '/goals' }),
      expect.objectContaining({
        title: 'Daily affirmation',
        body: '“Start where you are.” — Arthur Ashe',
        screen: '/affirmations',
      }),
      expect.objectContaining({
        title: 'Your library pick',
        body: 'A library recommendation is ready. Open MHtoolkit when you are ready.',
        screen: '/library',
      }),
    ]);
    expect(plan.dueDates).toEqual([
      expect.objectContaining({
        title: 'Due today',
        body: 'A goal reminder is ready. Open MHtoolkit when you are ready.',
        screen: '/goals',
        date: new Date(2026, 7, 7, 9),
      }),
      expect.objectContaining({
        title: 'Due Aug 9',
        body: 'A plan item is due. Open MHtoolkit to review it.',
        screen: '/planner',
        date: new Date(2026, 7, 9, 9),
      }),
    ]);
    const serialized = JSON.stringify(plan.dueDates);
    expect(serialized).not.toContain('Send the application');
    expect(serialized).not.toContain('Finish my portfolio');
    expect(serialized).not.toContain('Choose three projects');
    expect(serialized).not.toContain('Atomic Habits');
  });

  it('uses the explicit future reminder time instead of a generic daily hour', () => {
    const plan = buildSmartReminderPlan({
      now: NOW,
      reminderTimes: [7, 14],
      goals: [{
        content: 'Review notes',
        created_at: NOW.toISOString(),
        due_at: new Date(2026, 7, 7, 18).toISOString(),
        reminder_at: new Date(2026, 7, 7, 14).toISOString(),
      }],
      lifePlans: [],
      libraryStates: [],
      affirmations: [],
    });

    expect(plan.dueDates).toEqual([
      expect.objectContaining({ date: new Date(2026, 7, 7, 14) }),
    ]);
  });

  it('does not invent a due reminder for a goal without one', () => {
    const plan = buildSmartReminderPlan({
      now: NOW,
      reminderTimes: [9, 14],
      goals: [{
        content: 'Unscheduled goal',
        created_at: NOW.toISOString(),
        due_at: null,
        reminder_at: null,
      }],
      lifePlans: [],
      libraryStates: [],
      affirmations: [],
    });

    expect(plan.dueDates).toEqual([]);
  });

  it('keeps planner reminders available when many goal reminders exist', () => {
    const goals = Array.from({ length: 24 }, (_, index) => ({
      content: `Goal ${index}`,
      created_at: NOW.toISOString(),
      due_at: new Date(2026, 7, 10, 18).toISOString(),
      reminder_at: new Date(2026, 7, 10, 9, index).toISOString(),
    }));
    const plan = buildSmartReminderPlan({
      now: NOW,
      reminderTimes: [9],
      goals,
      lifePlans: [{
        id: 'plan-1',
        title: 'Plan item',
        next_step: 'Continue',
        target_date: '2026-08-09',
      }],
      libraryStates: [],
      affirmations: [],
    });

    expect(plan.dueDates.some((item) => item.category === 'planReminders')).toBe(true);
    expect(plan.dueDates.filter((item) => item.category === 'goalReminders')).toHaveLength(24);
  });

  it('adds privacy-safe Advisor and routine nudges without lock-screen titles', () => {
    const plan = buildSmartReminderPlan({
      now: NOW,
      reminderTimes: [9, 14, 20],
      goals: [],
      lifePlans: [],
      libraryStates: [],
      affirmations: [],
      routines: [
        {
          id: 'habit-private',
          routine_slot: 'evening',
          streak_count: 12,
          completed_today: false,
        },
      ],
    });

    expect(plan.daily).toEqual(expect.arrayContaining([
      expect.objectContaining({ category: 'advisorNudges', screen: '/advisor' }),
      expect.objectContaining({ category: 'routineReminders', screen: '/habits' }),
    ]));
    expect(JSON.stringify(plan.daily)).not.toContain('habit-private');
    expect(JSON.stringify(plan.daily)).not.toContain('12');
  });
});
