import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  clearAdvisorAction,
  loadAdvisorAction,
  recordAdvisorActionCheckIn,
  startAdvisorAction,
} from './advisor-action-storage';
import {
  answerAdvisorResolution,
  markAdvisorStarted,
  recordAdvisorOffered,
} from './advisor-outcome-storage';
import { createAdvisorLifecycleCoordinator } from './advisor-lifecycle';
import { cancelAdvisorReminder } from './notifications';

const advisorLifecycle = createAdvisorLifecycleCoordinator(AsyncStorage, {
  loadAction: async (ownerKey) => loadAdvisorAction(ownerKey),
  startAction: startAdvisorAction,
  clearAction: clearAdvisorAction,
  recordCheckIn: recordAdvisorActionCheckIn,
  recordOffered: recordAdvisorOffered,
  markStarted: markAdvisorStarted,
  resolveOutcome: answerAdvisorResolution,
  cancelReminder: cancelAdvisorReminder,
});

export const reconcileAdvisorLifecycle = advisorLifecycle.reconcileAdvisorLifecycle;
export const startAdvisorLifecycle = advisorLifecycle.startAdvisorLifecycle;
export const completeAdvisorLifecycle = advisorLifecycle.completeAdvisorLifecycle;
export const recoverAdvisorLifecycle = advisorLifecycle.recoverAdvisorLifecycle;
export const replaceAdvisorLifecycle = advisorLifecycle.replaceAdvisorLifecycle;
export const clearAdvisorLifecycleJournal = advisorLifecycle.clearAdvisorLifecycleJournal;
