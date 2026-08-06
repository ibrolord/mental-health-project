'use client';

import { useEffect, useRef, useState, type MutableRefObject } from 'react';
import { Loader2 } from 'lucide-react';
import {
  getAnonymousProfileDataConflictUserId,
  isAnonymousProfileDataConflict,
  useAuth,
  type SocialAuthIntent,
  type SocialAuthProvider,
} from '@/lib/auth-context';
import { getEnabledAuthProviders } from '@/lib/auth-providers';
import { isIdentityAlreadyLinkedError } from '@/lib/auth/social';

/** Google's mark, inlined so the button works without an external request. */
function GoogleMark() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.06 12.25c0-.85-.08-1.67-.22-2.45H12v4.63h6.2a5.3 5.3 0 0 1-2.3 3.48v2.89h3.72c2.18-2 3.44-4.960 3.44-8.55z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.11 0 5.72-1.03 7.62-2.79l-3.72-2.89c-1.03.69-2.35 1.1-3.9 1.1-3 0-5.55-2.03-6.46-4.76H1.69v2.98A11.5 11.5 0 0 0 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.54 14.66a6.9 6.9 0 0 1 0-4.4V7.28H1.69a11.51 11.51 0 0 0 0 10.36l3.85-2.98z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.69 0 3.21.58 4.4 1.72l3.3-3.3C17.72 1.2 15.11 0 12 0 7.48 0 3.57 2.6 1.69 6.38l3.85 2.98C6.45 6.78 9 4.75 12 4.75z"
      />
    </svg>
  );
}

function AppleMark() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M17.05 12.54c-.03-3.1 2.53-4.61 2.64-4.68a5.67 5.67 0 0 0-4.47-2.42c-1.88-.2-3.71 1.13-4.67 1.13-.98 0-2.46-1.11-4.05-1.08a5.94 5.94 0 0 0-5 3.05c-2.16 3.74-.55 9.24 1.52 12.26 1.04 1.48 2.25 3.14 3.84 3.08 1.56-.06 2.14-.99 4.02-.99 1.86 0 2.41.99 4.03.95 1.67-.02 2.72-1.49 3.72-2.98a12.24 12.24 0 0 0 1.7-3.45 5.36 5.36 0 0 1-3.28-4.87ZM13.99 3.45A5.43 5.43 0 0 0 15.23 0a5.55 5.55 0 0 0-3.59 1.74 5.15 5.15 0 0 0-1.28 3.3 4.58 4.58 0 0 0 3.63-1.59Z"
      />
    </svg>
  );
}

const PROVIDERS: Array<{
  id: SocialAuthProvider;
  mark: () => React.ReactNode;
}> = [
  { id: 'google', mark: GoogleMark },
  { id: 'apple', mark: AppleMark },
];

export function SocialAuthButtons({
  intent,
  nextPath,
  disabled = false,
  submissionRef: sharedSubmissionRef,
  onAnonymousDataBlocked,
  onIdentityAlreadyLinked,
}: {
  intent: SocialAuthIntent;
  nextPath?: string;
  disabled?: boolean;
  submissionRef?: MutableRefObject<boolean>;
  onAnonymousDataBlocked?: (
    provider: SocialAuthProvider,
    anonymousUserId: string
  ) => void;
  onIdentityAlreadyLinked?: (provider: SocialAuthProvider) => void;
}) {
  const { continueWithProvider } = useAuth();
  const [available, setAvailable] = useState<Record<SocialAuthProvider, boolean> | null>(
    null
  );
  const [pending, setPending] = useState<SocialAuthProvider | null>(null);
  const [error, setError] = useState<string | null>(null);
  const localSubmissionRef = useRef(false);
  const submissionRef = sharedSubmissionRef ?? localSubmissionRef;

  useEffect(() => {
    let active = true;
    getEnabledAuthProviders().then((providers) => {
      if (active) {
        setAvailable({ google: providers.google, apple: providers.apple });
      }
    });
    return () => {
      active = false;
    };
  }, []);

  const enabled = PROVIDERS.filter(({ id }) => available?.[id] === true);
  if (enabled.length === 0) return null;

  const handleClick = async (provider: SocialAuthProvider) => {
    if (disabled || submissionRef.current) return;
    submissionRef.current = true;
    setError(null);
    setPending(provider);
    try {
      await continueWithProvider(provider, intent, nextPath);
    } catch (err) {
      const anonymousUserId = getAnonymousProfileDataConflictUserId(err);
      if (
        intent === 'upgrade' &&
        isIdentityAlreadyLinkedError(
          err instanceof Error ? err.message : String(err)
        ) &&
        onIdentityAlreadyLinked
      ) {
        onIdentityAlreadyLinked(provider);
      } else if (
        anonymousUserId &&
        isAnonymousProfileDataConflict(err) &&
        onAnonymousDataBlocked
      ) {
        onAnonymousDataBlocked(provider, anonymousUserId);
      } else {
        setError((err as Error).message);
      }
    } finally {
      submissionRef.current = false;
      setPending(null);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-border" />
        <span className="text-xs uppercase tracking-[0.1em] text-muted-foreground">
          or
        </span>
        <span className="h-px flex-1 bg-border" />
      </div>

      {enabled.map(({ id, mark: Mark }) => (
        <button
          key={id}
          type="button"
          onClick={() => void handleClick(id)}
          disabled={disabled || pending !== null}
          className="flex w-full items-center justify-center gap-2.5 rounded-full border border-border bg-card px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-secondary disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {pending === id ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <Mark />
          )}
          {intent === 'sign-in' ? 'Sign in' : 'Continue'} with{' '}
          {id === 'google' ? 'Google' : 'Apple'}
        </button>
      ))}

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
