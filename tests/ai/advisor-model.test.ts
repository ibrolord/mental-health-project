import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AdvisorModelRequest } from '../../lib/ai/advisor-validation';

const { routedChat } = vi.hoisted(() => ({ routedChat: vi.fn() }));

vi.mock('../../lib/ai/model-router', () => ({ chat: routedChat }));

import { createModelAdvisorRecommendation } from '../../lib/ai/advisor-model';

function request(): AdvisorModelRequest {
  return {
    nowIso: '2026-08-14T12:00:00.000Z',
    mood: { label: 'Okay', localDate: '2026-08-14' },
    candidates: [
      {
        id: 'habit:walk',
        observation: 'Your walk is still open today.',
        observations: ['Your walk is still open today.'],
        action: 'Take a five-minute walk.',
        smallerAction: 'Put on your walking shoes.',
        sourceLabels: ['Habit'],
      },
      {
        id: 'goal:report',
        observation: 'Your report goal has a next step.',
        observations: ['Your report goal has a next step.'],
        action: 'Open the report and write one line.',
        smallerAction: 'Open the report.',
        sourceLabels: ['Goal'],
      },
    ],
    signals: [
      {
        id: 'routine:walk',
        kind: 'routine',
        text: 'Morning routine “Walk” is still open.',
      },
    ],
    appleHealthSummary: null,
    recentFeedback: [],
  };
}

describe('model-backed Advisor selection', () => {
  beforeEach(() => routedChat.mockReset());

  it('uses Gemini preference and accepts a bounded known candidate', async () => {
    routedChat.mockResolvedValue({
      model: 'gemini',
      response: JSON.stringify({
        candidateId: 'goal:report',
        observations: ['Your report goal has a next step.'],
        signalIds: ['routine:walk'],
        focus: 'deadline',
      }),
    });

    const result = await createModelAdvisorRecommendation(request());

    expect(result).toEqual({
      model: 'gemini',
      personalized: true,
      selection: {
        candidateId: 'goal:report',
        observations: ['Your report goal has a next step.'],
        signalIds: ['routine:walk'],
        focus: 'deadline',
      },
    });
    expect(routedChat).toHaveBeenCalledWith(
      expect.any(Array),
      undefined,
      { preferredProvider: 'gemini' }
    );
  });

  it('rejects an invented candidate and preserves the vetted fallback', async () => {
    routedChat.mockResolvedValue({
      model: 'gemini',
      response: JSON.stringify({
        candidateId: 'invented:action',
        observations: ['Do something the app did not approve.'],
        signalIds: [],
        focus: 'steady',
      }),
    });

    const result = await createModelAdvisorRecommendation(request());

    expect(result.personalized).toBe(false);
    expect(result.selection).toEqual({
      candidateId: 'habit:walk',
      observations: ['Your walk is still open today.'],
      signalIds: ['routine:walk'],
      focus: 'steady',
    });
  });

  it('rejects rewritten or clinical model claims', async () => {
    routedChat.mockResolvedValue({
      model: 'claude',
      response: JSON.stringify({
        candidateId: 'goal:report',
        observations: ['This means you have a disorder.'],
        signalIds: ['routine:walk'],
        focus: 'deadline',
      }),
    });

    const result = await createModelAdvisorRecommendation(request());

    expect(result.personalized).toBe(false);
    expect(result.selection.candidateId).toBe('habit:walk');
  });

  it('falls back when the provider response is not valid JSON', async () => {
    routedChat.mockResolvedValue({ model: 'gemini', response: 'not-json' });

    const result = await createModelAdvisorRecommendation(request());

    expect(result.personalized).toBe(false);
    expect(result.selection.candidateId).toBe('habit:walk');
  });
});
