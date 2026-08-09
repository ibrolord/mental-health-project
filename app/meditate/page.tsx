'use client';

import { useEffect, useRef, useState } from 'react';
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
  type GuidedTimerState,
} from '@/lib/guided-timer';
import { useDataContext } from '@/lib/hooks/use-data-context';
import {
  PracticeProgressConflictError,
  clearPausedPracticeProgress,
  parsePracticeProgressRow,
  pausedProgressFromTimer,
  pausedTimerFromProgress,
  savePausedPracticeProgress,
  type PracticeProgressRow,
  type ProductStateRpc,
} from '@/lib/product-state';
import { supabase } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

function durationLabel(seconds: number): string {
  const minutes = Math.ceil(seconds / 60);
  return `${minutes} min`;
}

export default function MeditatePage() {
  const { context, authLoading } = useDataContext();
  const [issue, setIssue] = useState<MeditationIssue | 'all'>('all');
  const [selectedId, setSelectedId] = useState(MEDITATION_PRACTICES[0].id);
  const [timerState, setTimerState] = useState(IDLE_GUIDED_TIMER);
  const [storedProgress, setStoredProgress] =
    useState<PracticeProgressRow | null>(null);
  const [progressLoading, setProgressLoading] = useState(true);
  const [progressBusy, setProgressBusy] = useState(false);
  const [progressConflict, setProgressConflict] = useState(false);
  const [progressMessage, setProgressMessage] = useState('');
  const ownerRef = useRef(context.user_id);
  const selectedIdRef = useRef(selectedId);
  const timerRef = useRef<GuidedTimerState>(timerState);
  const progressRef = useRef<PracticeProgressRow | null>(storedProgress);
  const pendingPauseRef = useRef<Promise<void> | null>(null);
  const lifecyclePauseRef = useRef<() => void>(() => {});
  ownerRef.current = context.user_id;
  selectedIdRef.current = selectedId;
  timerRef.current = timerState;
  progressRef.current = storedProgress;
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

  const rpc: ProductStateRpc = (name, args) => supabase.rpc(name, args);

  useEffect(() => {
    if (authLoading) return;
    const ownerId = context.user_id;
    setTimerState(IDLE_GUIDED_TIMER);
    setStoredProgress(null);
    progressRef.current = null;
    setProgressBusy(false);
    setProgressConflict(false);
    setProgressMessage('');

    if (!ownerId) {
      setProgressLoading(false);
      return;
    }

    let active = true;
    setProgressLoading(true);
    void supabase
      .from('practice_progress')
      .select(
        'user_id, practice_type, practice_id, route, step_index, step_elapsed_seconds, version, created_at, updated_at'
      )
      .eq('user_id', ownerId)
      .eq('practice_type', 'meditation')
      .maybeSingle()
      .then(({ data, error }) => {
        if (!active || ownerRef.current !== ownerId) return;
        setProgressLoading(false);
        if (error) {
          setProgressMessage('Paused progress could not be loaded.');
          return;
        }
        if (!data) return;

        const parsed = parsePracticeProgressRow(data);
        if (!parsed || parsed.user_id !== ownerId) {
          setProgressMessage('Saved practice progress was invalid and was not resumed.');
          return;
        }
        progressRef.current = parsed;
        setStoredProgress(parsed);
        setSelectedId(parsed.practice_id);
        setTimerState(pausedTimerFromProgress(parsed));
        setProgressMessage('Paused progress restored. Continue when you are ready.');
      });

    return () => {
      active = false;
    };
  }, [authLoading, context.user_id]);

  useEffect(() => {
    if (!running || complete) return;
    const timer = window.setInterval(() => {
      setTimerState((current) =>
        {
          const next = advanceGuidedTimer(
          current,
          currentStep.seconds,
          selected.steps.length
          );
          timerRef.current = next;
          return next;
        }
      );
    }, 1_000);
    return () => window.clearInterval(timer);
  }, [complete, currentStep.seconds, running, selected.steps.length]);

  const clearStored = async (): Promise<boolean> => {
    await pendingPauseRef.current;
    const ownerId = context.user_id;
    const current = progressRef.current;
    if (!current) return true;
    if (!ownerId || current.user_id !== ownerId) return false;

    setProgressBusy(true);
    setProgressMessage('');
    try {
      await clearPausedPracticeProgress(rpc, ownerId, current);
      if (ownerRef.current !== ownerId) return false;
      progressRef.current = null;
      setStoredProgress(null);
      return true;
    } catch (error) {
      if (ownerRef.current !== ownerId) return false;
      if (error instanceof PracticeProgressConflictError) {
        setProgressConflict(true);
      }
      setProgressMessage(
        error instanceof PracticeProgressConflictError
          ? 'Progress changed in another session. Reload before continuing.'
          : 'Paused progress could not be cleared. Try again.'
      );
      return false;
    } finally {
      if (ownerRef.current === ownerId) setProgressBusy(false);
    }
  };

  const persistPaused = async (
    paused: GuidedTimerState,
    practiceId: string
  ) => {
    const ownerId = context.user_id;
    if (!ownerId) return;
    const draft = pausedProgressFromTimer('meditation', practiceId, paused);
    if (!draft) return;

    const operation = (async () => {
      const expectedVersion = progressRef.current?.version ?? 0;
      setProgressBusy(true);
      setProgressMessage('Saving paused progress...');
      try {
        const saved = await savePausedPracticeProgress(
          rpc,
          ownerId,
          draft,
          expectedVersion
        );
        if (ownerRef.current !== ownerId) return;
        progressRef.current = saved;
        setStoredProgress(saved);
        setProgressMessage('Paused progress saved.');
      } catch (error) {
        if (ownerRef.current !== ownerId) return;
        if (error instanceof PracticeProgressConflictError) {
          setProgressConflict(true);
        }
        setProgressMessage(
          error instanceof PracticeProgressConflictError
            ? 'Progress changed in another session. Reload before saving again.'
            : 'Paused progress could not be saved.'
        );
      } finally {
        if (ownerRef.current === ownerId) setProgressBusy(false);
      }
    })();
    pendingPauseRef.current = operation;
    try {
      await operation;
    } finally {
      if (pendingPauseRef.current === operation) pendingPauseRef.current = null;
    }
  };

  const pausePractice = () => {
    const current = timerRef.current;
    if (!current.running || current.complete) return;
    const paused = { ...current, running: false };
    timerRef.current = paused;
    setTimerState(paused);
    void persistPaused(paused, selectedIdRef.current);
  };
  lifecyclePauseRef.current = pausePractice;

  useEffect(() => {
    const pauseWhenHidden = () => {
      if (document.visibilityState === 'hidden') lifecyclePauseRef.current();
    };
    const pauseBeforePageHide = () => lifecyclePauseRef.current();
    document.addEventListener('visibilitychange', pauseWhenHidden);
    window.addEventListener('pagehide', pauseBeforePageHide);
    return () => {
      document.removeEventListener('visibilitychange', pauseWhenHidden);
      window.removeEventListener('pagehide', pauseBeforePageHide);
    };
  }, []);

  const startPractice = async () => {
    if (progressBusy || progressConflict) return;
    if (!(await clearStored())) return;
    setProgressMessage('');
    setTimerState((current) => {
      const next = current.complete
        ? resetGuidedTimer(true)
        : { ...current, running: true };
      timerRef.current = next;
      return next;
    });
  };

  const selectPractice = async (id: string) => {
    if (progressBusy || progressConflict || !(await clearStored())) return;
    setSelectedId(id);
    selectedIdRef.current = id;
    timerRef.current = IDLE_GUIDED_TIMER;
    setTimerState(IDLE_GUIDED_TIMER);
    setProgressMessage('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const restart = () => void startPractice();

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
                    disabled={progressBusy || progressConflict}
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
                    onClick={running ? pausePractice : () => void startPractice()}
                    disabled={progressBusy || progressConflict || progressLoading}
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
                  {progressMessage ? (
                    <p
                      aria-live="polite"
                      className="mt-3 text-xs text-muted-foreground"
                    >
                      {progressMessage}
                    </p>
                  ) : null}
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
                onClick={() => void selectPractice(practice.id)}
                disabled={progressBusy || progressConflict}
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
