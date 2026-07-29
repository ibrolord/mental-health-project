'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CirclePause, CirclePlay, RotateCcw, Wind } from 'lucide-react';
import { OptionalSoundscape } from '@/components/optional-soundscape';
import {
  MEDITATION_ISSUES,
  MEDITATION_PRACTICES,
  practiceDurationSeconds,
  practicesForIssue,
  type MeditationIssue,
} from '@/lib/meditation';
import {
  IDLE_GUIDED_TIMER,
  advanceGuidedTimer,
  resetGuidedTimer,
} from '@/lib/guided-timer';
import { cn } from '@/lib/utils';

function durationLabel(seconds: number): string {
  const minutes = Math.ceil(seconds / 60);
  return `${minutes} min`;
}

export default function MeditatePage() {
  const [issue, setIssue] = useState<MeditationIssue | 'all'>('all');
  const [selectedId, setSelectedId] = useState(MEDITATION_PRACTICES[0].id);
  const [timerState, setTimerState] = useState(IDLE_GUIDED_TIMER);
  const {
    stepIndex,
    elapsed: stepElapsed,
    running,
    complete,
  } = timerState;

  const visiblePractices = practicesForIssue(issue);
  const selected =
    MEDITATION_PRACTICES.find((practice) => practice.id === selectedId) ??
    MEDITATION_PRACTICES[0];
  const currentStep = selected.steps[stepIndex];
  const completedSeconds = selected.steps
    .slice(0, stepIndex)
    .reduce((sum, step) => sum + step.seconds, 0);
  const totalSeconds = practiceDurationSeconds(selected);
  const elapsedSeconds = Math.min(totalSeconds, completedSeconds + stepElapsed);
  const progress = totalSeconds > 0 ? (elapsedSeconds / totalSeconds) * 100 : 0;

  useEffect(() => {
    if (!running || complete) return;
    const timer = window.setInterval(() => {
      setTimerState((current) =>
        advanceGuidedTimer(
          current,
          currentStep.seconds,
          selected.steps.length
        )
      );
    }, 1_000);
    return () => window.clearInterval(timer);
  }, [complete, currentStep.seconds, running, selected.steps.length]);

  const selectPractice = (id: string) => {
    setSelectedId(id);
    setTimerState(IDLE_GUIDED_TIMER);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const restart = () => {
    setTimerState(resetGuidedTimer(true));
  };

  return (
    <main className="px-4 py-8 md:px-8 md:py-12">
      <div className="mx-auto max-w-5xl">
        <header className="max-w-3xl">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            <Wind className="h-3.5 w-3.5" aria-hidden="true" />
            Guided practice
          </div>
          <h1 className="font-display text-4xl font-medium leading-[1.05] tracking-[-0.02em] text-foreground md:text-5xl">
            Choose the kind of quiet you need.
          </h1>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground">
            Short practices for stress, sleep, grief, focus, and grounding.
          </p>
        </header>

        <section className="mt-8 grid gap-5 lg:grid-cols-[1.35fr_0.65fr]">
          <div className="app-panel overflow-hidden">
            <div className="border-b border-border bg-primary p-6 text-primary-foreground">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary-foreground/60">
                    {durationLabel(totalSeconds)} practice
                  </p>
                  <h2 className="mt-2 font-display text-3xl font-medium">
                    {selected.title}
                  </h2>
                  <p className="mt-2 max-w-xl text-sm leading-relaxed text-primary-foreground/72">
                    {selected.summary}
                  </p>
                </div>
                <div className="rounded-full border border-primary-foreground/20 px-3 py-1 text-xs text-primary-foreground/70">
                  {stepIndex + 1}/{selected.steps.length}
                </div>
              </div>
              <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-primary-foreground/15">
                <div
                  className="h-full rounded-full bg-primary-foreground transition-[width] duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            <div className="grid min-h-[20rem] place-items-center p-6 text-center md:p-10">
              {complete ? (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent">
                    Practice complete
                  </p>
                  <h3 className="mt-3 font-display text-3xl font-medium text-foreground">
                    Notice what is here now.
                  </h3>
                  <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
                    You do not need to feel completely different for the practice
                    to count. Decide whether to rest, repeat, move, or contact
                    someone.
                  </p>
                  <button
                    type="button"
                    onClick={restart}
                    className="mt-6 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <RotateCcw className="h-4 w-4" aria-hidden="true" />
                    Repeat practice
                  </button>
                </div>
              ) : (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    {currentStep.label}
                  </p>
                  <p className="mx-auto mt-4 max-w-xl font-display text-2xl leading-relaxed text-foreground md:text-3xl">
                    {currentStep.instruction}
                  </p>
                  <p className="mt-5 text-sm tabular-nums text-muted-foreground">
                    {Math.max(0, currentStep.seconds - stepElapsed)} seconds
                  </p>
                  <button
                    type="button"
                    onClick={() =>
                      setTimerState((current) => ({
                        ...current,
                        running: !current.running,
                      }))
                    }
                    className="mt-6 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {running ? (
                      <CirclePause className="h-4 w-4" aria-hidden="true" />
                    ) : (
                      <CirclePlay className="h-4 w-4" aria-hidden="true" />
                    )}
                    {running
                      ? 'Pause'
                      : elapsedSeconds > 0
                        ? 'Continue'
                        : 'Begin'}
                  </button>
                </div>
              )}
            </div>

            {selected.safetyNote && (
              <p className="border-t border-border bg-secondary/60 px-5 py-3 text-xs leading-relaxed text-muted-foreground">
                {selected.safetyNote}
              </p>
            )}
          </div>

          <OptionalSoundscape
            options={['off', 'rain', 'ocean']}
          />
        </section>

        <section className="mt-10">
          <h2 className="font-display text-2xl font-medium text-foreground">
            Find a practice
          </h2>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setIssue('all')}
              className={cn(
                'rounded-full border px-3.5 py-2 text-sm transition-colors',
                issue === 'all'
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-card text-foreground hover:bg-secondary'
              )}
            >
              All
            </button>
            {MEDITATION_ISSUES.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setIssue(option.id)}
                className={cn(
                  'rounded-full border px-3.5 py-2 text-sm transition-colors',
                  issue === option.id
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-card text-foreground hover:bg-secondary'
                )}
              >
                {option.label}
              </button>
            ))}
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {visiblePractices.map((practice) => (
              <button
                key={practice.id}
                type="button"
                onClick={() => selectPractice(practice.id)}
                className={cn(
                  'app-panel p-5 text-left transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  selected.id === practice.id && 'border-primary/45'
                )}
              >
                <span className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                  {durationLabel(practiceDurationSeconds(practice))}
                </span>
                <span className="mt-2 block font-display text-xl font-medium text-foreground">
                  {practice.title}
                </span>
                <span className="mt-2 block text-sm leading-relaxed text-muted-foreground">
                  {practice.summary}
                </span>
              </button>
            ))}
          </div>
        </section>

        <Link
          href="/research#meditation"
          className="mt-8 inline-flex text-sm font-medium text-foreground underline underline-offset-4"
        >
          Research and safety
        </Link>
      </div>
    </main>
  );
}
