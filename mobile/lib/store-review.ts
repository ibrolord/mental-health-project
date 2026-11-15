import AsyncStorage from '@react-native-async-storage/async-storage';
import * as StoreReview from 'expo-store-review';
import { loadAmbientAdvisorContext, type AdvisorContextOwner } from './advisor-context';
import { supabase } from './supabase';
import { createStoreReviewPrompt, type SavedCheckIn } from './store-review-core';
import { checkInNoteNeedsSafety, shouldSkipReviewForAdvisorContext } from './store-review-safety';

const prompt = createStoreReviewPrompt(AsyncStorage, StoreReview);

/**
 * Call synchronously when a mood check-in save starts, before any await, so a
 * pending prompt from an earlier save can never fire after this one.
 */
export function invalidatePendingStoreReview(): void {
  prompt.invalidatePending();
}

async function loadTodayCheckInNote(
  owner: AdvisorContextOwner,
  localDate: string
): Promise<string | null> {
  if (!owner.queryValue) throw new Error('Check-in owner is not ready.');
  const result = await supabase
    .from('moods')
    .select('note')
    .eq(owner.queryColumn, owner.queryValue)
    .eq('local_date', localDate)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (result.error) throw result.error;
  return (result.data?.note as string | null | undefined) ?? null;
}

/**
 * Fire-and-forget: call after a mood check-in has been saved. Never throws
 * and never blocks the save. The owner's wider safety context (today's
 * persisted note and Advisor context) is only loaded once the check-in would
 * otherwise be eligible to ask for a review.
 */
export function maybeRequestStoreReviewAfterCheckIn(
  checkIn: Omit<SavedCheckIn, 'hasSafetyContext'>,
  owner: AdvisorContextOwner
): void {
  void prompt
    .afterCheckInSaved({
      ...checkIn,
      hasSafetyContext: async () => {
        if (await checkInNoteNeedsSafety(() => loadTodayCheckInNote(owner, checkIn.localDate))) {
          return true;
        }
        return shouldSkipReviewForAdvisorContext(await loadAmbientAdvisorContext(owner));
      },
    })
    .catch(() => undefined);
}
