'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { KeyRound, Loader2, TriangleAlert } from 'lucide-react';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { isValidatedPasswordRecovery } from '@/lib/auth/password-recovery';

const MIN_PASSWORD_LENGTH = 8;
const FIELD_CLASS =
  'w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

type PageState = 'checking' | 'password' | 'cleanup' | 'done' | 'error';

export default function ResetPasswordPage() {
  const [pageState, setPageState] = useState<PageState>('checking');
  const [error, setError] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const recoveryClientRef = useRef<SupabaseClient | null>(null);

  useEffect(() => {
    let active = true;
    let completed = false;
    let timeout: ReturnType<typeof setTimeout> | null = null;
    const initialQuery = new URLSearchParams(window.location.search);
    const initialHash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const providerError =
      initialQuery.get('error_description') ??
      initialQuery.get('error') ??
      initialHash.get('error_description') ??
      initialHash.get('error');

    const accept = (...args: Parameters<typeof isValidatedPasswordRecovery>) => {
      if (!active || completed || !isValidatedPasswordRecovery(...args)) return false;
      completed = true;
      if (timeout) clearTimeout(timeout);
      setPageState('password');
      return true;
    };

    if (providerError) {
      setError(providerError);
      setPageState('error');
      return;
    }

    const recoveryClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: true,
          flowType: 'implicit',
        },
      }
    );
    recoveryClientRef.current = recoveryClient;
    const { data: subscription } = recoveryClient.auth.onAuthStateChange((event, session) => {
      accept(event, session);
    });

    timeout = setTimeout(() => {
      if (!active || completed) return;
      completed = true;
      setError('That reset link is invalid, expired, or has already been used.');
      setPageState('error');
    }, 10_000);

    return () => {
      active = false;
      if (timeout) clearTimeout(timeout);
      subscription.subscription.unsubscribe();
      recoveryClientRef.current = null;
    };
  }, []);

  const clearRecoverySession = async () => {
    const recoveryClient = recoveryClientRef.current;
    if (!recoveryClient) {
      setError('The recovery session is no longer available. Request a new link.');
      setPageState('error');
      return false;
    }
    setSaving(true);
    setError('');
    let signOutError: unknown = null;
    try {
      const result = await recoveryClient.auth.signOut({ scope: 'local' });
      signOutError = result.error;
    } catch (cleanupError) {
      signOutError = cleanupError;
    }
    setSaving(false);
    if (signOutError) {
      setError(
        'Your password was updated, but this browser session could not be cleared. Retry before closing this page.'
      );
      setPageState('cleanup');
      return false;
    }
    setPageState('done');
    return true;
  };

  const savePassword = async (event: React.FormEvent) => {
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
      const recoveryClient = recoveryClientRef.current;
      if (!recoveryClient) throw new Error('Request a new reset link and try again.');
      const { error: updateError } = await recoveryClient.auth.updateUser({ password });
      if (updateError) throw updateError;
      setPassword('');
      setConfirmPassword('');
      await clearRecoverySession();
    } catch (updateError) {
      setError(
        updateError instanceof Error
          ? updateError.message
          : 'Your password could not be updated.'
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-16">
      <div className="w-full max-w-md text-center">
        {pageState === 'checking' ? (
          <>
            <Loader2 className="mx-auto mb-4 h-6 w-6 animate-spin text-primary" aria-hidden="true" />
            <h1 className="font-display text-3xl font-medium text-foreground">Opening your reset link</h1>
            <p className="mt-3 text-sm text-muted-foreground">One moment.</p>
          </>
        ) : null}

        {pageState === 'password' ? (
          <>
            <KeyRound className="mx-auto mb-4 h-7 w-7 text-primary" aria-hidden="true" />
            <h1 className="font-display text-3xl font-medium text-foreground">Choose a new password</h1>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Use at least eight characters, then return to MHtoolkit to sign in.
            </p>
            <form onSubmit={savePassword} className="mt-6 space-y-4 text-left">
              {error ? (
                <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                  {error}
                </p>
              ) : null}
              <div>
                <label htmlFor="password" className="mb-1.5 block text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
                  New password
                </label>
                <input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={MIN_PASSWORD_LENGTH}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
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
                  className={FIELD_CLASS}
                />
              </div>
              <button
                type="submit"
                disabled={saving}
                className="flex w-full items-center justify-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-60"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
                {saving ? 'Updating password' : 'Update Password'}
              </button>
            </form>
          </>
        ) : null}

        {pageState === 'done' ? (
          <>
            <KeyRound className="mx-auto mb-4 h-7 w-7 text-primary" aria-hidden="true" />
            <h1 className="font-display text-3xl font-medium text-foreground">Password updated</h1>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Return to MHtoolkit and sign in with your new password.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <a
                href="mhtoolkit://auth/login?reset=complete"
                className="rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground"
              >
                Open MHtoolkit
              </a>
              <Link
                href="/auth/login"
                className="rounded-full border border-border bg-card px-5 py-2.5 text-sm font-medium text-foreground"
              >
                Sign in on the web
              </Link>
            </div>
          </>
        ) : null}

        {pageState === 'cleanup' ? (
          <>
            <TriangleAlert className="mx-auto mb-4 h-7 w-7 text-destructive" aria-hidden="true" />
            <h1 className="font-display text-3xl font-medium text-foreground">Clear this browser session</h1>
            <p role="alert" className="mt-3 text-sm leading-relaxed text-muted-foreground">{error}</p>
            <button
              type="button"
              disabled={saving}
              onClick={() => void clearRecoverySession()}
              className="mt-6 inline-flex rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-60"
            >
              {saving ? 'Clearing session' : 'Retry Session Cleanup'}
            </button>
          </>
        ) : null}

        {pageState === 'error' ? (
          <>
            <TriangleAlert className="mx-auto mb-4 h-7 w-7 text-destructive" aria-hidden="true" />
            <h1 className="font-display text-3xl font-medium text-foreground">Reset link did not work</h1>
            <p role="alert" className="mt-3 text-sm leading-relaxed text-muted-foreground">{error}</p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <a
                href="mhtoolkit://auth/forgot-password"
                className="inline-flex rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground"
              >
                Request Another Link
              </a>
              <Link
                href="/auth/login"
                className="inline-flex rounded-full border border-border bg-card px-5 py-2.5 text-sm font-medium text-foreground"
              >
                Back to Sign In
              </Link>
            </div>
          </>
        ) : null}
      </div>
    </main>
  );
}
