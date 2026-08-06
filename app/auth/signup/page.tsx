'use client';

import { Suspense, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Loader2, MailCheck } from 'lucide-react';
import { useAuth, type SocialAuthProvider } from '@/lib/auth-context';
import { SocialAuthButtons } from '@/components/auth/social-auth-buttons';
import { authPathWithNext, getSafeAuthRedirect } from '@/lib/auth/redirect';
import { signupErrorMessage } from '@/mobile/lib/auth-validation';

const FIELD_CLASS =
  'w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';
const LABEL_CLASS =
  'mb-1.5 block text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground';

function SignupPageInner() {
  const searchParams = useSearchParams();
  const { signUp } = useAuth();
  const nextPath = getSafeAuthRedirect(searchParams.get('next'));

  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [linkedIdentityProvider, setLinkedIdentityProvider] =
    useState<SocialAuthProvider | null>(null);
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);
  const submissionRef = useRef(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (submissionRef.current) return;
    submissionRef.current = true;
    setError('');

    setLoading(true);
    try {
      await signUp(email, nextPath);
      setAwaitingConfirmation(true);
    } catch (err) {
      setError(signupErrorMessage(err));
    } finally {
      submissionRef.current = false;
      setLoading(false);
    }
  };

  if (awaitingConfirmation) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4 py-16">
        <div className="w-full max-w-md text-center">
          <span className="mx-auto mb-5 grid h-12 w-12 place-items-center rounded-2xl bg-primary text-primary-foreground">
            <MailCheck className="h-5 w-5" aria-hidden="true" />
          </span>
          <h1 className="font-display text-3xl font-medium text-foreground">
            Check your email
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            We sent a confirmation link to <strong>{email}</strong>. Open it to
            finish setting up your account. You can keep using MHtoolkit
            anonymously in the meantime.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link
              href="/dashboard"
              className="rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
            >
              Continue anonymously
            </Link>
            <Link
              href={authPathWithNext('/auth/login', nextPath)}
              className="rounded-full border border-border bg-card px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
            >
              Sign in
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="font-display text-4xl font-medium leading-tight text-foreground">
            Create an account
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Keep what you have already saved and use it across devices.
          </p>
        </div>

        <div className="app-panel p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <p
                role="alert"
                className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
              >
                {error}
              </p>
            )}

            {linkedIdentityProvider && (
              <div
                role="alert"
                className="rounded-xl border border-sky-300 bg-sky-50 px-4 py-4 text-sm text-sky-950"
              >
                <p className="font-medium">This account already exists.</p>
                <p className="mt-1 leading-relaxed">
                  Sign in with{' '}
                  {linkedIdentityProvider === 'google' ? 'Google' : 'Apple'} instead.
                  Nothing in this anonymous profile has been deleted.
                </p>
                <Link
                  href={`${authPathWithNext('/auth/login', nextPath)}&reason=identity_already_linked&provider=${linkedIdentityProvider}`}
                  className="mt-3 inline-flex rounded-full bg-primary px-4 py-2 font-medium text-primary-foreground"
                >
                  Go to sign in
                </Link>
              </div>
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

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              {loading ? 'Sending confirmation' : 'Continue with email'}
            </button>
          </form>

          <div className="mt-5">
            <SocialAuthButtons
              intent="upgrade"
              nextPath={nextPath}
              onIdentityAlreadyLinked={setLinkedIdentityProvider}
            />
          </div>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Already have an account?{' '}
            <Link
              href={authPathWithNext('/auth/login', nextPath)}
              className="text-foreground underline underline-offset-4"
            >
              Sign in
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

export default function SignupPage() {
  return (
    <Suspense fallback={<main className="min-h-screen" />}>
      <SignupPageInner />
    </Suspense>
  );
}
