import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { OWNED_DATA_SOURCES } from '../../lib/data/owned-data-inventory';
import {
  anonymousProfileDataConflict,
  discardAnonymousProfileSafely,
  getAnonymousProfileDataConflictUserId,
  isAnonymousProfileDataConflict,
} from '../../mobile/lib/anonymous-profile-switch';

const discardOptions = () => ({
  expectedAnonymousUserId: 'anonymous-1',
  currentUser: { id: 'anonymous-1', is_anonymous: true },
  prepareLocalCleanup: vi.fn().mockResolvedValue(true),
  deleteRemoteData: vi.fn().mockResolvedValue({ deleted: true }),
  localCleanupError: 'Local cleanup failed. No data was deleted.',
});

describe('anonymous profile switch safety', () => {
  it('carries the exact anonymous owner through the conflict decision', () => {
    const error = anonymousProfileDataConflict('anonymous-1');

    expect(isAnonymousProfileDataConflict(error)).toBe(true);
    expect(getAnonymousProfileDataConflictUserId(error)).toBe('anonymous-1');
    expect(getAnonymousProfileDataConflictUserId(new Error('other'))).toBeNull();
  });

  it('rejects a changed session before cleanup or deletion begins', async () => {
    const options = discardOptions();

    await expect(
      discardAnonymousProfileSafely({
        ...options,
        currentUser: { id: 'different-anonymous-user', is_anonymous: true },
      })
    ).rejects.toThrow('profile changed');
    expect(options.prepareLocalCleanup).not.toHaveBeenCalled();
    expect(options.deleteRemoteData).not.toHaveBeenCalled();
  });

  it('does not delete remote data when local reminders or settings cannot clear', async () => {
    const options = discardOptions();
    options.prepareLocalCleanup.mockResolvedValue(false);

    await expect(discardAnonymousProfileSafely(options)).rejects.toThrow(
      'No data was deleted'
    );
    expect(options.deleteRemoteData).not.toHaveBeenCalled();
  });

  it('deletes only after cleanup and does not fail after confirmed deletion', async () => {
    const order: string[] = [];
    const finalizeError = new Error('browser subscription already detached');
    const onFinalizeError = vi.fn();

    await expect(
      discardAnonymousProfileSafely({
        ...discardOptions(),
        prepareLocalCleanup: vi.fn(async () => {
          order.push('local-cleanup');
          return true;
        }),
        deleteRemoteData: vi.fn(async () => {
          order.push('remote-delete');
          return { deleted: true };
        }),
        finalizeAfterDelete: vi.fn(async () => {
          order.push('device-finalize');
          throw finalizeError;
        }),
        onFinalizeError,
      })
    ).resolves.toBeUndefined();
    expect(order).toEqual(['local-cleanup', 'remote-delete', 'device-finalize']);
    expect(onFinalizeError).toHaveBeenCalledWith(finalizeError);
  });

  it('keeps the switch inventory aligned with every user-owned deletion table', () => {
    const migration = readFileSync(
      resolve(
        process.cwd(),
        'supabase/migrations/20260808234500_add_privacy_safe_operational_events.sql'
      ),
      'utf8'
    );

    for (const { table } of OWNED_DATA_SOURCES) {
      expect(migration).toContain(`DELETE FROM public.${table}`);
    }
    expect(OWNED_DATA_SOURCES.map(({ table }) => table)).toEqual(
      expect.arrayContaining([
        'activity_plans',
        'safety_plans',
        'sleep_diary_entries',
        'staying_well_plans',
      ])
    );
  });
});
