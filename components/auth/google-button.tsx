'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { getEnabledAuthProviders } from '@/lib/auth-providers';

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

/**
 * Renders nothing until we know Google is actually enabled on the Supabase
 * project. See lib/auth-providers.ts for why.
 */
export function GoogleButton({ label }: { label: string }) {
  const { signInWithGoogle } = useAuth();
  const [available, setAvailable] = useState<boolean | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getEnabledAuthProviders().then((providers) => {
      if (active) setAvailable(providers.google);
    });
    return () => {
      active = false;
    };
  }, []);

  if (available !== true) return null;

  const handleClick = async () => {
    setError(null);
    setPending(true);
    try {
      // Redirects away on success, so `pending` stays true until navigation.
      await signInWithGoogle();
    } catch (err) {
      setError((err as Error).message);
      setPending(false);
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

      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className="flex w-full items-center justify-center gap-2.5 rounded-full border border-border bg-card px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-secondary disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {pending ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        ) : (
          <GoogleMark />
        )}
        {label}
      </button>

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
