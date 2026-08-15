import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AdvisorRecommendation } from '../../mobile/lib/advisor-core';

const { apiRequest } = vi.hoisted(() => ({ apiRequest: vi.fn() }));

vi.mock('../../mobile/lib/api', () => ({ apiRequest }));

import {
  ADVISOR_MODEL_TIMEOUT_MS,
  requestModelAdvisorRecommendation,
} from '../../mobile/lib/advisor-ai';
import {
  createAdvisorBriefFingerprint,
  createAdvisorBriefSignals,
} from '../../mobile/lib/advisor-brief-core';
import type { AdvisorContext } from '../../mobile/lib/advisor-core';
import type { AppleHealthAiSummary } from '../../mobile/lib/apple-health-core';

const context: AdvisorContext = {
  nowIso: '2026-08-14T12:00:00.000Z',
  mood: { emoji: '🙂', localDate: '2026-08-14' },
  goals: [
    { id: 'report', title: 'Finish report', dueAt: '2026-08-15T17:00:00.000Z' },
  ],
  habits: [
    {
      id: 'walk',
      name: 'Take a walk',
      tinyStep: 'Put on shoes',
      completedToday: false,
      routineSlot: 'afternoon',
      streakCount: 4,
    },
  ],
  health: null,
  notifications: {
    enabled: true,
    enabledCategories: ['advisorNudges', 'routineReminders'],
    reminderTimes: [9, 20],
  },
};

const health: AppleHealthAiSummary = {
  sevenDay: {
    coverageDays: 7,
    averageSteps: 6056,
    averageSleepMinutes: 483,
    exerciseMinutes: 201,
    mindfulMinutes: 0,
    workoutCount: 7,
    stateOfMindCount: 0,
  },
  thirtyDay: {
    coverageDays: 30,
    averageSteps: 5800,
    averageSleepMinutes: 470,
    exerciseMinutes: 600,
    mindfulMinutes: 0,
    workoutCount: 31,
    stateOfMindCount: 0,
  },
  moodComparison: 'Mood check-ins are not compared with Apple Health.',
};

const candidate: AdvisorRecommendation = {
  id: 'habit:walk',
  kind: 'standard',
  observation: 'Your walk is still open today.',
  observations: ['Your walk is still open today.'],
  action: 'Take a five-minute walk.',
  smallerAction: 'Put on your walking shoes.',
  route: '/habits',
  resourceLabel: 'Open habits',
  sourceLabels: ['Habit'],
  changeSignal: null,
};

describe('Advisor daily brief signals', () => {
  beforeEach(() => apiRequest.mockReset());

  it('bounds optional model personalization so the deterministic brief can take over', async () => {
    apiRequest.mockResolvedValue({
      model: 'gemini',
      personalized: true,
      selection: {
        candidateId: candidate.id,
        observations: candidate.observations,
        signalIds: ['routine:walk'],
        focus: 'routine',
      },
    });

    await requestModelAdvisorRecommendation(context, [candidate], []);

    expect(apiRequest).toHaveBeenCalledWith(
      '/api/advisor',
      expect.any(Object),
      { timeoutMs: ADVISOR_MODEL_TIMEOUT_MS }
    );
  });

  it('combines deadlines, routines, streaks, and notification choices', () => {
    const signals = createAdvisorBriefSignals(context);

    expect(signals).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'deadline:report', kind: 'deadline' }),
      expect.objectContaining({ id: 'routine:walk', kind: 'routine' }),
      expect.objectContaining({ id: 'streak:walk', kind: 'streak' }),
      expect.objectContaining({ id: 'notifications-current', kind: 'notifications' }),
    ]));
    expect(signals.some((signal) => signal.kind === 'health')).toBe(false);
  });

  it('adds only the confirmed aggregate Health signal and changes the cache key', () => {
    const signals = createAdvisorBriefSignals(context, health);
    const healthSignal = signals.find((signal) => signal.kind === 'health');

    expect(healthSignal?.text).toContain('8.1 hours average sleep');
    expect(healthSignal?.text).toContain('6,056 average steps');
    expect(healthSignal?.text).not.toContain('source device');
    expect(createAdvisorBriefFingerprint(context, [], health)).not.toBe(
      createAdvisorBriefFingerprint(context, [], null)
    );
  });

  it('invalidates the cache when low-energy or momentum context changes', () => {
    const baseline = createAdvisorBriefFingerprint(context, []);
    expect(
      createAdvisorBriefFingerprint({ ...context, lowEnergyMode: true }, [])
    ).not.toBe(baseline);
    expect(
      createAdvisorBriefFingerprint({
        ...context,
        momentumProgress: {
          totalPoints: 10,
          recentPoints: 5,
          previousPoints: 0,
        },
      }, [])
    ).not.toBe(baseline);
  });
});
