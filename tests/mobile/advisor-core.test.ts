import { describe, expect, it } from 'vitest';
import {
  createAdvisorContextSnapshot,
  createAdvisorHealthFeatures,
  createAdvisorRecommendation,
  getAdvisorChangeSignals,
  selectAdvisorRecommendation,
  type AdvisorContext,
  type AdvisorHealthFeatures,
} from '../../mobile/lib/advisor-core';
import { buildAppleHealthSnapshot } from '../../mobile/lib/apple-health-core';

function context(overrides: Partial<AdvisorContext> = {}): AdvisorContext {
  return {
    nowIso: '2026-08-13T12:00:00.000Z',
    mood: null,
    goals: [],
    habits: [],
    health: null,
    habitWeek: null,
    ...overrides,
  };
}

function health(overrides: Partial<AdvisorHealthFeatures> = {}): AdvisorHealthFeatures {
  return {
    sleepMinutes: {
      recentAverage: 420,
      baselineAverage: 430,
      recentCoverageDays: 5,
      baselineCoverageDays: 14,
    },
    steps: {
      recentAverage: 5000,
      baselineAverage: 5200,
      recentCoverageDays: 7,
      baselineCoverageDays: 14,
    },
    recent: {
      coverageDays: 4,
      exerciseMinutes: 120,
      mindfulMinutes: 0,
      workoutCount: 3,
      eligibleForSuggestion: true,
      availableCategoryCount: 3,
    },
    history: {
      coverageDays: 7,
      workoutCount: 12,
      stateOfMindCount: 0,
      moodOverlapDays: 0,
      moodComparison: 'Mood check-ins are not compared with Apple Health.',
    },
    ...overrides,
  };
}

describe('mobile Advisor recommendation engine', () => {
  it('keeps deterministic Advisor copy within the evidence-language boundary', () => {
    const outputs = [
      createAdvisorRecommendation(context()),
      createAdvisorRecommendation(
        context({ mood: { emoji: '😢', localDate: '2026-08-13' } })
      ),
      createAdvisorRecommendation(
        context({
          goals: [{ id: 'goal-1', title: 'Finish application', dueAt: '2026-08-13T18:00:00.000Z' }],
        })
      ),
      createAdvisorRecommendation(
        context({
          habits: [{ id: 'walk', name: 'Evening walk', tinyStep: 'Put on shoes', completedToday: false }],
          habitWeek: { habitId: 'walk', completedDays: 1, habitAgeDays: 14 },
        })
      ),
      createAdvisorRecommendation(
        context({
          health: health({
            sleepMinutes: { recentAverage: 300, baselineAverage: 480, recentCoverageDays: 7, baselineCoverageDays: 14 },
          }),
        })
      ),
    ];
    const renderedCopy = outputs
      .flatMap((output) => [
        output.action,
        output.smallerAction,
        output.resourceLabel,
        ...output.observations,
      ])
      .join(' ');

    expect(renderedCopy).not.toMatch(
      /\b(?:should|need to|risk|symptom|diagnos\w*|treat\w*|clinically|research shows|studies show|proven|healthy range|normal|deficient|disorder)\b/i
    );
  });

  it('returns the same recommendation for identical input', () => {
    const input = context({
      goals: [{ id: 'goal-1', title: 'Finish application', dueAt: null }],
    });
    const results = Array.from({ length: 100 }, () =>
      createAdvisorRecommendation(input)
    );
    expect(results.every((result) => JSON.stringify(result) === JSON.stringify(results[0]))).toBe(true);
  });

  it('suppresses recent and explicitly unhelpful recommendations when an alternative exists', () => {
    const input = context({
      goals: [{ id: 'goal-1', title: 'Finish application', dueAt: null }],
    });
    expect(
      selectAdvisorRecommendation(input, [
        {
          recommendationId: 'goal:goal-1',
          offeredAt: '2026-08-12T12:00:00.000Z',
          helpful: false,
        },
      ], { preserveToday: false }).id
    ).toBe('goal:goal-1:alternate');
  });

  it('keeps current-day low mood ahead of due goals, habits, and Health without escalating', () => {
    const result = createAdvisorRecommendation(
      context({
        mood: { emoji: '😢', localDate: '2026-08-13' },
        goals: [{ id: 'goal-1', title: 'Finish application', dueAt: '2026-08-14T12:00:00.000Z' }],
        habits: [{ id: 'habit-1', name: 'Stretch', tinyStep: 'Stand up', completedToday: false }],
        health: health(),
      })
    );
    expect(result.id).toBe('low-goal:goal-1');
    expect(result.kind).toBe('standard');
    expect(result.action).toContain('Finish application');
    expect(result.route).not.toBe('/resources');
    expect(JSON.stringify(result)).not.toMatch(/diagnos|depress|emergency|caused/i);
  });

  it('keeps manual Low Energy mode to one grounding next step', () => {
    const result = createAdvisorRecommendation(
      context({
        lowEnergyMode: true,
        goals: [{ id: 'goal-1', title: 'Finish application', dueAt: null }],
      })
    );
    expect(result).toMatchObject({
      id: 'low-energy-grounding',
      route: '/ground',
      resourceLabel: 'Start grounding',
    });
  });

  it('does not treat an older low check-in as today\'s state', () => {
    const result = createAdvisorRecommendation(
      context({
        mood: { emoji: '😞', localDate: '2026-08-10' },
        goals: [{ id: 'goal-1', title: 'Finish application', dueAt: null }],
      })
    );
    expect(result.id).toBe('goal:goal-1');
  });

  it('keeps a due-soon goal ahead of an incomplete habit and Health', () => {
    const result = createAdvisorRecommendation(
      context({
        goals: [{ id: 'goal-1', title: 'Submit taxes', dueAt: '2026-08-15T12:00:00.000Z' }],
        habits: [{ id: 'habit-1', name: 'Stretch', tinyStep: null, completedToday: false }],
        health: health(),
      })
    );
    expect(result.id).toBe('due-goal:goal-1');
    expect(result.action).toContain('Submit taxes');
  });

  it('treats an earlier time on the same local due date as due today, not overdue', () => {
    const result = createAdvisorRecommendation(
      context({
        nowIso: '2026-08-13T18:00:00.000Z',
        goals: [{ id: 'goal-1', title: 'Submit taxes', dueAt: '2026-08-13T08:00:00.000Z' }],
      })
    );

    expect(result.id).toBe('due-goal:goal-1');
    expect(result.changeSignal?.line).toContain('due today');
    expect(result.action).not.toContain('move its date');
  });

  it('keeps an incomplete habit ahead of eligible Health and uses its title and tiny step', () => {
    const result = createAdvisorRecommendation(
      context({
        habits: [
          { id: 'done', name: 'Read', tinyStep: 'Read one page', completedToday: true },
          { id: 'open', name: 'Stretch', tinyStep: 'Stretch for one minute', completedToday: false },
        ],
        health: health(),
      })
    );
    expect(result.id).toBe('habit:open');
    expect(result.action).toContain('Stretch');
    expect(result.smallerAction).toContain('Stretch for one minute');
    expect(JSON.stringify(result)).not.toMatch(/streak|missed|behind/i);
  });

  it('allows Health to influence only a generic suggestion at both coverage thresholds', () => {
    const result = createAdvisorRecommendation(context({ health: health() }));
    expect(result.id).toBe('health-wellbeing');
    expect(result.sourceLabels).toEqual(['Apple Health summary']);
    expect(JSON.stringify(result)).not.toMatch(
      /mood overlap|higher-mood|lower-mood|association|caus|because|linked|depress|anxi/i
    );
  });

  it('lets eligible Health precede an active goal that is not due soon', () => {
    const result = createAdvisorRecommendation(
      context({
        goals: [{ id: 'goal-1', title: 'Learn Spanish', dueAt: null }],
        health: health(),
      })
    );
    expect(result.id).toBe('health-wellbeing');
  });

  it.each([
    health({ recent: { ...health().recent, eligibleForSuggestion: false } }),
  ])('silently ignores Health below either coverage threshold', (insufficientHealth) => {
    const result = createAdvisorRecommendation(context({ health: insufficientHealth }));
    expect(result.id).toBe('check-in');
    expect(result.sourceLabels).not.toContain('Apple Health summary');
  });

  it('does not let an explicit Health intent override higher-priority context', () => {
    const result = createAdvisorRecommendation(
      context({
        intent: 'health-reflection',
        mood: { emoji: '😞', localDate: '2026-08-13' },
        health: health(),
      })
    );
    expect(result.id).toBe('low-grounding');
  });

  it('keeps missing Health metrics missing and never computes mood comparisons', () => {
    const snapshot = buildAppleHealthSnapshot(
      {
        steps: [{ date: new Date(2026, 7, 13, 12), value: 4200 }],
        exerciseMinutes: [],
        sleep: [],
        mindfulSessions: [],
        workouts: [],
        statesOfMind: [],
      },
      new Date(2026, 7, 13, 12),
      30
    );
    const features = createAdvisorHealthFeatures(snapshot, [
      { emoji: '😢', created_at: '2026-08-13T10:00:00.000Z' },
    ]);
    expect(features.sleepMinutes.recentAverage).toBeNull();
    expect(features.steps.recentAverage).toBe(4200);
    expect(features.history.moodOverlapDays).toBe(0);
    expect(features.history.moodComparison).toBe('Mood check-ins are not compared with Apple Health.');
  });

  it('sanitizes and bounds user-authored titles so action copy stays concise', () => {
    const longTitle = `  Apply\nfor\u0000 role ${'x'.repeat(100)}  `;
    const result = createAdvisorRecommendation(
      context({ goals: [{ id: 'goal-1', title: longTitle, dueAt: null }] })
    );
    expect(result.action).toContain('Apply for role');
    expect(result.action).not.toMatch(/[\u0000\n]/);
    const displayed = result.action.match(/“([^”]+)”/)?.[1] ?? '';
    expect(Array.from(displayed).length).toBeLessThanOrEqual(54);
    expect(Array.from(result.action).length).toBeLessThanOrEqual(120);
  });

  it.each([
    'die tonight',
    'end my life',
    'cut myself',
    'kill myself',
    'take all my pills',
    'shoot someone',
    'end\u200b my life',
    'murder someone',
    'murder\u200b someone',
  ])('fails closed for unsafe selected item text without echoing it: %s', (unsafeText) => {
    const result = createAdvisorRecommendation(
      context({ habits: [{ id: 'habit-1', name: 'Routine', tinyStep: unsafeText, completedToday: false }] })
    );
    expect(result).toMatchObject({ id: 'safety-support', kind: 'safety', route: '/resources' });
    expect(JSON.stringify(result)).not.toContain(unsafeText);
  });

  it('avoids the most recently offered recommendation when a deterministic variant exists', () => {
    const input = context({
      habits: [{ id: 'habit-1', name: 'Walk', tinyStep: null, completedToday: false }],
    });
    const first = selectAdvisorRecommendation(input, []);
    const second = selectAdvisorRecommendation(input, [first.id]);
    const repeated = selectAdvisorRecommendation(input, [first.id]);
    expect(first.id).toBe('habit:habit-1');
    expect(second.id).toBe('habit:habit-1:alternate');
    expect(repeated).toEqual(second);
  });

  it('accepts outcome objects and uses the newest offered outcome for anti-repetition', () => {
    const input = context({ goals: [{ id: 'goal-1', title: 'Apply', dueAt: null }] });
    const result = selectAdvisorRecommendation(input, [
      { recommendationId: 'goal:goal-1', offeredAt: '2026-08-12T09:00:00.000Z' },
      { recommendationId: 'unrelated', offeredAt: '2026-08-10T09:00:00.000Z' },
    ], { preserveToday: false });
    expect(result.id).toBe('goal:goal-1:alternate');
  });

  it('never diverts an unsafe item away from safety support for anti-repetition', () => {
    const input = context({ goals: [{ id: 'goal-1', title: 'overdose tonight', dueAt: null }] });
    expect(selectAdvisorRecommendation(input, ['safety-support']).id).toBe('safety-support');
  });

  it('keeps today\'s current recommendation stable until the user asks for another', () => {
    const input = context({ goals: [{ id: 'goal-1', title: 'Apply', dueAt: null }] });
    const recent = [
      { recommendationId: 'goal:goal-1', offeredAt: '2026-08-13T09:00:00.000Z' },
    ];
    expect(selectAdvisorRecommendation(input, recent).id).toBe('goal:goal-1');
    expect(
      selectAdvisorRecommendation(input, recent, { preserveToday: false }).id
    ).toBe('goal:goal-1:alternate');
  });

  it('replaces a stable same-day action when today\'s mood becomes low', () => {
    const input = context({
      mood: { emoji: '😢', localDate: '2026-08-13' },
      goals: [{ id: 'goal-1', title: 'Apply', dueAt: null }],
    });
    const recent = [
      { recommendationId: 'goal:goal-1', offeredAt: '2026-08-13T09:00:00.000Z' },
    ];
    expect(selectAdvisorRecommendation(input, recent).id).toBe('low-goal:goal-1');
  });

  it('replaces a stable same-day action when Low Energy mode is turned on', () => {
    const input = context({
      lowEnergyMode: true,
      goals: [{ id: 'goal-1', title: 'Apply', dueAt: null }],
    });
    const recent = [
      { recommendationId: 'goal:goal-1', offeredAt: '2026-08-13T09:00:00.000Z' },
    ];
    expect(selectAdvisorRecommendation(input, recent).id).toBe('low-energy-grounding');
  });

  it('falls through to a lower-priority tier when the current tier is exhausted', () => {
    const input = context({
      mood: { emoji: '😢', localDate: '2026-08-13' },
      habits: [{ id: 'walk', name: 'Walk', tinyStep: null, completedToday: false }],
    });
    expect(
      selectAdvisorRecommendation(
        input,
        ['low-grounding', 'low-grounding:alternate'],
        { preserveToday: false }
      ).id
    ).toBe('habit:walk');
  });

  it('returns a different safe action for an explicit alternate after every candidate was offered', () => {
    const input = context({
      goals: [{ id: 'goal-1', title: 'Apply', dueAt: null }],
    });
    const offered = [
      'goal:goal-1',
      'goal:goal-1:alternate',
      'check-in',
      'check-in:alternate',
    ];

    expect(
      selectAdvisorRecommendation(input, offered, {
        preserveToday: false,
        excludeRecommendationId: 'goal:goal-1',
      }).id
    ).toBe('goal:goal-1:alternate');
  });

  it('does not count State of Mind alone as eligible Advisor Health context', () => {
    const snapshot = buildAppleHealthSnapshot(
      {
        steps: [],
        exerciseMinutes: [],
        sleep: [],
        mindfulSessions: [],
        workouts: [],
        statesOfMind: Array.from({ length: 7 }, (_, index) => ({
          date: new Date(2026, 7, 7 + index, 12),
          valence: 0,
        })),
      },
      new Date(2026, 7, 13, 12),
      30
    );
    const features = createAdvisorHealthFeatures(snapshot);
    expect(features.recent.availableCategoryCount).toBe(0);
    expect(features.recent.eligibleForSuggestion).toBe(false);
  });

  it('freezes one deterministic active goal and one incomplete habit in the snapshot', () => {
    const snapshot = createAdvisorContextSnapshot(
      context({
        goals: [
          { id: 'later', title: 'Later', dueAt: null },
          { id: 'soon', title: 'Soon', dueAt: '2026-08-14T12:00:00.000Z' },
        ],
        habits: [
          { id: 'z', name: 'Done', tinyStep: null, completedToday: true },
          { id: 'b', name: 'Second', tinyStep: null, completedToday: false },
          { id: 'a', name: 'First', tinyStep: null, completedToday: false },
        ],
      })
    );
    expect(snapshot.goals.map((item) => item.id)).toEqual(['soon']);
    expect(snapshot.habits.map((item) => item.id)).toEqual(['a']);
  });

  it('returns bounded observations whose first item is the legacy observation', () => {
    const result = createAdvisorRecommendation(
      context({
        goals: [{ id: 'goal-1', title: 'Submit application', dueAt: '2026-08-14T12:00:00.000Z' }],
      })
    );

    expect(result.observations).toHaveLength(1);
    expect(result.observations[0]).toBe(result.observation);
    expect(result.observations.every((item) => Array.from(item).length <= 120)).toBe(true);
    expect(result.changeSignal).toMatchObject({
      id: 'goal-due:goal-1',
      stream: 'goal',
      direction: 'due',
      severity: 'notable',
    });
    expect(Array.from(result.changeSignal?.line ?? '')).toHaveLength(
      Array.from(result.observation).length
    );
  });

  it('uses no observations or change signal for safety and Low Energy precedence', () => {
    const safety = createAdvisorRecommendation(
      context({
        goals: [{ id: 'unsafe', title: 'end my life', dueAt: '2026-08-12T12:00:00.000Z' }],
        health: health({
          sleepMinutes: { recentAverage: 300, baselineAverage: 480, recentCoverageDays: 7, baselineCoverageDays: 14 },
        }),
      })
    );
    const lowEnergy = createAdvisorRecommendation(
      context({
        lowEnergyMode: true,
        goals: [{ id: 'due', title: 'File taxes', dueAt: '2026-08-12T12:00:00.000Z' }],
      })
    );

    expect(safety).toMatchObject({ observations: [], changeSignal: null });
    expect(lowEnergy).toMatchObject({ observations: [], changeSignal: null });
  });

  it('keeps current-day low mood first and rewrites its date as a relative day', () => {
    const result = createAdvisorRecommendation(
      context({
        mood: { emoji: '😢', localDate: '2026-08-13' },
        goals: [{ id: 'goal-1', title: 'Submit application', dueAt: '2026-08-12T12:00:00.000Z' }],
        health: health({
          sleepMinutes: { recentAverage: 300, baselineAverage: 480, recentCoverageDays: 7, baselineCoverageDays: 14 },
        }),
      })
    );

    expect(result.id).toBe('low-goal:goal-1');
    expect(result.observations).toEqual([result.observation]);
    expect(result.changeSignal).toBeNull();
    expect(result.observation).toContain('Very low today');
    expect(JSON.stringify(result)).not.toMatch(/2026-08-13|due|sleep/i);
  });

  it('gates sleep and steps changes on both coverage and delta thresholds', () => {
    const belowCoverage = createAdvisorRecommendation(
      context({
        health: health({
          sleepMinutes: { recentAverage: 300, baselineAverage: 480, recentCoverageDays: 3, baselineCoverageDays: 14 },
          steps: { recentAverage: 2000, baselineAverage: 6000, recentCoverageDays: 7, baselineCoverageDays: 6 },
        }),
      })
    );
    const atThreshold = createAdvisorRecommendation(
      context({
        health: health({
          sleepMinutes: { recentAverage: 352, baselineAverage: 400, recentCoverageDays: 4, baselineCoverageDays: 7 },
          steps: { recentAverage: 5000, baselineAverage: 5200, recentCoverageDays: 7, baselineCoverageDays: 14 },
        }),
      })
    );

    expect(belowCoverage.changeSignal).toBeNull();
    expect(belowCoverage.observations.join(' ')).not.toMatch(/sleep|moving less/i);
    expect(atThreshold.changeSignal).toMatchObject({ id: 'sleep-down', severity: 'notable' });
    expect(atThreshold.observation).toBe(
      'Your sleep is averaging about 45 minutes less than usual this week.'
    );
  });

  it('keeps simultaneous sleep and steps improvements to one Health observation', () => {
    const result = createAdvisorRecommendation(
      context({
        health: health({
          sleepMinutes: { recentAverage: 450, baselineAverage: 400, recentCoverageDays: 4, baselineCoverageDays: 7 },
          steps: { recentAverage: 7200, baselineAverage: 5000, recentCoverageDays: 4, baselineCoverageDays: 7 },
        }),
      })
    );

    expect(result.changeSignal).toBeNull();
    expect(result.observations).toEqual(['Your sleep has come back up this week.']);
    expect(result.observation).not.toMatch(/active|moving/i);
  });

  it('keeps the top change visible while pairing it with a separate action stream', () => {
    const input = context({
      habits: [
        { id: 'walk', name: 'Evening walk', tinyStep: 'Put on shoes', completedToday: false },
      ],
      health: health({
        sleepMinutes: {
          recentAverage: 300,
          baselineAverage: 480,
          recentCoverageDays: 7,
          baselineCoverageDays: 14,
        },
      }),
    });

    expect(getAdvisorChangeSignals(input).map((signal) => signal.id)).toContain(
      'sleep-down'
    );
    const result = createAdvisorRecommendation(input);
    expect(result.id).toBe('habit:walk');
    expect(result.observation).toContain('sleep');
    expect(result.observations).toEqual([
      'Your sleep is averaging about 3 hours less than usual this week.',
      '“Evening walk” is available for today.',
    ]);
    expect(result.changeSignal?.id).toBe('sleep-down');
    expect(result.sourceLabels).toEqual(['Habit', 'Apple Health summary']);
  });

  it('uses habit age rather than log count for stalled and strong week signals', () => {
    const habit = { id: 'walk', name: 'Evening walk', tinyStep: 'Put on shoes', completedToday: false };
    const stalled = createAdvisorRecommendation(
      context({
        habits: [habit],
        habitWeek: { habitId: 'walk', completedDays: 2, habitAgeDays: 30 },
      })
    );
    const strong = createAdvisorRecommendation(
      context({
        habits: [habit],
        habitWeek: { habitId: 'walk', completedDays: 5, habitAgeDays: 7 },
      })
    );

    expect(stalled.changeSignal).toMatchObject({
      id: 'habit-stalled:walk',
      direction: 'stalled',
      severity: 'notable',
    });
    expect(stalled.action).toBe('Do the smallest version of “Evening walk” once.');
    expect(stalled.smallerAction).toBe(stalled.action);
    expect(strong.changeSignal).toBeNull();
    expect(strong.observation).toBe('“Evening walk” has happened 5 of the last 7 days.');
  });

  it('ranks overdue goals above other signals and keeps rescheduling reachable', () => {
    const result = createAdvisorRecommendation(
      context({
        goals: [{ id: 'taxes', title: 'File taxes', dueAt: '2026-08-01T12:00:00.000Z' }],
        habits: [{ id: 'walk', name: 'Walk', tinyStep: null, completedToday: false }],
        habitWeek: { habitId: 'walk', completedDays: 1, habitAgeDays: 30 },
        health: health({
          sleepMinutes: { recentAverage: 300, baselineAverage: 480, recentCoverageDays: 7, baselineCoverageDays: 14 },
        }),
      })
    );

    expect(result.id).toBe('due-goal:taxes');
    expect(result.changeSignal?.id).toBe('goal-overdue:taxes');
    expect(result.observation).toBe('“File taxes” is due and the date has passed.');
    expect(result.smallerAction).toContain('Move the date');
    expect(result.observations).toEqual([result.observation]);
  });

  it('detects repeated not-helpful feedback only within one recommendation family', () => {
    const input = context({
      goals: [{ id: 'goal-1', title: 'Apply', dueAt: null }],
    });
    const repeatedFamily = selectAdvisorRecommendation(input, [
      { recommendationId: 'goal:goal-1', offeredAt: '2026-08-12T10:00:00.000Z', helpful: false },
      { recommendationId: 'goal:goal-1:alternate', offeredAt: '2026-08-11T10:00:00.000Z', helpful: false },
      { recommendationId: 'check-in', offeredAt: '2026-08-10T10:00:00.000Z', helpful: true },
    ], { preserveToday: false });
    const splitFamilies = selectAdvisorRecommendation(input, [
      { recommendationId: 'goal:goal-1', offeredAt: '2026-08-12T10:00:00.000Z', helpful: false },
      { recommendationId: 'check-in', offeredAt: '2026-08-11T10:00:00.000Z', helpful: false },
      { recommendationId: 'habit:walk', offeredAt: '2026-08-10T10:00:00.000Z', helpful: true },
    ], { preserveToday: false });

    expect(repeatedFamily.changeSignal).toBeNull();
    expect(repeatedFamily.observation).toBe(
      "The last few suggestions haven't landed, so this one is different."
    );
    expect(repeatedFamily.sourceLabels).toEqual(['Your feedback']);
    expect(splitFamilies.observation).not.toContain("haven't landed");
  });

  it('uses helpful feedback as a steadying line only for the same family', () => {
    const input = context({
      goals: [{ id: 'goal-1', title: 'Apply', dueAt: null }],
    });
    const sameFamily = selectAdvisorRecommendation(input, [
      { recommendationId: 'goal:old', offeredAt: '2026-08-10T10:00:00.000Z', helpful: true },
    ]);
    const differentFamily = selectAdvisorRecommendation(input, [
      { recommendationId: 'habit:walk', offeredAt: '2026-08-10T10:00:00.000Z', helpful: true },
    ]);
    const consumedFeedback = selectAdvisorRecommendation(input, [
      { recommendationId: 'goal:old', offeredAt: '2026-08-10T10:00:00.000Z', helpful: true },
      { recommendationId: 'goal:new', offeredAt: '2026-08-12T10:00:00.000Z', helpful: null },
    ]);

    expect(sameFamily.observations).toContain(
      'That helped last time, so this one is similar.'
    );
    expect(sameFamily.sourceLabels).toEqual(['Goal', 'Your feedback']);
    expect(differentFamily.observations).not.toContain(
      'That helped last time, so this one is similar.'
    );
    expect(consumedFeedback.observations).not.toContain(
      'That helped last time, so this one is similar.'
    );
  });

  it('keeps an explicit alternative in the same action family', () => {
    const input = context({
      goals: [
        { id: 'goal-1', title: 'Apply', dueAt: '2026-08-12T10:00:00.000Z' },
      ],
      habits: [
        { id: 'walk', name: 'Walk', tinyStep: null, completedToday: false },
      ],
    });
    const current = selectAdvisorRecommendation(input);
    const alternative = selectAdvisorRecommendation(
      input,
      [{ recommendationId: current.id, offeredAt: input.nowIso }],
      {
        preserveToday: false,
        excludeRecommendationId: current.id,
        candidateFamily: current.id.split(':')[0],
      }
    );

    expect(current.id).toBe('due-goal:goal-1');
    expect(alternative.id).toBe('due-goal:goal-1:alternate');
    expect(alternative.route).toBe('/goals');
  });

  it('keeps low-mood and Low Energy alternatives in their protected families', () => {
    const lowMood = context({
      mood: { emoji: '😢', localDate: '2026-08-13' },
    });
    const lowEnergy = context({ lowEnergyMode: true });

    expect(
      selectAdvisorRecommendation(lowMood, [], {
        preserveToday: false,
        excludeRecommendationId: 'low-grounding',
        candidateFamily: 'low-grounding',
      }).id
    ).toBe('low-grounding:alternate');
    expect(
      selectAdvisorRecommendation(lowEnergy, [], {
        preserveToday: false,
        excludeRecommendationId: 'low-energy-grounding',
        candidateFamily: 'low-energy-grounding',
      }).id
    ).toBe('low-energy-grounding:alternate');
  });

  it('drops Health category counts and bounds sanitized signal titles', () => {
    const healthResult = createAdvisorRecommendation(context({ health: health() }));
    const title = `Plan\n${'x'.repeat(100)}`;
    const goalResult = createAdvisorRecommendation(
      context({
        goals: [{ id: 'long', title, dueAt: '2026-08-14T12:00:00.000Z' }],
      })
    );

    expect(healthResult.observation).toBe(
      'Your recent Apple Health summary has enough to work with.'
    );
    expect(healthResult.observation).not.toMatch(/\b3\b|areas?/i);
    expect(goalResult.changeSignal?.line).not.toMatch(/[\n\u0000]/);
    expect(Array.from(goalResult.changeSignal?.line ?? '').length).toBeLessThanOrEqual(90);
  });

  it('stays total for malformed time, missing aggregates, and legacy outcomes', () => {
    expect(() =>
      selectAdvisorRecommendation(
        context({ nowIso: 'not-a-date', habitWeek: undefined }),
        ['legacy-id']
      )
    ).not.toThrow();
    const result = selectAdvisorRecommendation(
      context({ nowIso: 'not-a-date', habitWeek: undefined }),
      ['legacy-id']
    );
    expect(result.observations).toHaveLength(1);
    expect(result.observation).toBe(result.observations[0]);
  });

  it('returns the full active signal ledger unless state suppression applies', () => {
    const active = context({
      goals: [{ id: 'taxes', title: 'File taxes', dueAt: '2026-08-12T12:00:00.000Z' }],
      habits: [{ id: 'walk', name: 'Walk', tinyStep: null, completedToday: false }],
      habitWeek: { habitId: 'walk', completedDays: 1, habitAgeDays: 30 },
      health: health({
        sleepMinutes: {
          recentAverage: 300,
          baselineAverage: 480,
          recentCoverageDays: 7,
          baselineCoverageDays: 14,
        },
      }),
    });

    expect(getAdvisorChangeSignals(active).map((signal) => signal.id)).toEqual([
      'goal-overdue:taxes',
      'habit-stalled:walk',
      'sleep-down',
    ]);
    expect(getAdvisorChangeSignals({ ...active, lowEnergyMode: true })).toEqual([]);
    expect(
      getAdvisorChangeSignals({
        ...active,
        mood: { emoji: '😢', localDate: '2026-08-13' },
      })
    ).toEqual([]);
    expect(
      getAdvisorChangeSignals({
        ...active,
        goals: [{ id: 'unsafe', title: 'end my life', dueAt: null }],
      })
    ).toEqual([]);
  });
});
