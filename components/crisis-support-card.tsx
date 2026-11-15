import Link from 'next/link';
import { LifeBuoy, X } from 'lucide-react';

/**
 * Shown when /api/chat returns its deterministic crisis response
 * (`model === 'safety'`). Numbers mirror CRISIS_LINES in lib/resources.ts.
 */
export const CRISIS_SUPPORT_ACTIONS = [
  { label: 'Call 988', detail: 'US and Canada', href: 'tel:988' },
  { label: 'Text 988', detail: 'US and Canada', href: 'sms:988' },
  { label: 'Call 116 123', detail: 'Samaritans, UK', href: 'tel:116123' },
  { label: 'Call 13 11 14', detail: 'Lifeline, Australia', href: 'tel:131114' },
] as const;

export function CrisisSupportCard({ onDismiss }: { onDismiss?: () => void }) {
  return (
    <section
      role="region"
      aria-label="Reach someone now"
      className="rounded-2xl border border-destructive/40 bg-destructive/5 p-4 text-sm"
    >
      <div className="flex items-start gap-3">
        <LifeBuoy className="mt-0.5 h-5 w-5 shrink-0 text-destructive" aria-hidden="true" />
        <div className="flex-1">
          <h2 className="text-base font-semibold text-foreground">Reach someone now</h2>
          <p className="mt-1 text-muted-foreground">
            If you or someone else may be in immediate danger, call your local
            emergency number.
          </p>
        </div>
        {onDismiss ? (
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Close urgent support options"
            className="rounded-full p-1 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        ) : null}
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {CRISIS_SUPPORT_ACTIONS.map((action) => (
          <a
            key={action.href}
            href={action.href}
            className="rounded-xl border border-border bg-card px-3 py-2 font-semibold text-foreground hover:bg-secondary"
          >
            {action.label}
            <span className="block text-xs font-normal text-muted-foreground">
              {action.detail}
            </span>
          </a>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
        <a
          href="https://findahelpline.com"
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold underline"
        >
          Find a helpline in another country
        </a>
        <Link href="/resources#crisis" className="font-semibold underline">
          All crisis support
        </Link>
      </div>
    </section>
  );
}
