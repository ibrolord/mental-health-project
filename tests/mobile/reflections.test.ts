import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';

import { REFLECTION_TEMPLATES as WEB_REFLECTION_TEMPLATES } from '../../lib/reflections';
import {
  completedReflectionSteps,
  createReflectionDraftStorage,
  REFLECTION_RESPONSE_LIMIT,
  REFLECTION_TEMPLATES,
  reflectionDraftStorageKey,
  serializeReflectionResponses,
  validateReflectionResponses,
} from '../../mobile/lib/reflections';

class MemorySecureStore {
  values = new Map<string, string>();

  async getItemAsync(key: string): Promise<string | null> {
    return this.values.get(key) ?? null;
  }

  async setItemAsync(key: string, value: string): Promise<void> {
    this.values.set(key, value);
  }

  async deleteItemAsync(key: string): Promise<void> {
    this.values.delete(key);
  }
}

class DeferredSecureStore extends MemorySecureStore {
  private releaseWrite: (() => void) | null = null;
  private writeStartedResolve: (() => void) | null = null;
  readonly writeStarted = new Promise<void>((resolve) => {
    this.writeStartedResolve = resolve;
  });

  async setItemAsync(key: string, value: string): Promise<void> {
    if (!key.endsWith('.manifest') && !this.releaseWrite) {
      this.writeStartedResolve?.();
      await new Promise<void>((resolve) => {
        this.releaseWrite = resolve;
      });
    }
    await super.setItemAsync(key, value);
  }

  release(): void {
    this.releaseWrite?.();
  }
}

const reflectScreen = readFileSync(
  resolve(process.cwd(), 'mobile/app/reflect.tsx'),
  'utf8'
);
const draftStorageSource = readFileSync(
  resolve(process.cwd(), 'mobile/lib/reflection-draft-storage.ts'),
  'utf8'
);
const settingsSource = readFileSync(
  resolve(process.cwd(), 'mobile/app/settings.tsx'),
  'utf8'
);
const authContextSource = readFileSync(
  resolve(process.cwd(), 'mobile/lib/auth-context.tsx'),
  'utf8'
);

describe('mobile guided reflections', () => {
  let secureStore: MemorySecureStore;
  let generation: number;

  beforeEach(() => {
    secureStore = new MemorySecureStore();
    generation = 0;
  });

  const createStorage = () =>
    createReflectionDraftStorage({
      secureStore,
      now: () => '2026-08-08T12:00:00.000Z',
      createGeneration: () => `draft-${++generation}`,
    });

  it('ports every web reflection mode and its copy', () => {
    expect(REFLECTION_TEMPLATES).toEqual(WEB_REFLECTION_TEMPLATES);
    expect(REFLECTION_TEMPLATES).toHaveLength(7);
    expect(REFLECTION_TEMPLATES.filter((template) => template.primary)).toHaveLength(3);
    expect(REFLECTION_TEMPLATES.filter((template) => !template.primary)).toHaveLength(4);
  });

  it('serializes answered steps in order and rejects invalid responses', () => {
    const template = REFLECTION_TEMPLATES[1];
    const responses = {
      [template.steps[0].id]: '  A specific problem  ',
      [template.steps[2].id]: '',
      [template.steps[4].id]: 'If it is 9 AM, I will begin for five minutes.',
    };

    expect(serializeReflectionResponses(template, responses)).toBe(
      `## ${template.steps[0].label}\nA specific problem\n\n` +
        `## ${template.steps[4].label}\nIf it is 9 AM, I will begin for five minutes.`
    );
    expect(completedReflectionSteps(template, responses)).toBe(2);
    expect(validateReflectionResponses(template, {})).toBe(
      'Write at least one response before saving.'
    );
    expect(
      validateReflectionResponses(template, {
        [template.steps[0].id]: 'x'.repeat(REFLECTION_RESPONSE_LIMIT + 1),
      })
    ).toContain('Keep each response under');
  });

  it('isolates encrypted drafts by owner and chunks full-length responses', async () => {
    const storage = createStorage();
    const template = REFLECTION_TEMPLATES[0];
    const longResponse = 'private words '.repeat(140).slice(0, REFLECTION_RESPONSE_LIMIT);

    await storage.write('owner-a', {
      templateId: template.id,
      stepIndex: 2,
      responses: { [template.steps[2].id]: longResponse },
    });
    await storage.write('owner-b', {
      templateId: REFLECTION_TEMPLATES[2].id,
      stepIndex: 1,
      responses: { body: 'A tight feeling in my shoulders.' },
    });

    await expect(storage.read('owner-a')).resolves.toEqual({
      templateId: template.id,
      stepIndex: 2,
      responses: { [template.steps[2].id]: longResponse },
      updatedAt: '2026-08-08T12:00:00.000Z',
    });
    await expect(storage.read('owner-b')).resolves.toMatchObject({
      templateId: 'make-room',
      responses: { body: 'A tight feeling in my shoulders.' },
    });
    expect(
      [...secureStore.values.keys()].filter((key) =>
        key.startsWith(`${reflectionDraftStorageKey('owner-a')}.draft-1.`)
      ).length
    ).toBeGreaterThan(1);
  });

  it('rejects unknown response fields without writing a draft', async () => {
    const storage = createStorage();

    await expect(
      storage.write('owner-a', {
        templateId: 'make-room',
        stepIndex: 0,
        responses: { unknown: 'Do not retain this.' },
      })
    ).rejects.toThrow('Reflection draft is invalid');
    expect(secureStore.values.size).toBe(0);
  });

  it('clears malformed drafts and only removes the requested owner', async () => {
    const storage = createStorage();
    const ownerAKey = reflectionDraftStorageKey('owner-a');
    secureStore.values.set(ownerAKey, '{not-json');
    await storage.write('owner-b', {
      templateId: 'good-moments',
      stepIndex: 0,
      responses: { moment: 'A quiet cup of tea.' },
    });

    await expect(storage.read('owner-a')).resolves.toBeNull();
    expect(
      [...secureStore.values.keys()].some((key) => key.startsWith(ownerAKey))
    ).toBe(false);
    await expect(storage.read('owner-b')).resolves.toMatchObject({
      responses: { moment: 'A quiet cup of tea.' },
    });

    await storage.clear('owner-b');
    await expect(storage.read('owner-b')).resolves.toBeNull();
  });

  it('serializes clear after an in-flight write so a discarded draft cannot return', async () => {
    const deferredStore = new DeferredSecureStore();
    const storage = createReflectionDraftStorage({
      secureStore: deferredStore,
      now: () => '2026-08-08T12:00:00.000Z',
      createGeneration: () => `deferred-${++generation}`,
    });
    const token = storage.captureWriteToken('owner-a');
    const write = storage.write(
      'owner-a',
      {
        templateId: 'good-moments',
        stepIndex: 0,
        responses: { moment: 'Private words that must stay discarded.' },
      },
      token
    );

    await deferredStore.writeStarted;
    const clear = storage.clear('owner-a');
    deferredStore.release();

    await expect(write).resolves.toBe(true);
    await expect(clear).resolves.toBeUndefined();
    await expect(storage.read('owner-a')).resolves.toBeNull();
  });

  it('rejects a delayed write token after save or discard invalidates it', async () => {
    const storage = createStorage();
    const staleToken = storage.captureWriteToken('owner-a');

    await storage.clear('owner-a');
    await expect(
      storage.write(
        'owner-a',
        {
          templateId: 'make-room',
          stepIndex: 0,
          responses: { body: 'This stale snapshot must not be restored.' },
        },
        staleToken
      )
    ).resolves.toBe(false);
    await expect(storage.read('owner-a')).resolves.toBeNull();
  });

  it('never accepts one owner\'s snapshot token for another owner', async () => {
    const storage = createStorage();
    const ownerAToken = storage.captureWriteToken('owner-a');

    await expect(
      storage.write(
        'owner-b',
        {
          templateId: 'good-moments',
          stepIndex: 0,
          responses: { moment: 'Owner A private words.' },
        },
        ownerAToken
      )
    ).resolves.toBe(false);
    await expect(storage.read('owner-b')).resolves.toBeNull();
  });

  it('keeps mobile persistence private and journal saves owner-scoped', () => {
    expect(draftStorageSource).toContain('secureStore: SecureStore');
    expect(reflectScreen).toContain(".from('journal_entries')");
    expect(reflectScreen).toContain('.insert({ ...prepared, user_id: ownerId })');
    expect(reflectScreen).toContain('ownerIdRef.current !== ownerId');
    expect(reflectScreen).toContain('ownerGenerationRef.current !== ownerGeneration');
    expect(reflectScreen).toContain('AI does not receive it unless');
    expect(reflectScreen).toContain('Partners only see enabled activity counts.');
    expect(reflectScreen).toContain('They do not diagnose a condition');
    expect(reflectScreen).not.toContain('AsyncStorage');
    expect(reflectScreen).not.toContain("from('partner_links')");
    expect(reflectScreen).not.toContain('fetch(');
  });

  it('flushes drafts on lifecycle changes and clears them from privacy workflows', () => {
    expect(reflectScreen).toContain("AppState.addEventListener('change'");
    expect(reflectScreen).toContain('void flushDraftRef.current()');
    expect(reflectScreen).toContain('stateOwnerId !== ownerId');
    expect(reflectScreen).toContain('persistDraftSnapshotRef.current(previousSnapshot)');
    expect(reflectScreen).toContain('reflectionDraftStorage.captureWriteToken(ownerId)');
    expect(settingsSource).toContain('clearReflectionDraft(expectedOwnerId)');
    expect(authContextSource).toContain('clearReflectionDraft(user.id)');
    expect(authContextSource).toContain(
      'clearReflectionDraft(expectedAnonymousUserId)'
    );
    expect(authContextSource).toContain('clearReflectionDraft(deletedOwnerId)');
    expect(authContextSource).toContain(
      'reflectionDraftStorage.read(session.user.id)'
    );
    expect(authContextSource).toContain(
      'result.hasOwnedData !== false || remindersEnabled || advisorReminder || reflectionDraft'
    );
  });

  it('deletes temporary exports even after sharing is cancelled or fails', () => {
    expect(settingsSource).toContain('FileSystem.cacheDirectory');
    expect(settingsSource).toContain('FileSystem.deleteAsync(exportPath');
    expect(settingsSource).toContain('{ idempotent: true }');
    expect(settingsSource).not.toContain('mental-health-data.json');
  });
});
