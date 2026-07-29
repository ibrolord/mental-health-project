'use client';

import { useEffect, useRef, useState } from 'react';
import { format } from 'date-fns';
import {
  CheckCircle2,
  CirclePause,
  CirclePlay,
  Coffee,
  Flag,
  RotateCcw,
  Timer,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DismissibleNotice } from '@/components/dismissible-notice';
import {
  OptionalSoundscape,
  type SoundscapeId,
} from '@/components/optional-soundscape';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase/client';
import {
  advanceFocusClock,
  completedFocusCycles,
  createFocusClock,
  formatClock,
  type FocusClock,
} from '@/lib/wellbeing/focus';
import { cn } from '@/lib/utils';

type Goal = {
  id: string;
  content: string;
};

type SoundMode = 'none' | 'rain' | 'ocean' | 'brown_noise';

const FOCUS_OPTIONS = [15, 25, 45, 60];
const BREAK_OPTIONS = [5, 10, 15];
const CYCLE_OPTIONS = [1, 2, 3, 4];

function soundModeFor(soundscape: SoundscapeId): SoundMode {
  if (soundscape === 'brown') return 'brown_noise';
  if (soundscape === 'rain' || soundscape === 'ocean') return soundscape;
  return 'none';
}

async function showPhaseNotification(clock: FocusClock) {
  if (
    typeof window === 'undefined' ||
    !('Notification' in window) ||
    Notification.permission !== 'granted' ||
    !('serviceWorker' in navigator)
  ) {
    return;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    const body = clock.complete
      ? 'Your planned focus session is complete.'
      : clock.phase === 'break'
        ? 'Your focus block is complete. Take the break you planned.'
        : 'Your break is complete. Begin the next block when you are ready.';
    await registration.showNotification('MHtoolkit timer', {
      body,
      tag: 'mhtoolkit-focus-timer',
      data: { route: '/focus' },
    });
  } catch {
    // A visible in-page transition remains available if the browser blocks it.
  }
}

export default function FocusPage() {
  const { user, loading: authLoading } = useAuth();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [selectedGoalId, setSelectedGoalId] = useState('');
  const [taskLabel, setTaskLabel] = useState('');
  const [focusMinutes, setFocusMinutes] = useState(25);
  const [breakMinutes, setBreakMinutes] = useState(5);
  const [plannedCycles, setPlannedCycles] = useState(1);
  const [soundMode, setSoundMode] = useState<SoundMode>('none');
  const [clock, setClock] = useState(() => createFocusClock(25, 1));
  const [sessionId, setSessionId] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const clockRef = useRef(clock);
  const deadlineRef = useRef<number | null>(null);
  const startInFlightRef = useRef(false);
  const sessionIdRef = useRef('');

  useEffect(() => {
    clockRef.current = clock;
  }, [clock]);

  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);

  useEffect(() => {
    if (authLoading || !user) return;
    void supabase
      .from('goals')
      .select('id, content')
      .eq('user_id', user.id)
      .eq('date', format(new Date(), 'yyyy-MM-dd'))
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .then(({ data }) => setGoals((data ?? []) as Goal[]));
  }, [authLoading, user]);

  useEffect(() => {
    if (!clock.running || clock.complete) return;

    const tick = () => {
      const current = clockRef.current;
      if (!current.running || current.complete || deadlineRef.current === null) return;

      const remaining = Math.max(
        0,
        Math.ceil((deadlineRef.current - Date.now()) / 1_000)
      );
      if (remaining > 0) {
        if (remaining !== current.secondsRemaining) {
          const nextClock = { ...current, secondsRemaining: remaining };
          clockRef.current = nextClock;
          setClock(nextClock);
        }
        return;
      }

      deadlineRef.current = null;
      const next = advanceFocusClock(
        { ...current, secondsRemaining: 1 },
        focusMinutes,
        breakMinutes,
        plannedCycles
      );
      clockRef.current = next;
      setClock(next);

      const completedCycles = completedFocusCycles(next);
      const activeSessionId = sessionIdRef.current;
      if (activeSessionId) {
        void supabase
          .from('focus_sessions')
          .update({
            completed_cycles: completedCycles,
            status: next.complete ? 'complete' : 'paused',
            completed_at: next.complete ? new Date().toISOString() : null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', activeSessionId);
      }
      setStatus(
        next.complete
          ? 'Session complete. Decide what recovery or next step you need.'
          : next.phase === 'break'
            ? 'Focus block complete. Take the break you planned.'
            : 'Break complete. Start the next block when you are ready.'
      );
      void showPhaseNotification(next);
    };

    tick();
    const timer = window.setInterval(tick, 250);
    return () => window.clearInterval(timer);
  }, [
    breakMinutes,
    clock.complete,
    clock.running,
    focusMinutes,
    plannedCycles,
  ]);

  const updateConfiguration = (
    nextFocus: number,
    nextBreak: number,
    nextCycles: number
  ) => {
    if (sessionId) return;
    setFocusMinutes(nextFocus);
    setBreakMinutes(nextBreak);
    setPlannedCycles(nextCycles);
    const nextClock = createFocusClock(nextFocus, nextCycles);
    clockRef.current = nextClock;
    setClock(nextClock);
  };

  const chooseGoal = (goal: Goal) => {
    if (sessionId) return;
    setSelectedGoalId(goal.id);
    setTaskLabel(goal.content);
  };

  const startOrResume = async () => {
    const cleanLabel = taskLabel.trim().replace(/\s+/g, ' ').slice(0, 200);
    if (!user || !cleanLabel || startInFlightRef.current) {
      if (!cleanLabel) setError('Name the outcome for this focus block first.');
      return;
    }
    startInFlightRef.current = true;
    setError('');
    setStatus('');

    let activeSessionId = sessionId;
    if (!activeSessionId) {
      const now = new Date().toISOString();
      const { data, error: insertError } = await supabase
        .from('focus_sessions')
        .insert({
          user_id: user.id,
          goal_id: selectedGoalId || null,
          task_label: cleanLabel,
          focus_minutes: focusMinutes,
          break_minutes: breakMinutes,
          planned_cycles: plannedCycles,
          completed_cycles: completedFocusCycles(clock),
          sound_mode: soundMode,
          status: 'running',
          started_at: now,
          updated_at: now,
        })
        .select('id')
        .single();
      if (insertError || !data) {
        setError(insertError?.message ?? 'The focus session could not be started.');
        startInFlightRef.current = false;
        return;
      }
      activeSessionId = data.id;
      sessionIdRef.current = data.id;
      setSessionId(data.id);
    } else {
      const { error: updateError } = await supabase
        .from('focus_sessions')
        .update({ status: 'running', updated_at: new Date().toISOString() })
        .eq('id', activeSessionId);
      if (updateError) {
        setError(updateError.message);
        startInFlightRef.current = false;
        return;
      }
    }

    const nextClock = { ...clockRef.current, running: true };
    deadlineRef.current = Date.now() + nextClock.secondsRemaining * 1_000;
    clockRef.current = nextClock;
    setClock(nextClock);
    startInFlightRef.current = false;
  };

  const pause = async () => {
    const current = clockRef.current;
    let nextClock: FocusClock;
    if (deadlineRef.current !== null) {
      const remaining = Math.max(
        1,
        Math.ceil((deadlineRef.current - Date.now()) / 1_000)
      );
      nextClock = {
        ...current,
        secondsRemaining: remaining,
        running: false,
      };
    } else {
      nextClock = { ...current, running: false };
    }
    clockRef.current = nextClock;
    setClock(nextClock);
    deadlineRef.current = null;
    if (sessionId) {
      await supabase
        .from('focus_sessions')
        .update({
          status: 'paused',
          completed_cycles: completedFocusCycles(nextClock),
          updated_at: new Date().toISOString(),
        })
        .eq('id', sessionId);
    }
    setStatus('Paused. The timer will resume from this point.');
  };

  const reset = async () => {
    const current = clockRef.current;
    deadlineRef.current = null;
    if (sessionId && !current.complete) {
      await supabase
        .from('focus_sessions')
        .update({
          status: 'abandoned',
          completed_cycles: completedFocusCycles(current),
          updated_at: new Date().toISOString(),
        })
        .eq('id', sessionId);
    }
    sessionIdRef.current = '';
    setSessionId('');
    const nextClock = createFocusClock(focusMinutes, plannedCycles);
    clockRef.current = nextClock;
    setClock(nextClock);
    setStatus('');
    setError('');
  };

  const changeSound = (soundscape: SoundscapeId) => {
    const nextMode = soundModeFor(soundscape);
    setSoundMode(nextMode);
    if (sessionIdRef.current) {
      void supabase
        .from('focus_sessions')
        .update({ sound_mode: nextMode, updated_at: new Date().toISOString() })
        .eq('id', sessionIdRef.current);
    }
  };

  const phaseLabel = clock.complete
    ? 'Complete'
    : clock.phase === 'focus'
      ? 'Focus'
      : 'Break';
  const configurationLocked = Boolean(sessionId);

  return (
    <main className="px-4 py-8 md:px-8 md:py-12">
      <div className="mx-auto max-w-5xl">
        <header className="max-w-3xl">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            <Timer className="h-3.5 w-3.5" aria-hidden="true" />
            Lock In
          </div>
          <h1 className="font-display text-4xl font-medium leading-[1.05] tracking-[-0.02em] text-foreground md:text-5xl">
            Give one outcome a protected block.
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground">
            Choose a visible finish line, work for a bounded period, then take the
            break you planned. The timer is flexible, not a productivity grade.
          </p>
        </header>

        <section className="mt-8 grid gap-5 lg:grid-cols-[1.35fr_0.65fr]">
          <div className="app-panel overflow-hidden">
            <div className="border-b border-border bg-primary p-6 text-primary-foreground">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary-foreground/65">
                    {phaseLabel} · cycle {Math.min(clock.cycle, plannedCycles)} of{' '}
                    {plannedCycles}
                  </p>
                  <p className="mt-3 font-display text-6xl tabular-nums md:text-7xl">
                    {formatClock(clock.secondsRemaining)}
                  </p>
                </div>
                {clock.complete ? (
                  <CheckCircle2 className="h-8 w-8" aria-hidden="true" />
                ) : clock.phase === 'focus' ? (
                  <Flag className="h-8 w-8" aria-hidden="true" />
                ) : (
                  <Coffee className="h-8 w-8" aria-hidden="true" />
                )}
              </div>
              <p className="mt-5 line-clamp-2 text-sm text-primary-foreground/72">
                {taskLabel.trim() || 'Name the outcome below before you begin.'}
              </p>
            </div>

            <div className="p-5 md:p-6">
              {!configurationLocked && (
                <>
                  {goals.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                        Use a goal from today
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {goals.map((goal) => (
                          <button
                            key={goal.id}
                            type="button"
                            onClick={() => chooseGoal(goal)}
                            className={cn(
                              'max-w-full truncate rounded-full border px-3 py-2 text-sm transition-colors',
                              selectedGoalId === goal.id
                                ? 'border-primary bg-primary text-primary-foreground'
                                : 'border-border bg-background text-foreground hover:bg-secondary'
                            )}
                          >
                            {goal.content}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <label className="mt-5 block">
                    <span className="text-sm font-medium text-foreground">
                      By the bell, I will…
                    </span>
                    <Input
                      value={taskLabel}
                      onChange={(event) => {
                        setTaskLabel(event.target.value);
                        if (selectedGoalId) setSelectedGoalId('');
                      }}
                      maxLength={200}
                      placeholder="Draft the first section"
                      className="mt-2"
                    />
                  </label>

                  <div className="mt-5 grid gap-4 sm:grid-cols-3">
                    <OptionGroup
                      label="Focus"
                      options={FOCUS_OPTIONS}
                      value={focusMinutes}
                      suffix="m"
                      onChange={(value) =>
                        updateConfiguration(value, breakMinutes, plannedCycles)
                      }
                    />
                    <OptionGroup
                      label="Break"
                      options={BREAK_OPTIONS}
                      value={breakMinutes}
                      suffix="m"
                      onChange={(value) =>
                        updateConfiguration(focusMinutes, value, plannedCycles)
                      }
                    />
                    <OptionGroup
                      label="Cycles"
                      options={CYCLE_OPTIONS}
                      value={plannedCycles}
                      onChange={(value) =>
                        updateConfiguration(focusMinutes, breakMinutes, value)
                      }
                    />
                  </div>
                </>
              )}

              {(error || status) && (
                <p
                  role={error ? 'alert' : 'status'}
                  className={cn(
                    'mt-5 rounded-xl border px-4 py-3 text-sm',
                    error
                      ? 'border-destructive/25 bg-destructive/5 text-destructive'
                      : 'border-border bg-secondary text-foreground'
                  )}
                >
                  {error || status}
                </p>
              )}

              <div className="mt-6 flex flex-wrap gap-2">
                {!clock.complete &&
                  (clock.running ? (
                    <Button onClick={() => void pause()}>
                      <CirclePause className="mr-2 h-4 w-4" aria-hidden="true" />
                      Pause
                    </Button>
                  ) : (
                    <Button onClick={() => void startOrResume()}>
                      <CirclePlay className="mr-2 h-4 w-4" aria-hidden="true" />
                      {sessionId
                        ? clock.phase === 'break'
                          ? 'Start break'
                          : 'Continue'
                        : 'Begin'}
                    </Button>
                  ))}
                {(sessionId || clock.complete) && (
                  <Button variant="outline" onClick={() => void reset()}>
                    <RotateCcw className="mr-2 h-4 w-4" aria-hidden="true" />
                    New session
                  </Button>
                )}
              </div>
            </div>
          </div>

          <OptionalSoundscape
            options={['off', 'brown', 'rain', 'ocean']}
            title="Focus sound"
            description="Choose a background sound, or keep it quiet."
            onChange={changeSound}
          />
        </section>

        <DismissibleNotice
          noticeKey="focus-evidence-v1"
          className="mt-6"
          title="Why this is intentionally flexible"
        >
          Short breaks appear to support energy and fatigue more reliably than
          performance. Use the lengths that fit your attention, access needs, and
          task. See the source and evidence limits in the{' '}
          <a href="/research#focus" className="font-medium underline">
            research guide
          </a>
          .
        </DismissibleNotice>
      </div>
    </main>
  );
}

function OptionGroup({
  label,
  options,
  value,
  suffix = '',
  onChange,
}: {
  label: string;
  options: number[];
  value: number;
  suffix?: string;
  onChange: (value: number) => void;
}) {
  return (
    <fieldset>
      <legend className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
        {label}
      </legend>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => onChange(option)}
            className={cn(
              'rounded-lg border px-2.5 py-1.5 text-sm tabular-nums transition-colors',
              value === option
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-background text-foreground hover:bg-secondary'
            )}
          >
            {option}
            {suffix}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
