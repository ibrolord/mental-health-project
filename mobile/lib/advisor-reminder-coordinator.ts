import type { AdvisorRecommendation } from './advisor-core';
import type { AdvisorActionInstance } from './advisor-action-storage';

type ActionTransitionResult = {
  action: AdvisorActionInstance | null;
  changed: boolean;
};

type AdvisorReminderCoordinatorDependencies = {
  schedule: (date: Date) => Promise<boolean>;
  cancel: () => Promise<void>;
  accept: (
    ownerKey: string,
    recommendation: AdvisorRecommendation,
    options: { useSmallerStep: boolean }
  ) => Promise<ActionTransitionResult>;
  setFollowUp: (
    ownerKey: string,
    actionId: string,
    followUpAt: string | null,
    reminderAt?: string | null
  ) => Promise<ActionTransitionResult>;
  clear: (ownerKey: string, actionId: string) => Promise<boolean>;
};

export type ScheduleAdvisorActionReminderInput = {
  ownerKey: string;
  recommendation: AdvisorRecommendation;
  existingAction: AdvisorActionInstance | null;
  useSmallerStep: boolean;
  date: Date;
};

export type ScheduleAdvisorActionReminderResult = {
  action: AdvisorActionInstance | null;
  scheduled: boolean;
};

export function createAdvisorReminderCoordinator(
  dependencies: AdvisorReminderCoordinatorDependencies
) {
  return async function scheduleActionReminder({
    ownerKey,
    recommendation,
    existingAction,
    useSmallerStep,
    date,
  }: ScheduleAdvisorActionReminderInput): Promise<ScheduleAdvisorActionReminderResult> {
    let accepted: ActionTransitionResult = {
      action: existingAction,
      changed: false,
    };
    let nativeScheduleAttempted = false;

    const restoreLocalState = async (): Promise<AdvisorActionInstance | null> => {
      if (!accepted.action) return existingAction;
      if (accepted.changed) {
        const cleared = await dependencies.clear(ownerKey, accepted.action.id);
        if (!cleared) throw new Error('Advisor reminder action could not be rolled back.');
        return null;
      }
      const restored = await dependencies.setFollowUp(
        ownerKey,
        accepted.action.id,
        existingAction?.followUpAt ?? null,
        existingAction?.reminderAt ?? null
      );
      if (!restored.changed || !restored.action) {
        throw new Error('Advisor reminder state could not be rolled back.');
      }
      return restored.action;
    };

    try {
      if (!accepted.action) {
        accepted = await dependencies.accept(ownerKey, recommendation, {
          useSmallerStep,
        });
      }
      if (!accepted.action) throw new Error('Advisor action was not saved.');

      const updated = await dependencies.setFollowUp(
        ownerKey,
        accepted.action.id,
        date.toISOString(),
        date.toISOString()
      );
      if (!updated.changed || !updated.action) {
        throw new Error('Advisor reminder state was not saved.');
      }
      nativeScheduleAttempted = true;
      const scheduled = await dependencies.schedule(date);
      if (!scheduled) {
        return { action: await restoreLocalState(), scheduled: false };
      }
      return { action: updated.action, scheduled: true };
    } catch (error) {
      let cleanupFailed = false;
      let nativeCancellationFailed = false;
      if (nativeScheduleAttempted) {
        await dependencies.cancel().catch(() => {
          cleanupFailed = true;
          nativeCancellationFailed = true;
        });
      }
      if (!nativeCancellationFailed) {
        await restoreLocalState().catch(() => {
          cleanupFailed = true;
        });
      }
      if (cleanupFailed) {
        throw new Error('Advisor reminder setup failed and could not be fully rolled back.');
      }
      throw error;
    }
  };
}
