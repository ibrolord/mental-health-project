import { describe, expect, it } from 'vitest';
import {
  createMoodDraftPersistenceQueue,
  createMoodDraftStorage,
  hasMoodCheckInDraft,
  parseMoodCheckInDraft,
  type MoodDraftSecureStore,
} from '../../mobile/lib/mood-draft';

class MemorySecureStore implements MoodDraftSecureStore {
  values = new Map<string, string>();

  async getItemAsync(key: string) {
    return this.values.get(key) ?? null;
  }

  async setItemAsync(key: string, value: string) {
    this.values.set(key, value);
  }

  async deleteItemAsync(key: string) {
    this.values.delete(key);
  }
}

describe('mobile mood check-in draft', () => {
  it('round-trips a private draft under an owner-isolated key', async () => {
    const storage = new MemorySecureStore();
    const drafts = createMoodDraftStorage(storage);
    const draft = {
      mood: '🙂' as const,
      note: 'A little steadier after lunch',
      emotions: ['calm'] as const,
      customEmotions: ['Quietly hopeful'],
      support: 'keep-going' as const,
      visibleTags: ['sleep'],
      detailsOpen: true,
    };

    await drafts.write('owner-a', {
      ...draft,
      emotions: [...draft.emotions],
    });

    await expect(drafts.read('owner-a')).resolves.toEqual(draft);
    await expect(drafts.read('owner-b')).resolves.toBeNull();
  });

  it('sanitizes stale or mood-incompatible values', () => {
    expect(
      parseMoodCheckInDraft({
        mood: '😄',
        note: 'x'.repeat(700),
        emotions: ['joyful', 'sad', 'joyful'],
        customEmotions: ['Calm', 'Ready'],
        support: 'rest',
        visibleTags: ['sleep', 'mood-support:rest', 42],
        detailsOpen: true,
      })
    ).toEqual({
      mood: '😄',
      note: 'x'.repeat(500),
      emotions: ['joyful'],
      customEmotions: ['Ready'],
      support: null,
      visibleTags: ['sleep'],
      detailsOpen: true,
    });
  });

  it('recognizes meaningful drafts and clears saved data', async () => {
    const storage = new MemorySecureStore();
    const drafts = createMoodDraftStorage(storage);
    const draft = {
      mood: '😐' as const,
      note: '',
      emotions: [],
      customEmotions: [],
      support: null,
      visibleTags: [],
      detailsOpen: false,
    };

    expect(hasMoodCheckInDraft(draft)).toBe(true);
    await drafts.write('owner-a', draft);
    await drafts.clear('owner-a');
    await expect(drafts.read('owner-a')).resolves.toBeNull();
  });

  it('serializes a clear after an in-flight write so stale data cannot return', async () => {
    let releaseWrite!: () => void;
    let markWriteStarted!: () => void;
    const writeStarted = new Promise<void>((resolve) => {
      markWriteStarted = resolve;
    });
    const events: string[] = [];
    const storage = {
      async read() {
        return null;
      },
      async write() {
        events.push('write:start');
        markWriteStarted();
        await new Promise<void>((resolve) => {
          releaseWrite = resolve;
        });
        events.push('write:end');
      },
      async clear() {
        events.push('clear');
      },
    };
    const queue = createMoodDraftPersistenceQueue(storage);
    const write = queue.write('owner-a', {
      mood: '🙂',
      note: '',
      emotions: [],
      customEmotions: [],
      support: null,
      visibleTags: [],
      detailsOpen: false,
    });
    await writeStarted;
    const clear = queue.clear('owner-a');
    releaseWrite();

    await Promise.all([write, clear]);
    expect(events).toEqual(['write:start', 'write:end', 'clear']);
  });

  it('drops queued writes invalidated by a save, discard, or owner change', async () => {
    const events: string[] = [];
    const queue = createMoodDraftPersistenceQueue({
      async read() {
        return null;
      },
      async write(ownerId) {
        events.push(`write:${ownerId}`);
      },
      async clear(ownerId) {
        events.push(`clear:${ownerId}`);
      },
    });

    const staleWrite = queue.write('owner-a', {
      mood: '😐',
      note: '',
      emotions: [],
      customEmotions: [],
      support: null,
      visibleTags: [],
      detailsOpen: false,
    });
    queue.invalidatePendingWrites();
    await staleWrite;

    expect(events).toEqual([]);
  });

  it('does not clear a draft when the secure read fails', async () => {
    let deleted = false;
    const drafts = createMoodDraftStorage({
      async getItemAsync() {
        throw new Error('keychain unavailable');
      },
      async setItemAsync() {},
      async deleteItemAsync() {
        deleted = true;
      },
    });

    await expect(drafts.read('owner-a')).rejects.toThrow('keychain unavailable');
    expect(deleted).toBe(false);
  });
});
