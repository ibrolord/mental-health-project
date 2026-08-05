'use client';

import { Suspense, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { SocialAuthButtons } from '@/components/auth/social-auth-buttons';
import { authPathWithNext, getSafeAuthRedirect } from '@/lib/auth/redirect';

const FIELD_CLASS =
  'w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';
const LABEL_CLASS =
  'mb-1.5 block text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground';

function LoginPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { signIn } = useAuth();
  const nextPath = getSafeAuthRedirect(searchParams.get('next'));

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const submissionRef = useRef(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (submissionRef.current) return;
    submissionRef.current = true;
    setError('');
    setLoading(true);

    try {
      await signIn(email, password);
      router.push(nextPath);
    } catch (err) {
      setError((err as Error).message || 'Failed to sign in');
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
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              {loading ? 'Signing in' : 'Sign in'}
            </button>
          </form>

          <div className="mt-5">
            <SocialAuthButtons intent="sign-in" nextPath={nextPath} />
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
