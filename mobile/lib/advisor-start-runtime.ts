import { createAdvisorStepStarter } from './advisor-start';
import { acceptAdvisorAction, setAdvisorActionFollowUp } from './advisor-action-storage';
import { startAdvisorLifecycle } from './advisor-lifecycle-runtime';
import { cancelAdvisorReminder } from './notifications';

export const startAdvisorStep = createAdvisorStepStarter({
  accept: acceptAdvisorAction,
  cancelReminder: cancelAdvisorReminder,
  clearFollowUp: (owner, id) => setAdvisorActionFollowUp(owner, id, null, null),
  start: startAdvisorLifecycle,
});
