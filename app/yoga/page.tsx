'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  Activity,
  CirclePause,
  CirclePlay,
  Clock3,
  RotateCcw,
  ShieldCheck,
} from 'lucide-react';
import { OptionalSoundscape } from '@/components/optional-soundscape';
import {
  IDLE_GUIDED_TIMER,
  advanceGuidedTimerBy,
  resetGuidedTimer,
} from '@/lib/guided-timer';
import {
  YOGA_PRACTICES,
  getYogaPose,
  yogaPracticeDurationSeconds,
} from '@/lib/wellbeing/yoga';
import { cn } from '@/lib/utils';

function minutesLabel(seconds: number): string {
  return `${Math.max(1, Math.ceil(seconds / 60))} min`;
}

export default function YogaPage() {
  const [selectedId, setSelectedId] = useState(YOGA_PRACTICES[0].id);
  const [timer, setTimer] = useState(IDLE_GUIDED_TIMER);
  const [pauseNotice, setPauseNotice] = useState('');
  const lastTickRef = useRef<number | null>(null);
  const runningRef = useRef(false);
  runningRef.current = timer.running;
  const selected =
    YOGA_PRACTICES.find((practice) => practice.id === selectedId) ??
    YOGA_PRACTICES[0];
  const currentStep = selected.steps[timer.stepIndex] ?? selected.steps[0];
  const currentPose = getYogaPose(currentStep.poseId);
  const totalSeconds = yogaPracticeDurationSeconds(selected);
  const completedSeconds = selected.steps
    .slice(0, timer.stepIndex)
    .reduce((total, step) => total + step.seconds, 0);
  const elapsedSeconds = Math.min(totalSeconds, completedSeconds + timer.elapsed);
  const progress = totalSeconds > 0 ? (elapsedSeconds / totalSeconds) * 100 : 0;

  useEffect(() => {
    if (!timer.running || timer.complete) {
      lastTickRef.current = null;
      return;
    }

    lastTickRef.current = Date.now();
    const stepDurations = selected.steps.map(({ seconds }) => seconds);
    const interval = window.setInterval(() => {
      const now = Date.now();
      const previous = lastTickRef.current ?? now;
      const elapsedSeconds = Math.floor((now - previous) / 1_000);
      if (elapsedSeconds < 1) return;

      lastTickRef.current = previous + elapsedSeconds * 1_000;
      setTimer((current) =>
        advanceGuidedTimerBy(current, stepDurations, elapsedSeconds)
      );
    }, 250);
    return () => window.clearInterval(interval);
  }, [selected, timer.complete, timer.running]);

  useEffect(() => {
    const pauseWhenHidden = () => {
      if (document.visibilityState !== 'visible' && runningRef.current) {
        setPauseNotice('Paused while this page was in the background.');
        setTimer((current) => ({ ...current, running: false }));
      }
    };
    document.addEventListener('visibilitychange', pauseWhenHidden);
    return () => document.removeEventListener('visibilitychange', pauseWhenHidden);
  }, []);

  const choosePractice = (practiceId: string) => {
    setSelectedId(practiceId);
    setTimer(IDLE_GUIDED_TIMER);
    setPauseNotice('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <main className="px-4 py-8 md:px-8 md:py-12">
      <div className="mx-auto max-w-6xl">
        <header className="max-w-3xl">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            <Activity className="h-3.5 w-3.5" aria-hidden="true" />
            Guided movement
          </div>
          <h1 className="font-display text-4xl font-medium leading-[1.05] tracking-[-0.02em] text-foreground md:text-5xl">
            Move gently, one step at a time.
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground">
            Beginner chair and floor sequences with a clear picture for every movement.
          </p>
        </header>

        <section className="mt-8 grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="app-panel overflow-hidden">
            <div className="grid md:grid-cols-[0.92fr_1.08fr]">
              <div className="relative min-h-80 overflow-hidden bg-[#eadfcd] md:min-h-[34rem]">
                <Image
                  key={currentPose.id}
                  src={currentPose.imagePath}
                  alt={currentStep.imageAlt ?? currentPose.imageAlt}
                  fill
                  priority
                  sizes="(min-width: 1024px) 32rem, (min-width: 768px) 42vw, 100vw"
                  className={cn(
                    'absolute inset-0 h-full w-full object-cover',
                    currentStep.mirrorImage && '-scale-x-100'
                  )}
                />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-brand-ink/70 to-transparent px-5 pb-5 pt-14 text-white">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-white/70">
                    {currentPose.name}
                  </p>
                </div>
              </div>

              <div className="flex min-h-[34rem] flex-col p-6 md:p-8">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-accent">
                      {selected.setting === 'chair' ? 'Chair practice' : 'Floor practice'}
                    </p>
                    <h2 className="mt-2 font-display text-3xl font-medium text-foreground">
                      {selected.title}
                    </h2>
                  </div>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-xs font-semibold text-foreground">
                    <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
                    {minutesLabel(totalSeconds)}
                  </span>
                </div>

                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  {selected.summary}
                </p>
                <p className="mt-4 rounded-xl bg-secondary/65 px-4 py-3 text-xs leading-relaxed text-muted-foreground">
                  <span className="font-semibold text-foreground">You need:</span>{' '}
                  {selected.equipment}
                </p>
                <div className="mt-3 flex items-start gap-2 rounded-xl border border-border bg-background px-4 py-3">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    Optional wellbeing support, not treatment or individualized advice. Stop for pain, dizziness, numbness, or breathing difficulty. {selected.safetyNote}
                  </p>
                </div>

                <div className="mt-6 flex-1">
                  <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
                    {timer.complete
                      ? 'Practice complete.'
                      : timer.running
                        ? `Step ${timer.stepIndex + 1}: ${currentStep.label}. ${currentStep.instruction}`
                        : ''}
                  </p>
                  {timer.complete ? (
                    <div className="rounded-2xl bg-primary p-6 text-primary-foreground">
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary-foreground/65">
                        Complete
                      </p>
                      <h3 className="mt-3 font-display text-3xl font-medium">
                        Take your time getting up.
                      </h3>
                      <p className="mt-3 text-sm leading-relaxed text-primary-foreground/75">
                        Notice how you feel without needing the practice to produce a particular result.
                      </p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                        Step {timer.stepIndex + 1} of {selected.steps.length}
                      </p>
                      <h3 className="mt-3 font-display text-3xl font-medium text-foreground">
                        {currentStep.label}
                      </h3>
                      <p className="mt-3 text-base leading-relaxed text-foreground">
                        {currentStep.instruction}
                      </p>
                      <p className="mt-4 text-sm tabular-nums text-muted-foreground">
                        {Math.max(0, currentStep.seconds - timer.elapsed)} seconds
                      </p>
                    </div>
                  )}
                </div>

                <div className="mt-6 h-2 overflow-hidden rounded-full bg-secondary">
                  <div
                    role="progressbar"
                    aria-label="Practice progress"
                    aria-valuemin={0}
                    aria-valuemax={totalSeconds}
                    aria-valuenow={elapsedSeconds}
                    className="h-full rounded-full bg-accent transition-[width] duration-500"
                    style={{ width: `${progress}%` }}
                  />
                </div>

                <div className="mt-5 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setTimer((current) =>
                        current.complete
                          ? resetGuidedTimer(true)
                          : { ...current, running: !current.running }
                      );
                      setPauseNotice('');
                    }}
                    className="inline-flex min-h-11 items-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {timer.complete ? (
                      <RotateCcw className="h-4 w-4" aria-hidden="true" />
                    ) : timer.running ? (
                      <CirclePause className="h-4 w-4" aria-hidden="true" />
                    ) : (
                      <CirclePlay className="h-4 w-4" aria-hidden="true" />
                    )}
                    {timer.complete
                      ? 'Start again'
                      : timer.running
                        ? 'Pause'
                        : timer.elapsed > 0
                          ? 'Continue'
                          : 'Begin'}
                  </button>
                  {!timer.complete && (
                    <button
                      type="button"
                      onClick={() => {
                        setTimer(IDLE_GUIDED_TIMER);
                        setPauseNotice('');
                      }}
                      className="inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-semibold text-muted-foreground hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <RotateCcw className="h-4 w-4" aria-hidden="true" />
                      Reset
                    </button>
                  )}
                </div>
                {pauseNotice ? (
                  <p className="mt-3 text-xs text-muted-foreground" role="status">
                    {pauseNotice}
                  </p>
                ) : null}

                <div className="mt-4 flex flex-wrap gap-2" aria-label="Practice steps">
                  {selected.steps.map((step, index) => (
                    <button
                      key={`${step.label}-${index}`}
                      type="button"
                      aria-label={`Go to step ${index + 1}: ${step.label}`}
                      aria-current={timer.stepIndex === index ? 'step' : undefined}
                      onClick={() => {
                        setPauseNotice('');
                        setTimer({
                          stepIndex: index,
                          elapsed: 0,
                          running: false,
                          complete: false,
                        })
                      }}
                      className={cn(
                        'grid h-11 w-11 place-items-center rounded-full border text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                        timer.stepIndex === index
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-border bg-background text-muted-foreground hover:bg-secondary'
                      )}
                    >
                      {index + 1}
                    </button>
                  ))}
                </div>
              </div>
            </div>

          </div>

          <aside className="space-y-4">
            <div className="app-panel p-4">
              <h2 className="px-1 font-display text-2xl font-medium text-foreground">
                Choose a sequence
              </h2>
              <div className="mt-3 space-y-2">
                {YOGA_PRACTICES.map((practice) => (
                  <button
                    key={practice.id}
                    type="button"
                    onClick={() => choosePractice(practice.id)}
                    className={cn(
                      'w-full rounded-2xl border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      practice.id === selected.id
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border bg-background hover:bg-secondary'
                    )}
                  >
                    <span className="text-xs font-semibold uppercase tracking-[0.1em] opacity-70">
                      {practice.setting} | {minutesLabel(yogaPracticeDurationSeconds(practice))}
                    </span>
                    <span className="mt-1.5 block font-semibold">{practice.title}</span>
                    <span className="mt-1 block text-xs leading-relaxed opacity-75">
                      {practice.summary}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <OptionalSoundscape options={['off', 'rain', 'ocean']} />
          </aside>
        </section>

        <details className="app-panel mt-6 p-5">
          <summary className="cursor-pointer font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            Before you begin
          </summary>
          <div className="mt-3 max-w-3xl space-y-2 text-sm leading-relaxed text-muted-foreground">
            <p>
              These are gentle self-guided movements, not medical treatment or a substitute for an instructor.
            </p>
            <p>
              If you are pregnant, recovering from surgery or injury, have a health condition, or are unsure whether movement is safe for you, ask a qualified health professional first.
            </p>
          </div>
        </details>

        <Link
          href="/research#movement"
          className="mt-7 inline-flex text-sm font-medium text-foreground underline underline-offset-4"
        >
          Research and safety
        </Link>
      </div>
    </main>
  );
}
