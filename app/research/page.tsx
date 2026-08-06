import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowUpRight, FlaskConical, ShieldCheck } from 'lucide-react';
import {
  EVIDENCE_SOURCES,
  EVIDENCE_STRENGTH_LABELS,
  type EvidenceSource,
} from '@/lib/wellbeing/evidence';
import { cn } from '@/lib/utils';

export const metadata: Metadata = {
  title: 'Research and evidence limits - MHtoolkit',
  description:
    'Review the research, evidence strength, and limits behind MHtoolkit features.',
};

const SECTIONS: Array<{
  id: string;
  title: string;
  summary: string;
  evidenceIds: string[];
}> = [
  {
    id: 'habits',
    title: 'Habits and routines',
    summary:
      'MHtoolkit emphasizes a clear cue, a very small action, a stable context, and a compassionate return after missed days. Templates borrow limited techniques from behavior-change research; they are not mental-health treatment plans.',
    evidenceIds: [
      'habit-repetition',
      'implementation-intentions',
      'behavioral-activation',
      'cbti',
    ],
  },
  {
    id: 'focus',
    title: 'Focus, breaks, and optional sound',
    summary:
      'The focus timer protects a bounded work period and a real break. It does not claim that one timer length, music style, sound frequency, or noise color reliably improves productivity.',
    evidenceIds: ['microbreaks', 'nature-sound'],
  },
  {
    id: 'mind-games',
    title: 'Mind games',
    summary:
      'The games are brief attention and working-memory tasks. They can provide a structured activity, but are not cognitive assessment, treatment, rehabilitation, or evidence of broad brain improvement.',
    evidenceIds: ['working-memory-training'],
  },
  {
    id: 'calm',
    title: 'Breathing, meditation, and grounding',
    summary:
      'Slow breathing and present-moment exercises may help some people regulate short-term arousal. They are optional, should stop if distress increases, and do not replace crisis or clinical care.',
    evidenceIds: ['slow-breathing', 'nature-sound'],
  },
  {
    id: 'movement',
    title: 'Yoga',
    summary:
      'MHtoolkit uses beginner chair, floor, and restorative yoga. Research suggests possible wellbeing benefits, but programs vary and evidence for mental-health outcomes is inconsistent. These sequences are optional movement guidance, not treatment or individualized exercise advice.',
    evidenceIds: ['yoga-safety', 'yoga-depression', 'physical-activity'],
  },
  {
    id: 'reminders',
    title: 'Reminders',
    summary:
      'Reminders can prompt a near-term action, but do not create lasting adherence by themselves. MHtoolkit therefore keeps them sparse, generic, opt-in, and user-controlled.',
    evidenceIds: ['notifications'],
  },
];

const sourceById = new Map(EVIDENCE_SOURCES.map((source) => [source.id, source]));

export default function ResearchPage() {
  return (
    <main className="min-h-screen bg-background px-4 py-10 sm:px-6 sm:py-14">
      <article className="mx-auto max-w-5xl">
        <header className="max-w-3xl">
          <Link
            href="/support"
            className="text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            Support
          </Link>
          <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            <FlaskConical className="h-3.5 w-3.5" aria-hidden="true" />
            Evidence guide
          </div>
          <h1 className="mt-4 font-display text-4xl font-medium leading-[1.05] tracking-[-0.02em] text-foreground md:text-6xl">
            What the research supports, and what it does not.
          </h1>
          <p className="mt-5 text-base leading-relaxed text-muted-foreground">
            MHtoolkit uses published research to shape self-management tools while
            keeping claims narrow. Evidence labels describe the cited body of work,
            not proof that a feature will help every person.
          </p>
        </header>

        <aside className="app-panel mt-8 flex items-start gap-3 p-5">
          <ShieldCheck
            className="mt-0.5 h-5 w-5 shrink-0 text-accent"
            aria-hidden="true"
          />
          <div>
            <h2 className="font-semibold text-foreground">Clinical boundary</h2>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              MHtoolkit is not a medical device, diagnostic service, therapist, or
              emergency service. Assessments retain their published scoring rules,
              but results still require clinical context.
            </p>
          </div>
        </aside>

        <div className="mt-10 space-y-10">
          {SECTIONS.map((section) => (
            <section key={section.id} id={section.id} className="scroll-mt-24">
              <div className="max-w-3xl">
                <h2 className="font-display text-3xl font-medium text-foreground">
                  {section.title}
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  {section.summary}
                </p>
              </div>
              <div className="mt-5 grid gap-3 md:grid-cols-2">
                {section.evidenceIds.flatMap((id) => {
                  const source = sourceById.get(id);
                  return source ? [<EvidenceCard key={id} source={source} />] : [];
                })}
              </div>
            </section>
          ))}
        </div>

        <footer className="mt-12 border-t border-border pt-6 text-sm text-muted-foreground">
          Questions about a source or feature?{' '}
          <a
            href="mailto:bolajiag10@gmail.com"
            className="font-medium text-foreground underline"
          >
            Contact support
          </a>
          .
        </footer>
      </article>
    </main>
  );
}

function EvidenceCard({ source }: { source: EvidenceSource }) {
  return (
    <a
      href={source.url}
      target="_blank"
      rel="noreferrer"
      className="group rounded-2xl border border-border bg-card p-5 transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="flex items-start justify-between gap-3">
        <span
          className={cn(
            'rounded-full px-2.5 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.08em]',
            source.strength === 'strong' && 'bg-primary text-primary-foreground',
            source.strength === 'moderate' && 'bg-accent/12 text-accent',
            source.strength === 'emerging' && 'bg-secondary text-foreground',
            source.strength === 'limited' &&
              'border border-border bg-background text-muted-foreground'
          )}
        >
          {EVIDENCE_STRENGTH_LABELS[source.strength]}
        </span>
        <ArrowUpRight
          className="h-4 w-4 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
          aria-hidden="true"
        />
      </div>
      <h3 className="mt-4 font-semibold text-foreground">{source.title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        {source.summary}
      </p>
      <p className="mt-4 text-xs text-muted-foreground">{source.citation}</p>
    </a>
  );
}
