'use client';

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import Link from 'next/link';
import { LockKeyhole, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AI_DATA_SHARING_DISCLOSURE,
  grantAiDataSharingConsent,
  hasAiDataSharingConsent,
} from '@/lib/ai-consent';
import { useDataContext } from '@/lib/hooks/use-data-context';

type ConsentResolver = (granted: boolean) => void;
type RequestConsent = () => Promise<boolean>;

const AiConsentContext = createContext<RequestConsent | null>(null);

export function AiConsentProvider({ children }: { children: ReactNode }) {
  const { query } = useDataContext();
  const subjectId = query ? `${query.column}:${query.value}` : '';
  const [open, setOpen] = useState(false);
  const pendingResolvers = useRef(new Set<ConsentResolver>());
  const requestSubjectRef = useRef('');

  const resolvePending = (granted: boolean) => {
    const requestedSubject = requestSubjectRef.current;
    const resolvedValue = granted && requestedSubject === subjectId
      ? grantAiDataSharingConsent(requestedSubject)
      : false;
    for (const resolve of pendingResolvers.current) {
      resolve(resolvedValue);
    }
    pendingResolvers.current.clear();
    requestSubjectRef.current = '';
    setOpen(false);
  };

  const requestConsent: RequestConsent = () => {
    if (hasAiDataSharingConsent(subjectId)) return Promise.resolve(true);
    if (!subjectId) return Promise.resolve(false);

    requestSubjectRef.current = subjectId;
    setOpen(true);
    return new Promise<boolean>((resolve) => {
      pendingResolvers.current.add(resolve);
    });
  };

  useEffect(() => {
    const pending = pendingResolvers.current;
    return () => {
      for (const resolve of pending) resolve(false);
      pending.clear();
    };
  }, []);

  useEffect(() => {
    if (open && requestSubjectRef.current !== subjectId) {
      resolvePending(false);
    }
    // Identity changes must cancel, never transfer, an open consent request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, subjectId]);

  return (
    <AiConsentContext.Provider value={requestConsent}>
      {children}
      {open && (
        <div className="fixed inset-0 z-[70]">
          <button
            type="button"
            aria-label="Close AI data sharing consent"
            onClick={() => resolvePending(false)}
            className="absolute inset-0 bg-brand-ink/45 backdrop-blur-[2px]"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="ai-consent-title"
            aria-describedby="ai-consent-description"
            className="absolute inset-x-4 top-1/2 mx-auto max-w-lg -translate-y-1/2 rounded-3xl border border-border bg-card p-6 shadow-2xl sm:p-7"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-secondary text-foreground">
                <LockKeyhole className="h-5 w-5" aria-hidden="true" />
              </div>
              <button
                type="button"
                onClick={() => resolvePending(false)}
                aria-label="Close AI data sharing consent"
                className="grid h-9 w-9 place-items-center rounded-full border border-border text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <h2
              id="ai-consent-title"
              className="mt-5 font-display text-3xl font-medium text-foreground"
            >
              Continue with AI?
            </h2>
            <p
              id="ai-consent-description"
              className="mt-3 text-sm leading-relaxed text-muted-foreground"
            >
              {AI_DATA_SHARING_DISCLOSURE}
            </p>
            <p className="mt-3 text-xs text-muted-foreground">
              You can reset this choice in Settings. Read the{' '}
              <Link href="/privacy" className="font-semibold underline">
                privacy policy
              </Link>
              .
            </p>

            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => resolvePending(false)}
              >
                Not now
              </Button>
              <Button
                type="button"
                autoFocus
                onClick={() => resolvePending(true)}
              >
                Continue with AI
              </Button>
            </div>
          </div>
        </div>
      )}
    </AiConsentContext.Provider>
  );
}

export function useAiConsent(): RequestConsent {
  const requestConsent = useContext(AiConsentContext);
  if (!requestConsent) {
    throw new Error('useAiConsent must be used within AiConsentProvider.');
  }
  return requestConsent;
}
