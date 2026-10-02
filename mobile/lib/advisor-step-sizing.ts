import { selectAdvisorRecommendation, type AdvisorContext, type AdvisorRecommendation } from './advisor-core';

export function prefersSmallerStep(
  context: AdvisorContext,
  recommendation?: Pick<AdvisorRecommendation, 'id'>
): boolean {
  const profile = context.profile;
  if (context.lowEnergyMode === true || (profile?.completedAt && (
    profile.personalPlan?.obstacle === 'energy' ||
    profile.personalPlan?.obstacle === 'overwhelm'
  ))) return true;
  // The chosen microstep is already small; gentle style alone should not rewrite it.
  return profile?.supportStyle === 'gentle' &&
    !(recommendation ?? selectAdvisorRecommendation(context)).id.startsWith('personal-plan:');
}
