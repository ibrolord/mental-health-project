import { apiRequest } from './api';
import type {
  AdvisorContext,
  AdvisorRecentRecommendation,
  AdvisorRecommendation,
} from './advisor-core';
import { hasUnsafeAdvisorContext } from './advisor-core';
import type { AppleHealthAiSummary } from './apple-health-core';
import {
  advisorMoodLabel,
  createAdvisorBriefSignals,
  type AdvisorBriefFocus,
  type AdvisorBriefSignal,
  type AdvisorDailyBrief,
} from './advisor-brief-core';

type AdvisorModel = 'gemini' | 'claude';

export const ADVISOR_MODEL_TIMEOUT_MS = 6_000;

type AdvisorModelResponse = {
  selection: {
    candidateId: string;
    observations: string[];
    signalIds: string[];
    focus: AdvisorBriefFocus;
  };
  model: AdvisorModel | 'safety';
  personalized: boolean;
};

const BRIEF_HEADLINES: Record<AdvisorBriefFocus, string> = {
  steady: 'Keep today clear.',
  deadline: 'Protect the next deadline.',
  routine: 'Keep the routine moving.',
  baseline: 'Support your baseline.',
  recover: 'Make today lighter.',
};

function boundedObservation(value: string): string {
  return Array.from(value.trim().replace(/\s+/g, ' ')).slice(0, 180).join('');
}


export async function requestModelAdvisorRecommendation(
  context: AdvisorContext,
  candidates: readonly AdvisorRecommendation[],
  recent: readonly AdvisorRecentRecommendation[],
  appleHealthSummary: AppleHealthAiSummary | null = null,
  requestOptions: { isCurrent?: () => boolean; expectedUserId?: string } = {}
): Promise<{
  recommendation: AdvisorRecommendation;
  model: AdvisorModel;
  personalized: boolean;
  brief: AdvisorDailyBrief;
}> {
  if (hasUnsafeAdvisorContext(context)) {
    throw new Error('Advisor safety guidance must stay local');
  }
  // Reject local-only candidates even if a caller forgets to strip the profile.
  const modelCandidates = candidates.filter((candidate) =>
    !candidate.id.startsWith('personal-plan:') &&
    !candidate.sourceLabels.includes('Your personal plan')
  );
  if (modelCandidates.length === 0) throw new Error('No model-safe Advisor candidates');
  const modelContext: AdvisorContext = {
    ...context,
    profile: context.profile ? { ...context.profile, personalPlan: undefined } : context.profile,
  };
  const signals = createAdvisorBriefSignals(modelContext, appleHealthSummary);
  const response = await apiRequest<AdvisorModelResponse>('/api/advisor', {
    nowIso: context.nowIso,
    mood: context.mood
      ? {
          label: advisorMoodLabel(context.mood.emoji),
          localDate: context.mood.localDate,
        }
      : null,
    candidates: modelCandidates.map((candidate) => ({
      id: candidate.id,
      observation: candidate.observation,
      observations: candidate.observations.length
        ? candidate.observations
        : [candidate.observation],
      action: candidate.action,
      smallerAction: candidate.smallerAction,
      sourceLabels: [...candidate.sourceLabels],
    })),
    signals,
    appleHealthSummary,
    recentFeedback: recent
      .filter(
        (item): item is Exclude<AdvisorRecentRecommendation, string> =>
          typeof item !== 'string' && !item.recommendationId.startsWith('personal-plan:')
      )
      .slice(0, 5)
      .map((item) => ({
        recommendationId: item.recommendationId,
        helpful: item.helpful ?? null,
      })),
    profile: modelContext.profile?.completedAt
      ? {
          preferredName: modelContext.profile.preferredName,
          priorities: modelContext.profile.priorities,
          supportStyle: modelContext.profile.supportStyle,
        }
      : null,
  }, {
    timeoutMs: ADVISOR_MODEL_TIMEOUT_MS,
    ...requestOptions,
  });

  if (response.model === 'safety') {
    throw new Error('Advisor model returned an invalid safety response');
  }
  const selected = modelCandidates.find(
    (candidate) => candidate.id === response.selection.candidateId
  );
  if (!selected) throw new Error('Advisor selected an unknown action');
  const observations = response.selection.observations
    .map(boundedObservation)
    .filter(Boolean)
    .slice(0, 3);
  const selectedSignals = response.selection.signalIds
    .map((id) => signals.find((signal) => signal.id === id))
    .filter((signal): signal is AdvisorBriefSignal => Boolean(signal))
    .slice(0, 3);

  return {
    recommendation: {
      ...selected,
      observation: observations[0] ?? selected.observation,
      observations: observations.length ? observations : selected.observations,
    },
    model: response.model,
    personalized: response.personalized,
    brief: {
      focus: response.selection.focus,
      headline: BRIEF_HEADLINES[response.selection.focus],
      signals: selectedSignals,
      usedAppleHealth: Boolean(appleHealthSummary),
    },
  };
}
