import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowRight,
  BookOpenCheck,
  Bug,
  LifeBuoy,
  Mail,
  ShieldCheck,
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'Support - MHtoolkit',
  description:
    'Contact MHtoolkit support, report an issue, and review common questions.',
};

const FAQS = [
  {
    question: 'Is MHtoolkit medical treatment or a diagnostic service?',
    answer:
      'No. MHtoolkit is a self-management and reflection tool. Published screeners retain their original recall periods and scoring, but a score is not a diagnosis and needs clinical context.',
  },
  {
    question: 'Why does a missed habit day not erase my progress?',
    answer:
      'Habit formation varies widely between people. MHtoolkit records current and best streaks while keeping total completions, so one missed opportunity does not turn your prior effort into zero.',
  },
  {
    question: 'Do the mind games improve my brain?',
    answer:
      'MHtoolkit does not make that claim. The games practice the task in front of you. Research finds small average training effects and limited evidence that gains transfer broadly to everyday life.',
  },
  {
    question: 'Do sounds, tones, or special frequencies improve focus?',
    answer:
      'No special frequency is promised. Optional sounds are generated locally and offered for comfort or preference. Evidence for natural sound and performance is mixed.',
  },
  {
    question: 'What appears in a push notification?',
    answer:
      'Only generic MHtoolkit reminder text. Habit names, goals, life-plan text, journal entries, moods, assessment results, and AI conversations are not placed on your lock screen.',
  },
  {
    question: 'What can an accountability partner see?',
    answer:
      'Only progress categories you explicitly enable, and only as counts or status. Partners can never see journal text, AI chat history, assessment scores, or notes attached to mood entries. These boundaries are enforced by database policies.',
  },
  {
    question: 'Can I use MHtoolkit without a standard account?',
    answer:
      'Yes. The app can create an anonymous authenticated session so owner-scoped data and privacy rules still work. Anonymous sessions are not automatically purged.',
  },
  {
    question: 'How do I export or delete my data?',
    answer:
      'Open Settings to download a complete export or delete your data. Account deletion removes owner-scoped application records before removing the authentication account.',
  },
];

export default function SupportPage() {
  return (
    <main className="min-h-screen bg-background px-4 py-10 sm:px-6 sm:py-14">
      <article className="mx-auto max-w-5xl">
        <header className="max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            <LifeBuoy className="h-3.5 w-3.5" aria-hidden="true" />
            Support
          </div>
          <h1 className="mt-4 font-display text-4xl font-medium leading-[1.05] tracking-[-0.02em] text-foreground md:text-6xl">
            Answers, evidence, and a real way to reach us.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground">
            Get product help, report a problem, or review why a feature is designed
            the way it is.
          </p>
        </header>

        <section className="mt-8 grid gap-4 md:grid-cols-3">
          <a
            href="mailto:bolajiag10@gmail.com"
            className="app-panel p-5 transition-colors hover:bg-secondary"
          >
            <Mail className="h-5 w-5 text-accent" aria-hidden="true" />
            <h2 className="mt-4 font-display text-xl text-foreground">
              Contact support
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              bolajiag10@gmail.com
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Target response time: 48 hours
            </p>
          </a>
          <a
            href="mailto:bolajiag10@gmail.com?subject=MHtoolkit%20bug%20report"
            className="app-panel p-5 transition-colors hover:bg-secondary"
          >
            <Bug className="h-5 w-5 text-accent" aria-hidden="true" />
            <h2 className="mt-4 font-display text-xl text-foreground">
              Report a bug
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Include your device, browser or app version, steps, and a screenshot
              if possible.
            </p>
          </a>
          <Link
            href="/research"
            className="app-panel p-5 transition-colors hover:bg-secondary"
          >
            <BookOpenCheck className="h-5 w-5 text-accent" aria-hidden="true" />
            <h2 className="mt-4 font-display text-xl text-foreground">
              Research guide
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Read the sources, evidence strength, and limits behind each tool.
            </p>
          </Link>
        </section>

        <section className="mt-10">
          <h2 className="font-display text-3xl font-medium text-foreground">
            Frequently asked questions
          </h2>
          <div className="mt-5 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
            {FAQS.map((faq, index) => (
              <details key={faq.question} className="group p-5" open={index === 0}>
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold text-foreground">
                  {faq.question}
                  <ArrowRight
                    className="h-4 w-4 shrink-0 transition-transform group-open:rotate-90"
                    aria-hidden="true"
                  />
                </summary>
                <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted-foreground">
                  {faq.answer}
                </p>
              </details>
            ))}
          </div>
        </section>

        <section className="mt-10 rounded-2xl border border-destructive/20 bg-destructive/5 p-5">
          <div className="flex items-start gap-3">
            <ShieldCheck
              className="mt-0.5 h-5 w-5 shrink-0 text-destructive"
              aria-hidden="true"
            />
            <div>
              <h2 className="font-semibold text-foreground">Urgent support</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                MHtoolkit does not provide crisis care. If you or someone else is
                in immediate danger, contact local emergency services or go to the
                nearest emergency department. For urgent emotional support, use an
                official service for your country or find a verified local option
                through{' '}
                <a
                  href="https://findahelpline.com/"
                  className="font-medium text-foreground underline"
                >
                  Find A Helpline
                </a>
                .
              </p>
            </div>
          </div>
        </section>

        <footer className="mt-10 flex flex-wrap gap-x-5 gap-y-2 border-t border-border pt-6 text-sm text-muted-foreground">
          <Link href="/privacy" className="hover:text-foreground">
            Privacy policy
          </Link>
          <Link href="/research" className="hover:text-foreground">
            Research and evidence
          </Link>
          <span>MHtoolkit is developed by Bolaji Agunbiade.</span>
        </footer>
      </article>
    </main>
  );
}
