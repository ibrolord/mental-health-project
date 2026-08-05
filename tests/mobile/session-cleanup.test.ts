import { describe, expect, it, vi } from 'vitest';
import {
  clearDeletedAccountSession,
  runDeletedAccountLocalCleanup,
} from '../../mobile/lib/session-cleanup';

describe('deleted-account iOS session cleanup', () => {
  it('settles every ancillary cleanup operation without blocking session cleanup', async () => {
    const cleanupError = vi.fn();
    const finalOperation = vi.fn().mockResolvedValue(undefined);

    await expect(
      runDeletedAccountLocalCleanup(
        [
          Promise.reject(new Error('cache unavailable')),
          Promise.resolve('consent cleared'),
          finalOperation(),
        ],
        cleanupError
      )
    ).resolves.toBe(false);
    expect(finalOperation).toHaveBeenCalledTimes(1);
    expect(cleanupError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'cache unavailable' })
    );
  });

  it('recovers when the first local sign-out throws from secure storage', async () => {
    const auth = {
      signOut: vi.fn()
        .mockRejectedValueOnce(new Error('keychain unavailable'))
        .mockResolvedValueOnce({ error: null }),
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
    };
    const clearPersisted = vi.fn().mockResolvedValue(undefined);

    await expect(clearDeletedAccountSession(auth, clearPersisted)).resolves.toBe(true);
    expect(clearPersisted).toHaveBeenCalledTimes(1);
    expect(auth.signOut).toHaveBeenCalledTimes(2);
  });

  it('attempts verification even when forced storage cleanup reports an error', async () => {
    const cleanupError = vi.fn();
    const auth = {
      signOut: vi.fn()
        .mockResolvedValueOnce({ error: new Error('local sign-out failed') })
        .mockResolvedValueOnce({ error: null }),
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
    };

    await expect(
      clearDeletedAccountSession(
        auth,
        vi.fn().mockRejectedValue(new Error('manifest delete failed')),
        cleanupError
      )
    ).resolves.toBe(true);
    expect(cleanupError).toHaveBeenCalledTimes(1);
  });

  it('fails closed when sign-out or verification leaves a session behind', async () => {
    const auth = {
      signOut: vi.fn().mockResolvedValue({ error: new Error('still signed in') }),
      getSession: vi.fn().mockResolvedValue({
        data: { session: { user: { id: 'retained' } } },
        error: null,
      }),
    };

    await expect(
      clearDeletedAccountSession(auth, vi.fn().mockResolvedValue(undefined))
    ).resolves.toBe(false);
  });
});
