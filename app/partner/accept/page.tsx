'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle2, HeartHandshake, Loader2, TriangleAlert } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { acceptInvite } from '@/lib/partners';
import { authPathWithNext } from '@/lib/auth/redirect';

type State =
  | { kind: 'loading' }
  | { kind: 'needs-account' }
  | { kind: 'missing-token' }
  | { kind: 'accepting' }
  | { kind: 'accepted' }
  | { kind: 'error'; message: string };

function AcceptInviteInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, isAnonymous, loading } = useAuth();
  const [state, setState] = useState<State>({ kind: 'loading' });
  const acceptanceRef = useRef<{
    token: string;
    promise: Promise<string>;
  } | null>(null);
  const userId = user?.id;

  const token = searchParams.get('token');
  const returnPath = token
    ? `/partner/accept?token=${encodeURIComponent(token)}`
    : '/partner';

  useEffect(() => {
    if (loading) return;

    if (!token) {
      setState({ kind: 'missing-token' });
      return;
    }

    // An anonymous session has a JWT but no durable identity, so the
    // partnership would evaporate. Require a real account first.
    if (!userId || isAnonymous) {
      setState({ kind: 'needs-account' });
      return;
    }

    if (acceptanceRef.current?.token !== token) {
      acceptanceRef.current = {
        token,
        promise: acceptInvite(token),
      };
    }
    const acceptance = acceptanceRef.current;

    let active = true;
    setState({ kind: 'accepting' });
    acceptance.promise
      .then(() => {
        if (active) setState({ kind: 'accepted' });
      })
      .catch((err: Error) => {
        if (active) setState({ kind: 'error', message: err.message });
      });

    return () => {
      active = false;
    };
  }, [token, userId, isAnonymous, loading]);

  useEffect(() => {
    if (state.kind !== 'accepted') return;
    const timer = setTimeout(() => router.push('/partner'), 1800);
    return () => clearTimeout(timer);
  }, [state.kind, router]);

  return (
    <main className="px-4 py-16 md:px-8">
      <div className="mx-auto max-w-lg text-center">
        <span className="mx-auto mb-5 grid h-12 w-12 place-items-center rounded-2xl bg-primary text-primary-foreground">
          <HeartHandshake className="h-5 w-5" aria-hidden="true" />
        </span>

        {(state.kind === 'loading' || state.kind === 'accepting') && (
          <>
            <h1 className="font-display text-3xl font-medium text-foreground">
              Setting things up
            </h1>
            <p className="mt-3 flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              One moment
            </p>
          </>
        )}

        {state.kind === 'accepted' && (
          <>
            <h1 className="font-display text-3xl font-medium text-foreground">
              You are connected
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              You can now see the progress they chose to share. Taking you there.
            </p>
            <CheckCircle2
              className="mx-auto mt-5 h-6 w-6 text-foreground"
              aria-hidden="true"
            />
          </>
        )}

        {state.kind === 'needs-account' && (
          <>
            <h1 className="font-display text-3xl font-medium text-foreground">
              Create an account to accept
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Being someone&apos;s accountability partner needs an account on
              both sides so the connection survives across devices. Your invite
              will bring you back to this invite after setup.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link
                href={authPathWithNext('/auth/signup', returnPath)}
                className="rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
              >
                Create an account
              </Link>
              <Link
                href={authPathWithNext('/auth/login', returnPath)}
                className="rounded-full border border-border bg-card px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
              >
                Sign in
              </Link>
            </div>
          </>
        )}

        {(state.kind === 'error' || state.kind === 'missing-token') && (
          <>
            <TriangleAlert
              className="mx-auto mb-3 h-6 w-6 text-destructive"
              aria-hidden="true"
            />
            <h1 className="font-display text-3xl font-medium text-foreground">
              This link did not work
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              {state.kind === 'missing-token'
                ? 'The link is missing its invite code. Ask for a fresh one.'
                : state.message}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              Invite links expire after seven days and can only be used once.
            </p>
            <Link
              href="/dashboard"
              className="mt-6 inline-block rounded-full border border-border bg-card px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
            >
              Go to MHtoolkit
            </Link>
          </>
        )}
      </div>
    </main>
  );
}

export default function AcceptInvitePage() {
  return (
    <Suspense
      fallback={
        <main className="px-4 py-16 text-center text-sm text-muted-foreground">
          Loading
        </main>
      }
    >
      <AcceptInviteInner />
    </Suspense>
  );
}
