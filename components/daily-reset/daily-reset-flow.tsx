'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, LifeBuoy, RotateCcw } from 'lucide-react';
import type { MoodEmoji } from '@/lib/supabase/types';

/**
 * A short, sign-in-free reset. The user's answers live in React state only:
 * they are never written to storage, Supabase, analytics, or an AI provider.
 */

const MOODS: { emoji: MoodEmoji; label: string }[] = [
  { emoji: '😢', label: 'Very low' },
  { emoji: '😞', label: 'Low' },
  { emoji: '😐', label: 'Okay' },
  { emoji: '🙂', label: 'Good' },
  { emoji: '😄', label: 'Great' },
];

const LOW_MOODS: MoodEmoji[] = ['😢', '😞'];

const SMALL_STEPS: { id: string; label: string; detail: string; href?: string; linkLabel?: string }[] = [
  { id: 'water', label: 'Drink a glass of water', detail: 'Fill a glass and drink it slowly.' },
  {
    id: 'breathe',
    label: 'Take 2 minutes to breathe',
    detail: 'Follow a short guided grounding practice.',
    href: '/ground',
    linkLabel: 'Open the grounding tool',
  },
  { id: 'outside', label: 'Step outside', detail: 'A few minutes of fresh air or daylight.' },
  { id: 'message', label: 'Message someone', detail: 'Send a short hello to someone you trust.' },
];

const STEP_TITLES = ['How are you feeling?', 'Write one line', 'Pick one small step'];

export function DailyResetFlow() {
  const [step, setStep] = useState(0);
  const [mood, setMood] = useState<MoodEmoji | null>(null);
  const [line, setLine] = useState('');
  const [smallStep, setSmallStep] = useState<string | null>(null);

  const chosenStep = SMALL_STEPS.find((item) => item.id === smallStep) ?? null;
  const isLowMood = mood !== null && LOW_MOODS.includes(mood);
  const done = step === 3;

  // After a step change, move focus to the new heading so keyboard and screen
  // reader users land on (and hear) the new content instead of staying on a
  // button below it, or on nothing once Finish unmounts. Nothing moves on first
  // render, so loading the page does not steal focus.
  const stepHeadingRef = useRef<HTMLHeadingElement>(null);
  const doneHeadingRef = useRef<HTMLHeadingElement>(null);
  const focusedStepRef = useRef(step);
  useEffect(() => {
    if (focusedStepRef.current === step) return;
    focusedStepRef.current = step;
    (step === 3 ? doneHeadingRef : stepHeadingRef).current?.focus();
  }, [step]);

  const restart = () => {
    setStep(0);
    setMood(null);
    setLine('');
    setSmallStep(null);
  };

  return (
    <main className="min-h-screen bg-background px-4 py-8 sm:px-6 sm:py-12">
      <div className="mx-auto max-w-2xl">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          MHtoolkit home
        </Link>

        <header className="mt-6">
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-accent">
            Daily reset
          </p>
          <h1 className="mt-3 font-display text-4xl font-medium leading-[1.05] tracking-[-0.02em] text-foreground md:text-5xl">
            Two minutes, just for you.
          </h1>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground">
            Check in, write one line, pick one small step. No sign-in needed. What you
            choose and write here isn&apos;t saved or sent anywhere.
          </p>
        </header>

        {!done ? (
          <section className="app-panel mt-8 p-5 sm:p-7" aria-labelledby="reset-step-title">
            <p className="text-xs font-medium text-muted-foreground">Step {step + 1} of 3</p>
            <h2
              id="reset-step-title"
              ref={stepHeadingRef}
              tabIndex={-1}
              className="mt-1 font-display text-2xl font-medium text-foreground focus:outline-none"
            >
              {STEP_TITLES[step]}
            </h2>

            {step === 0 ? (
              <fieldset className="mt-5">
                <legend className="sr-only">Choose how you feel right now</legend>
                <div className="grid grid-cols-5 gap-2">
                  {MOODS.map((option) => {
                    const selected = mood === option.emoji;
                    return (
                      <button
                        key={option.emoji}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => setMood(option.emoji)}
                        className={`flex min-h-[84px] flex-col items-center justify-center gap-1 rounded-2xl border px-1 py-3 text-center transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                          selected
                            ? 'border-foreground bg-secondary'
                            : 'border-border bg-card hover:bg-secondary'
                        }`}
                      >
                        <span className="text-3xl" aria-hidden="true">
                          {option.emoji}
                        </span>
                        <span className="text-xs font-medium text-foreground">{option.label}</span>
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            ) : null}

            {step === 0 && isLowMood ? (
              <p className="mt-4 rounded-xl bg-secondary p-4 text-sm leading-relaxed text-foreground">
                Thanks for being honest about how you feel. If things feel like too much
                right now, you don&apos;t have to handle it alone.{' '}
                <Link href="/resources" className="font-semibold underline underline-offset-4">
                  Find support near you
                </Link>
                .
              </p>
            ) : null}

            {step === 1 ? (
              <div className="mt-5">
                <label htmlFor="reset-line" className="text-sm text-muted-foreground">
                  What&apos;s on your mind? One line is plenty. You can skip this.
                </label>
                <textarea
                  id="reset-line"
                  value={line}
                  onChange={(event) => setLine(event.target.value)}
                  rows={3}
                  maxLength={280}
                  placeholder="Today I feel..."
                  className="mt-2 w-full resize-none rounded-xl border border-input bg-card p-3 text-base text-foreground placeholder:text-muted-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
                />
              </div>
            ) : null}

            {step === 2 ? (
              <fieldset className="mt-5">
                <legend className="sr-only">Choose one small step</legend>
                <div className="grid gap-2 sm:grid-cols-2">
                  {SMALL_STEPS.map((option) => {
                    const selected = smallStep === option.id;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => setSmallStep(option.id)}
                        className={`rounded-2xl border p-4 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                          selected
                            ? 'border-foreground bg-secondary'
                            : 'border-border bg-card hover:bg-secondary'
                        }`}
                      >
                        <span className="block font-semibold text-foreground">{option.label}</span>
                        <span className="mt-1 block text-sm text-muted-foreground">
                          {option.detail}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            ) : null}

            <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
              {step > 0 ? (
                <button
                  type="button"
                  onClick={() => setStep(step - 1)}
                  className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
                >
                  <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                  Back
                </button>
              ) : (
                <span />
              )}
              <button
                type="button"
                onClick={() => setStep(step + 1)}
                disabled={(step === 0 && !mood) || (step === 2 && !smallStep)}
                className="inline-flex min-h-[48px] items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
              >
                {step === 1 && !line.trim() ? 'Skip' : step === 2 ? 'Finish' : 'Next'}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </section>
        ) : (
          <section className="app-panel mt-8 p-5 sm:p-7" aria-labelledby="reset-done-title">
            <Check className="h-6 w-6 text-accent" aria-hidden="true" />
            <h2
              id="reset-done-title"
              ref={doneHeadingRef}
              tabIndex={-1}
              className="mt-3 font-display text-2xl font-medium text-foreground focus:outline-none"
            >
              That&apos;s your reset for today.
            </h2>
            <dl className="mt-4 space-y-3 text-sm">
              {mood ? (
                <div>
                  <dt className="text-muted-foreground">You&apos;re feeling</dt>
                  <dd className="font-medium text-foreground">
                    {mood} {MOODS.find((option) => option.emoji === mood)?.label}
                  </dd>
                </div>
              ) : null}
              {line.trim() ? (
                <div>
                  <dt className="text-muted-foreground">Your line</dt>
                  <dd className="whitespace-pre-wrap font-medium text-foreground">{line.trim()}</dd>
                </div>
              ) : null}
              {chosenStep ? (
                <div>
                  <dt className="text-muted-foreground">Your small step</dt>
                  <dd className="font-medium text-foreground">{chosenStep.label}</dd>
                </div>
              ) : null}
            </dl>
            {chosenStep?.href ? (
              <Link
                href={chosenStep.href}
                className="mt-5 inline-flex min-h-[48px] items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground"
              >
                {chosenStep.linkLabel}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            ) : (
              <p className="mt-5 text-sm leading-relaxed text-muted-foreground">
                Do it when you&apos;re ready. Small is enough.
              </p>
            )}
            <div className="mt-6 border-t border-border pt-5">
              <p className="text-sm leading-relaxed text-muted-foreground">
                Your answers here aren&apos;t kept. Want to keep track over time? Save
                check-ins in the full app.
              </p>
              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm font-semibold text-foreground">
                <Link href="/tracker" className="underline underline-offset-4">
                  Save a mood check-in
                </Link>
                <Link href="/dashboard" className="underline underline-offset-4">
                  Open the full app
                </Link>
                <button
                  type="button"
                  onClick={restart}
                  className="inline-flex items-center gap-1.5 underline underline-offset-4"
                >
                  <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                  Start again
                </button>
              </div>
            </div>
          </section>
        )}

        <p className="mt-8 flex items-start gap-2 text-sm leading-relaxed text-muted-foreground">
          <LifeBuoy className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            MHtoolkit is a self-help tool, not a crisis service, and it doesn&apos;t
            diagnose or replace care. If you need urgent help,{' '}
            <Link href="/resources" className="font-semibold text-foreground underline underline-offset-4">
              find support near you
            </Link>
            .
          </span>
        </p>
      </div>
    </main>
  );
}
