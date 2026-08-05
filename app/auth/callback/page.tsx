'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Loader2, TriangleAlert } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { authPathWithNext, getSafeAuthRedirect } from '@/lib/auth/redirect';
import {
  hasOAuthCallbackParameters,
  socialAuthCompletionError,
} from '@/lib/auth/social';
import type { Session } from '@supabase/supabase-js';

/**
 * Landing point for OAuth redirects and email confirmation links.
 *
 * This app uses the plain supabase-js browser client with localStorage
 * sessions, not @supabase/ssr with cookies, so the code exchange happens on
 * the client: `detectSessionInUrl` is on by default and consumes the `code`
 * or token fragment as soon as this page loads. That is why this is a client
 * page rather than a route handler, which would have no access to the PKCE
 * verifier stored in the browser.
 */
export default function AuthCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loginPath, setLoginPath] = useState('/auth/login');

  useEffect(() => {
    let active = true;
    let completed = false;
    let authSubscription: { unsubscribe: () => void } | null = null;
    let timeout: ReturnType<typeof setTimeout> | null = null;

    // The provider can hand back an error in either the query string or the
    // hash fragment depending on the flow, so check both.
    const params = new URLSearchParams(window.location.search);
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const nextPath = getSafeAuthRedirect(params.get('next'));
    const expectedUpgradeUserId = params.get('upgrade_user_id');
    const isProviderCallback = hasOAuthCallbackParameters(
      window.location.search,
      window.location.hash
    );
    setLoginPath(authPathWithNext('/auth/login', nextPath));
    const providerError =
      params.get('error_description') ??
      params.get('error') ??
      hash.get('error_description') ??
      hash.get('error');

    if (providerError) {
      completed = true;
      setError(providerError);
      return;
    }

    const complete = (session: Session) => {
      if (!active || completed) return;

      // Supabase can briefly expose the pre-redirect anonymous session while it
      // exchanges the OAuth response. Wait for the provider identity instead of
      // treating that stale session as the callback result.
      if (isProviderCallback && session.user.is_anonymous) return;

      completed = true;
      if (timeout) clearTimeout(timeout);
      authSubscription?.unsubscribe();
      const completionError = socialAuthCompletionError(
        session.user,
        expectedUpgradeUserId
      );
      if (completionError) {
        setError(completionError);
        return;
      }
      router.replace(nextPath);
    };

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) complete(session);
    });
    authSubscription = sub.subscription;
    timeout = setTimeout(() => {
      if (!active || completed) return;
      completed = true;
      authSubscription?.unsubscribe();
      setError(
        'That sign-in link could not be completed. It may have expired or already been used.'
      );
    }, 8000);

    supabase.auth
      .getSession()
      .then(({ data, error: sessionError }) => {
        if (!active || completed) return;
        if (sessionError) {
          completed = true;
          if (timeout) clearTimeout(timeout);
          authSubscription?.unsubscribe();
          setError(sessionError.message);
          return;
        }
        if (data.session) {
          complete(data.session);
        }
      })
      .catch((err: Error) => {
        if (!active || completed) return;
        completed = true;
        if (timeout) clearTimeout(timeout);
        authSubscription?.unsubscribe();
        setError(err.message);
      });

    return () => {
      active = false;
      if (timeout) clearTimeout(timeout);
      authSubscription?.unsubscribe();
    };
  }, [router]);

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-16">
      <div className="mx-auto max-w-md text-center">
        {error ? (
          <>
            <TriangleAlert
              className="mx-auto mb-3 h-6 w-6 text-destructive"
              aria-hidden="true"
            />
            <h1 className="font-display text-3xl font-medium text-foreground">
              Sign-in did not complete
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{error}</p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link
                href={loginPath}
                className="rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
              >
                Back to sign in
              </Link>
              <Link
                href="/dashboard"
                className="rounded-full border border-border bg-card px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
              >
                Continue anonymously
              </Link>
            </div>
          </>
        ) : (
          <>
            <h1 className="font-display text-3xl font-medium text-foreground">
              Signing you in
            </h1>
            <p className="mt-3 flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              One moment
            </p>
          </>
        )}
      </div>
    </main>
  );
}
