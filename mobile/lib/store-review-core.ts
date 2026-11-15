/**
 * Decides when to ask for an App Store rating after mood check-ins.
 *
 * Rules:
 * - Count check-ins once per local day. A day's check-in is upserted, and the
 *   tracker saves twice (mood pick, then details), so raw saves would overcount.
 * - Ask once the 3rd check-in day has been saved, at most once ever.
 * - Never ask on a low mood or when a safety signal is present, including the
 *   wider safety context (checked last, only once otherwise eligible). If that
 *   check fails, treat it as unsafe. A skipped save still counts, so the next
 *   eligible check-in can ask instead.
 * - A newer save supersedes any pending prompt: call invalidatePending() when a
 *   save starts, so a slow good-mood run cannot ask after a later low-mood or
 *   safety save. Superseded runs still count their date. The owner and route
 *   are rechecked via isStillCurrent right before asking.
 * - Never throw: failures here must not affect saving a check-in.
 *
 * Pure module with injected storage and reviewer so it can be unit tested
 * without native modules. Keep imports relative.
 */

export const STORE_REVIEW_STATE_KEY = 'mhtoolkit.store-review.v1';
export const STORE_REVIEW_CHECK_IN_THRESHOLD = 3;
export const STORE_REVIEW_SKIPPED_MOODS: readonly string[] = ['😢', '😞'];

export interface StoreReviewKeyValueStore {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

export interface StoreReviewer {
  isAvailableAsync(): Promise<boolean>;
  requestReview(): Promise<void>;
}

export interface StoreReviewState {
  /** Distinct local dates with a saved check-in, capped at the threshold. */
  checkInDates: string[];
  requested: boolean;
}

export interface SavedCheckIn {
  emoji: string;
  localDate: string;
  /** True when any crisis or safety flow is showing or was triggered. */
  safetySignal?: boolean;
  /** Resolves true when the user's wider context needs safety support. */
  hasSafetyContext?: () => Promise<boolean>;
  /** False once the owner changed or the user left the screen that saved. */
  isStillCurrent?: () => boolean;
}

export type StoreReviewOutcome =
  | 'requested'
  | 'already-requested'
  | 'below-threshold'
  | 'skipped-low-mood'
  | 'skipped-safety'
  | 'unavailable'
  | 'superseded'
  | 'error';

const EMPTY_STATE: StoreReviewState = {
  checkInDates: [],
  requested: false,
};

export function parseStoreReviewState(raw: string | null): StoreReviewState {
  if (!raw) return { ...EMPTY_STATE, checkInDates: [] };
  try {
    const value = JSON.parse(raw) as Partial<StoreReviewState> | null;
    const dates = Array.isArray(value?.checkInDates)
      ? value.checkInDates.filter((date): date is string => typeof date === 'string' && date !== '')
      : [];
    return {
      checkInDates: [...new Set(dates)].slice(0, STORE_REVIEW_CHECK_IN_THRESHOLD),
      requested: value?.requested === true,
    };
  } catch {
    return { ...EMPTY_STATE, checkInDates: [] };
  }
}

export function createStoreReviewPrompt(
  storage: StoreReviewKeyValueStore,
  reviewer: StoreReviewer
) {
  // Serialise calls so a double tap cannot read stale state and ask twice.
  let queue: Promise<unknown> = Promise.resolve();
  // Bumped whenever a newer save starts or is submitted; older runs must not ask.
  let generation = 0;

  const run = async (checkIn: SavedCheckIn, runGeneration: number): Promise<StoreReviewOutcome> => {
    const isCurrent = () =>
      runGeneration === generation && (checkIn.isStillCurrent?.() ?? true);
    try {
      const state = parseStoreReviewState(await storage.getItem(STORE_REVIEW_STATE_KEY));
      if (state.requested) return 'already-requested';

      if (
        checkIn.localDate &&
        state.checkInDates.length < STORE_REVIEW_CHECK_IN_THRESHOLD &&
        !state.checkInDates.includes(checkIn.localDate)
      ) {
        state.checkInDates.push(checkIn.localDate);
        await storage.setItem(STORE_REVIEW_STATE_KEY, JSON.stringify(state));
      }

      if (state.checkInDates.length < STORE_REVIEW_CHECK_IN_THRESHOLD) return 'below-threshold';
      if (checkIn.safetySignal) return 'skipped-safety';
      if (STORE_REVIEW_SKIPPED_MOODS.includes(checkIn.emoji)) return 'skipped-low-mood';
      if (checkIn.hasSafetyContext) {
        const unsafe = await checkIn.hasSafetyContext().catch(() => true);
        if (unsafe) return 'skipped-safety';
      }
      if (!isCurrent()) return 'superseded';
      if (!(await reviewer.isAvailableAsync())) return 'unavailable';
      if (!isCurrent()) return 'superseded';

      // Persist the flag first so a failed or interrupted prompt is never retried.
      await storage.setItem(
        STORE_REVIEW_STATE_KEY,
        JSON.stringify({ ...state, requested: true })
      );
      if (!isCurrent()) {
        await storage.setItem(STORE_REVIEW_STATE_KEY, JSON.stringify(state));
        return 'superseded';
      }
      await reviewer.requestReview();
      return 'requested';
    } catch {
      return 'error';
    }
  };

  return {
    /** Call synchronously when a check-in save starts, before any await. */
    invalidatePending(): void {
      generation += 1;
    },
    afterCheckInSaved(checkIn: SavedCheckIn): Promise<StoreReviewOutcome> {
      generation += 1;
      const runGeneration = generation;
      const next = queue.then(() => run(checkIn, runGeneration));
      queue = next.catch(() => undefined);
      return next;
    },
  };
}
