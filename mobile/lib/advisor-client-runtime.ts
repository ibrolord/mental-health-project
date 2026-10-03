import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import { createAdvisorClientCoordinator, loadAdvisorClientSnapshot, parseAdvisorClientPreferences, type AdvisorClientPreferences } from './advisor-client-core';
import { emitAdvisorClient } from './advisor-client-events';
import { loadTodayAdvisor } from './today-advisor';
import { loadAdvisorAction } from './advisor-action-storage';
import { refreshToolCompletions } from './tool-completion-runtime';
import { completeAdvisorLifecycle } from './advisor-lifecycle-runtime';
import { cancelAutomaticAdvisorReminder, clearAutomaticAdvisorHistory, reconcileAutomaticAdvisorReminder } from './notifications';
import { syncAdvisorBackgroundTask } from './advisor-background-task';

const key = (owner: string) => `mhtoolkit.advisor.client.v1:${encodeURIComponent(owner)}`;
export async function readAdvisorClientPreferences(owner: string) {
  return parseAdvisorClientPreferences(await AsyncStorage.getItem(key(owner)));
}

const coordinator = createAdvisorClientCoordinator({
  async currentOwner() {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    return data.session ? `user_id:${data.session.user.id}` : null;
  },
  read: readAdvisorClientPreferences,
  write: (owner, prefs) => AsyncStorage.setItem(key(owner), JSON.stringify(prefs)),
  async load(owner) {
    const userId = owner.slice('user_id:'.length);
    return loadAdvisorClientSnapshot(async () => {
      const result = await loadTodayAdvisor({ ownerKey: owner, queryColumn: 'user_id', queryValue: userId, userId });
      return { action: result.action, safety: result.recommendation.kind === 'safety', targetCompleted: result.targetCompleted };
    }, () => loadAdvisorAction(owner));
  },
  loadAction: loadAdvisorAction,
  refreshCompletions: async (owner) => { await refreshToolCompletions(owner); },
  complete: async (owner, action) => { await completeAdvisorLifecycle(owner, action); },
  schedule: reconcileAutomaticAdvisorReminder,
  cancel: cancelAutomaticAdvisorReminder,
  clearHistory: clearAutomaticAdvisorHistory,
  syncBackground: syncAdvisorBackgroundTask,
  emit: emitAdvisorClient,
});

export async function runAdvisorClientRefresh(_source: 'background' | 'foreground' | 'change' = 'foreground') {
  await coordinator.refresh();
}
export const updateAdvisorClientPreferences = (owner: string, patch: Partial<AdvisorClientPreferences>) => coordinator.update(owner, patch);
export const clearAdvisorClient = coordinator.clear;
