'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, LockKeyhole, TriangleAlert } from 'lucide-react';
import type { EmailOtpType, Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase/client';
import {
  ACCOUNT_UPGRADE_COMPLETION_FLAG,
  ACCOUNT_UPGRADE_EMAIL_FIELD,
  ACCOUNT_UPGRADE_STARTED_FLAG,
} from '@/mobile/lib/auth-validation';
import { getSafeAuthRedirect } from '@/lib/auth/redirect';

const MIN_PASSWORD_LENGTH = 8;
const FIELD_CLASS =
  'w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

type PageState = 'checking' | 'password' | 'done' | 'error';

export default function MobileAccountConfirmationPage() {
  const [pageState, setPageState] = useState<PageState>('checking');
  const [error, setError] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [completionNote, setCompletionNote] = useState('');
  const [source, setSource] = useState<'mobile' | 'web'>('mobile');
  const [nextPath, setNextPath] = useState('/dashboard');

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let unsubscribe: (() => void) | null = null;
    let sessionResolved = false;
    const params = new URLSearchParams(window.location.search);
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const confirmationSource = params.get('source') === 'web' ? 'web' : 'mobile';
    setSource(confirmationSource);
    setNextPath(getSafeAuthRedirect(params.get('next')));
    const expectedUserId = params.get('upgrade_user_id');
    const hasAuthCallbackPayload =
      params.has('code') ||
      params.has('token_hash') ||
      hash.has('access_token') ||
      hash.has('refresh_token');

    const stopWaiting = () => {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      unsubscribe?.();
      unsubscribe = null;
    };

    const acceptSession = (
      session: Session | null,
      rejectMismatchedSession = true
    ) => {
      if (!active || !session) return false;
      if (!expectedUserId || session.user.id !== expectedUserId) {
        if (!rejectMismatchedSession) return false;
        sessionResolved = true;
        setError('This confirmation link does not match the account being upgraded.');
        setPageState('error');
        stopWaiting();
        return true;
      }
      if (session.user.is_anonymous || !session.user.email_confirmed_at) {
        return false;
      }
      stopWaiting();
      sessionResolved = true;
      if (confirmationSource === 'web') {
        setPageState('password');
      } else {
        setPageState('done');
        void supabase.auth.signOut({ scope: 'local' }).then(({ error: signOutError }) => {
          if (signOutError && active) {
            setCompletionNote('Close this browser window before returning to MHtoolkit.');
          }
        });
      }
      return true;
    };

    const initialize = async () => {
      const providerError =
        params.get('error_description') ??
        params.get('error') ??
        hash.get('error_description') ??
        hash.get('error');

      if (providerError) {
        setError(providerError);
        setPageState('error');
        return;
      }

      const tokenHash = params.get('token_hash');
      const otpType = params.get('type') as EmailOtpType | null;
      if (tokenHash) {
        if (!otpType) {
          setError('This confirmation link is missing its verification type.');
          setPageState('error');
          return;
        }

        const { data: verification, error: verificationError } =
          await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: otpType,
          });
        if (!active) return;
        if (verificationError) {
          setError(verificationError.message);
          setPageState('error');
          return;
        }
        if (acceptSession(verification.session, true)) return;
      }

      const { data, error: sessionError } = await supabase.auth.getSession();
      if (!active) return;
      if (sessionError) {
        setError(sessionError.message);
        setPageState('error');
        return;
      }
      if (acceptSession(data.session, !hasAuthCallbackPayload)) return;

      const { data: subscription } = supabase.auth.onAuthStateChange((event, session) => {
        const rejectMismatch = !hasAuthCallbackPayload || event !== 'INITIAL_SESSION';
        acceptSession(session, rejectMismatch);
      });
      unsubscribe = () => subscription.subscription.unsubscribe();
      if (sessionResolved) {
        stopWaiting();
        return;
      }
      timer = setTimeout(() => {
        if (!active) return;
        stopWaiting();
        setError('That confirmation link could not be completed. It may have expired or already been used.');
        setPageState('error');
      }, 10_000);
    };

    void initialize().catch((initializationError: Error) => {
      if (!active) return;
      setError(initializationError.message);
      setPageState('error');
    });

    return () => {
      active = false;
      stopWaiting();
    };
  }, []);

  const setAccountPassword = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Use at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (password !== confirmPassword) {
      setError('Those passwords do not match.');
      return;
    }

    setSaving(true);
    try {
      const { error: passwordError } = await supabase.auth.updateUser({
        password,
        data: {
          [ACCOUNT_UPGRADE_COMPLETION_FLAG]: true,
          [ACCOUNT_UPGRADE_STARTED_FLAG]: false,
          [ACCOUNT_UPGRADE_EMAIL_FIELD]: null,
        },
      });
      if (passwordError) throw passwordError;

      setPassword('');
      setConfirmPassword('');
      setPageState('done');
    } catch (passwordError) {
      setError(passwordError instanceof Error ? passwordError.message : 'Could not set your password.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-16">
      <div className="w-full max-w-md text-center">
        {pageState === 'checking' && (
          <>
            <Loader2 className="mx-auto mb-4 h-6 w-6 animate-spin text-primary" aria-hidden="true" />
            <h1 className="font-display text-3xl font-medium text-foreground">Confirming your email</h1>
            <p className="mt-3 text-sm text-muted-foreground">One moment.</p>
          </>
        )}

        {pageState === 'password' && (
          <>
            <LockKeyhole className="mx-auto mb-4 h-7 w-7 text-primary" aria-hidden="true" />
            <h1 className="font-display text-3xl font-medium text-foreground">Create your password</h1>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Your email is confirmed. Set a password so you can use this same MHtoolkit account on another device.
            </p>
            <form onSubmit={setAccountPassword} className="mt-6 space-y-4 text-left">
              {error && (
                <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                  {error}
                </p>
              )}
              <div>
                <label htmlFor="password" className="mb-1.5 block text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={MIN_PASSWORD_LENGTH}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
                  className={FIELD_CLASS}
                />
              </div>
              <div>
                <label htmlFor="confirm-password" className="mb-1.5 block text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
                  Confirm password
                </label>
                <input
                  id="confirm-password"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder="Type it again"
                  className={FIELD_CLASS}
                />
              </div>
              <button
                type="submit"
                disabled={saving}
                className="flex w-full items-center justify-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-60"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                {saving ? 'Saving password' : 'Finish Account Setup'}
              </button>
            </form>
          </>
        )}

        {pageState === 'done' && (
          <>
            <LockKeyhole className="mx-auto mb-4 h-7 w-7 text-primary" aria-hidden="true" />
            <h1 className="font-display text-3xl font-medium text-foreground">Your account is ready</h1>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              {source === 'web'
                ? 'Your account is ready and your saved data stayed with it.'
                : 'Return to MHtoolkit to create your password.'}
            </p>
            {source === 'web' && (
              <Link
                href={nextPath}
                className="mt-6 inline-flex rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground"
              >
                Continue to MHtoolkit
              </Link>
            )}
            {source === 'mobile' && (
              <a
                href="mhtoolkit://auth/signup"
                className="mt-6 inline-flex rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground"
              >
                Return to MHtoolkit
              </a>
            )}
            {completionNote && (
              <p role="status" className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-foreground">
                {completionNote}
              </p>
            )}
          </>
        )}

        {pageState === 'error' && (
          <>
            <TriangleAlert className="mx-auto mb-4 h-7 w-7 text-destructive" aria-hidden="true" />
            <h1 className="font-display text-3xl font-medium text-foreground">Setup did not complete</h1>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{error}</p>
            <Link
              href="/support"
              className="mt-6 inline-flex rounded-full border border-border bg-card px-5 py-2.5 text-sm font-medium text-foreground"
            >
              Contact Support
            </Link>
          </>
        )}
      </div>
    </main>
  );
}
