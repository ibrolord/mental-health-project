import type { AdvisorActionInstance } from './advisor-action-storage';
import type { AdvisorRecommendation } from './advisor-core';
import { advisorFollowUpState } from './advisor-accountability-core';

type StartDependencies = {
  accept: (owner: string, recommendation: AdvisorRecommendation, options: { useSmallerStep: boolean }) => Promise<{ action: AdvisorActionInstance | null }>;
  cancelReminder: () => Promise<unknown>;
  clearFollowUp: (owner: string, actionId: string) => Promise<{ action: AdvisorActionInstance | null }>;
  start: (owner: string, action: AdvisorActionInstance) => Promise<AdvisorActionInstance | null>;
};

// Both Today and Advisor use the same durable action transition before navigating.
export function createAdvisorStepStarter(dependencies: StartDependencies) {
  return async (owner: string, recommendation: AdvisorRecommendation,
    existing: AdvisorActionInstance | null, useSmallerStep: boolean,
    isCurrent: () => boolean, now = new Date()): Promise<{ route: AdvisorRecommendation['route']; action: AdvisorActionInstance | null } | null> => {
    if (!isCurrent()) return null;
    if (recommendation.kind === 'safety') return { route: recommendation.route, action: null };
    let action = existing ?? (await dependencies.accept(owner, recommendation, { useSmallerStep })).action;
    if (!isCurrent()) return null;
    if (!action) throw new Error('Advisor action was not saved.');
    if (action.status === 'in_progress' && action.followUpAt) return { route: action.route, action };
    if (action.status === 'accepted' && advisorFollowUpState(action, now) === 'planned_due') {
      if (action.reminderAt) await dependencies.cancelReminder();
      if (!isCurrent()) return null;
      action = (await dependencies.clearFollowUp(owner, action.id)).action;
      if (!isCurrent()) return null;
      if (!action) throw new Error('Advisor check-in state was not cleared.');
    }
    const started = await dependencies.start(owner, action);
    if (!isCurrent()) return null;
    if (!started || started.id !== action.id) throw new Error('Advisor action could not be started.');
    return { route: started.route, action: started };
  };
}
