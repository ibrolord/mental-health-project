import type { Session } from '@supabase/supabase-js';

interface SessionResult {
  data: { session: Session | null };
  error: unknown;
}

interface AnonymousSessionAuth {
  getSession(): Promise<SessionResult>;
  signInAnonymously(): Promise<SessionResult>;
}

export interface AnonymousSignInState {
  isPending(): Promise<boolean>;
  markPending(): Promise<void>;
  clearPending(): Promise<void>;
}

export function withSessionTimeout<T>(
  operation: Promise<T>,
  timeoutMs: number
): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([
    operation,
    new Promise<never>((_, reject) => {
      timeout = setTimeout(
        () => reject(new Error('Session initialization timed out')),
        timeoutMs
      );
    }),
  ]).finally(() => {
    if (timeout) clearTimeout(timeout);
  });
}

export function createAnonymousSessionManager(
  auth: AnonymousSessionAuth,
  timeoutMs: number,
  signInState?: AnonymousSignInState
): { ensureSession: () => Promise<Session> } {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new Error('Session initialization timeout must be positive');
  }
  let anonymousSignIn: Promise<Session> | null = null;

  return {
    async ensureSession(): Promise<Session> {
      const deadline = Date.now() + timeoutMs;
      const remainingTime = () => Math.max(0, deadline - Date.now());
      const current = await withSessionTimeout(auth.getSession(), remainingTime());
      if (current.error) throw current.error;
      if (current.data.session) {
        if (signInState) {
          await withSessionTimeout(signInState.clearPending(), remainingTime());
        }
        return current.data.session;
      }

      if (!anonymousSignIn) {
        if (
          signInState &&
          await withSessionTimeout(signInState.isPending(), remainingTime())
        ) {
          throw new Error(
            'Anonymous session initialization was interrupted and cannot be retried safely'
          );
        }

        const request = (async () => {
          await signInState?.markPending();

          const { data, error } = await auth.signInAnonymously();
          if (error) {
            // A structured auth response confirms that no usable identity was
            // issued. Transport exceptions remain pending because their server
            // outcome is unknowable and retrying could create a second user.
            await signInState?.clearPending();
            throw error;
          }
          if (!data.session) {
            throw new Error('Anonymous sign-in did not return a session');
          }
          await signInState?.clearPending();
          return data.session;
        })();
        anonymousSignIn = request;
        void request.then(
          () => {
            if (anonymousSignIn === request) anonymousSignIn = null;
          },
          () => {
            if (anonymousSignIn === request) anonymousSignIn = null;
          }
        );
      }

      // A caller may stop waiting, but the underlying native auth operation is
      // not cancelled. Keep reusing it until it settles to prevent duplicate
      // anonymous accounts during retries.
      return withSessionTimeout(anonymousSignIn, remainingTime());
    },
  };
}
