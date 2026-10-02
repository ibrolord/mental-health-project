import { readFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { describe, expect, it, vi } from 'vitest';
import {
  ADVISOR_PROFILE_VERSION,
  defaultAdvisorProfile,
  type AdvisorProfile,
} from '../../mobile/lib/advisor-profile';
import {
  advisorProfileStorageKey,
  createAdvisorProfileStorage,
} from '../../mobile/lib/advisor-profile-storage';
import type { AdvisorPersonalPlan } from '../../mobile/lib/onboarding-journey';

const SOURCE_OWNER = 'user_id:anonymous/source';
const TARGET_OWNER = 'user_id:account/target';
const BEFORE = '2026-09-26T12:00:00.000Z';
const NOW = '2026-09-27T12:00:00.000Z';
const PLAN: AdvisorPersonalPlan = {
  motivation: 'Make room for friends', obstacle: 'custom', obstacleDetail: 'My shifts change',
  action: 'Take a short walk', cue: 'After lunch',
};
const EMPTY_PLAN: AdvisorPersonalPlan = {
  motivation: '', obstacle: null, obstacleDetail: '', action: '', cue: '',
};

function sourceProfile(): AdvisorProfile {
  return { ...defaultAdvisorProfile(NOW), preferredName: 'Source', focus: 'momentum',
    priorities: ['goals'], supportStyle: 'direct', lowEnergyEssentials: ['goals'],
    completedAt: NOW, onboardingDismissedAt: NOW, personalPlan: { ...PLAN } };
}

function legacyTarget(completedAt: string | null = null): AdvisorProfile {
  return { version: ADVISOR_PROFILE_VERSION, preferredName: 'Target', focus: 'recovery',
    priorities: ['sleep', 'mood'], supportStyle: 'practical', lowEnergyEssentials: ['rest'],
    completedAt, onboardingDismissedAt: BEFORE, updatedAt: BEFORE };
}

function harness() {
  const values = new Map<string, string>();
  const memory = {
    getItem: vi.fn(async (key: string) => values.get(key) ?? null),
    setItem: vi.fn(async (key: string, value: string) => { values.set(key, value); }),
    removeItem: vi.fn(async (key: string) => { values.delete(key); }),
  };
  const storage = createAdvisorProfileStorage(memory);
  const seed = (owner: string, profile: unknown) => {
    values.set(advisorProfileStorageKey(owner), JSON.stringify(profile));
  };
  return { values, memory, storage, seed };
}

async function migrateAndFinalize(
  storage: ReturnType<typeof createAdvisorProfileStorage>,
  source = SOURCE_OWNER,
  target = TARGET_OWNER
) {
  const finalize = await storage.migrateOwner(source, target);
  expect(await finalize()).toBe('complete');
}

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((yes) => { resolve = yes; });
  return { promise, resolve };
}

function delayRead(h: ReturnType<typeof harness>, owner: string) {
  const started = deferred();
  const release = deferred();
  let delayed = false;
  h.memory.getItem.mockImplementation(async (key) => {
    const snapshot = h.values.get(key) ?? null;
    if (key === advisorProfileStorageKey(owner) && !delayed) {
      delayed = true;
      started.resolve();
      await release.promise;
    }
    return snapshot;
  });
  return { started: started.promise, release: release.resolve };
}

describe('local Advisor profile owner migration', () => {
  it('keeps the entire source profile when the target is absent', async () => {
    const { storage, seed, values, memory } = harness();
    const source = sourceProfile();
    seed(SOURCE_OWNER, source);
    await migrateAndFinalize(storage);
    expect(await storage.read(TARGET_OWNER)).toEqual(source);
    expect(memory.setItem).toHaveBeenCalledTimes(2);
    expect(JSON.parse(memory.setItem.mock.calls[0][1])).toEqual({ ...source,
      _ownerMigration: { version: 1, sourceOwnerKey: SOURCE_OWNER, scope: 'profile' } });
    expect(JSON.parse(values.get(advisorProfileStorageKey(TARGET_OWNER))!)).toEqual(source);
    expect(values.has(advisorProfileStorageKey(SOURCE_OWNER))).toBe(false);
  });

  it('keeps legacy source settings and incomplete status when the target is absent', async () => {
    const { storage, seed, values } = harness();
    const source = legacyTarget();
    seed(SOURCE_OWNER, source);
    await migrateAndFinalize(storage);
    expect(await storage.read(TARGET_OWNER)).toEqual({ ...source, personalPlan: EMPTY_PLAN });
    expect(values.has(advisorProfileStorageKey(SOURCE_OWNER))).toBe(false);
  });

  it.each([null, BEFORE])('fills a legacy plan without changing target settings or completion %s', async (completedAt) => {
    const { storage, seed, values } = harness();
    const target = legacyTarget(completedAt);
    seed(SOURCE_OWNER, sourceProfile());
    seed(TARGET_OWNER, target);
    await migrateAndFinalize(storage);
    expect(await storage.read(TARGET_OWNER)).toEqual({ ...target, personalPlan: PLAN });
    expect(values.has(advisorProfileStorageKey(SOURCE_OWNER))).toBe(false);
  });

  it('copies a coherent normalized source plan, not target focus or stale source answers', async () => {
    const { storage, seed } = harness();
    const target = legacyTarget();
    seed(TARGET_OWNER, target);
    seed(SOURCE_OWNER, { ...sourceProfile(), personalPlan: {
      motivation: '  Make\nroom for friends ', obstacle: 'time', obstacleDetail: 'Stale custom answer',
      action: ' \u0000\n ', cue: 'A cue without an action',
    } });
    await migrateAndFinalize(storage);
    expect(await storage.read(TARGET_OWNER)).toEqual({ ...target, personalPlan: {
      motivation: 'Make room for friends', obstacle: 'time', obstacleDetail: '', action: '', cue: '',
    } });
  });

  it.each([
    { label: 'explicitly cleared', personalPlan: EMPTY_PLAN },
    { label: 'existing', personalPlan: { ...PLAN, action: 'Read a page', cue: 'Before bed' } },
    { label: 'explicit null', personalPlan: null },
    { label: 'explicit empty object', personalPlan: {} },
  ])('keeps an $label target plan authoritative without rewriting its profile', async ({ personalPlan }) => {
    const { storage, seed, values, memory } = harness();
    const target = { ...legacyTarget(), personalPlan };
    seed(SOURCE_OWNER, sourceProfile());
    seed(TARGET_OWNER, target);
    const observed = vi.fn();
    storage.subscribe(TARGET_OWNER, observed);
    await migrateAndFinalize(storage);
    expect(values.get(advisorProfileStorageKey(TARGET_OWNER))).toBe(JSON.stringify(target));
    expect(memory.setItem).not.toHaveBeenCalled();
    expect(observed).not.toHaveBeenCalled();
    expect(values.has(advisorProfileStorageKey(SOURCE_OWNER))).toBe(false);
  });

  it('does not invent a target plan when both stored profiles predate personal plans', async () => {
    const { storage, seed, memory, values } = harness();
    const target = legacyTarget();
    seed(SOURCE_OWNER, { ...legacyTarget(NOW), preferredName: 'Source' });
    seed(TARGET_OWNER, target);
    await migrateAndFinalize(storage);
    expect(values.get(advisorProfileStorageKey(TARGET_OWNER))).toBe(JSON.stringify(target));
    expect(memory.setItem).not.toHaveBeenCalled();
    expect(values.has(advisorProfileStorageKey(SOURCE_OWNER))).toBe(false);
  });

  it.each([false, true])('preserves the source and target after a failed write (legacy target: %s)', async (hasTarget) => {
    const { storage, seed, memory, values } = harness();
    seed(SOURCE_OWNER, sourceProfile());
    if (hasTarget) seed(TARGET_OWNER, legacyTarget());
    const before = new Map(values);
    const sourceListener = vi.fn();
    const targetListener = vi.fn();
    storage.subscribe(SOURCE_OWNER, sourceListener);
    storage.subscribe(TARGET_OWNER, targetListener);
    memory.setItem.mockRejectedValueOnce(new Error('disk full'));
    await expect(storage.migrateOwner(SOURCE_OWNER, TARGET_OWNER)).rejects.toThrow('disk full');
    expect(values).toEqual(before);
    expect(memory.removeItem).not.toHaveBeenCalled();
    expect(sourceListener).not.toHaveBeenCalled();
    expect(targetListener).not.toHaveBeenCalled();
    await migrateAndFinalize(storage);
    expect((await storage.read(TARGET_OWNER)).personalPlan).toEqual(PLAN);
    expect(targetListener).toHaveBeenCalledOnce();
    expect(values.has(advisorProfileStorageKey(SOURCE_OWNER))).toBe(false);
  });

  it.each([false, true])('persists and notifies the target before deleting and notifying the source (legacy: %s)', async (hasTarget) => {
    const { storage, seed, memory, values } = harness();
    const source = sourceProfile();
    const target = legacyTarget();
    seed(SOURCE_OWNER, source);
    if (hasTarget) seed(TARGET_OWNER, target);
    const events: string[] = [];
    let finishWrite!: () => void;
    const writing = new Promise<void>((resolve) => { finishWrite = resolve; });
    let startWrite!: () => void;
    const started = new Promise<void>((resolve) => { startWrite = resolve; });
    memory.setItem.mockImplementationOnce(async (key, value) => {
      startWrite();
      await writing;
      values.set(key, value);
      events.push('persisted');
    });
    const expected = hasTarget ? { ...target, personalPlan: PLAN } : source;
    const unsubscribe = storage.subscribe(TARGET_OWNER, (profile) => {
      expect(profile).toEqual(expected);
      expect(JSON.parse(values.get(advisorProfileStorageKey(TARGET_OWNER))!)).toEqual({ ...expected,
        _ownerMigration: { version: 1, sourceOwnerKey: SOURCE_OWNER,
          scope: hasTarget ? 'personalPlan' : 'profile' } });
      expect(values.has(advisorProfileStorageKey(SOURCE_OWNER))).toBe(true);
      events.push('target notified');
    });
    storage.subscribe(SOURCE_OWNER, (profile) => {
      expect(profile).toBeNull();
      expect(values.has(advisorProfileStorageKey(SOURCE_OWNER))).toBe(false);
      events.push('source cleared');
    });
    const unrelated = vi.fn();
    storage.subscribe('user_id:someone-else', unrelated);
    const migration = migrateAndFinalize(storage);
    await started;
    expect(events).toEqual([]);
    expect(values.has(advisorProfileStorageKey(SOURCE_OWNER))).toBe(true);
    expect(memory.removeItem).not.toHaveBeenCalled();
    finishWrite();
    await migration;
    expect(events).toEqual(['persisted', 'target notified', 'source cleared']);
    expect(unrelated).not.toHaveBeenCalled();
    unsubscribe();
  });

  it('retries a failed source deletion without replacing an already migrated target plan', async () => {
    const { storage, seed, memory, values } = harness();
    seed(SOURCE_OWNER, sourceProfile());
    seed(TARGET_OWNER, legacyTarget());
    memory.removeItem.mockRejectedValueOnce(new Error('remove failed'));
    await expect(migrateAndFinalize(storage)).rejects.toThrow('remove failed');
    expect(values.has(advisorProfileStorageKey(SOURCE_OWNER))).toBe(true);
    expect((await storage.read(TARGET_OWNER)).personalPlan).toEqual(PLAN);
    const target = { ...legacyTarget(), personalPlan: EMPTY_PLAN };
    seed(TARGET_OWNER, target);
    await migrateAndFinalize(storage);
    expect(await storage.read(TARGET_OWNER)).toEqual(target);
    expect(memory.setItem).toHaveBeenCalledOnce();
    expect(values.has(advisorProfileStorageKey(SOURCE_OWNER))).toBe(false);
  });

  it.each(['source', 'target'] as const)('preserves both owners when the %s read fails', async (owner) => {
    const { storage, seed, memory, values } = harness();
    seed(SOURCE_OWNER, sourceProfile());
    seed(TARGET_OWNER, legacyTarget());
    const before = new Map(values);
    const failedKey = advisorProfileStorageKey(owner === 'source' ? SOURCE_OWNER : TARGET_OWNER);
    memory.getItem.mockImplementation(async (key) => {
      if (key === failedKey) throw new Error('read failed');
      return values.get(key) ?? null;
    });
    await expect(storage.migrateOwner(SOURCE_OWNER, TARGET_OWNER)).rejects.toThrow('read failed');
    expect(values).toEqual(before);
    expect(memory.setItem).not.toHaveBeenCalled();
    expect(memory.removeItem).not.toHaveBeenCalled();
  });

  it.each([
    { label: 'invalid JSON', raw: '{broken' },
    { label: 'null', raw: 'null' },
    { label: 'array', raw: '[]' },
    { label: 'future version', raw: JSON.stringify({ ...sourceProfile(), version: ADVISOR_PROFILE_VERSION + 1 }) },
  ])('preserves data rather than treating $label as an absent profile', async ({ raw }) => {
    for (const invalidOwner of [SOURCE_OWNER, TARGET_OWNER]) {
      const { storage, seed, values, memory } = harness();
      seed(SOURCE_OWNER, sourceProfile());
      seed(TARGET_OWNER, legacyTarget());
      values.set(advisorProfileStorageKey(invalidOwner), raw);
      const before = new Map(values);
      await expect(storage.migrateOwner(SOURCE_OWNER, TARGET_OWNER)).rejects.toThrow();
      expect(values).toEqual(before);
      expect(memory.setItem).not.toHaveBeenCalled();
      expect(memory.removeItem).not.toHaveBeenCalled();
    }
  });

  it('is a no-op for missing sources, already migrated sources, and identical owner keys', async () => {
    const { storage, seed, memory, values } = harness();
    await migrateAndFinalize(storage);
    expect(memory.setItem).not.toHaveBeenCalled();
    expect(memory.removeItem).not.toHaveBeenCalled();
    const source = sourceProfile();
    seed(SOURCE_OWNER, source);
    await migrateAndFinalize(storage, SOURCE_OWNER, SOURCE_OWNER);
    expect(values.get(advisorProfileStorageKey(SOURCE_OWNER))).toBe(JSON.stringify(source));
    expect(memory.removeItem).not.toHaveBeenCalled();
    await migrateAndFinalize(storage);
    await migrateAndFinalize(storage);
    expect(memory.setItem).toHaveBeenCalledTimes(2);
    expect(memory.removeItem).toHaveBeenCalledOnce();
  });

  it('uses encoded v1 owner keys without touching consent, other stores, or other owners', async () => {
    const { storage, seed, memory, values } = harness();
    const unrelated = new Map([
      [`mhtoolkit.ai_data_sharing_consent.v4:${encodeURIComponent(SOURCE_OWNER)}`, 'granted'],
      [`mhtoolkit.ai_data_sharing_consent.v4:${encodeURIComponent(TARGET_OWNER)}`, 'denied'],
      [`mhtoolkit.advisor_action.v1:${encodeURIComponent(SOURCE_OWNER)}`, 'source action'],
      [`mhtoolkit.advisor_action.v1:${encodeURIComponent(TARGET_OWNER)}`, 'target action'],
      [advisorProfileStorageKey('session_id:anonymous/source'), JSON.stringify(sourceProfile())],
      [advisorProfileStorageKey('user_id:unrelated'), JSON.stringify(legacyTarget())],
    ]);
    for (const [key, value] of unrelated) values.set(key, value);
    seed(SOURCE_OWNER, sourceProfile());
    seed(TARGET_OWNER, legacyTarget());
    await migrateAndFinalize(storage);
    expect(advisorProfileStorageKey(SOURCE_OWNER)).toBe('mhtoolkit.advisor.profile.v1:user_id%3Aanonymous%2Fsource');
    expect(advisorProfileStorageKey(TARGET_OWNER)).toBe('mhtoolkit.advisor.profile.v1:user_id%3Aaccount%2Ftarget');
    expect(memory.getItem.mock.calls).toEqual([
      [advisorProfileStorageKey(SOURCE_OWNER)], [advisorProfileStorageKey(TARGET_OWNER)],
      [advisorProfileStorageKey(SOURCE_OWNER)], [advisorProfileStorageKey(TARGET_OWNER)],
    ]);
    expect(memory.removeItem).toHaveBeenCalledExactlyOnceWith(advisorProfileStorageKey(SOURCE_OWNER));
    for (const [key, value] of unrelated) expect(values.get(key)).toBe(value);
  });
});

describe('durable provisional Advisor profile copies', () => {
  it.each(['identical save', 'new answer', 'empty plan'] as const)(
    'keeps an explicit target %s authoritative across a failed migration and restart', async (change) => {
      const h = harness();
      h.seed(SOURCE_OWNER, sourceProfile());
      h.seed(TARGET_OWNER, legacyTarget());
      await h.storage.migrateOwner(SOURCE_OWNER, TARGET_OWNER);
      const target = await h.storage.read(TARGET_OWNER);
      const saved = { ...target, personalPlan: change === 'empty plan' ? EMPTY_PLAN :
        change === 'new answer' ? { ...PLAN, action: 'My target answer' } : PLAN };
      await h.storage.write(TARGET_OWNER, saved);
      await h.storage.write(SOURCE_OWNER, { ...sourceProfile(),
        personalPlan: { ...PLAN, action: 'New anonymous answer' } });
      const rawTarget = h.values.get(advisorProfileStorageKey(TARGET_OWNER));
      expect(JSON.parse(rawTarget!)).not.toHaveProperty('_ownerMigration');
      const restarted = createAdvisorProfileStorage(h.memory);
      await migrateAndFinalize(restarted);
      expect(await restarted.read(TARGET_OWNER)).toEqual(saved);
      expect(h.values.get(advisorProfileStorageKey(TARGET_OWNER))).toBe(rawTarget);
      expect(h.values.has(advisorProfileStorageKey(SOURCE_OWNER))).toBe(false);
    }
  );

  it('retries an unchanged pending copy without rewriting or notifying twice', async () => {
    const h = harness();
    h.seed(SOURCE_OWNER, sourceProfile());
    h.seed(TARGET_OWNER, legacyTarget());
    const observed = vi.fn();
    h.storage.subscribe(TARGET_OWNER, observed);
    const oldFinalize = await h.storage.migrateOwner(SOURCE_OWNER, TARGET_OWNER);
    const finalize = await h.storage.migrateOwner(SOURCE_OWNER, TARGET_OWNER);
    expect(h.memory.setItem).toHaveBeenCalledOnce();
    expect(observed).toHaveBeenCalledOnce();
    await finalize();
    const snapshot = new Map(h.values);
    await oldFinalize();
    await finalize();
    expect(h.values).toEqual(snapshot);
    expect(observed).toHaveBeenCalledOnce();
    expect(h.memory.removeItem).toHaveBeenCalledOnce();
    expect(JSON.parse(h.values.get(advisorProfileStorageKey(TARGET_OWNER))!))
      .not.toHaveProperty('_ownerMigration');
  });

  it.each([false, true])('recovers a copy committed before setItem rejects (legacy target: %s)', async (hasTarget) => {
    const h = harness();
    h.seed(SOURCE_OWNER, sourceProfile());
    if (hasTarget) h.seed(TARGET_OWNER, legacyTarget());
    h.memory.setItem.mockImplementationOnce(async (key, value) => {
      h.values.set(key, value);
      throw new Error('interrupted after commit');
    });
    await expect(h.storage.migrateOwner(SOURCE_OWNER, TARGET_OWNER))
      .rejects.toThrow('interrupted after commit');
    const restarted = createAdvisorProfileStorage(h.memory);
    const newer = { ...sourceProfile(), personalPlan: { ...PLAN, action: 'After the crash' } };
    await restarted.write(SOURCE_OWNER, newer);
    await migrateAndFinalize(restarted);
    expect(await restarted.read(TARGET_OWNER)).toEqual(hasTarget
      ? { ...legacyTarget(), personalPlan: newer.personalPlan } : newer);
    expect(h.values.has(advisorProfileStorageKey(SOURCE_OWNER))).toBe(false);
  });

  it.each([false, true])('publishes an unchanged commit-then-reject copy on retry (restart: %s)', async (restart) => {
    const h = harness();
    h.seed(SOURCE_OWNER, sourceProfile());
    h.seed(TARGET_OWNER, legacyTarget());
    const observed = vi.fn();
    h.storage.subscribe(TARGET_OWNER, observed);
    h.memory.setItem.mockImplementationOnce(async (key, value) => {
      h.values.set(key, value);
      throw new Error('copy committed but not acknowledged');
    });
    await expect(h.storage.migrateOwner(SOURCE_OWNER, TARGET_OWNER))
      .rejects.toThrow('copy committed but not acknowledged');
    expect(observed).not.toHaveBeenCalled();
    const storage = restart ? createAdvisorProfileStorage(h.memory) : h.storage;
    if (restart) storage.subscribe(TARGET_OWNER, observed);
    const finalize = await storage.migrateOwner(SOURCE_OWNER, TARGET_OWNER);
    expect(observed).toHaveBeenCalledExactlyOnceWith({ ...legacyTarget(), personalPlan: PLAN });
    expect(h.memory.setItem).toHaveBeenCalledOnce();
    await finalize();
    expect(observed).toHaveBeenCalledOnce();
    expect(await storage.read(TARGET_OWNER)).toEqual({ ...legacyTarget(), personalPlan: PLAN });
    expect(h.values.has(advisorProfileStorageKey(SOURCE_OWNER))).toBe(false);
  });

  it('keeps provenance after source deletion fails so an edited source still refreshes the target', async () => {
    const h = harness();
    h.seed(SOURCE_OWNER, sourceProfile());
    h.seed(TARGET_OWNER, legacyTarget());
    const finalize = await h.storage.migrateOwner(SOURCE_OWNER, TARGET_OWNER);
    h.memory.removeItem.mockRejectedValueOnce(new Error('source removal failed'));
    await expect(finalize()).rejects.toThrow('source removal failed');
    const restarted = createAdvisorProfileStorage(h.memory);
    const newer = { ...sourceProfile(), personalPlan: { ...PLAN, action: 'Keep this newer answer' } };
    await restarted.write(SOURCE_OWNER, newer);
    await migrateAndFinalize(restarted);
    expect((await restarted.read(TARGET_OWNER)).personalPlan).toEqual(newer.personalPlan);
    expect(h.values.has(advisorProfileStorageKey(SOURCE_OWNER))).toBe(false);
  });

  it.each(['source removal acknowledgement', 'provenance cleanup'] as const)(
    'recovers a crash at %s after the source has already been removed', async (failure) => {
      const h = harness();
      h.seed(SOURCE_OWNER, sourceProfile());
      h.seed(TARGET_OWNER, legacyTarget());
      const finalize = await h.storage.migrateOwner(SOURCE_OWNER, TARGET_OWNER);
      if (failure === 'source removal acknowledgement') {
        h.memory.removeItem.mockImplementationOnce(async (key) => {
          h.values.delete(key);
          throw new Error('interrupted');
        });
      } else {
        h.memory.setItem.mockRejectedValueOnce(new Error('interrupted'));
      }
      await expect(finalize()).rejects.toThrow('interrupted');
      expect(h.values.has(advisorProfileStorageKey(SOURCE_OWNER))).toBe(false);
      expect(JSON.parse(h.values.get(advisorProfileStorageKey(TARGET_OWNER))!))
        .toHaveProperty('_ownerMigration');
      const restarted = createAdvisorProfileStorage(h.memory);
      await migrateAndFinalize(restarted);
      expect(await restarted.read(TARGET_OWNER)).toEqual({ ...legacyTarget(), personalPlan: PLAN });
      expect(JSON.parse(h.values.get(advisorProfileStorageKey(TARGET_OWNER))!))
        .not.toHaveProperty('_ownerMigration');
      const snapshot = new Map(h.values);
      await migrateAndFinalize(restarted);
      expect(h.values).toEqual(snapshot);
      expect(h.memory.removeItem).toHaveBeenCalledOnce();
    }
  );

  it('preserves both records if an edited source cannot refresh a pending target', async () => {
    const h = harness();
    h.seed(SOURCE_OWNER, sourceProfile());
    h.seed(TARGET_OWNER, legacyTarget());
    await h.storage.migrateOwner(SOURCE_OWNER, TARGET_OWNER);
    const newer = { ...sourceProfile(), personalPlan: { ...PLAN, action: 'Never discard this' } };
    await h.storage.write(SOURCE_OWNER, newer);
    const before = new Map(h.values);
    h.memory.setItem.mockRejectedValueOnce(new Error('disk full on retry'));
    await expect(migrateAndFinalize(h.storage)).rejects.toThrow('disk full on retry');
    expect(h.values).toEqual(before);
    expect(h.memory.removeItem).not.toHaveBeenCalled();
    await migrateAndFinalize(createAdvisorProfileStorage(h.memory));
    expect((await h.storage.read(TARGET_OWNER)).personalPlan).toEqual(newer.personalPlan);
  });

  it('keeps the source when the destination is cleared before finalization', async () => {
    const h = harness();
    h.seed(SOURCE_OWNER, sourceProfile());
    const finalize = await h.storage.migrateOwner(SOURCE_OWNER, TARGET_OWNER);
    await h.storage.clear(TARGET_OWNER);
    expect(await finalize()).toBe('retry-required');
    expect(await h.storage.read(SOURCE_OWNER)).toEqual(sourceProfile());
    expect(h.values.has(advisorProfileStorageKey(TARGET_OWNER))).toBe(false);
    expect(h.memory.removeItem).not.toHaveBeenCalledWith(advisorProfileStorageKey(SOURCE_OWNER));
  });

  it('serializes a target save through the finalization read and provenance cleanup', async () => {
    const h = harness();
    h.seed(SOURCE_OWNER, sourceProfile());
    const finalize = await h.storage.migrateOwner(SOURCE_OWNER, TARGET_OWNER);
    const delayed = delayRead(h, TARGET_OWNER);
    const finalizing = finalize();
    await delayed.started;
    const newer = { ...sourceProfile(), personalPlan: { ...PLAN, action: 'An explicit target edit' } };
    const saving = h.storage.write(TARGET_OWNER, newer);
    delayed.release();
    await finalizing;
    await saving;
    expect(await h.storage.read(TARGET_OWNER)).toEqual(newer);
    expect(h.values.has(advisorProfileStorageKey(SOURCE_OWNER))).toBe(false);
  });

  it('does not let a stale finalizer delete a source edited and copied on a newer attempt', async () => {
    const h = harness();
    h.seed(SOURCE_OWNER, sourceProfile());
    const oldFinalize = await h.storage.migrateOwner(SOURCE_OWNER, TARGET_OWNER);
    const newer = { ...sourceProfile(), personalPlan: { ...PLAN, action: 'Latest source answer' } };
    await h.storage.write(SOURCE_OWNER, newer);
    const finalize = await h.storage.migrateOwner(SOURCE_OWNER, TARGET_OWNER);
    const before = new Map(h.values);
    expect(await oldFinalize()).toBe('retry-required');
    expect(h.values).toEqual(before);
    expect(await finalize()).toBe('complete');
    expect(await h.storage.read(TARGET_OWNER)).toEqual(newer);
    expect(h.values.has(advisorProfileStorageKey(SOURCE_OWNER))).toBe(false);
  });

  it.each([null, {}, { version: 2, sourceOwnerKey: SOURCE_OWNER, scope: 'profile' },
    { version: 1, sourceOwnerKey: '', scope: 'personalPlan' },
    { version: 1, sourceOwnerKey: SOURCE_OWNER, scope: 'unknown' }])(
    'fails closed on malformed or unsupported migration metadata: %j', async (marker) => {
      const h = harness();
      h.seed(SOURCE_OWNER, sourceProfile());
      h.seed(TARGET_OWNER, { ...legacyTarget(), personalPlan: PLAN, _ownerMigration: marker });
      const before = new Map(h.values);
      await expect(migrateAndFinalize(h.storage)).rejects.toThrow('could not be recovered');
      expect(h.values).toEqual(before);
      expect(h.memory.setItem).not.toHaveBeenCalled();
      expect(h.memory.removeItem).not.toHaveBeenCalled();
    }
  );

  it('does not overwrite another source owner\'s pending copy', async () => {
    const h = harness();
    h.seed(SOURCE_OWNER, sourceProfile());
    await h.storage.migrateOwner(SOURCE_OWNER, TARGET_OWNER);
    h.seed('user_id:another-anonymous', { ...sourceProfile(), preferredName: 'Another owner' });
    const before = new Map(h.values);
    await expect(migrateAndFinalize(h.storage, 'user_id:another-anonymous', TARGET_OWNER))
      .rejects.toThrow('Another Advisor profile migration is still pending');
    expect(h.values).toEqual(before);
  });
});

describe('serialized Advisor profile migration', () => {
  it('retains the source until explicit finalization and notifies its removal only once', async () => {
    const { storage, seed, values } = harness();
    const source = sourceProfile();
    seed(SOURCE_OWNER, source);
    const observed = vi.fn();
    storage.subscribe(SOURCE_OWNER, observed);
    const finalize = await storage.migrateOwner(SOURCE_OWNER, TARGET_OWNER);
    expect(await storage.read(TARGET_OWNER)).toEqual(source);
    expect(values.get(advisorProfileStorageKey(SOURCE_OWNER))).toBe(JSON.stringify(source));
    expect(observed).not.toHaveBeenCalled();
    await finalize();
    await finalize();
    expect(values.has(advisorProfileStorageKey(SOURCE_OWNER))).toBe(false);
    expect(observed).toHaveBeenCalledExactlyOnceWith(null);
  });

  it('does not overwrite a newer target name or action during a delayed target read', async () => {
    const h = harness();
    h.seed(SOURCE_OWNER, sourceProfile());
    h.seed(TARGET_OWNER, legacyTarget());
    const delayed = delayRead(h, TARGET_OWNER);
    const observed = vi.fn();
    h.storage.subscribe(TARGET_OWNER, observed);
    const migration = h.storage.migrateOwner(SOURCE_OWNER, TARGET_OWNER);
    await delayed.started;
    const newer = { ...legacyTarget(), preferredName: 'New target name',
      personalPlan: { ...PLAN, action: 'A newer target action' } };
    const saving = h.storage.write(TARGET_OWNER, newer);
    expect(h.memory.setItem).not.toHaveBeenCalled();
    delayed.release();
    const finalize = await migration;
    await saving;
    await finalize();
    expect(await h.storage.read(TARGET_OWNER)).toEqual(newer);
    expect(observed.mock.calls.map(([profile]) => profile)).toEqual([
      { ...legacyTarget(), personalPlan: PLAN }, newer,
    ]);
  });

  it('does not delete a newer source answer saved during a delayed source read', async () => {
    const h = harness();
    h.seed(SOURCE_OWNER, sourceProfile());
    h.seed(TARGET_OWNER, legacyTarget());
    const delayed = delayRead(h, SOURCE_OWNER);
    const observed = vi.fn();
    h.storage.subscribe(SOURCE_OWNER, observed);
    const migration = h.storage.migrateOwner(SOURCE_OWNER, TARGET_OWNER);
    await delayed.started;
    const newer = { ...sourceProfile(), personalPlan: { ...PLAN, action: 'A newer source answer' } };
    const saving = h.storage.write(SOURCE_OWNER, newer);
    expect(h.memory.setItem).not.toHaveBeenCalled();
    delayed.release();
    const finalize = await migration;
    await saving;
    expect(await finalize()).toBe('retry-required');
    expect(await h.storage.read(SOURCE_OWNER)).toEqual(newer);
    expect((await h.storage.read(TARGET_OWNER)).personalPlan).toEqual(newer.personalPlan);
    expect(observed).toHaveBeenCalledExactlyOnceWith(newer);
    expect(h.memory.removeItem).not.toHaveBeenCalled();
    expect(await finalize()).toBe('complete');
    expect(h.values.has(advisorProfileStorageKey(SOURCE_OWNER))).toBe(false);
  });

  it.each([SOURCE_OWNER, TARGET_OWNER])('waits for an earlier pending save on %s before reading either owner', async (owner) => {
    const h = harness();
    h.seed(SOURCE_OWNER, sourceProfile());
    h.seed(TARGET_OWNER, legacyTarget());
    const started = deferred();
    const release = deferred();
    h.memory.setItem.mockImplementationOnce(async (key, value) => {
      started.resolve();
      await release.promise;
      h.values.set(key, value);
    });
    const newer = { ...sourceProfile(), preferredName: 'Latest saved name',
      personalPlan: { ...PLAN, action: 'Latest saved answer' } };
    const saving = h.storage.write(owner, newer);
    await started.promise;
    const migration = h.storage.migrateOwner(SOURCE_OWNER, TARGET_OWNER);
    expect(h.memory.getItem).not.toHaveBeenCalled();
    release.resolve();
    await saving;
    const finalize = await migration;
    await finalize();
    expect(await h.storage.read(TARGET_OWNER)).toEqual(owner === TARGET_OWNER
      ? newer : { ...legacyTarget(), personalPlan: newer.personalPlan });
  });

  it.each([SOURCE_OWNER, TARGET_OWNER])('orders a concurrent clear on %s after a delayed migration read', async (owner) => {
    const h = harness();
    h.seed(SOURCE_OWNER, sourceProfile());
    h.seed(TARGET_OWNER, legacyTarget());
    const delayed = delayRead(h, owner);
    const observed = vi.fn();
    h.storage.subscribe(owner, observed);
    const migration = h.storage.migrateOwner(SOURCE_OWNER, TARGET_OWNER);
    await delayed.started;
    const clearing = h.storage.clear(owner);
    expect(h.memory.removeItem).not.toHaveBeenCalled();
    delayed.release();
    const finalize = await migration;
    await clearing;
    await finalize();
    expect(h.values.has(advisorProfileStorageKey(owner))).toBe(false);
    expect(observed.mock.calls.filter(([profile]) => profile === null)).toHaveLength(1);
    expect(observed.mock.calls.at(-1)).toEqual([null]);
    if (owner === SOURCE_OWNER) expect((await h.storage.read(TARGET_OWNER)).personalPlan).toEqual(PLAN);
  });

  it.each(['identical save', 'clear and restore'] as const)('keeps a newer source revision after %s, even when bytes match', async (change) => {
    const h = harness();
    const source = sourceProfile();
    await h.storage.write(SOURCE_OWNER, source);
    const originalRaw = h.values.get(advisorProfileStorageKey(SOURCE_OWNER));
    const finalize = await h.storage.migrateOwner(SOURCE_OWNER, TARGET_OWNER);
    if (change === 'clear and restore') await h.storage.clear(SOURCE_OWNER);
    await h.storage.write(SOURCE_OWNER, source);
    expect(h.values.get(advisorProfileStorageKey(SOURCE_OWNER))).toBe(originalRaw);
    const observed = vi.fn();
    h.storage.subscribe(SOURCE_OWNER, observed);
    expect(await finalize()).toBe('retry-required');
    expect(await h.storage.read(SOURCE_OWNER)).toEqual(source);
    expect(observed).not.toHaveBeenCalled();
  });

  it('keeps source bytes changed outside the profile store after copying', async () => {
    const h = harness();
    h.seed(SOURCE_OWNER, sourceProfile());
    const finalize = await h.storage.migrateOwner(SOURCE_OWNER, TARGET_OWNER);
    const newer = { ...sourceProfile(), preferredName: 'Externally updated' };
    h.seed(SOURCE_OWNER, newer);
    expect(await finalize()).toBe('retry-required');
    expect(await h.storage.read(SOURCE_OWNER)).toEqual(newer);
    expect(await h.storage.read(TARGET_OWNER)).toEqual(newer);
    expect(h.memory.removeItem).not.toHaveBeenCalled();
  });

  it('serializes saves requested by a migration subscriber without deadlocking or deleting their answer', async () => {
    const h = harness();
    h.seed(SOURCE_OWNER, sourceProfile());
    const newer = { ...sourceProfile(), personalPlan: { ...PLAN, action: 'Saved by mounted source' } };
    let saving!: Promise<AdvisorProfile>;
    const sourceObserved = vi.fn();
    h.storage.subscribe(SOURCE_OWNER, sourceObserved);
    h.storage.subscribe(TARGET_OWNER, () => { saving = h.storage.write(SOURCE_OWNER, newer); });
    const finalize = await h.storage.migrateOwner(SOURCE_OWNER, TARGET_OWNER);
    expect(await finalize()).toBe('retry-required');
    await saving;
    expect(await h.storage.read(SOURCE_OWNER)).toEqual(newer);
    expect(sourceObserved.mock.calls).toEqual([[newer], [newer]]);
  });

  it('does not block an unrelated owner while both migrating owners are reserved', async () => {
    const h = harness();
    h.seed(SOURCE_OWNER, sourceProfile());
    const delayed = delayRead(h, TARGET_OWNER);
    const migration = h.storage.migrateOwner(SOURCE_OWNER, TARGET_OWNER);
    await delayed.started;
    await h.storage.write('user_id:unrelated', sourceProfile());
    expect(await h.storage.read('user_id:unrelated')).toEqual(sourceProfile());
    delayed.release();
    await (await migration)();
  });

  it('releases both owner queues after a failed copy so saves and clears can still finish', async () => {
    const h = harness();
    h.seed(SOURCE_OWNER, sourceProfile());
    h.memory.setItem.mockRejectedValueOnce(new Error('copy failed'));
    await expect(h.storage.migrateOwner(SOURCE_OWNER, TARGET_OWNER)).rejects.toThrow('copy failed');
    await Promise.all([
      h.storage.write(TARGET_OWNER, { ...legacyTarget(), personalPlan: EMPTY_PLAN }),
      h.storage.clear(SOURCE_OWNER),
    ]);
    expect((await h.storage.read(TARGET_OWNER)).personalPlan).toEqual(EMPTY_PLAN);
    expect(h.values.has(advisorProfileStorageKey(SOURCE_OWNER))).toBe(false);
  });
});

// Run the actual local migration functions without loading native auth or starting a session.
function authMigration(
  memory: ReturnType<typeof harness>['memory'],
  storage: ReturnType<typeof createAdvisorProfileStorage>,
  moveAudio: (source: string, target: string) => Promise<void> = async () => {}
) {
  const source = readFileSync(path.resolve('mobile/lib/auth-context.tsx'), 'utf8');
  const ast = ts.createSourceFile('auth-context.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const functions = ast.statements.filter((node) => ts.isFunctionDeclaration(node) &&
    ['moveAsyncStorageKey', 'migrateAnonymousLocalState'].includes(node.name?.text ?? ''));
  expect(functions).toHaveLength(2);
  const compiled = ts.transpileModule(functions.map((node) => node.getText(ast)).join('\n'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const draftStorage = { read: vi.fn(async () => null), clear: vi.fn(async () => {}) };
  return new Function('AsyncStorage', 'advisorProfileStorage', 'moodDraftStorage', 'reflectionDraftStorage',
    'clearReflectionDraft', 'moveJournalAudioForUser', `${compiled}\nreturn migrateAnonymousLocalState;`)(
    memory, storage, draftStorage, draftStorage, vi.fn(async () => {}), moveAudio,
  ) as (sourceUserId: string, targetUserId: string) => Promise<void>;
}

// Exercise the enclosing auth success/recovery boundary, with no real sessions or requests.
function authMerge(h: ReturnType<typeof harness>, moveAudio: () => Promise<void>) {
  const source = readFileSync(path.resolve('mobile/lib/auth-context.tsx'), 'utf8');
  const ast = ts.createSourceFile('auth-context.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const declaration = ast.statements.find((node) => ts.isFunctionDeclaration(node) &&
    node.name?.text === 'mergeAnonymousSessionIntoCurrentAccount');
  expect(declaration).toBeDefined();
  const compiled = ts.transpileModule(declaration!.getText(ast), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const sourceSession = { user: { id: 'anonymous/source', is_anonymous: true },
    access_token: 'test-source-access', refresh_token: 'test-source-refresh' };
  const destination = { user: { id: 'account/target', is_anonymous: false },
    access_token: 'test-target-access' };
  const setSession = vi.fn(async (_tokens: { access_token: string; refresh_token: string }) => ({ error: null }));
  const supabase = { auth: {
    getSession: vi.fn(async () => ({ data: { session: destination }, error: null })),
    setSession,
  } };
  const apiRequest = vi.fn(async () => {});
  const completionsMigrated = vi.fn();
  const migrateToolCompletions = vi.fn(async (_source: string, _target: string, mergeProfile: () => Promise<void>) => {
    await mergeProfile();
    completionsMigrated();
  });
  const auth = new Function('supabase', 'apiRequest', 'migrateToolCompletions', 'migrateAnonymousLocalState',
    'sourceSession', `let pendingAnonymousMergeSourceId = sourceSession.user.id;
      ${compiled}
      return {
        merge: () => mergeAnonymousSessionIntoCurrentAccount(sourceSession),
        pending: () => pendingAnonymousMergeSourceId,
      };`)(supabase, apiRequest, migrateToolCompletions, authMigration(h.memory, h.storage, moveAudio), sourceSession
  ) as { merge: () => Promise<void>; pending: () => string | null };
  return { ...auth, setSession, apiRequest, migrateToolCompletions, completionsMigrated };
}

describe('anonymous auth profile migration integration', () => {
  it.each([false, true])('copies the latest source on retry after a later store fails (legacy target: %s)', async (hasTarget) => {
    const h = harness();
    h.seed(SOURCE_OWNER, sourceProfile());
    if (hasTarget) h.seed(TARGET_OWNER, legacyTarget());
    await expect(authMigration(h.memory, h.storage, async () => {
      throw new Error('audio migration failed');
    })('anonymous/source', 'account/target')).rejects.toThrow('audio migration failed');

    const newer = { ...sourceProfile(), preferredName: 'Updated source',
      personalPlan: { ...PLAN, action: 'The answer saved after the failure' } };
    await h.storage.write(SOURCE_OWNER, newer);
    // Reconstruct storage to exercise persisted provenance, not an in-memory retry flag.
    const restarted = createAdvisorProfileStorage(h.memory);
    await authMigration(h.memory, restarted)('anonymous/source', 'account/target');
    expect(await restarted.read(TARGET_OWNER)).toEqual(hasTarget
      ? { ...legacyTarget(), personalPlan: newer.personalPlan } : newer);
    expect(h.values.has(advisorProfileStorageKey(SOURCE_OWNER))).toBe(false);
    const afterSuccess = new Map(h.values);
    await authMigration(h.memory, restarted)('anonymous/source', 'account/target');
    expect(h.values).toEqual(afterSuccess);
  });

  it('calls profile storage with user owner keys and notifies mounted target consumers', async () => {
    const { memory, storage, seed, values } = harness();
    const target = legacyTarget();
    seed(SOURCE_OWNER, sourceProfile());
    seed(TARGET_OWNER, target);
    const migrate = vi.spyOn(storage, 'migrateOwner');
    const observed = vi.fn();
    storage.subscribe(TARGET_OWNER, observed);
    await authMigration(memory, storage)('anonymous/source', 'account/target');
    expect(migrate).toHaveBeenCalledExactlyOnceWith(SOURCE_OWNER, TARGET_OWNER);
    expect(observed).toHaveBeenCalledExactlyOnceWith({ ...target, personalPlan: PLAN });
    expect(await storage.read(TARGET_OWNER)).toEqual({ ...target, personalPlan: PLAN });
    expect(values.has(advisorProfileStorageKey(SOURCE_OWNER))).toBe(false);
    expect(memory.getItem.mock.calls.filter(([key]) => key === advisorProfileStorageKey(SOURCE_OWNER)))
      .toHaveLength(2);
  });

  it('propagates profile-write failures instead of deleting the anonymous source through the generic mover', async () => {
    const { memory, storage, seed, values } = harness();
    seed(SOURCE_OWNER, sourceProfile());
    seed(TARGET_OWNER, legacyTarget());
    const before = new Map(values);
    memory.setItem.mockRejectedValueOnce(new Error('disk full'));
    await expect(authMigration(memory, storage)('anonymous/source', 'account/target')).rejects.toThrow('disk full');
    expect(values).toEqual(before);
    expect(memory.removeItem).not.toHaveBeenCalled();
  });

  it.each(['key migration', 'final audio migration'] as const)(
    'retains the anonymous profile when a later %s fails after the profile copy', async (failure) => {
      const h = harness();
      const source = sourceProfile();
      h.seed(SOURCE_OWNER, source);
      h.seed(TARGET_OWNER, legacyTarget());
      const sourceObserved = vi.fn();
      const targetObserved = vi.fn();
      h.storage.subscribe(SOURCE_OWNER, sourceObserved);
      h.storage.subscribe(TARGET_OWNER, targetObserved);
      if (failure === 'key migration') {
        h.memory.getItem.mockImplementation(async (key) => {
          if (key === `mhtoolkit.advisor_action.v1:${encodeURIComponent(SOURCE_OWNER)}`) {
            throw new Error('later migration failed');
          }
          return h.values.get(key) ?? null;
        });
      }
      const moveAudio = async () => {
        if (failure === 'final audio migration') throw new Error('later migration failed');
      };
      await expect(authMigration(h.memory, h.storage, moveAudio)('anonymous/source', 'account/target'))
        .rejects.toThrow('later migration failed');
      expect(await h.storage.read(SOURCE_OWNER)).toEqual(source);
      expect(h.values.get(advisorProfileStorageKey(SOURCE_OWNER))).toBe(JSON.stringify(source));
      expect(await h.storage.read(TARGET_OWNER)).toEqual({ ...legacyTarget(), personalPlan: PLAN });
      expect(sourceObserved).not.toHaveBeenCalled();
      expect(targetObserved).toHaveBeenCalledExactlyOnceWith({ ...legacyTarget(), personalPlan: PLAN });
      expect(h.memory.removeItem).not.toHaveBeenCalledWith(advisorProfileStorageKey(SOURCE_OWNER));
    }
  );

  it('defers source cleanup until all other stores finish, then notifies subscribers', async () => {
    const h = harness();
    h.seed(SOURCE_OWNER, sourceProfile());
    const started = deferred();
    const release = deferred();
    const observed = vi.fn();
    h.storage.subscribe(SOURCE_OWNER, observed);
    const migration = authMigration(h.memory, h.storage, async () => {
      started.resolve();
      await release.promise;
    })('anonymous/source', 'account/target');
    await started.promise;
    expect((await h.storage.read(TARGET_OWNER)).personalPlan).toEqual(PLAN);
    expect(h.values.has(advisorProfileStorageKey(SOURCE_OWNER))).toBe(true);
    expect(observed).not.toHaveBeenCalled();
    release.resolve();
    await migration;
    expect(h.values.has(advisorProfileStorageKey(SOURCE_OWNER))).toBe(false);
    expect(observed).toHaveBeenCalledExactlyOnceWith(null);
  });

  it.each([false, true])('finishes with the latest answer saved during migration (legacy target: %s)', async (hasTarget) => {
    const h = harness();
    h.seed(SOURCE_OWNER, sourceProfile());
    if (hasTarget) h.seed(TARGET_OWNER, legacyTarget());
    const started = deferred();
    const release = deferred();
    const observed = vi.fn();
    h.storage.subscribe(SOURCE_OWNER, observed);
    const migration = authMigration(h.memory, h.storage, async () => {
      started.resolve();
      await release.promise;
    })('anonymous/source', 'account/target');
    await started.promise;
    const newer = { ...sourceProfile(), personalPlan: { ...PLAN, action: 'Saved during auth migration' } };
    await h.storage.write(SOURCE_OWNER, newer);
    release.resolve();
    await migration;
    expect(await h.storage.read(TARGET_OWNER)).toEqual(hasTarget
      ? { ...legacyTarget(), personalPlan: newer.personalPlan } : newer);
    expect(h.values.has(advisorProfileStorageKey(SOURCE_OWNER))).toBe(false);
    expect(JSON.parse(h.values.get(advisorProfileStorageKey(TARGET_OWNER))!))
      .not.toHaveProperty('_ownerMigration');
    expect(observed.mock.calls).toEqual([[newer], [null]]);
  });

  it.each([false, true])('keeps auth and completion migration pending until refresh is durable (legacy: %s)', async (hasTarget) => {
    const h = harness();
    h.seed(SOURCE_OWNER, sourceProfile());
    if (hasTarget) h.seed(TARGET_OWNER, legacyTarget());
    const refreshing = deferred();
    const release = deferred();
    const newer = { ...sourceProfile(), preferredName: 'Updated while signing in',
      personalPlan: { ...PLAN, action: 'Latest answer during this attempt' } };
    const auth = authMerge(h, async () => {
      await h.storage.write(SOURCE_OWNER, newer);
      h.memory.setItem.mockImplementationOnce(async (key, value) => {
        expect(key).toBe(advisorProfileStorageKey(TARGET_OWNER));
        refreshing.resolve();
        await release.promise;
        h.values.set(key, value);
      });
    });
    const completed = vi.fn();
    const migration = auth.merge().then(completed);
    await refreshing.promise;
    expect(completed).not.toHaveBeenCalled();
    expect(auth.pending()).toBe('anonymous/source');
    expect(auth.completionsMigrated).not.toHaveBeenCalled();
    expect((await h.storage.read(TARGET_OWNER)).personalPlan).toEqual(PLAN);
    expect(await h.storage.read(SOURCE_OWNER)).toEqual(newer);
    release.resolve();
    await migration;
    expect(completed).toHaveBeenCalledOnce();
    expect(auth.pending()).toBeNull();
    expect(auth.completionsMigrated).toHaveBeenCalledOnce();
    expect(auth.migrateToolCompletions).toHaveBeenCalledExactlyOnceWith(SOURCE_OWNER, TARGET_OWNER, expect.any(Function));
    expect(auth.apiRequest).toHaveBeenCalledOnce();
    expect(auth.setSession).not.toHaveBeenCalled();
    expect(await h.storage.read(TARGET_OWNER)).toEqual(hasTarget
      ? { ...legacyTarget(), personalPlan: newer.personalPlan } : newer);
    expect(h.values.has(advisorProfileStorageKey(SOURCE_OWNER))).toBe(false);
    expect(JSON.parse(h.values.get(advisorProfileStorageKey(TARGET_OWNER))!)).not.toHaveProperty('_ownerMigration');
  });

  it('bounds repeated source edits and restores anonymous auth instead of reporting completion', async () => {
    const h = harness();
    h.seed(SOURCE_OWNER, sourceProfile());
    let updates = 0;
    const saves: Promise<AdvisorProfile>[] = [];
    const unsubscribe = h.storage.subscribe(TARGET_OWNER, () => {
      updates += 1;
      saves.push(h.storage.write(SOURCE_OWNER, { ...sourceProfile(),
        personalPlan: { ...PLAN, action: `Concurrent answer ${updates}` } }));
    });
    const auth = authMerge(h, async () => {});
    const restoring = deferred();
    const release = deferred();
    auth.setSession.mockImplementationOnce(async () => {
      restoring.resolve();
      await release.promise;
      return { error: null };
    });
    const rejected = expect(auth.merge()).rejects.toThrow('Please try signing in again');
    await restoring.promise;
    expect(auth.pending()).toBe('anonymous/source');
    expect(auth.completionsMigrated).not.toHaveBeenCalled();
    release.resolve();
    await rejected;
    await Promise.all(saves);
    expect(updates).toBe(3); // Initial copy plus two bounded refresh/check attempts.
    expect(auth.apiRequest).toHaveBeenCalledOnce();
    expect(auth.setSession).toHaveBeenCalledExactlyOnceWith({
      access_token: 'test-source-access', refresh_token: 'test-source-refresh',
    });
    expect((await h.storage.read(SOURCE_OWNER)).personalPlan?.action).toBe('Concurrent answer 3');
    expect((await h.storage.read(TARGET_OWNER)).personalPlan?.action).toBe('Concurrent answer 2');
    expect(JSON.parse(h.values.get(advisorProfileStorageKey(TARGET_OWNER))!)).toHaveProperty('_ownerMigration');
    expect(auth.pending()).toBeNull();
    unsubscribe();
    await authMerge(h, async () => {}).merge();
    expect((await h.storage.read(TARGET_OWNER)).personalPlan?.action).toBe('Concurrent answer 3');
    expect(h.values.has(advisorProfileStorageKey(SOURCE_OWNER))).toBe(false);
  });

  it.each(['identical save', 'new answer', 'empty plan'] as const)(
    'does not restore source answers over an explicit target %s during the attempt', async (change) => {
      const h = harness();
      h.seed(SOURCE_OWNER, sourceProfile());
      h.seed(TARGET_OWNER, legacyTarget());
      const expected = { ...legacyTarget(), personalPlan: change === 'empty plan' ? EMPTY_PLAN :
        change === 'new answer' ? { ...PLAN, action: 'My explicit target answer' } : PLAN };
      const auth = authMerge(h, async () => {
        await h.storage.write(SOURCE_OWNER, { ...sourceProfile(),
          personalPlan: { ...PLAN, action: 'Newer anonymous answer' } });
        await h.storage.write(TARGET_OWNER, expected);
      });
      await auth.merge();
      expect(await h.storage.read(TARGET_OWNER)).toEqual(expected);
      expect(h.memory.setItem).toHaveBeenCalledTimes(3); // Copy and the two explicit saves only.
      expect(h.values.has(advisorProfileStorageKey(SOURCE_OWNER))).toBe(false);
      expect(auth.completionsMigrated).toHaveBeenCalledOnce();
      expect(auth.setSession).not.toHaveBeenCalled();
    }
  );

  it.each(['cleared', 'foreign migration', 'changed provisional copy'] as const)(
    'fails closed when the target is %s during the attempt', async (change) => {
      const h = harness();
      h.seed(SOURCE_OWNER, sourceProfile());
      const newer = { ...sourceProfile(), personalPlan: { ...PLAN, action: 'Keep my newer answer' } };
      let expectedTarget: string | undefined;
      const auth = authMerge(h, async () => {
        await h.storage.write(SOURCE_OWNER, newer);
        if (change === 'cleared') await h.storage.clear(TARGET_OWNER);
        else h.seed(TARGET_OWNER, { ...legacyTarget(), _ownerMigration: { version: 1,
          sourceOwnerKey: change === 'foreign migration' ? 'user_id:unrelated' : SOURCE_OWNER, scope: 'profile' } });
        expectedTarget = h.values.get(advisorProfileStorageKey(TARGET_OWNER));
      });
      await expect(auth.merge()).rejects.toThrow('Please try signing in again');
      expect(await h.storage.read(SOURCE_OWNER)).toEqual(newer);
      expect(h.values.get(advisorProfileStorageKey(TARGET_OWNER))).toBe(expectedTarget);
      expect(auth.completionsMigrated).not.toHaveBeenCalled();
      expect(auth.setSession).toHaveBeenCalledOnce();
    }
  );

  it.each(['save', 'clear'] as const)('respects a target %s queued by the refresh notification', async (change) => {
    const h = harness();
    h.seed(SOURCE_OWNER, sourceProfile());
    const newer = { ...sourceProfile(), personalPlan: { ...PLAN, action: 'Refreshed source answer' } };
    const explicitTarget = { ...legacyTarget(), personalPlan: EMPTY_PLAN };
    let targetChange!: Promise<unknown>;
    h.storage.subscribe(TARGET_OWNER, (profile) => {
      if (profile?.personalPlan?.action === newer.personalPlan.action) {
        targetChange = change === 'clear' ? h.storage.clear(TARGET_OWNER) :
          h.storage.write(TARGET_OWNER, explicitTarget);
      }
    });
    const auth = authMerge(h, async () => { await h.storage.write(SOURCE_OWNER, newer); });
    if (change === 'clear') {
      await expect(auth.merge()).rejects.toThrow('Please try signing in again');
      expect(await h.storage.read(SOURCE_OWNER)).toEqual(newer);
      expect(h.values.has(advisorProfileStorageKey(TARGET_OWNER))).toBe(false);
      expect(auth.completionsMigrated).not.toHaveBeenCalled();
    } else {
      await auth.merge();
      expect(await h.storage.read(TARGET_OWNER)).toEqual(explicitTarget);
      expect(h.values.has(advisorProfileStorageKey(SOURCE_OWNER))).toBe(false);
      expect(auth.completionsMigrated).toHaveBeenCalledOnce();
    }
    await targetChange;
  });

  it.each([false, true])('does not complete auth when a refresh fails (committed: %s)', async (committed) => {
    const h = harness();
    h.seed(SOURCE_OWNER, sourceProfile());
    const newer = { ...sourceProfile(), personalPlan: { ...PLAN, action: 'Retry this answer safely' } };
    const auth = authMerge(h, async () => {
      await h.storage.write(SOURCE_OWNER, newer);
      h.memory.setItem.mockImplementationOnce(async (key, value) => {
        if (committed) h.values.set(key, value);
        throw new Error('refresh failed');
      });
    });
    await expect(auth.merge()).rejects.toThrow('refresh failed');
    expect(await h.storage.read(SOURCE_OWNER)).toEqual(newer);
    expect(auth.completionsMigrated).not.toHaveBeenCalled();
    expect(auth.setSession).toHaveBeenCalledOnce();
    await authMerge(h, async () => {}).merge();
    expect(await h.storage.read(TARGET_OWNER)).toEqual(newer);
    expect(h.values.has(advisorProfileStorageKey(SOURCE_OWNER))).toBe(false);
  });

  it('requires another attempt when an initially absent source is saved during migration', async () => {
    const h = harness();
    const auth = authMerge(h, async () => { await h.storage.write(SOURCE_OWNER, sourceProfile()); });
    await expect(auth.merge()).rejects.toThrow('Please try signing in again');
    expect(await h.storage.read(SOURCE_OWNER)).toEqual(sourceProfile());
    expect(h.values.has(advisorProfileStorageKey(TARGET_OWNER))).toBe(false);
    expect(auth.completionsMigrated).not.toHaveBeenCalled();
    expect(auth.setSession).toHaveBeenCalledOnce();
  });
});
