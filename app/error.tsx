'use client';

import { useEffect } from 'react';
import { recordOperationalEvent } from '@/lib/observability';

export default function ErrorPage({ reset }: { reset: () => void }) {
  useEffect(() => {
    void recordOperationalEvent('route_error');
  }, []);

  return (
    <main className="flex min-h-[70vh] items-center justify-center px-6 py-16">
      <section className="w-full max-w-lg rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
        <p className="font-display text-3xl font-semibold text-foreground">
          Something went wrong
        </p>
        <p className="mt-3 text-muted-foreground">
          This page could not load. Your saved information has not been changed.
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-6 rounded-lg bg-primary px-5 py-3 font-semibold text-primary-foreground"
        >
          Try again
        </button>
      </section>
    </main>
  );
}
