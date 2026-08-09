import { CalendarDays, LockKeyhole } from 'lucide-react';
import Link from 'next/link';
import {
  createWeeklyInsight,
  type WeeklyOwnerSummary,
} from '@/lib/weekly-insights';

type WeeklyInsightProps = {
  summary: WeeklyOwnerSummary;
  className?: string;
};

export function WeeklyInsight({ summary, className = '' }: WeeklyInsightProps) {
  const insight = createWeeklyInsight(summary);
  if (insight.totalObservations === 0) return null;

  return (
    <section
      aria-labelledby="weekly-insight-heading"
      className={`app-panel overflow-hidden ${className}`.trim()}
    >
      <div className="flex items-start justify-between gap-4 px-5 pb-3 pt-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Weekly insight
          </p>
          <h2
            id="weekly-insight-heading"
            className="mt-1 font-display text-xl font-medium text-foreground"
          >
            {insight.heading}
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">{insight.periodLabel}</p>
        </div>
        <div className="rounded-full bg-secondary p-2.5 text-primary">
          <CalendarDays aria-hidden="true" size={20} />
        </div>
      </div>

      <ul className="grid grid-cols-2 gap-2 px-5 pb-4 sm:grid-cols-4">
        {insight.counts.map((count) => (
          <li
            key={count.feature}
            className="rounded-xl border border-border bg-secondary/60 px-3 py-3"
          >
            <span className="block text-xl font-semibold text-foreground">
              {count.value}
            </span>
            <span className="mt-0.5 block text-xs leading-4 text-muted-foreground">
              {count.label}
            </span>
          </li>
        ))}
      </ul>

      {insight.question ? (
        <div className="border-t border-border bg-secondary/40 px-5 py-3">
          <p className="text-sm leading-5 text-foreground">{insight.question}</p>
          <Link
            href="/reflect?mode=weekly-patterns"
            className="mt-2 inline-flex text-sm font-semibold text-primary underline underline-offset-4"
          >
            Reflect on this week
          </Link>
        </div>
      ) : null}

      <p className="flex items-center gap-1.5 px-5 pb-4 pt-3 text-xs text-muted-foreground">
        <LockKeyhole aria-hidden="true" size={13} />
        Your content stays private. Partners only see enabled activity totals.
      </p>
    </section>
  );
}
