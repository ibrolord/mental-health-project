'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  Anchor,
  ArrowLeft,
  CirclePause,
  CirclePlay,
  LifeBuoy,
  RotateCcw,
  ShieldAlert,
} from 'lucide-react';
import { OptionalSoundscape } from '@/components/optional-soundscape';
import {
  GROUNDING_NEEDS,
  groundingPathFor,
  type GroundingNeed,
} from '@/lib/grounding';
import {
  IDLE_GUIDED_TIMER,
  advanceGuidedTimer,
  resetGuidedTimer,
} from '@/lib/guided-timer';

export default function GroundPage() {
  const [need, setNeed] = useState<GroundingNeed | null>(null);
  const [timerState, setTimerState] = useState(IDLE_GUIDED_TIMER);
  const { stepIndex, elapsed, running, complete } = timerState;

  const path = need ? groundingPathFor(need) : null;
  const step = path?.steps[stepIndex] ?? null;
  const completedSeconds =
    path?.steps
      .slice(0, stepIndex)
      .reduce((sum, item) => sum + item.seconds, 0) ?? 0;
  const totalSeconds =
    path?.steps.reduce((sum, item) => sum + item.seconds, 0) ?? 0;
  const overallElapsed = Math.min(totalSeconds, completedSeconds + elapsed);
  const progress =
    totalSeconds > 0 ? Math.round((overallElapsed / totalSeconds) * 100) : 0;

  useEffect(() => {
    if (!running || !path || !step || complete) return;
    const timer = window.setInterval(() => {
      setTimerState((current) =>
        advanceGuidedTimer(current, step.seconds, path.steps.length)
      );
    }, 1_000);
    return () => window.clearInterval(timer);
  }, [complete, path, running, step]);

  const startPath = (nextNeed: GroundingNeed) => {
    setNeed(nextNeed);
    setTimerState(resetGuidedTimer(true));
  };

  const reset = () => {
    setTimerState(resetGuidedTimer(true));
  };

  const chooseAgain = () => {
    setNeed(null);
    setTimerState(IDLE_GUIDED_TIMER);
  };

  return (
    <main className="min-h-[calc(100vh-5rem)] px-4 py-6 md:px-8 md:py-10">
      <div className="mx-auto max-w-4xl">
        <section className="overflow-hidden rounded-[1.25rem] border border-primary/20 bg-primary text-primary-foreground shadow-[0_30px_80px_-45px_hsl(var(--brand-ink)/0.8)]">
          <div className="p-5 md:p-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-primary-foreground/65">
                <Anchor className="h-4 w-4" aria-hidden="true" />
                Ground me now
              </div>
            </div>

            {!path ? (
              <>
                <h1 className="mt-6 max-w-2xl font-display text-4xl font-medium leading-tight md:text-6xl">
                  You do not need to explain everything.
                </h1>
                <p className="mt-3 max-w-xl text-sm leading-relaxed text-primary-foreground/70 md:text-base">
                  Pick the closest description. You can stop, switch, keep your
                  eyes open, or move at any time.
                </p>

                <Link
                  href="/resources#crisis"
                  className="mt-6 flex items-start gap-3 rounded-xl border border-primary-foreground/20 bg-primary-foreground/[0.08] p-4 transition-colors hover:bg-primary-foreground/[0.13] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-foreground/70"
                >
                  <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
                  <span>
                    <span className="block text-sm font-semibold">
                      I may hurt myself or someone else, or I am not safe
                    </span>
                    <span className="mt-1 block text-xs leading-relaxed text-primary-foreground/65">
                      Skip this exercise. Open local crisis and emergency support.
                    </span>
                  </span>
                </Link>

                <div className="mt-6 grid gap-2 sm:grid-cols-2">
                  {GROUNDING_NEEDS.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => startPath(option.id)}
                      className="rounded-xl border border-primary-foreground/15 bg-primary-foreground/[0.06] p-4 text-left transition-colors hover:bg-primary-foreground/[0.12] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-foreground/70"
                    >
                      <span className="block text-sm font-semibold">
                        {option.label}
                      </span>
                      <span className="mt-1 block text-xs leading-relaxed text-primary-foreground/60">
                        {option.prompt}
                      </span>
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={chooseAgain}
                  className="mt-5 inline-flex items-center gap-1.5 text-xs font-medium text-primary-foreground/65 hover:text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-foreground/70"
                >
                  <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                  Choose a different feeling
                </button>

                <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-primary-foreground/15">
                  <div
                    className="h-full rounded-full bg-primary-foreground transition-[width] duration-500"
                    style={{ width: `${progress}%` }}
                  />
                </div>

                <div className="grid min-h-[25rem] place-items-center py-8 text-center md:py-12">
                  {complete ? (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary-foreground/55">
                        You reached the end
                      </p>
                      <h2 className="mt-4 font-display text-4xl font-medium md:text-5xl">
                        Check what you need now.
                      </h2>
                      <p className="mx-auto mt-4 max-w-lg text-sm leading-relaxed text-primary-foreground/70">
                        Grounding does not have to remove every feeling. If you are
                        still getting more distressed, contact someone you trust or
                        use local professional or crisis support.
                      </p>
                      <div className="mt-6 flex flex-wrap justify-center gap-2">
                        <button
                          type="button"
                          onClick={reset}
                          className="inline-flex items-center gap-2 rounded-full bg-primary-foreground px-5 py-2.5 text-sm font-medium text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-foreground/70"
                        >
                          <RotateCcw className="h-4 w-4" aria-hidden="true" />
                          Repeat
                        </button>
                        <Link
                          href="/resources#crisis"
                          className="inline-flex items-center gap-2 rounded-full border border-primary-foreground/25 px-5 py-2.5 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-foreground/70"
                        >
                          <LifeBuoy className="h-4 w-4" aria-hidden="true" />
                          Find support
                        </Link>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary-foreground/55">
                        {path.technique} · step {stepIndex + 1} of {path.steps.length}
                      </p>
                      <h2 className="mt-4 font-display text-3xl font-medium md:text-5xl">
                        {step?.label}
                      </h2>
                      <p className="mx-auto mt-5 max-w-2xl font-display text-2xl leading-relaxed text-primary-foreground/90 md:text-3xl">
                        {step?.instruction}
                      </p>
                      <p className="mt-5 text-sm tabular-nums text-primary-foreground/55">
                        {Math.max(0, (step?.seconds ?? 0) - elapsed)} seconds
                      </p>
                      <button
                        type="button"
                        onClick={() =>
                          setTimerState((current) => ({
                            ...current,
                            running: !current.running,
                          }))
                        }
                        className="mt-6 inline-flex items-center gap-2 rounded-full bg-primary-foreground px-5 py-2.5 text-sm font-medium text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-foreground/70"
                      >
                        {running ? (
                          <CirclePause className="h-4 w-4" aria-hidden="true" />
                        ) : (
                          <CirclePlay className="h-4 w-4" aria-hidden="true" />
                        )}
                        {running ? 'Pause' : 'Continue'}
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </section>

        <section className="mt-4">
          <OptionalSoundscape
            options={['off', 'rain', 'ocean']}
            title="Optional sound"
            description="Choose quiet, soft rain, or slow tide."
          />
        </section>

        {path && !complete && (
          <details className="app-panel mt-4 p-4">
            <summary className="cursor-pointer text-sm font-medium text-foreground">
              About this exercise
            </summary>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              {path.why}
            </p>
            <Link
              href="/research#grounding"
              className="mt-3 inline-flex text-xs font-medium text-foreground underline underline-offset-4"
            >
              Research and safety
            </Link>
          </details>
        )}
      </div>
    </main>
  );
}
