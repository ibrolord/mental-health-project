import { format } from 'date-fns';
import { loadAmbientAdvisorContext, type AdvisorContextOwner } from './advisor-context';
import { loadAdvisorAction } from './advisor-action-storage';
import { loadAdvisorOutcomes } from './advisor-outcome-storage';
import { selectAdvisorRecommendation } from './advisor-core';
import { advisorBriefStorage } from './advisor-brief-storage';
import { createAdvisorBriefFingerprint } from './advisor-brief-core';
import { checkAdvisorTargetCompletion } from './advisor-target-completion-runtime';

export async function loadTodayAdvisor(owner: AdvisorContextOwner) {
  const [context, action, outcomes] = await Promise.all([
    loadAmbientAdvisorContext(owner), loadAdvisorAction(owner.ownerKey), loadAdvisorOutcomes(owner.ownerKey),
  ]);
  // Loading Today is read-only. Advisor owns completion reconciliation and feedback.
  const targetCompleted = Boolean(action && await checkAdvisorTargetCompletion(action, owner).catch(() => false));
  const recommendation = selectAdvisorRecommendation(context, outcomes);
  if (recommendation.kind === 'safety') return { context, recommendation, action: null, targetCompleted: false };
  // Reuse a matching model brief, but never request AI consent or a new model call on Today.
  const cached = owner.ownerKey ? await advisorBriefStorage.read(owner.ownerKey,
    format(new Date(context.nowIso), 'yyyy-MM-dd'), createAdvisorBriefFingerprint(context, outcomes)
  ).catch(() => null) : null;
  return { context, recommendation: cached?.recommendation ?? recommendation, action, targetCompleted };
}
