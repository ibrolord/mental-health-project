import { describe, expect, it } from 'vitest';
import {
  activityPlanDraftSchema,
  activityPlanSchema,
  createActivityPlan,
  createSafetyPlan,
  createSleepDiaryEntry,
  createStayingWellPlan,
  createSupportPreferences,
  orderActivityPlans,
  orderSleepDiaryEntries,
  safetyPlanSchema,
  sleepDiaryEntrySchema,
  supportPreferencesSchema,
} from '../../lib/wellbeing/recovery-tools';

function activityPlan(id: string, title: string, scheduledDate?: string) {
  return createActivityPlan({
    id,
    title,
    scheduledDate,
    steps: [{ action: 'Open the front door' }],
  });
}

function sleepEntry(id: string, date: string) {
  return createSleepDiaryEntry({
    id,
    date,
    wentToBedAt: '22:30',
    triedToSleepAt: '23:00',
    estimatedMinutesToFallAsleep: 20,
    finalWakeAt: '06:30',
    gotOutOfBedAt: '06:45',
  });
}

describe('small-step activity plans', () => {
  it('normalizes concise text and assigns stable step order and defaults', () => {
    expect(
      createActivityPlan({
        id: 'walk-1',
        title: '  Short   walk  ',
        scheduledDate: '2026-08-06',
        steps: [
          { action: ' Put on shoes ' },
          { action: ' Walk to the corner ', completed: true },
        ],
      })
    ).toEqual({
      id: 'walk-1',
      title: 'Short walk',
      scheduledDate: '2026-08-06',
      steps: [
        { action: 'Put on shoes', completed: false, order: 1 },
        { action: 'Walk to the corner', completed: true, order: 2 },
      ],
    });
  });

  it('enforces step count, duration, and unknown-field bounds', () => {
    expect(
      activityPlanDraftSchema.safeParse({ id: 'none', title: 'None', steps: [] })
        .success
    ).toBe(false);
    expect(
      activityPlanDraftSchema.safeParse({
        id: 'many',
        title: 'Too many',
        steps: Array.from({ length: 8 }, () => ({ action: 'One thing' })),
      }).success
    ).toBe(false);
    expect(
      activityPlanDraftSchema.safeParse({
        id: 'long',
        title: 'Long',
        steps: [{ action: 'One thing', estimatedMinutes: 181 }],
      }).success
    ).toBe(false);
    expect(
      activityPlanDraftSchema.safeParse({
        id: 'extra',
        title: 'Extra',
        steps: [{ action: 'One thing' }],
        recommendation: 'Do more',
      }).success
    ).toBe(false);
  });

  it('rejects persisted step order that is duplicated or non-contiguous', () => {
    expect(
      activityPlanSchema.safeParse({
        id: 'bad-order',
        title: 'Bad order',
        steps: [
          { action: 'First', completed: false, order: 1 },
          { action: 'Second', completed: false, order: 1 },
        ],
      }).success
    ).toBe(false);
  });

  it('orders dated plans first by date and leaves unscheduled plans last', () => {
    const ordered = orderActivityPlans([
      activityPlan('later', 'Later', '2026-08-09'),
      activityPlan('none', 'Unscheduled'),
      activityPlan('early-b', 'B plan', '2026-08-06'),
      activityPlan('early-a', 'A plan', '2026-08-06'),
    ]);
    expect(ordered.map((plan) => plan.id)).toEqual([
      'early-a',
      'early-b',
      'later',
      'none',
    ]);
  });
});

describe('Safety Plan and Staying Well structures', () => {
  it('creates all six Safety Plan fields with empty defaults and no inserted content', () => {
    expect(createSafetyPlan()).toEqual({
      warningSigns: [],
      internalCopingStrategies: [],
      peopleAndPlacesForDistraction: [],
      peopleToAskForHelp: [],
      professionalAndAgencyContacts: [],
      waysToMakeEnvironmentSafer: [],
    });
  });

  it('accepts user-entered Safety Plan content without adding advice or scores', () => {
    const plan = createSafetyPlan({
      warningSigns: ['I stop answering messages'],
      internalCopingStrategies: ['Listen to my saved playlist'],
      peopleToAskForHelp: [{ name: 'Sam', phone: '+1 416 555 0100' }],
    });
    expect(plan.warningSigns).toEqual(['I stop answering messages']);
    expect(plan.peopleToAskForHelp[0].name).toBe('Sam');
    expect(plan).not.toHaveProperty('riskScore');
    expect(plan).not.toHaveProperty('recommendations');
  });

  it('rejects oversized lists and fields outside the six-step structure', () => {
    expect(
      safetyPlanSchema.safeParse({
        warningSigns: Array.from({ length: 31 }, (_, index) => `Sign ${index}`),
      }).success
    ).toBe(false);
    expect(safetyPlanSchema.safeParse({ diagnosis: 'anything' }).success).toBe(
      false
    );
  });

  it('creates a complete empty Staying Well structure and normalizes its content', () => {
    expect(createStayingWellPlan()).toEqual({
      dailyActions: [],
      situationsToPrepareFor: [],
      changesIWantToNotice: [],
      responsesIChoose: [],
      peopleIWantInvolved: [],
    });
    expect(
      createStayingWellPlan({ dailyActions: ['  Eat   breakfast '] }).dailyActions
    ).toEqual(['Eat breakfast']);
  });
});

describe('factual sleep diary', () => {
  it('accepts an incomplete factual entry without inventing missing values', () => {
    expect(createSleepDiaryEntry({ id: 'partial', date: '2026-08-05' })).toEqual({
      id: 'partial',
      date: '2026-08-05',
      awakenings: [],
      naps: [],
    });
  });

  it('preserves entered times and estimates while defaulting only list fields', () => {
    expect(sleepEntry('night-1', '2026-08-05')).toEqual({
      id: 'night-1',
      date: '2026-08-05',
      wentToBedAt: '22:30',
      triedToSleepAt: '23:00',
      estimatedMinutesToFallAsleep: 20,
      awakenings: [],
      finalWakeAt: '06:30',
      gotOutOfBedAt: '06:45',
      naps: [],
    });
  });

  it('accepts a valid leap date and rejects impossible dates and times', () => {
    expect(sleepDiaryEntrySchema.safeParse(sleepEntry('leap', '2024-02-29')).success).toBe(
      true
    );
    expect(
      sleepDiaryEntrySchema.safeParse({
        ...sleepEntry('bad-date', '2026-08-05'),
        date: '2026-02-30',
      }).success
    ).toBe(false);
    expect(
      sleepDiaryEntrySchema.safeParse({
        ...sleepEntry('bad-time', '2026-08-05'),
        wentToBedAt: '24:00',
      }).success
    ).toBe(false);
  });

  it('bounds entered estimates, awakenings, and naps', () => {
    const base = sleepEntry('bounds', '2026-08-05');
    expect(
      sleepDiaryEntrySchema.safeParse({
        ...base,
        estimatedMinutesToFallAsleep: 1_441,
      }).success
    ).toBe(false);
    expect(
      sleepDiaryEntrySchema.safeParse({
        ...base,
        awakenings: Array.from({ length: 21 }, () => ({
          estimatedMinutesAwake: 5,
        })),
      }).success
    ).toBe(false);
    expect(
      sleepDiaryEntrySchema.safeParse({
        ...base,
        naps: [{ startedAt: '15:00', durationMinutes: 721 }],
      }).success
    ).toBe(false);
  });

  it('rejects inferred clinical fields and orders recent entries first', () => {
    expect(
      sleepDiaryEntrySchema.safeParse({
        ...sleepEntry('extra', '2026-08-05'),
        sleepScore: 80,
      }).success
    ).toBe(false);
    expect(
      orderSleepDiaryEntries([
        sleepEntry('older', '2026-08-01'),
        sleepEntry('same-b', '2026-08-05'),
        sleepEntry('same-a', '2026-08-05'),
      ]).map((entry) => entry.id)
    ).toEqual(['same-a', 'same-b', 'older']);
  });
});

describe('structured support preferences', () => {
  it('defaults every preference list to empty without inventing preferences', () => {
    expect(createSupportPreferences()).toEqual({
      preferredContactMethods: [],
      preferredTimes: [],
      communicationNeeds: [],
      helpfulSupport: [],
      unhelpfulSupport: [],
      practicalNeeds: [],
      peopleToInclude: [],
    });
  });

  it('validates contact methods, contacts, and list bounds', () => {
    expect(
      createSupportPreferences({
        preferredContactMethods: ['text', 'email'],
        helpfulSupport: ['Ask before offering suggestions'],
        peopleToInclude: [{ name: 'Ari', email: 'ari@example.com' }],
      }).preferredContactMethods
    ).toEqual(['text', 'email']);
    expect(
      supportPreferencesSchema.safeParse({
        preferredContactMethods: ['pager'],
      }).success
    ).toBe(false);
    expect(
      supportPreferencesSchema.safeParse({
        helpfulSupport: Array.from({ length: 31 }, () => 'Listen'),
      }).success
    ).toBe(false);
    expect(
      supportPreferencesSchema.safeParse({
        peopleToInclude: [{ name: 'Ari', email: 'not-an-email' }],
      }).success
    ).toBe(false);
  });
});
