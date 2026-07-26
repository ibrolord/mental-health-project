'use client';

import { ArrowRight, BadgeCheck, Brain, Flame, ShieldCheck } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { ASSESSMENTS } from '@/lib/assessments/definitions';

const presentation = {
  GAD7: {
    icon: Brain,
    accent: 'border-sky-200 bg-sky-50 text-sky-950',
    iconStyle: 'bg-sky-900 text-white',
  },
  PHQ9: {
    icon: ShieldCheck,
    accent: 'border-teal-200 bg-teal-50 text-teal-950',
    iconStyle: 'bg-teal-900 text-white',
  },
  CBI: {
    icon: Flame,
    accent: 'border-amber-200 bg-amber-50 text-amber-950',
    iconStyle: 'bg-amber-900 text-white',
  },
} as const;

export default function AssessmentsPage() {
  const router = useRouter();
  const assessments = Object.values(ASSESSMENTS);

  return (
    <main className="min-h-screen bg-[#f4f1e8] px-4 py-10 pb-28 md:py-14">
      <div className="mx-auto max-w-6xl">
        <section className="relative overflow-hidden rounded-[2rem] border border-emerald-950/10 bg-[#173f38] px-6 py-9 text-white shadow-[0_24px_70px_rgba(23,63,56,0.18)] md:px-10 md:py-12">
          <div className="absolute -right-16 -top-20 h-64 w-64 rounded-full bg-amber-300/20 blur-2xl" />
          <div className="relative max-w-3xl">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-sm text-emerald-50">
              <BadgeCheck className="h-4 w-4" aria-hidden="true" />
              Published self-report tools
            </div>
            <h1 className="font-[family-name:var(--font-display)] text-4xl leading-tight md:text-6xl">
              Check a pattern, not a label.
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-emerald-50/90 md:text-lg">
              Choose the question you want to explore. Each tool uses its published wording,
              response scale, and scoring method. Results can support a conversation with a
              qualified professional, but they cannot diagnose you.
            </p>
          </div>
        </section>

        <section className="mt-10" aria-labelledby="assessment-list-title">
          <div className="mb-5 flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-800">
                Choose one
              </p>
              <h2
                id="assessment-list-title"
                className="mt-1 font-[family-name:var(--font-display)] text-3xl text-slate-950"
              >
                What do you want to check?
              </h2>
            </div>
            <p className="text-sm text-slate-600">About 2-5 minutes each</p>
          </div>

          <div className="grid gap-5 lg:grid-cols-3">
            {assessments.map((assessment) => {
              const card = presentation[assessment.type];
              const Icon = card.icon;

              return (
                <article
                  key={assessment.type}
                  className={`flex min-h-[25rem] flex-col rounded-[1.5rem] border p-6 shadow-sm ${card.accent}`}
                >
                  <div className={`mb-6 grid h-12 w-12 place-items-center rounded-2xl ${card.iconStyle}`}>
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <p className="text-xs font-bold uppercase tracking-[0.14em] opacity-70">
                    {assessment.measureType}
                  </p>
                  <h3 className="mt-2 text-2xl font-semibold">{assessment.shortName}</h3>
                  <p className="mt-2 min-h-12 text-sm leading-6 opacity-80">
                    {assessment.description}
                  </p>

                  <dl className="mt-6 space-y-3 border-y border-current/10 py-4 text-sm">
                    <div className="flex justify-between gap-4">
                      <dt className="opacity-65">Recall period</dt>
                      <dd className="text-right font-semibold">{assessment.timeframe}</dd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <dt className="opacity-65">Length</dt>
                      <dd className="text-right font-semibold">
                        {assessment.functioningQuestion
                          ? `${assessment.questions.length} scored + 1 impact`
                          : `${assessment.questions.length} questions`}
                      </dd>
                    </div>
                  </dl>

                  <div className="mt-auto pt-6">
                    <button
                      type="button"
                      onClick={() =>
                        router.push(`/assessments/${assessment.type.toLowerCase()}`)
                      }
                      className="flex w-full items-center justify-between rounded-xl bg-slate-950 px-4 py-3 text-left font-semibold text-white transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2"
                    >
                      Start {assessment.type === 'CBI' ? 'measure' : 'screener'}
                      <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </button>
                    <a
                      href={assessment.citationUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-3 block text-center text-xs font-medium underline decoration-current/30 underline-offset-4 hover:decoration-current"
                    >
                      View published source
                    </a>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <section className="mt-8 grid gap-4 rounded-[1.5rem] border border-slate-200 bg-white p-6 md:grid-cols-3 md:p-8">
          <div>
            <p className="font-semibold text-slate-950">What a score can do</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Summarize symptom frequency or exhaustion using the instrument&apos;s published
              method.
            </p>
          </div>
          <div>
            <p className="font-semibold text-slate-950">What it cannot do</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Diagnose a condition, identify its cause, or decide which treatment is right for you.
            </p>
          </div>
          <div>
            <p className="font-semibold text-slate-950">When to get help</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Seek professional care whenever symptoms concern you or interfere with daily life,
              regardless of the number.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
