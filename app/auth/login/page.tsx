'use client';

import { Suspense, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import {
  getAnonymousProfileDataConflictUserId,
  isAnonymousProfileDataConflict,
  useAuth,
  type SocialAuthProvider,
} from '@/lib/auth-context';
import { SocialAuthButtons } from '@/components/auth/social-auth-buttons';
import { authPathWithNext, getSafeAuthRedirect } from '@/lib/auth/redirect';
import { parseSocialAuthProvider } from '@/lib/auth/social';

const FIELD_CLASS =
  'w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';
const LABEL_CLASS =
  'mb-1.5 block text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground';

type BlockedAttempt = (
  | { kind: 'password' }
  | { kind: 'provider'; provider: SocialAuthProvider }
) & { anonymousUserId: string };

function LoginPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { continueWithProvider, discardAnonymousProfile, signIn } = useAuth();
  const nextPath = getSafeAuthRedirect(searchParams.get('next'));
  const linkedIdentityRecovery =
    searchParams.get('reason') === 'identity_already_linked';
  const linkedIdentityProvider = parseSocialAuthProvider(
    searchParams.get('provider')
  );

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [blockedAttempt, setBlockedAttempt] = useState<BlockedAttempt | null>(null);
  const [anonymousDataDeleted, setAnonymousDataDeleted] = useState(false);
  const submissionRef = useRef(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (submissionRef.current || blockedAttempt) return;
    submissionRef.current = true;
    setError('');
    setLoading(true);

    try {
      await signIn(email, password);
      router.push(nextPath);
    } catch (err) {
      const anonymousUserId = getAnonymousProfileDataConflictUserId(err);
      if (anonymousUserId && isAnonymousProfileDataConflict(err)) {
        setAnonymousDataDeleted(false);
        setBlockedAttempt({ kind: 'password', anonymousUserId });
      } else {
        setError((err as Error).message || 'Failed to sign in');
      }
    } finally {
      submissionRef.current = false;
      setLoading(false);
    }
  };

  const handleDiscardAndContinue = async () => {
    if (!blockedAttempt || submissionRef.current) return;
    const confirmed = window.confirm(
      'Permanently delete the activity saved in this anonymous profile and continue signing in? This cannot be undone.'
    );
    if (!confirmed) return;

    submissionRef.current = true;
    setError('');
    setLoading(true);
    try {
      const attempt = blockedAttempt;
      await discardAnonymousProfile(attempt.anonymousUserId);
      setBlockedAttempt(null);
      setAnonymousDataDeleted(true);
      if (attempt.kind === 'password') {
        await signIn(email, password);
        router.push(nextPath);
      } else {
        await continueWithProvider(attempt.provider, 'sign-in', nextPath);
      }
    } catch (err) {
      setError((err as Error).message || 'Could not finish signing in.');
    } finally {
      submissionRef.current = false;
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="font-display text-4xl font-medium leading-tight text-foreground">
            Welcome back
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Sign in to pick up where you left off.
          </p>
        </div>

        <div className="app-panel p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            {linkedIdentityRecovery && !blockedAttempt && (
              <div
                role="status"
                className="rounded-xl border border-sky-300 bg-sky-50 px-4 py-3 text-sm text-sky-950"
              >
                <p className="font-medium">
                  Sign in to your existing
                  {linkedIdentityProvider === 'google'
                    ? ' Google'
                    : linkedIdentityProvider === 'apple'
                      ? ' Apple'
                      : ''}{' '}
                  account.
                </p>
                <p className="mt-1 leading-relaxed">
                  If this anonymous profile has saved activity, you will choose
                  whether to keep it or delete it. Nothing is removed automatically.
                </p>
              </div>
            )}

            {blockedAttempt && (
              <div
                role="alert"
                className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-4 text-sm text-amber-950"
              >
                <p className="font-medium">This anonymous profile has saved activity.</p>
                <p className="mt-1 leading-relaxed">
                  Keep it by creating an account, or permanently delete it before
                  signing in to a different account.
                </p>
                <div className="mt-4 flex flex-col gap-2">
                  <Link
                    href={authPathWithNext('/auth/signup', nextPath)}
                    className="rounded-full bg-primary px-4 py-2 text-center font-medium text-primary-foreground"
                  >
                    Keep data and create an account
                  </Link>
                  <button
                    type="button"
                    onClick={() => void handleDiscardAndContinue()}
                    disabled={loading}
                    className="rounded-full border border-destructive/40 px-4 py-2 font-medium text-destructive disabled:opacity-60"
                  >
                    {loading ? 'Deleting data' : 'Delete data and sign in'}
                  </button>
                </div>
              </div>
            )}

            {error && (
              <p
                role="alert"
                className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
              >
                {error}
              </p>
            )}

            {anonymousDataDeleted && (
              <p
                role="status"
                className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-950"
              >
                Anonymous data deleted. You can retry sign-in if it did not finish.
              </p>
            )}

            <div>
              <label htmlFor="email" className={LABEL_CLASS}>
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                className={FIELD_CLASS}
              />
            </div>

            <div>
              <label htmlFor="password" className={LABEL_CLASS}>
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="••••••••"
                className={FIELD_CLASS}
              />
            </div>

            <button
              type="submit"
              disabled={loading || blockedAttempt !== null}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              {loading ? 'Signing in' : 'Sign in'}
            </button>
          </form>

          <div className="mt-5">
            <SocialAuthButtons
              intent="sign-in"
              nextPath={nextPath}
              disabled={loading || blockedAttempt !== null}
              submissionRef={submissionRef}
              onAnonymousDataBlocked={(provider, anonymousUserId) => {
                setError('');
                setAnonymousDataDeleted(false);
                setBlockedAttempt({ kind: 'provider', provider, anonymousUserId });
              }}
            />
          </div>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            New here?{' '}
            <Link
              href={authPathWithNext('/auth/signup', nextPath)}
              className="text-foreground underline underline-offset-4"
            >
              Create an account
            </Link>
          </p>
          <p className="mt-2 text-center text-sm text-muted-foreground">
            or{' '}
            <Link
              href="/dashboard"
              className="text-foreground underline underline-offset-4"
            >
              continue anonymously
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<main className="min-h-screen" />}>
      <LoginPageInner />
    </Suspense>
  );
}
