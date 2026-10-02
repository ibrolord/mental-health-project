import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import { supabase } from './supabase';
import { advisorBriefStorage } from './advisor-brief-storage';
import { completeAdvisorLifecycle, reconcileAdvisorLifecycle } from './advisor-lifecycle-runtime';
import { createToolCompletionCoordinator, type ToolCompletionSession } from './tool-completion-core';
import {
  createToolCompletionStorage, isToolCompletion,
  type ToolCompletion, type ToolCompletionKind,
} from './tool-completion-storage';

export type { ToolCompletionSession } from './tool-completion-core';
const storage = createToolCompletionStorage(AsyncStorage);

async function currentOwner() {
  const { data, error } = await supabase.auth.getSession();
  return !error && data.session ? `user_id:${data.session.user.id}` : null;
}

async function verifiedUserId(owner: string) {
  if (!owner.startsWith('user_id:') || await currentOwner() !== owner) {
    throw new Error('The profile changed.');
  }
  return owner.slice('user_id:'.length);
}

const coordinator = createToolCompletionCoordinator({
  storage, currentOwner,
  reconcileAction: reconcileAdvisorLifecycle,
  completeAction: completeAdvisorLifecycle,
  clearBrief: (owner) => advisorBriefStorage.clear(owner),
  async upload(owner, rows) {
    const userId = await verifiedUserId(owner);
    const result = await supabase.from('tool_completions').upsert(rows.map((row) => ({
      id: row.id, user_id: userId, session_id: null, kind: row.kind, item_id: row.itemId,
      started_at: row.startedAt, completed_at: row.completedAt,
      source_step_id: row.sourceStepId, partial: row.partial,
    })), { onConflict: 'id', ignoreDuplicates: true });
    if (result.error) throw result.error;
    // An ignored UUID conflict is not proof that this owner has the row.
    for (let offset = 0; offset < rows.length; offset += 500) {
      await verifiedUserId(owner);
      const ids = rows.slice(offset, offset + 500).map((row) => row.id);
      const confirmed = await supabase.from('tool_completions').select('id')
        .eq('user_id', userId).in('id', ids);
      if (confirmed.error) throw confirmed.error;
      const owned = new Set((confirmed.data ?? []).map((row) => row.id));
      if (ids.some((id) => !owned.has(id))) throw new Error('Completion ownership could not be confirmed.');
    }
  },
  async download(owner, since) {
    const userId = await verifiedUserId(owner);
    const rows: ToolCompletion[] = [];
    for (let from = 0; ; from += 500) {
      await verifiedUserId(owner);
      const result = await supabase.from('tool_completions')
        .select('id, kind, item_id, started_at, completed_at, source_step_id, partial')
        .eq('user_id', userId).gte('completed_at', since)
        .order('completed_at', { ascending: false }).order('id')
        .range(from, from + 499);
      if (result.error) throw result.error;
      for (const row of result.data ?? []) {
        const completion = {
          id: row.id, kind: row.kind, itemId: row.item_id, startedAt: row.started_at,
          completedAt: row.completed_at, sourceStepId: row.source_step_id,
          partial: row.partial, synced: true,
        };
        if (isToolCompletion(completion)) rows.push(completion);
      }
      if ((result.data?.length ?? 0) < 500) return rows;
    }
  },
});

export function startToolCompletion(
  ownerKey: string, kind: ToolCompletionKind, itemId: string,
  sourceStepId: string | null, options: { id?: string; startedAt?: string } = {},
): ToolCompletionSession {
  return {
    id: options.id ?? Crypto.randomUUID(), ownerKey, kind, itemId, sourceStepId,
    startedAt: options.startedAt ?? new Date().toISOString(),
    generation: storage.generation(ownerKey),
  };
}

export const recordToolCompletion = coordinator.record;
export const refreshToolCompletions = coordinator.refresh;
export const withToolCompletionDataDeletion = coordinator.remove;
export const clearToolCompletions = (owner: string) => coordinator.remove(owner, async () => {});
export const suspendToolCompletions = coordinator.suspend;
export const loadToolCompletions = (owner: string) => storage.list(owner);

export async function migrateToolCompletions(source: string, target: string, mergeProfile: () => Promise<void>) {
  // Drain source uploads before the server changes ownership, then retain unsynced records.
  await coordinator.remove(source, async () => {
    await mergeProfile();
    const rows = await storage.list(source);
    await storage.merge(target, rows);
  }, false);
}
