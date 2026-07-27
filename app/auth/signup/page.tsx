'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Loader2, MailCheck } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { GoogleButton } from '@/components/auth/google-button';

const MIN_PASSWORD_LENGTH = 8;

const FIELD_CLASS =
  'w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';
const LABEL_CLASS =
  'mb-1.5 block text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground';

export default function SignupPage() {
  const router = useRouter();
  const { signUp } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Use at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (password !== confirm) {
      setError('Those passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const hasSession = await signUp(email, password);
      if (hasSession) {
        router.push('/dashboard');
      } else {
        // The project requires email confirmation, so there is no session yet.
        setAwaitingConfirmation(true);
      }
    } catch (err) {
      setError((err as Error).message || 'Could not create your account.');
    } finally {
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
              href="/auth/login"
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
            Keeps your check-ins with you across devices. Everything works
            anonymously too, if you would rather not.
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
              <label htmlFor="confirm" className={LABEL_CLASS}>
                Confirm password
              </label>
              <input
                id="confirm"
                type="password"
                autoComplete="new-password"
                required
                value={confirm}
                onChange={(event) => setConfirm(event.target.value)}
                placeholder="Type it again"
                className={FIELD_CLASS}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              {loading ? 'Creating your account' : 'Create account'}
            </button>
          </form>

          <div className="mt-5">
            <GoogleButton label="Continue with Google" />
          </div>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Already have an account?{' '}
            <Link
              href="/auth/login"
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
