import { describe, expect, it } from 'vitest';
import {
  createActivityPlan,
  createSafetyPlan,
  createSleepDiaryEntry,
  createStayingWellPlan,
  createSupportPreferences,
} from '../../lib/wellbeing/recovery-tools';
import {
  createVisitBriefSelection,
  generateVisitBrief,
  getVisitBriefExportText,
  visitBriefSelectionSchema,
} from '../../lib/wellbeing/visit-brief';

const userEntered = <T>(value: T) => ({
  provenance: 'user-entered' as const,
  value,
});

function basicActivityPlan() {
  return createActivityPlan({
    id: 'morning-reset',
    title: 'Morning reset',
    scheduledDate: '2026-08-06',
    steps: [
      {
        action: 'Put on shoes',
        when: 'After breakfast',
        estimatedMinutes: 2,
      },
    ],
  });
}

function basicSleepEntry(id = 'night-1', date = '2026-08-05') {
  return createSleepDiaryEntry({
    id,
    date,
    wentToBedAt: '22:30',
    triedToSleepAt: '23:00',
    estimatedMinutesToFallAsleep: 20,
    awakenings: [{ awakeAt: '02:10', estimatedMinutesAwake: 10 }],
    finalWakeAt: '06:30',
    gotOutOfBedAt: '06:45',
    naps: [{ startedAt: '15:00', durationMinutes: 25 }],
  });
}

describe('Visit Brief selection and exclusion', () => {
  it('defaults every section to excluded, including safety', () => {
    expect(createVisitBriefSelection()).toEqual({
      activityPlans: false,
      stayingWellPlan: false,
      sleepDiary: false,
      supportPreferences: false,
      safetyPlan: false,
    });

    const brief = generateVisitBrief({
      source: {
        safetyPlan: userEntered(
          createSafetyPlan({ warningSigns: ['PRIVATE SAFETY DETAIL'] })
        ),
      },
    });
    expect(brief.sections).toEqual([]);
    expect(brief.preview).toBe('Visit brief');
    expect(brief.preview).not.toContain('PRIVATE SAFETY DETAIL');
  });

  it('does not validate or reveal an unselected allowed section', () => {
    const supportPreferences = createSupportPreferences({
      preferredContactMethods: ['text'],
    });
    const brief = generateVisitBrief({
      selection: { supportPreferences: true },
      source: {
        activityPlans: { malformed: 'PRIVATE ACTIVITY DETAIL' },
        safetyPlan: { malformed: 'PRIVATE SAFETY DETAIL' },
        supportPreferences: userEntered(supportPreferences),
      },
    });
    expect(brief.preview).toContain('Preferred contact methods: text');
    expect(brief.preview).not.toContain('PRIVATE ACTIVITY DETAIL');
    expect(brief.preview).not.toContain('PRIVATE SAFETY DETAIL');
  });

  it('rejects journal and chat as section or source categories', () => {
    expect(visitBriefSelectionSchema.safeParse({ journal: true }).success).toBe(
      false
    );
    expect(visitBriefSelectionSchema.safeParse({ chat: true }).success).toBe(
      false
    );
    expect(() =>
      generateVisitBrief({ source: { journal: userEntered(['private']) } })
    ).toThrow();
    expect(() =>
      generateVisitBrief({ source: { chat: userEntered(['private']) } })
    ).toThrow();
  });

  it('requires a selected section to exist and have user-entered provenance', () => {
    expect(() =>
      generateVisitBrief({ selection: { activityPlans: true } })
    ).toThrow();
    expect(() =>
      generateVisitBrief({
        selection: { activityPlans: true },
        source: {
          activityPlans: {
            provenance: 'ai-generated',
            value: [basicActivityPlan()],
          },
        },
      })
    ).toThrow();
  });

  it('rejects selected empty plan structures instead of adding filler text', () => {
    expect(() =>
      generateVisitBrief({
        selection: { stayingWellPlan: true },
        source: { stayingWellPlan: userEntered(createStayingWellPlan()) },
      })
    ).toThrow('Selected sections need user-entered content.');
    expect(() =>
      generateVisitBrief({
        selection: { safetyPlan: true },
        source: { safetyPlan: userEntered(createSafetyPlan()) },
      })
    ).toThrow('Selected sections need user-entered content.');
  });
});

describe('Visit Brief deterministic generation', () => {
  it('uses canonical section order regardless of request key order', () => {
    const brief = generateVisitBrief({
      selection: {
        safetyPlan: true,
        supportPreferences: true,
        sleepDiary: true,
        stayingWellPlan: true,
        activityPlans: true,
      },
      source: {
        safetyPlan: userEntered(
          createSafetyPlan({ warningSigns: ['I stop replying'] })
        ),
        supportPreferences: userEntered(
          createSupportPreferences({ preferredContactMethods: ['text'] })
        ),
        sleepDiary: userEntered([basicSleepEntry()]),
        stayingWellPlan: userEntered(
          createStayingWellPlan({ dailyActions: ['Eat breakfast'] })
        ),
        activityPlans: userEntered([basicActivityPlan()]),
      },
    });
    expect(brief.sections.map((section) => section.id)).toEqual([
      'activityPlans',
      'stayingWellPlan',
      'sleepDiary',
      'supportPreferences',
      'safetyPlan',
    ]);
  });

  it('produces an exact preview and returns that same text for export', () => {
    const brief = generateVisitBrief({
      selection: {
        supportPreferences: true,
        activityPlans: true,
      },
      source: {
        supportPreferences: userEntered(
          createSupportPreferences({
            preferredContactMethods: ['text'],
            helpfulSupport: ['Ask before offering suggestions'],
          })
        ),
        activityPlans: userEntered([basicActivityPlan()]),
      },
    });
    const expected = [
      'Visit brief',
      '',
      '[Activity plans]',
      'Plan: Morning reset | date: 2026-08-06',
      'Step 1: Put on shoes | when: After breakfast | estimated minutes: 2',
      '',
      '[Support preferences]',
      'Preferred contact methods: text',
      'Helpful support: Ask before offering suggestions',
    ].join('\n');
    expect(brief.preview).toBe(expected);
    expect(getVisitBriefExportText(brief)).toBe(expected);
  });

  it('orders activity plans by date and sleep entries most-recent first', () => {
    const laterPlan = createActivityPlan({
      id: 'later',
      title: 'Later plan',
      scheduledDate: '2026-08-09',
      steps: [{ action: 'Later step' }],
    });
    const brief = generateVisitBrief({
      selection: { activityPlans: true, sleepDiary: true },
      source: {
        activityPlans: userEntered([laterPlan, basicActivityPlan()]),
        sleepDiary: userEntered([
          basicSleepEntry('older', '2026-08-01'),
          basicSleepEntry('newer', '2026-08-05'),
        ]),
      },
    });
    expect(brief.preview.indexOf('Morning reset')).toBeLessThan(
      brief.preview.indexOf('Later plan')
    );
    expect(brief.preview.indexOf('2026-08-05:')).toBeLessThan(
      brief.preview.indexOf('2026-08-01:')
    );
  });

  it('renders the six Safety Plan fields only after explicit opt-in', () => {
    const brief = generateVisitBrief({
      selection: { safetyPlan: true },
      source: {
        safetyPlan: userEntered(
          createSafetyPlan({
            warningSigns: ['I stop replying'],
            internalCopingStrategies: ['Use my saved playlist'],
            peopleAndPlacesForDistraction: ['Community centre'],
            peopleToAskForHelp: [{ name: 'Alex', relationship: 'friend' }],
            professionalAndAgencyContacts: [
              { name: 'Clinic desk', phone: '4165550100' },
            ],
            waysToMakeEnvironmentSafer: ['Give spare keys to Alex'],
          })
        ),
      },
    });
    expect(brief.preview).toContain('1. Warning signs: I stop replying');
    expect(brief.preview).toContain(
      '2. Internal coping strategies: Use my saved playlist'
    );
    expect(brief.preview).toContain(
      '3. People and places for distraction: Community centre'
    );
    expect(brief.preview).toContain(
      '4. People to ask for help: Alex (relationship: friend)'
    );
    expect(brief.preview).toContain(
      '5. Professional and agency contacts: Clinic desk (phone: 4165550100)'
    );
    expect(brief.preview).toContain(
      '6. Ways to make the environment safer: Give spare keys to Alex'
    );
  });

  it('keeps factual sleep entries concise without scores or interpretation', () => {
    const brief = generateVisitBrief({
      selection: { sleepDiary: true },
      source: { sleepDiary: userEntered([basicSleepEntry()]) },
    });
    expect(brief.preview).toContain(
      '2026-08-05: went to bed 22:30; tried to sleep 23:00; estimated minutes to fall asleep 20; final wake 06:30; got out of bed 06:45'
    );
    expect(brief.preview).toContain(
      'Awakenings: 02:10, estimated minutes awake 10'
    );
    expect(brief.preview).toContain('Naps: 15:00, duration minutes 25');
    expect(brief.preview).not.toMatch(/diagnosis|risk|score|recommend|advice/i);
    expect(brief.preview.split('\n').filter(Boolean)).toHaveLength(5);
  });

  it('labels missing sleep facts and preserves full contact details', () => {
    const brief = generateVisitBrief({
      selection: { sleepDiary: true, safetyPlan: true },
      source: {
        sleepDiary: userEntered([
          createSleepDiaryEntry({ id: 'partial', date: '2026-08-05' }),
        ]),
        safetyPlan: userEntered(
          createSafetyPlan({
            professionalAndAgencyContacts: [
              { name: 'Clinic', details: 'Ask for the after-hours duty clinician.' },
            ],
          })
        ),
      },
    });
    expect(brief.preview).toContain('went to bed not entered');
    expect(brief.preview).toContain('estimated minutes to fall asleep not entered');
    expect(brief.preview).toContain(
      'Clinic (details: Ask for the after-hours duty clinician.)'
    );
  });

  it('returns immutable section and line collections', () => {
    const brief = generateVisitBrief({
      selection: { activityPlans: true },
      source: { activityPlans: userEntered([basicActivityPlan()]) },
    });
    expect(Object.isFrozen(brief)).toBe(true);
    expect(Object.isFrozen(brief.sections)).toBe(true);
    expect(Object.isFrozen(brief.sections[0])).toBe(true);
    expect(Object.isFrozen(brief.sections[0].lines)).toBe(true);
  });
});
