import type { Session } from '@supabase/supabase-js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAnonymousSessionManager } from '../../mobile/lib/session-bootstrap';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

const session = (id: string) => ({
  user: { id, is_anonymous: true },
}) as Session;

function pendingState() {
  let pending = false;
  return {
    isPending: vi.fn(async () => pending),
    markPending: vi.fn(async () => {
      pending = true;
    }),
    clearPending: vi.fn(async () => {
      pending = false;
    }),
  };
}

describe('anonymous iOS session bootstrap', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns a persisted session without creating another identity', async () => {
    const existing = session('existing');
    const auth = {
      getSession: vi.fn().mockResolvedValue({ data: { session: existing }, error: null }),
      signInAnonymously: vi.fn(),
    };
    const manager = createAnonymousSessionManager(auth, 12_000);

    await expect(manager.ensureSession()).resolves.toBe(existing);
    expect(auth.signInAnonymously).not.toHaveBeenCalled();
  });

  it('single-flights concurrent anonymous session creation', async () => {
    const created = session('created');
    const pending = deferred<{ data: { session: Session | null }; error: unknown }>();
    const auth = {
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      signInAnonymously: vi.fn().mockReturnValue(pending.promise),
    };
    const manager = createAnonymousSessionManager(auth, 12_000);

    const first = manager.ensureSession();
    const second = manager.ensureSession();
    await vi.advanceTimersByTimeAsync(0);
    pending.resolve({ data: { session: created }, error: null });

    await expect(first).resolves.toBe(created);
    await expect(second).resolves.toBe(created);
    expect(auth.signInAnonymously).toHaveBeenCalledTimes(1);
  });

  it('does not create a second anonymous account after a caller times out', async () => {
    const created = session('slow-created');
    const pending = deferred<{ data: { session: Session | null }; error: unknown }>();
    const auth = {
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      signInAnonymously: vi.fn().mockReturnValue(pending.promise),
    };
    const manager = createAnonymousSessionManager(auth, 12_000);

    const first = expect(manager.ensureSession()).rejects.toThrow(
      'Session initialization timed out'
    );
    await vi.advanceTimersByTimeAsync(12_000);
    await first;

    const retry = manager.ensureSession();
    await vi.advanceTimersByTimeAsync(0);
    expect(auth.signInAnonymously).toHaveBeenCalledTimes(1);
    pending.resolve({ data: { session: created }, error: null });

    await expect(retry).resolves.toBe(created);
    expect(auth.signInAnonymously).toHaveBeenCalledTimes(1);
  });

  it('blocks a second identity after an ambiguous request survives a restart', async () => {
    const state = pendingState();
    const firstRequest = deferred<{
      data: { session: Session | null };
      error: unknown;
    }>();
    const firstAuth = {
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      signInAnonymously: vi.fn().mockReturnValue(firstRequest.promise),
    };
    const firstManager = createAnonymousSessionManager(firstAuth, 12_000, state);
    const firstAttempt = firstManager.ensureSession();
    await vi.advanceTimersByTimeAsync(0);
    expect(state.markPending).toHaveBeenCalledTimes(1);

    const restartedAuth = {
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      signInAnonymously: vi.fn(),
    };
    const restartedManager = createAnonymousSessionManager(
      restartedAuth,
      12_000,
      state
    );

    await expect(restartedManager.ensureSession()).rejects.toThrow(
      'cannot be retried safely'
    );
    expect(restartedAuth.signInAnonymously).not.toHaveBeenCalled();

    firstRequest.reject(new Error('connection interrupted'));
    await expect(firstAttempt).rejects.toThrow('connection interrupted');
    await expect(state.isPending()).resolves.toBe(true);
  });

  it('recovers an interrupted guard when Supabase persisted the session', async () => {
    const state = pendingState();
    await state.markPending();
    const restored = session('restored');
    const auth = {
      getSession: vi.fn().mockResolvedValue({ data: { session: restored }, error: null }),
      signInAnonymously: vi.fn(),
    };
    const manager = createAnonymousSessionManager(auth, 12_000, state);

    await expect(manager.ensureSession()).resolves.toBe(restored);
    await expect(state.isPending()).resolves.toBe(false);
    expect(auth.signInAnonymously).not.toHaveBeenCalled();
  });

  it('uses one timeout budget for lookup and anonymous sign-in', async () => {
    const lookup = deferred<{ data: { session: Session | null }; error: unknown }>();
    const signIn = deferred<{ data: { session: Session | null }; error: unknown }>();
    const auth = {
      getSession: vi.fn().mockReturnValue(lookup.promise),
      signInAnonymously: vi.fn().mockReturnValue(signIn.promise),
    };
    const manager = createAnonymousSessionManager(auth, 12_000);

    const result = expect(manager.ensureSession()).rejects.toThrow(
      'Session initialization timed out'
    );
    await vi.advanceTimersByTimeAsync(11_000);
    lookup.resolve({ data: { session: null }, error: null });
    await vi.advanceTimersByTimeAsync(1_000);

    await result;
    expect(auth.signInAnonymously).toHaveBeenCalledTimes(1);
    signIn.resolve({ data: { session: session('late-created') }, error: null });
    await vi.advanceTimersByTimeAsync(0);
  });

  it('allows a new attempt after the underlying request actually fails', async () => {
    const created = session('retry-created');
    const state = pendingState();
    const auth = {
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      signInAnonymously: vi.fn()
        .mockResolvedValueOnce({ data: { session: null }, error: new Error('offline') })
        .mockResolvedValueOnce({ data: { session: created }, error: null }),
    };
    const manager = createAnonymousSessionManager(auth, 12_000, state);

    await expect(manager.ensureSession()).rejects.toThrow('offline');
    await expect(state.isPending()).resolves.toBe(false);
    await expect(manager.ensureSession()).resolves.toBe(created);
    expect(auth.signInAnonymously).toHaveBeenCalledTimes(2);
  });

  it('propagates session lookup failures without creating an identity', async () => {
    const auth = {
      getSession: vi.fn().mockResolvedValue({
        data: { session: null },
        error: new Error('keychain unavailable'),
      }),
      signInAnonymously: vi.fn(),
    };
    const manager = createAnonymousSessionManager(auth, 12_000);

    await expect(manager.ensureSession()).rejects.toThrow('keychain unavailable');
    expect(auth.signInAnonymously).not.toHaveBeenCalled();
  });

  it('rejects invalid timeout configuration', () => {
    const auth = {
      getSession: vi.fn(),
      signInAnonymously: vi.fn(),
    };

    expect(() => createAnonymousSessionManager(auth, 0)).toThrow('must be positive');
  });
});
