import { describe, expect, it } from 'vitest';
import {
  createStoreReviewPrompt,
  parseStoreReviewState,
  STORE_REVIEW_STATE_KEY,
  type StoreReviewKeyValueStore,
  type StoreReviewer,
} from '../../mobile/lib/store-review-core';
import {
  checkInNoteNeedsSafety,
  shouldSkipReviewForAdvisorContext,
} from '../../mobile/lib/store-review-safety';
import type { AdvisorContext } from '../../mobile/lib/advisor-core';

class MemoryStore implements StoreReviewKeyValueStore {
  values = new Map<string, string>();
  failReads = false;
  async getItem(key: string) {
    if (this.failReads) throw new Error('storage unavailable');
    return this.values.get(key) ?? null;
  }
  async setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

class FakeReviewer implements StoreReviewer {
  available = true;
  requests = 0;
  failRequest = false;
  async isAvailableAsync() {
    return this.available;
  }
  async requestReview() {
    this.requests += 1;
    if (this.failRequest) throw new Error('native failure');
  }
}

function setup() {
  const store = new MemoryStore();
  const reviewer = new FakeReviewer();
  return { store, reviewer, prompt: createStoreReviewPrompt(store, reviewer) };
}

const good = (localDate: string) => ({ emoji: '🙂', localDate });

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe('store review prompt after mood check-ins', () => {
  it('asks once on the third check-in day and never again', async () => {
    const { prompt, reviewer } = setup();
    expect(await prompt.afterCheckInSaved(good('2026-11-01'))).toBe('below-threshold');
    expect(await prompt.afterCheckInSaved(good('2026-11-02'))).toBe('below-threshold');
    expect(await prompt.afterCheckInSaved(good('2026-11-03'))).toBe('requested');
    expect(await prompt.afterCheckInSaved(good('2026-11-04'))).toBe('already-requested');
    expect(await prompt.afterCheckInSaved(good('2026-11-05'))).toBe('already-requested');
    expect(reviewer.requests).toBe(1);
  });

  it('counts repeated saves on the same day once', async () => {
    const { prompt, reviewer } = setup();
    for (let i = 0; i < 5; i += 1) {
      await prompt.afterCheckInSaved(good('2026-11-01'));
    }
    await prompt.afterCheckInSaved(good('2026-11-02'));
    expect(reviewer.requests).toBe(0);
    expect(await prompt.afterCheckInSaved(good('2026-11-03'))).toBe('requested');
  });

  it('skips low moods and safety signals, then asks on the next eligible check-in', async () => {
    const { prompt, reviewer } = setup();
    await prompt.afterCheckInSaved(good('2026-11-01'));
    await prompt.afterCheckInSaved(good('2026-11-02'));
    expect(await prompt.afterCheckInSaved({ emoji: '😢', localDate: '2026-11-03' })).toBe(
      'skipped-low-mood'
    );
    expect(await prompt.afterCheckInSaved({ emoji: '😞', localDate: '2026-11-04' })).toBe(
      'skipped-low-mood'
    );
    expect(
      await prompt.afterCheckInSaved({ emoji: '😄', localDate: '2026-11-05', safetySignal: true })
    ).toBe('skipped-safety');
    expect(reviewer.requests).toBe(0);
    expect(await prompt.afterCheckInSaved(good('2026-11-06'))).toBe('requested');
    expect(reviewer.requests).toBe(1);
  });

  it('does not set the flag when the store review is unavailable', async () => {
    const { prompt, reviewer, store } = setup();
    reviewer.available = false;
    await prompt.afterCheckInSaved(good('2026-11-01'));
    await prompt.afterCheckInSaved(good('2026-11-02'));
    expect(await prompt.afterCheckInSaved(good('2026-11-03'))).toBe('unavailable');
    expect(parseStoreReviewState(store.values.get(STORE_REVIEW_STATE_KEY) ?? null).requested).toBe(
      false
    );
    reviewer.available = true;
    expect(await prompt.afterCheckInSaved(good('2026-11-04'))).toBe('requested');
  });

  it('never throws and never retries after a failed native request', async () => {
    const { prompt, reviewer, store } = setup();
    reviewer.failRequest = true;
    await prompt.afterCheckInSaved(good('2026-11-01'));
    await prompt.afterCheckInSaved(good('2026-11-02'));
    expect(await prompt.afterCheckInSaved(good('2026-11-03'))).toBe('error');
    expect(await prompt.afterCheckInSaved(good('2026-11-04'))).toBe('already-requested');
    expect(reviewer.requests).toBe(1);

    store.failReads = true;
    await expect(prompt.afterCheckInSaved(good('2026-11-05'))).resolves.toBe('error');
  });

  it('asks only once when saves race', async () => {
    const { prompt, reviewer } = setup();
    await prompt.afterCheckInSaved(good('2026-11-01'));
    await prompt.afterCheckInSaved(good('2026-11-02'));
    await Promise.all([
      prompt.afterCheckInSaved(good('2026-11-03')),
      prompt.afterCheckInSaved(good('2026-11-03')),
      prompt.afterCheckInSaved(good('2026-11-04')),
    ]);
    expect(reviewer.requests).toBe(1);
  });

  it('counts distinct dates, not just changes from the last date', async () => {
    const { prompt, reviewer } = setup();
    await prompt.afterCheckInSaved(good('2026-11-01'));
    await prompt.afterCheckInSaved(good('2026-11-02'));
    expect(await prompt.afterCheckInSaved(good('2026-11-01'))).toBe('below-threshold');
    expect(reviewer.requests).toBe(0);
    expect(await prompt.afterCheckInSaved(good('2026-11-03'))).toBe('requested');
  });

  it('checks the wider safety context and treats a failed check as unsafe', async () => {
    const { prompt, reviewer } = setup();
    let safetyChecks = 0;
    const unsafeContext = async () => {
      safetyChecks += 1;
      return true;
    };
    await prompt.afterCheckInSaved({ ...good('2026-11-01'), hasSafetyContext: unsafeContext });
    await prompt.afterCheckInSaved({ ...good('2026-11-02'), hasSafetyContext: unsafeContext });
    // Not loaded until the check-in would otherwise be eligible.
    expect(safetyChecks).toBe(0);
    expect(
      await prompt.afterCheckInSaved({ ...good('2026-11-03'), hasSafetyContext: unsafeContext })
    ).toBe('skipped-safety');
    expect(
      await prompt.afterCheckInSaved({
        ...good('2026-11-04'),
        hasSafetyContext: async () => {
          throw new Error('context unavailable');
        },
      })
    ).toBe('skipped-safety');
    expect(reviewer.requests).toBe(0);
    expect(
      await prompt.afterCheckInSaved({ ...good('2026-11-05'), hasSafetyContext: async () => false })
    ).toBe('requested');
  });

  it('cancels a pending prompt when a newer low-mood or safety save starts', async () => {
    const { prompt, reviewer, store } = setup();
    await prompt.afterCheckInSaved(good('2026-11-01'));
    await prompt.afterCheckInSaved(good('2026-11-02'));

    // Good save on day 3 is stuck loading its safety context.
    const slowContext = deferred<boolean>();
    const pending = prompt.afterCheckInSaved({
      ...good('2026-11-03'),
      hasSafetyContext: () => slowContext.promise,
    });
    // A low-mood save starts (and is still in flight) before it resolves.
    prompt.invalidatePending();
    slowContext.resolve(false);
    expect(await pending).toBe('superseded');
    expect(
      await prompt.afterCheckInSaved({ emoji: '😢', localDate: '2026-11-03' })
    ).toBe('skipped-low-mood');

    // Same race with a safety save that has already been submitted.
    const slowAvailability = deferred<boolean>();
    reviewer.isAvailableAsync = () => slowAvailability.promise;
    const pendingAgain = prompt.afterCheckInSaved(good('2026-11-04'));
    await Promise.resolve();
    const safetySave = prompt.afterCheckInSaved({
      ...good('2026-11-04'),
      safetySignal: true,
    });
    slowAvailability.resolve(true);
    expect(await pendingAgain).toBe('superseded');
    expect(await safetySave).toBe('skipped-safety');
    expect(reviewer.requests).toBe(0);
    expect(parseStoreReviewState(store.values.get(STORE_REVIEW_STATE_KEY) ?? null).requested).toBe(
      false
    );

    reviewer.isAvailableAsync = async () => true;
    expect(await prompt.afterCheckInSaved(good('2026-11-05'))).toBe('requested');
    expect(reviewer.requests).toBe(1);
  });

  it('does not ask once the owner changed or the user left the screen', async () => {
    const { prompt, reviewer, store } = setup();
    await prompt.afterCheckInSaved(good('2026-11-01'));
    await prompt.afterCheckInSaved(good('2026-11-02'));
    expect(
      await prompt.afterCheckInSaved({ ...good('2026-11-03'), isStillCurrent: () => false })
    ).toBe('superseded');
    expect(reviewer.requests).toBe(0);
    expect(parseStoreReviewState(store.values.get(STORE_REVIEW_STATE_KEY) ?? null)).toEqual({
      checkInDates: ['2026-11-01', '2026-11-02', '2026-11-03'],
      requested: false,
    });
    expect(
      await prompt.afterCheckInSaved({ ...good('2026-11-04'), isStillCurrent: () => true })
    ).toBe('requested');
  });

  it('skips a Dashboard good-mood save when Tracker saved a safety note today', async () => {
    const { prompt, reviewer } = setup();
    // Persisted moods table, keyed by local date. Dashboard upserts keep the note.
    const notes = new Map<string, string | null>();
    const persistedNoteContext = (localDate: string) => () =>
      checkInNoteNeedsSafety(async () => notes.get(localDate) ?? null);

    for (const localDate of ['2026-11-01', '2026-11-02']) {
      notes.set(localDate, 'Long day at work');
      await prompt.afterCheckInSaved({
        ...good(localDate),
        hasSafetyContext: persistedNoteContext(localDate),
      });
    }

    // Tracker: details save with a safety note.
    const safetyNote = 'I want to end my life';
    notes.set('2026-11-03', safetyNote);
    expect(
      await prompt.afterCheckInSaved({
        emoji: '😐',
        localDate: '2026-11-03',
        safetySignal: true,
        hasSafetyContext: persistedNoteContext('2026-11-03'),
      })
    ).toBe('skipped-safety');

    // Dashboard: good mood later the same day, no note in screen state.
    expect(
      await prompt.afterCheckInSaved({
        emoji: '😄',
        localDate: '2026-11-03',
        safetySignal: false,
        hasSafetyContext: persistedNoteContext('2026-11-03'),
      })
    ).toBe('skipped-safety');
    expect(reviewer.requests).toBe(0);
  });

  it('treats an unreadable check-in note as unsafe', async () => {
    expect(await checkInNoteNeedsSafety(async () => null)).toBe(false);
    expect(await checkInNoteNeedsSafety(async () => 'Tired but okay')).toBe(false);
    expect(await checkInNoteNeedsSafety(async () => 'I want to kill myself')).toBe(true);
    expect(
      await checkInNoteNeedsSafety(async () => {
        throw new Error('network');
      })
    ).toBe(true);
  });

  it('recovers from corrupt stored state', () => {
    const empty = { checkInDates: [], requested: false };
    expect(parseStoreReviewState('{not json')).toEqual(empty);
    expect(parseStoreReviewState('null')).toEqual(empty);
    expect(parseStoreReviewState('{"checkInDates":"x","requested":"yes"}')).toEqual(empty);
    expect(
      parseStoreReviewState('{"checkInDates":["a","a",1,"b","c","d"],"requested":true}')
    ).toEqual({ checkInDates: ['a', 'b', 'c'], requested: true });
  });
});

describe('store review advisor safety guard', () => {
  const ready = {
    mood: 'ready',
    goals: 'ready',
    habits: 'ready',
    health: 'ready',
    notifications: 'ready',
  } as const;
  const base = (overrides: Partial<AdvisorContext> = {}): AdvisorContext => ({
    nowIso: '2026-11-14T12:00:00.000Z',
    mood: null,
    goals: [],
    habits: [],
    health: null,
    habitWeek: null,
    sourceAvailability: ready,
    ...overrides,
  });

  it('allows a clean, fully loaded context', () => {
    expect(shouldSkipReviewForAdvisorContext(base())).toBe(false);
  });

  it('fails closed when goals, habits, or availability are unknown', () => {
    expect(
      shouldSkipReviewForAdvisorContext(base({ sourceAvailability: { ...ready, goals: 'unavailable' } }))
    ).toBe(true);
    expect(
      shouldSkipReviewForAdvisorContext(base({ sourceAvailability: { ...ready, habits: 'unavailable' } }))
    ).toBe(true);
    expect(shouldSkipReviewForAdvisorContext(base({ sourceAvailability: undefined }))).toBe(true);
  });

  it('skips when habit text needs safety support', () => {
    expect(
      shouldSkipReviewForAdvisorContext(
        base({
          habits: [{ id: 'habit-1', name: 'Routine', tinyStep: 'end my life', completedToday: false }],
        })
      )
    ).toBe(true);
  });
});
