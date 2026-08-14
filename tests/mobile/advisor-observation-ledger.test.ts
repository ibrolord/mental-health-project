import { beforeEach, describe, expect, it } from 'vitest';
import {
  createAdvisorObservationLedger,
  keepAdvisorChangeSignalVisible,
  type AdvisorObservationLedgerStorageAdapter,
} from '../../mobile/lib/advisor-observation-ledger';

describe('Advisor change-line focus visibility', () => {
  it('keeps the same approved signal visible but never carries visibility to another signal', () => {
    expect(
      keepAdvisorChangeSignalVisible(true, 'sleep-down', 'sleep-down', false)
    ).toBe(true);
    expect(
      keepAdvisorChangeSignalVisible(true, 'sleep-down', 'goal-overdue:a', false)
    ).toBe(false);
    expect(
      keepAdvisorChangeSignalVisible(false, 'sleep-down', 'sleep-down', false)
    ).toBe(false);
    expect(
      keepAdvisorChangeSignalVisible(false, null, 'sleep-down', true)
    ).toBe(true);
    expect(
      keepAdvisorChangeSignalVisible(true, 'sleep-down', null, false)
    ).toBe(false);
  });
});

const memory = {
  values: new Map<string, string>(),
  failReads: false,
  failWrites: false,
};

const adapter: AdvisorObservationLedgerStorageAdapter = {
  async getItem(key) {
    if (memory.failReads) throw new Error('read unavailable');
    return memory.values.get(key) ?? null;
  },
  async setItem(key, value) {
    if (memory.failWrites) throw new Error('write unavailable');
    memory.values.set(key, value);
  },
  async removeItem(key) {
    if (memory.failWrites) throw new Error('remove unavailable');
    memory.values.delete(key);
  },
};

const ledger = createAdvisorObservationLedger(adapter);
const {
  evaluateAdvisorChangeSignal,
  evaluateAdvisorChangeSignals,
  suppressAdvisorChangeSignal,
  clearAdvisorObservationLedger,
} = ledger;

type StoredState = {
  lastOperationDay: string | null;
  entries: Array<{
    signalId: string;
    state: 'firing' | 'clear';
    consecutiveClearDays: number;
  }>;
  suppressions: Array<{ signalId: string; suppressedUntilDay: string }>;
};

function storedState(): StoredState {
  return JSON.parse([...memory.values.values()][0] ?? '{}') as StoredState;
}

function signal(id: string) {
  return {
    id,
    stream: 'habit' as const,
    direction: 'stalled' as const,
    severity: 'notable' as const,
    line: `${id} changed.`,
  };
}

beforeEach(() => {
  memory.values.clear();
  memory.failReads = false;
  memory.failWrites = false;
});

describe('Advisor observation ledger', () => {
  it('shows an absent signal once and ignores repeated same-day focus evaluations', async () => {
    await expect(
      evaluateAdvisorChangeSignal('owner', signal('habit-stalled:focus'), '2026-08-01T09:00:00.000Z')
    ).resolves.toBe(true);
    await expect(
      evaluateAdvisorChangeSignal('owner', signal('habit-stalled:focus'), '2026-08-01T21:00:00.000Z')
    ).resolves.toBe(false);
  });

  it('does not promote a minor signal to a Home change line', async () => {
    await expect(
      evaluateAdvisorChangeSignal(
        'owner',
        { ...signal('habit-strong:focus'), severity: 'minor' },
        '2026-08-01T09:00:00.000Z'
      )
    ).resolves.toBe(false);
    expect(storedState().entries).toEqual([
      expect.objectContaining({ signalId: 'habit-strong:focus', state: 'firing' }),
    ]);
  });

  it('does not show a signal that remains firing on consecutive days', async () => {
    await expect(
      evaluateAdvisorChangeSignal('owner', signal('sleep-down'), '2026-08-01T12:00:00.000Z')
    ).resolves.toBe(true);
    await expect(
      evaluateAdvisorChangeSignal('owner', signal('sleep-down'), '2026-08-02T12:00:00.000Z')
    ).resolves.toBe(false);
  });

  it('advances A toward clear when A disappears while B fires', async () => {
    const a = signal('habit-stalled:a');
    const b = signal('sleep-down');

    await expect(
      evaluateAdvisorChangeSignals('owner', [a], a.id, '2026-08-01T12:00:00.000Z')
    ).resolves.toBe(true);
    await expect(
      evaluateAdvisorChangeSignals('owner', [b], b.id, '2026-08-02T12:00:00.000Z')
    ).resolves.toBe(true);

    expect(storedState().entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          signalId: a.id,
          state: 'firing',
          consecutiveClearDays: 1,
        }),
        expect.objectContaining({
          signalId: b.id,
          state: 'firing',
          consecutiveClearDays: 0,
        }),
      ])
    );

    await evaluateAdvisorChangeSignals('owner', [b], b.id, '2026-08-03T12:00:00.000Z');
    expect(storedState().entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          signalId: a.id,
          state: 'clear',
          consecutiveClearDays: 2,
        }),
      ])
    );
  });

  it('advances active lower-ranked signals without making them visible later', async () => {
    const promoted = signal('goal-overdue:taxes');
    const lowerRanked = signal('sleep-down');

    await expect(
      evaluateAdvisorChangeSignal(
        'owner',
        [promoted, lowerRanked],
        promoted.id,
        '2026-08-01T12:00:00.000Z'
      )
    ).resolves.toBe(true);
    expect(storedState().entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ signalId: promoted.id, state: 'firing' }),
        expect.objectContaining({ signalId: lowerRanked.id, state: 'firing' }),
      ])
    );

    await expect(
      evaluateAdvisorChangeSignal(
        'owner',
        [lowerRanked],
        lowerRanked.id,
        '2026-08-02T12:00:00.000Z'
      )
    ).resolves.toBe(false);
  });

  it('admits a signal that appears later on the same local day', async () => {
    const laterSignal = signal('sleep-down');
    await expect(
      evaluateAdvisorChangeSignals('owner', [], null, '2026-08-01T09:00:00.000Z')
    ).resolves.toBe(false);
    await expect(
      evaluateAdvisorChangeSignals(
        'owner',
        [laterSignal],
        laterSignal.id,
        '2026-08-01T21:00:00.000Z'
      )
    ).resolves.toBe(true);
    await expect(
      evaluateAdvisorChangeSignals(
        'owner',
        [laterSignal],
        laterSignal.id,
        '2026-08-01T22:00:00.000Z'
      )
    ).resolves.toBe(false);
    expect(storedState().entries.map((entry) => entry.signalId)).toEqual([
      laterSignal.id,
    ]);
  });

  it('requires two distinct clear days and a seven-local-day cooldown before re-showing', async () => {
    await evaluateAdvisorChangeSignal('owner-a', signal('sleep-down'), '2026-08-01T12:00:00.000Z');
    await evaluateAdvisorChangeSignal('owner-a', null, '2026-08-02T12:00:00.000Z');
    await expect(
      evaluateAdvisorChangeSignal('owner-a', signal('sleep-down'), '2026-08-03T12:00:00.000Z')
    ).resolves.toBe(false);

    await evaluateAdvisorChangeSignal('owner-b', signal('sleep-down'), '2026-08-01T12:00:00.000Z');
    await evaluateAdvisorChangeSignal('owner-b', null, '2026-08-02T12:00:00.000Z');
    await evaluateAdvisorChangeSignal('owner-b', null, '2026-08-03T12:00:00.000Z');
    await expect(
      evaluateAdvisorChangeSignal('owner-b', signal('sleep-down'), '2026-08-07T12:00:00.000Z')
    ).resolves.toBe(false);

    await evaluateAdvisorChangeSignal('owner-c', signal('sleep-down'), '2026-08-01T12:00:00.000Z');
    await evaluateAdvisorChangeSignal('owner-c', null, '2026-08-02T12:00:00.000Z');
    await evaluateAdvisorChangeSignal('owner-c', null, '2026-08-03T12:00:00.000Z');
    await expect(
      evaluateAdvisorChangeSignal('owner-c', signal('sleep-down'), '2026-08-08T12:00:00.000Z')
    ).resolves.toBe(true);
  });

  it('does not count non-consecutive clear evaluations as two clear days', async () => {
    await evaluateAdvisorChangeSignal('owner', signal('sleep-down'), '2026-08-01T12:00:00.000Z');
    await evaluateAdvisorChangeSignal('owner', null, '2026-08-02T12:00:00.000Z');
    await evaluateAdvisorChangeSignal('owner', null, '2026-08-04T12:00:00.000Z');
    await expect(
      evaluateAdvisorChangeSignal('owner', signal('sleep-down'), '2026-08-09T12:00:00.000Z')
    ).resolves.toBe(false);
  });

  it('caps ordinary distinct signals at two in a rolling seven-local-day window', async () => {
    await expect(
      evaluateAdvisorChangeSignal('owner', signal('habit-stalled:a'), '2026-08-01T12:00:00.000Z')
    ).resolves.toBe(true);
    await expect(
      evaluateAdvisorChangeSignal('owner', signal('sleep-down'), '2026-08-02T12:00:00.000Z')
    ).resolves.toBe(true);
    await expect(
      evaluateAdvisorChangeSignal('owner', signal('feedback-shift'), '2026-08-03T12:00:00.000Z')
    ).resolves.toBe(false);
  });

  it('exempts goal-overdue without consuming an ordinary weekly slot', async () => {
    await expect(
      evaluateAdvisorChangeSignal('owner', signal('habit-stalled:a'), '2026-08-01T12:00:00.000Z')
    ).resolves.toBe(true);
    await expect(
      evaluateAdvisorChangeSignal('owner', signal('goal-overdue:taxes'), '2026-08-02T12:00:00.000Z')
    ).resolves.toBe(true);
    await expect(
      evaluateAdvisorChangeSignal('owner', signal('sleep-down'), '2026-08-03T12:00:00.000Z')
    ).resolves.toBe(true);
  });

  it('suppresses one signal for fourteen local days without suppressing another', async () => {
    const suppressed = signal('sleep-down');
    const other = signal('habit-stalled:a');

    await expect(
      suppressAdvisorChangeSignal('owner-a', suppressed.id, '2026-08-01T08:00:00.000Z')
    ).resolves.toBeUndefined();
    await expect(
      evaluateAdvisorChangeSignals(
        'owner-a',
        [suppressed, other],
        suppressed.id,
        '2026-08-01T12:00:00.000Z'
      )
    ).resolves.toBe(false);
    expect(storedState().suppressions).toEqual([
      { signalId: suppressed.id, suppressedUntilDay: '2026-08-15' },
    ]);

    await expect(
      evaluateAdvisorChangeSignals(
        'owner-b',
        [suppressed],
        suppressed.id,
        '2026-08-01T12:00:00.000Z'
      )
    ).resolves.toBe(true);
  });

  it('enforces fourteen suppression days and expires on day fifteen', async () => {
    const suppressed = signal('sleep-down');
    await suppressAdvisorChangeSignal('owner-a', suppressed.id, '2026-08-01T08:00:00.000Z');
    await evaluateAdvisorChangeSignals(
      'owner-a',
      [suppressed],
      suppressed.id,
      '2026-08-01T12:00:00.000Z'
    );
    await evaluateAdvisorChangeSignals('owner-a', [], null, '2026-08-02T12:00:00.000Z');
    await evaluateAdvisorChangeSignals('owner-a', [], null, '2026-08-03T12:00:00.000Z');
    await expect(
      evaluateAdvisorChangeSignals(
        'owner-a',
        [suppressed],
        suppressed.id,
        '2026-08-14T12:00:00.000Z'
      )
    ).resolves.toBe(false);

    await suppressAdvisorChangeSignal('owner-b', suppressed.id, '2026-08-01T08:00:00.000Z');
    await evaluateAdvisorChangeSignals(
      'owner-b',
      [suppressed],
      suppressed.id,
      '2026-08-01T12:00:00.000Z'
    );
    await evaluateAdvisorChangeSignals('owner-b', [], null, '2026-08-02T12:00:00.000Z');
    await evaluateAdvisorChangeSignals('owner-b', [], null, '2026-08-03T12:00:00.000Z');
    await expect(
      evaluateAdvisorChangeSignals(
        'owner-b',
        [suppressed],
        suppressed.id,
        '2026-08-15T12:00:00.000Z'
      )
    ).resolves.toBe(true);
  });

  it('isolates owner history and clearing', async () => {
    await expect(
      evaluateAdvisorChangeSignal('owner-a', signal('sleep-down'), '2026-08-01T12:00:00.000Z')
    ).resolves.toBe(true);
    await expect(
      evaluateAdvisorChangeSignal('owner-b', signal('sleep-down'), '2026-08-01T12:00:00.000Z')
    ).resolves.toBe(true);
    await clearAdvisorObservationLedger('owner-a');
    await expect(
      evaluateAdvisorChangeSignal('owner-a', signal('sleep-down'), '2026-08-01T13:00:00.000Z')
    ).resolves.toBe(true);
    await expect(
      evaluateAdvisorChangeSignal('owner-b', signal('sleep-down'), '2026-08-01T13:00:00.000Z')
    ).resolves.toBe(false);
  });

  it('clears malformed storage and fails closed without throwing', async () => {
    await evaluateAdvisorChangeSignal('owner', signal('sleep-down'), '2026-08-01T12:00:00.000Z');
    const key = [...memory.values.keys()][0];
    expect(key).toBeDefined();
    memory.values.set(key, '{bad json');
    await expect(
      evaluateAdvisorChangeSignal('owner', signal('habit-stalled:a'), '2026-08-02T12:00:00.000Z')
    ).resolves.toBe(false);
    expect(memory.values.has(key)).toBe(false);

    memory.failReads = true;
    await expect(
      evaluateAdvisorChangeSignal('owner', signal('sleep-down'), '2026-08-03T12:00:00.000Z')
    ).resolves.toBe(false);
    await expect(
      evaluateAdvisorChangeSignal('owner', signal('sleep-down'), 'not-a-clock')
    ).resolves.toBe(false);

    memory.failReads = false;
    memory.failWrites = true;
    await expect(
      evaluateAdvisorChangeSignal('owner', signal('habit-stalled:b'), '2026-08-04T12:00:00.000Z')
    ).resolves.toBe(false);
    await expect(
      suppressAdvisorChangeSignal('owner', 'sleep-down', '2026-08-04T12:00:00.000Z')
    ).resolves.toBeUndefined();
    await expect(clearAdvisorObservationLedger('owner')).resolves.toBeUndefined();
  });

  it('advances active state but fails visibility closed for a stale promoted id', async () => {
    await expect(
      evaluateAdvisorChangeSignals(
        'owner',
        [signal('sleep-down')],
        'missing-signal',
        '2026-08-01T12:00:00.000Z'
      )
    ).resolves.toBe(false);
    expect(storedState().entries).toEqual([
      expect.objectContaining({ signalId: 'sleep-down', state: 'firing' }),
    ]);
  });

  it('fails closed for invalid operation input without mutating storage', async () => {
    await expect(
      evaluateAdvisorChangeSignals(
        'owner',
        [signal('sleep-down'), signal('sleep-down')],
        'sleep-down',
        '2026-08-01T12:00:00.000Z'
      )
    ).resolves.toBe(false);
    await expect(
      evaluateAdvisorChangeSignals('', [signal('habit-stalled:a')], 'habit-stalled:a')
    ).resolves.toBe(false);
    await expect(
      suppressAdvisorChangeSignal('owner', 'habit-stalled:a', 'not-a-clock')
    ).resolves.toBeUndefined();
    expect(memory.values.size).toBe(0);
  });

  it('does not move an owner ledger backward to an earlier local day', async () => {
    await evaluateAdvisorChangeSignals(
      'owner',
      [signal('sleep-down')],
      'sleep-down',
      '2026-08-02T12:00:00.000Z'
    );
    await expect(
      evaluateAdvisorChangeSignals(
        'owner',
        [signal('habit-stalled:a')],
        'habit-stalled:a',
        '2026-08-01T12:00:00.000Z'
      )
    ).resolves.toBe(false);
    expect(storedState().lastOperationDay).toBe('2026-08-02');
    expect(storedState().entries.map((entry) => entry.signalId)).toEqual(['sleep-down']);
  });

  it('rejects a corrupt owner payload without affecting another owner', async () => {
    await evaluateAdvisorChangeSignals(
      'owner-a',
      [signal('sleep-down')],
      'sleep-down',
      '2026-08-01T12:00:00.000Z'
    );
    await evaluateAdvisorChangeSignals(
      'owner-b',
      [signal('sleep-down')],
      'sleep-down',
      '2026-08-01T12:00:00.000Z'
    );
    const ownerAKey = [...memory.values.keys()].find((key) => key.endsWith(':owner-a'));
    const ownerBKey = [...memory.values.keys()].find((key) => key.endsWith(':owner-b'));
    expect(ownerAKey).toBeDefined();
    expect(ownerBKey).toBeDefined();
    memory.values.set(
      ownerAKey!,
      JSON.stringify({ lastOperationDay: 'invalid', entries: [], suppressions: [] })
    );

    await expect(
      evaluateAdvisorChangeSignals(
        'owner-a',
        [signal('habit-stalled:a')],
        'habit-stalled:a',
        '2026-08-02T12:00:00.000Z'
      )
    ).resolves.toBe(false);
    expect(memory.values.has(ownerAKey!)).toBe(false);
    expect(memory.values.has(ownerBKey!)).toBe(true);
  });

  it('prunes entries after 90 local days', async () => {
    await evaluateAdvisorChangeSignal('owner', signal('sleep-down'), '2026-05-01T12:00:00.000Z');
    await evaluateAdvisorChangeSignal('owner', signal('habit-stalled:fresh'), '2026-08-01T12:00:00.000Z');
    expect(storedState().entries.map((entry) => entry.signalId)).toEqual([
      'habit-stalled:fresh',
    ]);
  });

  it('serializes concurrent evaluations for the same owner', async () => {
    const results = await Promise.all([
      evaluateAdvisorChangeSignal('owner', signal('sleep-down'), '2026-08-01T12:00:00.000Z'),
      evaluateAdvisorChangeSignal('owner', signal('sleep-down'), '2026-08-01T12:00:00.000Z'),
    ]);
    expect(results).toEqual([true, false]);
  });
});
