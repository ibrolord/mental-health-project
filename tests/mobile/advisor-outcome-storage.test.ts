import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  advisorOutcomesStorageKey,
  createAdvisorOutcomeStorage,
  type AdvisorOutcomeStorageAdapter,
} from '../../mobile/lib/advisor-outcome-storage';

function memoryStorage(initial: Record<string, string> = {}): {
  adapter: AdvisorOutcomeStorageAdapter;
  values: Map<string, string>;
} {
  const values = new Map(Object.entries(initial));
  return {
    values,
    adapter: {
      getItem: async (key) => values.get(key) ?? null,
      setItem: async (key, value) => { values.set(key, value); },
      removeItem: async (key) => { values.delete(key); },
    },
  };
}

const NOW = new Date('2026-08-13T12:00:00.000Z');

describe('Advisor outcome storage', () => {
  it('records and transitions the newest matching owner-scoped outcome', async () => {
    const { adapter } = memoryStorage();
    const storage = createAdvisorOutcomeStorage(adapter, () => NOW);
    await storage.recordAdvisorOffered('user_id:owner-a', { id: 'habit:walk' });
    await storage.markAdvisorStarted('user_id:owner-a', 'habit:walk', '2026-08-13T12:01:00.000Z');
    await storage.answerAdvisorCompletion('user_id:owner-a', 'habit:walk', true, '2026-08-13T12:02:00.000Z');
    expect(await storage.loadAdvisorOutcomes('user_id:owner-a')).toEqual([{
      recommendationId: 'habit:walk',
      offeredAt: NOW.toISOString(),
      startedAt: '2026-08-13T12:01:00.000Z',
      completedAt: '2026-08-13T12:02:00.000Z',
      helpful: null,
      feedbackAt: null,
    }]);
  });

  it('upserts one offer per recommendation per local day', async () => {
    const { adapter } = memoryStorage();
    const storage = createAdvisorOutcomeStorage(adapter, () => NOW);
    await storage.recordAdvisorOffered('owner', { id: 'habit:walk' });
    await storage.recordAdvisorOffered(
      'owner',
      { id: 'habit:walk' },
      '2026-08-13T22:00:00.000Z'
    );
    expect(await storage.loadAdvisorOutcomes('owner')).toHaveLength(1);
  });

  it('stores explicit usefulness without claiming the action was completed', async () => {
    const { adapter } = memoryStorage();
    const storage = createAdvisorOutcomeStorage(adapter, () => NOW);
    await storage.recordAdvisorOffered('owner', { id: 'grounding' });
    await storage.markAdvisorStarted('owner', 'grounding', '2026-08-13T12:01:00.000Z');
    await storage.answerAdvisorHelpfulness(
      'owner',
      'grounding',
      false,
      '2026-08-13T12:03:00.000Z'
    );
    expect((await storage.loadAdvisorOutcomes('owner'))[0]).toMatchObject({
      helpful: false,
      startedAt: '2026-08-13T12:01:00.000Z',
      completedAt: null,
      feedbackAt: '2026-08-13T12:03:00.000Z',
    });
  });

  it('carries the change signal shown when an action starts across reloads', async () => {
    const { adapter } = memoryStorage();
    const storage = createAdvisorOutcomeStorage(adapter, () => NOW);
    await storage.recordAdvisorOffered('owner', { id: 'grounding' });
    await storage.markAdvisorStarted(
      'owner',
      'grounding',
      '2026-08-13T12:01:00.000Z',
      'sleep-down'
    );

    expect((await storage.loadAdvisorOutcomes('owner'))[0]).toMatchObject({
      recommendationId: 'grounding',
      shownSignalId: 'sleep-down',
    });
  });

  it('loads legacy outcomes that do not contain a shown signal', async () => {
    const key = advisorOutcomesStorageKey('owner');
    const { adapter } = memoryStorage({
      [key]: JSON.stringify([
        {
          recommendationId: 'legacy',
          offeredAt: NOW.toISOString(),
          startedAt: NOW.toISOString(),
          completedAt: null,
          helpful: null,
          feedbackAt: null,
        },
      ]),
    });
    const storage = createAdvisorOutcomeStorage(adapter, () => NOW);

    expect((await storage.loadAdvisorOutcomes('owner'))[0]).not.toHaveProperty(
      'shownSignalId'
    );
  });

  it('persists skipped usefulness feedback and does not prompt twice', async () => {
    const { adapter } = memoryStorage();
    const storage = createAdvisorOutcomeStorage(adapter, () => NOW);
    await storage.recordAdvisorOffered('owner', { id: 'grounding' });
    await storage.markAdvisorStarted('owner', 'grounding');
    await storage.answerAdvisorHelpfulness('owner', 'grounding', null);
    const first = (await storage.loadAdvisorOutcomes('owner'))[0];
    expect(first.helpful).toBeNull();
    expect(first.feedbackAt).toBe(NOW.toISOString());
    await storage.answerAdvisorHelpfulness(
      'owner',
      'grounding',
      true,
      '2026-08-13T13:00:00.000Z'
    );
    expect((await storage.loadAdvisorOutcomes('owner'))[0]).toEqual(first);
  });

  it('does not transition outcomes forward before they are started', async () => {
    const { adapter } = memoryStorage();
    const storage = createAdvisorOutcomeStorage(adapter, () => NOW);
    await storage.recordAdvisorOffered('owner', { id: 'goal:one' });
    await storage.answerAdvisorCompletion('owner', 'goal:one', true);
    await storage.answerAdvisorHelpfulness('owner', 'goal:one', true);
    expect((await storage.loadAdvisorOutcomes('owner'))[0]).toMatchObject({
      startedAt: null,
      completedAt: null,
      helpful: null,
      feedbackAt: null,
    });
  });

  it('keeps a declined completion incomplete', async () => {
    const { adapter } = memoryStorage();
    const storage = createAdvisorOutcomeStorage(adapter, () => NOW);
    await storage.recordAdvisorOffered('owner', { id: 'goal:one' });
    await storage.answerAdvisorCompletion('owner', 'goal:one', false);
    expect((await storage.loadAdvisorOutcomes('owner'))[0].completedAt).toBeNull();
  });

  it('isolates owners and treats null owners as empty no-ops', async () => {
    const { adapter } = memoryStorage();
    const storage = createAdvisorOutcomeStorage(adapter, () => NOW);
    await storage.recordAdvisorOffered('owner-a', { id: 'a' });
    await storage.recordAdvisorOffered('owner-b', { id: 'b' });
    await storage.recordAdvisorOffered(null, { id: 'ignored' });
    expect((await storage.loadAdvisorOutcomes('owner-a')).map((row) => row.recommendationId)).toEqual(['a']);
    expect((await storage.loadAdvisorOutcomes('owner-b')).map((row) => row.recommendationId)).toEqual(['b']);
    expect(await storage.loadAdvisorOutcomes(null)).toEqual([]);
  });

  it.each([
    '{bad json',
    '{}',
    '[{"recommendationId":"ok"}]',
    '[{"recommendationId":"ok","offeredAt":"2026-08-13T12:00:00.000Z","startedAt":null,"completedAt":null,"helpful":null},{"bad":true}]',
  ])('fails closed for a malformed stored payload: %s', async (raw) => {
    const key = advisorOutcomesStorageKey('owner');
    const { adapter } = memoryStorage({ [key]: raw });
    const storage = createAdvisorOutcomeStorage(adapter, () => NOW);
    expect(await storage.loadAdvisorOutcomes('owner')).toEqual([]);
  });

  it('prunes outcomes older than 90 days and keeps only the newest 20', async () => {
    const key = advisorOutcomesStorageKey('owner');
    const rows = Array.from({ length: 24 }, (_, index) => ({
      recommendationId: `rec-${index}`,
      offeredAt: new Date(NOW.getTime() - index * 24 * 60 * 60 * 1000).toISOString(),
      startedAt: null,
      completedAt: null,
      helpful: null,
    }));
    rows.push({
      recommendationId: 'expired',
      offeredAt: '2026-05-01T12:00:00.000Z',
      startedAt: null,
      completedAt: null,
      helpful: null,
    });
    const { adapter, values } = memoryStorage({ [key]: JSON.stringify(rows) });
    const storage = createAdvisorOutcomeStorage(adapter, () => NOW);
    const loaded = await storage.loadAdvisorOutcomes('owner');
    expect(loaded).toHaveLength(20);
    expect(loaded.map((row) => row.recommendationId)).toEqual(
      Array.from({ length: 20 }, (_, index) => `rec-${index}`)
    );
    expect(JSON.parse(values.get(key) ?? '[]')).toHaveLength(20);
  });

  it('serializes racing writes without losing an outcome', async () => {
    const { adapter } = memoryStorage();
    let releaseFirstWrite: (() => void) | undefined;
    let signalFirstWrite: (() => void) | undefined;
    const firstWriteStarted = new Promise<void>((resolve) => {
      signalFirstWrite = resolve;
    });
    let writes = 0;
    const delayed: AdvisorOutcomeStorageAdapter = {
      ...adapter,
      setItem: async (key, value) => {
        writes += 1;
        if (writes === 1) {
          signalFirstWrite?.();
          await new Promise<void>((resolve) => { releaseFirstWrite = resolve; });
        }
        await adapter.setItem(key, value);
      },
    };
    const storage = createAdvisorOutcomeStorage(delayed, () => NOW);
    const first = storage.recordAdvisorOffered('owner', { id: 'first' });
    const second = storage.recordAdvisorOffered('owner', { id: 'second' });
    await firstWriteStarted;
    releaseFirstWrite?.();
    await Promise.all([first, second]);
    expect((await storage.loadAdvisorOutcomes('owner')).map((row) => row.recommendationId)).toEqual(['second', 'first']);
  });

  it('serializes clear after an in-flight write so history cannot reappear', async () => {
    const { adapter } = memoryStorage();
    let releaseWrite: (() => void) | undefined;
    let signalWrite: (() => void) | undefined;
    const writeStarted = new Promise<void>((resolve) => {
      signalWrite = resolve;
    });
    const delayed: AdvisorOutcomeStorageAdapter = {
      ...adapter,
      setItem: async (key, value) => {
        signalWrite?.();
        await new Promise<void>((resolve) => { releaseWrite = resolve; });
        await adapter.setItem(key, value);
      },
    };
    const storage = createAdvisorOutcomeStorage(delayed, () => NOW);
    const write = storage.recordAdvisorOffered('owner', { id: 'first' });
    const clear = storage.clearAdvisorOutcomes('owner');
    await writeStarted;
    releaseWrite?.();
    await Promise.all([write, clear]);
    expect(await storage.loadAdvisorOutcomes('owner')).toEqual([]);
  });

  it('wires clearing into sign-out, anonymous discard, and account deletion cleanup', () => {
    const auth = readFileSync(resolve(process.cwd(), 'mobile/lib/auth-context.tsx'), 'utf8');
    expect(auth).toContain("import { clearAdvisorOutcomes } from './advisor-outcome-storage';");
    expect(auth).toContain(
      "import { clearAdvisorObservationLedger } from './advisor-observation-ledger';"
    );
    const signOut = auth.slice(auth.indexOf('const signOut = async () =>'), auth.indexOf('const discardAnonymousProfile = async'));
    const discard = auth.slice(auth.indexOf('const discardAnonymousProfile = async'), auth.indexOf('const deleteAccount = async'));
    const deletion = auth.slice(auth.indexOf('const deleteAccount = async'));
    const expiredSession = auth.slice(
      auth.indexOf('const localCleanup = previousOwnerId'),
      auth.indexOf('// Avoid calling another auth method')
    );
    expect(signOut).toContain('clearAdvisorOutcomes(ownerKey)');
    expect(signOut).toContain('clearAdvisorObservationLedger(ownerKey)');
    expect(discard).toContain('clearAdvisorOutcomes(ownerKey)');
    expect(discard).toContain('clearAdvisorObservationLedger(ownerKey)');
    expect(deletion).toContain('clearAdvisorOutcomes(deletedOwnerKey)');
    expect(deletion).toContain('clearAdvisorObservationLedger(deletedOwnerKey)');
    expect(expiredSession).toContain(
      'clearAdvisorOutcomes(`user_id:${previousOwnerId}`)'
    );
    expect(expiredSession).toContain(
      'clearAdvisorObservationLedger(`user_id:${previousOwnerId}`)'
    );
    expect(auth).toContain('previousOwnerWasAnonymous');
    expect(auth).toContain("console.error('Abandoned anonymous Advisor cleanup failed:'");
  });
});
