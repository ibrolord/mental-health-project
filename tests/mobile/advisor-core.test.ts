import { describe, expect, it } from 'vitest';
import {
  createAdvisorHealthFeatures,
  createAdvisorContextSnapshot,
  createAdvisorRecommendation,
  type AdvisorContext,
} from '../../mobile/lib/advisor-core';
import { buildAppleHealthSnapshot } from '../../mobile/lib/apple-health-core';

function context(overrides: Partial<AdvisorContext> = {}): AdvisorContext {
  return {
    nowIso: '2026-08-13T12:00:00.000Z',
    mood: null,
    goals: [],
    habits: [],
    health: null,
    ...overrides,
  };
}

describe('mobile Advisor recommendation engine', () => {
  it('returns the same recommendation for identical input', () => {
    const input = context({
      goals: [{ id: 'goal-1', title: 'Finish application', dueAt: null }],
    });
    expect(createAdvisorRecommendation(input)).toEqual(
      createAdvisorRecommendation(input)
    );
  });

  it('makes an existing goal smaller after a low check-in without inferring a crisis', () => {
    const result = createAdvisorRecommendation(
      context({
        mood: { emoji: '😞', localDate: '2026-08-13' },
        goals: [{ id: 'goal-1', title: 'Finish application', dueAt: null }],
      })
    );
    expect(result.id).toBe('low-goal:goal-1');
    expect(result.action).toContain('two minutes');
    expect(result.sourceLabels).toEqual(['Mood check-in', 'Goal']);
    expect(JSON.stringify(result)).not.toMatch(/diagnos|depress|emergency|caused/i);
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

  it('prefers an incomplete habit and never exposes streak language', () => {
    const result = createAdvisorRecommendation(
      context({
        mood: { emoji: '🙂', localDate: '2026-08-13' },
        habits: [
          { id: 'done', name: 'Read', tinyStep: 'Read one page', completedToday: true },
          { id: 'open', name: 'Stretch', tinyStep: 'Stretch for one minute', completedToday: false },
        ],
      })
    );
    expect(result.id).toBe('habit:open');
    expect(result.action).toBe('Open your selected habit and do its smallest version once.');
    expect(JSON.stringify(result)).not.toContain('Stretch for one minute');
    expect(JSON.stringify(result)).not.toMatch(/streak|missed|behind/i);
  });

  it('keeps missing Health metrics missing instead of treating them as zero', () => {
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
    const features = createAdvisorHealthFeatures(snapshot);
    expect(features.sleepMinutes.recentAverage).toBeNull();
    expect(features.sleepMinutes.recentCoverageDays).toBe(0);
    expect(features.steps.recentAverage).toBe(4200);
  });

  it('uses a stable generic fallback with no data', () => {
    expect(createAdvisorRecommendation(context())).toMatchObject({
      id: 'check-in',
      route: '/(tabs)/tracker',
    });
  });

  it('does not claim Health influenced a next step when it did not', () => {
    const result = createAdvisorRecommendation(
      context({
        health: {
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
        },
      })
    );
    expect(result.id).toBe('check-in');
    expect(result.sourceLabels).toEqual([]);
  });

  it('does not change an action based on lower Health averages', () => {
    const base = context({
      goals: [{ id: 'goal-1', title: 'Finish application', dueAt: null }],
    });
    const withHealth = context({
      goals: base.goals,
      health: {
        sleepMinutes: { recentAverage: 240, baselineAverage: 480, recentCoverageDays: 7, baselineCoverageDays: 14 },
        steps: { recentAverage: 1000, baselineAverage: 8000, recentCoverageDays: 7, baselineCoverageDays: 14 },
      },
    });
    expect(createAdvisorRecommendation(withHealth).action).toBe(
      createAdvisorRecommendation(base).action
    );
  });

  it('routes unsafe user-authored action fragments to support without echoing them', () => {
    const result = createAdvisorRecommendation(
      context({ goals: [{ id: 'goal-1', title: 'overdose tonight', dueAt: null }] })
    );
    expect(result).toMatchObject({
      id: 'safety-support',
      kind: 'safety',
      route: '/resources',
    });
    expect(JSON.stringify(result)).not.toContain('overdose tonight');
  });

  it.each([
    'die tonight',
    'end my life',
    'cut myself',
    'kill myself',
    'take all my pills',
    'shoot someone',
  ])('fails closed for unsafe selected item text: %s', (unsafeText) => {
    const result = createAdvisorRecommendation(
      context({ habits: [{ id: 'habit-1', name: 'Routine', tinyStep: unsafeText, completedToday: false }] })
    );
    expect(result).toMatchObject({ kind: 'safety', route: '/resources' });
    expect(JSON.stringify(result)).not.toContain(unsafeText);
  });

  it('never copies user-authored goal or habit text into an executable action', () => {
    const goalText = 'Call the landlord about the leaking sink';
    const habitStep = 'Walk around the block twice';
    const goal = createAdvisorRecommendation(
      context({ goals: [{ id: 'goal-1', title: goalText, dueAt: null }] })
    );
    const habit = createAdvisorRecommendation(
      context({ habits: [{ id: 'habit-1', name: 'Walk', tinyStep: habitStep, completedToday: false }] })
    );
    expect(`${goal.action} ${goal.smallerAction}`).not.toContain(goalText);
    expect(`${habit.action} ${habit.smallerAction}`).not.toContain(habitStep);
  });

  it('freezes the exact deterministic goal and habit shown during review', () => {
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
});
