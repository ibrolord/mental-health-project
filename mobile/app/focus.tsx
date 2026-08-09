import { useEffect, useRef, useState } from 'react';
import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AppState, StyleSheet, Text, View } from 'react-native';
import {
  AppButton,
  AppCard,
  AppInput,
  AppScreen,
  ChoiceChip,
  PageHeader,
  Stat,
  appUiStyles,
} from '@/components/AppUI';
import {
  OptionalSoundscape,
  type SoundscapeId,
} from '@/components/OptionalSoundscape';
import { useDataContext } from '@/lib/hooks/use-data-context';
import { supabase } from '@/lib/supabase';
import {
  advanceFocusClockBy,
  completedFocusCycles,
  createFocusClock,
  formatClock,
  normalizeGoalIdParam,
  type FocusClock,
} from '@/lib/wellbeing/focus';
import { Colors } from '@/lib/constants';

type ActiveConfig = {
  focusMinutes: number;
  breakMinutes: number;
  plannedCycles: number;
};

const EMPTY_CLOCK: FocusClock = {
  phase: 'focus',
  cycle: 1,
  secondsRemaining: 0,
  running: false,
  complete: false,
};

const SOUND_SYNC_ERROR =
  'The sound changed, but the session setting could not be synced.';

function safeNumber(value: string, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed)
    ? Math.max(min, Math.min(max, Math.round(parsed)))
    : fallback;
}

export default function FocusScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    source?: string | string[];
    goalId?: string | string[];
  }>();
  const { context, authLoading } = useDataContext();
  const [task, setTask] = useState('');
  const [prefilledFromGoals, setPrefilledFromGoals] = useState(false);
  const [focusMinutes, setFocusMinutes] = useState('25');
  const [breakMinutes, setBreakMinutes] = useState('5');
  const [cycles, setCycles] = useState('1');
  const [clock, setClock] = useState<FocusClock>(EMPTY_CLOCK);
  const [config, setConfig] = useState<ActiveConfig | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');
  const [completedThisWeek, setCompletedThisWeek] = useState(0);
  const finalizeRef = useRef<string | null>(null);
  const ownerRef = useRef(context.user_id);
  const sessionIdRef = useRef<string | null>(null);
  const soundModeRef = useRef<SoundscapeId>('off');
  const soundSyncRef = useRef<Promise<void>>(Promise.resolve());
  const soundSyncGenerationRef = useRef(0);
  const lastTickAtRef = useRef<number | null>(null);
  const previousClockRef = useRef<FocusClock>(EMPTY_CLOCK);
  const appliedTaskParamRef = useRef('');
  ownerRef.current = context.user_id;

  useEffect(() => {
    const source = Array.isArray(params.source)
      ? params.source[0]
      : params.source;
    const goalId = normalizeGoalIdParam(params.goalId);
    const ownerId = context.user_id;
    const identity = source === 'goals' && ownerId ? `${ownerId}:${goalId}` : '';
    if (
      authLoading ||
      !identity ||
      appliedTaskParamRef.current === identity ||
      sessionIdRef.current
    ) {
      return;
    }

    let active = true;
    appliedTaskParamRef.current = identity;
    void supabase
      .from('goals')
      .select('id, content, status')
      .eq('id', goalId)
      .eq('user_id', ownerId)
      .maybeSingle()
      .then(({ data, error: goalError }) => {
        if (!active || ownerRef.current !== ownerId || sessionIdRef.current) {
          return;
        }
        router.setParams({ source: undefined, goalId: undefined });
        if (goalError || !data || data.status !== 'pending') {
          setError('That goal is no longer available for focus.');
          return;
        }
        const requestedTask = String(data.content)
          .trim()
          .replace(/\s+/g, ' ')
          .slice(0, 200);
        if (!requestedTask) {
          setError('That goal is no longer available for focus.');
          return;
        }
        setTask(requestedTask);
        setPrefilledFromGoals(true);
      });

    return () => {
      active = false;
    };
  }, [authLoading, context.user_id, params.goalId, params.source, router]);

  const queueSoundSync = (
    activeId: string,
    ownerId: string,
    nextSound: SoundscapeId
  ) => {
    const generation = soundSyncGenerationRef.current + 1;
    soundSyncGenerationRef.current = generation;
    soundSyncRef.current = soundSyncRef.current
      .catch(() => undefined)
      .then(async () => {
        if (
          ownerRef.current !== ownerId ||
          sessionIdRef.current !== activeId
        ) {
          return;
        }
        const { error: updateError } = await supabase
          .from('focus_sessions')
          .update({
            sound_mode: nextSound === 'off' ? 'none' : nextSound,
            updated_at: new Date().toISOString(),
          })
          .eq('id', activeId)
          .eq('user_id', ownerId);
        if (
          updateError &&
          generation === soundSyncGenerationRef.current &&
          ownerRef.current === ownerId &&
          sessionIdRef.current === activeId
        ) {
          setError(SOUND_SYNC_ERROR);
        } else if (
          !updateError &&
          generation === soundSyncGenerationRef.current &&
          ownerRef.current === ownerId &&
          sessionIdRef.current === activeId
        ) {
          setError((current) => (current === SOUND_SYNC_ERROR ? '' : current));
        }
      });
  };

  useEffect(() => {
    const ownerId = context.user_id;
    if (authLoading || !ownerId) return;
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    void supabase
      .from('focus_sessions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', ownerId)
      .eq('status', 'complete')
      .gte('completed_at', since)
      .then(({ count }) => {
        if (ownerRef.current === ownerId) setCompletedThisWeek(count ?? 0);
      });
  }, [authLoading, context.user_id]);

  useEffect(() => {
    if (!clock.running || clock.complete || !config) {
      lastTickAtRef.current = null;
      return;
    }

    if (lastTickAtRef.current === null) lastTickAtRef.current = Date.now();
    const reconcileElapsedTime = () => {
      const now = Date.now();
      const lastTickAt = lastTickAtRef.current ?? now;
      const elapsedSeconds = Math.floor((now - lastTickAt) / 1000);
      if (elapsedSeconds < 1) return;

      lastTickAtRef.current = lastTickAt + elapsedSeconds * 1000;
      setClock((current) =>
        advanceFocusClockBy(
          current,
          elapsedSeconds,
          config.focusMinutes,
          config.breakMinutes,
          config.plannedCycles
        )
      );
    };

    const interval = setInterval(reconcileElapsedTime, 250);
    const appStateSubscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') reconcileElapsedTime();
    });
    return () => {
      clearInterval(interval);
      appStateSubscription.remove();
    };
  }, [clock.complete, clock.running, config]);

  useEffect(() => {
    const previousClock = previousClockRef.current;
    previousClockRef.current = clock;
    if (
      !sessionId ||
      !context.user_id ||
      clock.complete ||
      clock.running ||
      !previousClock.running ||
      previousClock.phase === clock.phase
    ) {
      return;
    }

    const ownerId = context.user_id;
    void supabase
      .from('focus_sessions')
      .update({
        status: 'paused',
        completed_cycles: completedFocusCycles(clock),
        updated_at: new Date().toISOString(),
      })
      .eq('id', sessionId)
      .eq('user_id', ownerId)
      .then(({ error: updateError }) => {
        if (updateError && ownerRef.current === ownerId) {
          setError('The completed block could not be synced.');
        }
      });
  }, [clock, context.user_id, sessionId]);

  useEffect(() => {
    if (!clock.complete || !sessionId || finalizeRef.current === sessionId) return;
    const ownerId = context.user_id;
    if (!ownerId) return;
    finalizeRef.current = sessionId;
    void supabase
      .from('focus_sessions')
      .update({
        status: 'complete',
        completed_cycles: completedFocusCycles(clock),
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', sessionId)
      .eq('user_id', ownerId)
      .then(({ error: updateError }) => {
        if (ownerRef.current !== ownerId) return;
        if (updateError) {
          finalizeRef.current = null;
          setError('The timer finished, but the session was not saved.');
        } else {
          setCompletedThisWeek((current) => current + 1);
        }
      });
  }, [clock, context.user_id, sessionId]);

  const start = async () => {
    const ownerId = context.user_id;
    if (!ownerId || !task.trim() || starting) return;
    const nextConfig = {
      focusMinutes: safeNumber(focusMinutes, 25, 5, 120),
      breakMinutes: safeNumber(breakMinutes, 5, 1, 30),
      plannedCycles: safeNumber(cycles, 1, 1, 12),
    };

    setStarting(true);
    setError('');
    try {
      const { data, error: createError } = await supabase
        .from('focus_sessions')
        .insert({
          user_id: ownerId,
          task_label: task.trim(),
          focus_minutes: nextConfig.focusMinutes,
          break_minutes: nextConfig.breakMinutes,
          planned_cycles: nextConfig.plannedCycles,
          completed_cycles: 0,
          sound_mode:
            soundModeRef.current === 'off' ? 'none' : soundModeRef.current,
          status: 'running',
          started_at: new Date().toISOString(),
        })
        .select('id')
        .single();
      if (ownerRef.current !== ownerId) return;
      if (createError || !data) {
        setError('This focus session could not start.');
        return;
      }

      setConfig(nextConfig);
      setPrefilledFromGoals(false);
      setSessionId(data.id as string);
      sessionIdRef.current = data.id as string;
      queueSoundSync(data.id as string, ownerId, soundModeRef.current);
      finalizeRef.current = null;
      lastTickAtRef.current = Date.now();
      setClock({ ...createFocusClock(nextConfig.focusMinutes, nextConfig.plannedCycles), running: true });
    } finally {
      if (ownerRef.current === ownerId) setStarting(false);
    }
  };

  const setRunning = async (running: boolean) => {
    lastTickAtRef.current = running ? Date.now() : null;
    setClock((current) => ({ ...current, running }));
    const ownerId = context.user_id;
    if (!ownerId || !sessionId) return;
    const { error: updateError } = await supabase
      .from('focus_sessions')
      .update({
        status: running ? 'running' : 'paused',
        completed_cycles: completedFocusCycles(clock),
        updated_at: new Date().toISOString(),
      })
      .eq('id', sessionId)
      .eq('user_id', ownerId);
    if (updateError && ownerRef.current === ownerId) {
      setError('The session state could not be synced.');
    }
  };

  const stop = async () => {
    const ownerId = context.user_id;
    const activeId = sessionId;
    setClock(EMPTY_CLOCK);
    setConfig(null);
    setSessionId(null);
    sessionIdRef.current = null;
    soundSyncGenerationRef.current += 1;
    finalizeRef.current = null;
    lastTickAtRef.current = null;
    if (!ownerId || !activeId) return;
    const { error: updateError } = await supabase
      .from('focus_sessions')
      .update({
        status: 'abandoned',
        completed_cycles: completedFocusCycles(clock),
        updated_at: new Date().toISOString(),
      })
      .eq('id', activeId)
      .eq('user_id', ownerId);
    if (updateError && ownerRef.current === ownerId) {
      setError('The stopped session could not be synced.');
    }
  };

  const changeSound = (nextSound: SoundscapeId) => {
    soundModeRef.current = nextSound;
    const ownerId = context.user_id;
    const activeId = sessionIdRef.current;
    if (!ownerId || !activeId) return;
    queueSoundSync(activeId, ownerId, nextSound);
  };

  const active = Boolean(config && sessionId);

  return (
    <AppScreen>
      <PageHeader
        eyebrow="Lock-in mode"
        title="One outcome. One block."
        description="Set a bounded task, focus, then take the break you planned."
        icon="target"
      />

      <AppCard style={active ? styles.timerCard : undefined}>
        {active && config ? (
          <>
            <Text style={appUiStyles.label}>
              {clock.phase === 'focus' ? 'Focus block' : 'Break'} · cycle{' '}
              {clock.cycle} of {config.plannedCycles}
            </Text>
            <Text style={styles.activeTask}>{task}</Text>
            <Text style={styles.clock}>{formatClock(clock.secondsRemaining)}</Text>
            <View
              accessibilityRole="progressbar"
              accessibilityValue={{
                min: 0,
                max:
                  (clock.phase === 'focus'
                    ? config.focusMinutes
                    : config.breakMinutes) * 60,
                now:
                  (clock.phase === 'focus'
                    ? config.focusMinutes
                    : config.breakMinutes) *
                    60 -
                  clock.secondsRemaining,
              }}
              style={styles.progress}
            >
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${Math.max(
                      0,
                      Math.min(
                        100,
                        (1 -
                          clock.secondsRemaining /
                            ((clock.phase === 'focus'
                              ? config.focusMinutes
                              : config.breakMinutes) *
                              60)) *
                          100
                      )
                    )}%`,
                  },
                ]}
              />
            </View>
            {clock.complete ? (
              <View style={styles.complete}>
                <Feather name="check-circle" size={21} color={Colors.success} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.completeTitle}>Session complete</Text>
                  <Text style={appUiStyles.muted}>
                    {completedFocusCycles(clock)} focused{' '}
                    {completedFocusCycles(clock) === 1 ? 'cycle' : 'cycles'} saved.
                  </Text>
                </View>
              </View>
            ) : (
              <View style={styles.controls}>
                <AppButton
                  label={clock.running ? 'Pause' : 'Continue'}
                  icon={clock.running ? 'pause' : 'play'}
                  onPress={() => void setRunning(!clock.running)}
                  style={{ flex: 1 }}
                />
                <AppButton
                  label="Stop"
                  icon="square"
                  variant="danger"
                  onPress={() => void stop()}
                />
              </View>
            )}
            {clock.complete ? (
              <AppButton
                label="Plan another block"
                icon="rotate-ccw"
                onPress={() => {
                  setClock(EMPTY_CLOCK);
                  setConfig(null);
                  setSessionId(null);
                  sessionIdRef.current = null;
                  soundSyncGenerationRef.current += 1;
                  lastTickAtRef.current = null;
                }}
                style={{ marginTop: 16 }}
              />
            ) : null}
          </>
        ) : (
          <>
            <Text style={styles.formTitle}>Plan the block</Text>
            {prefilledFromGoals ? (
              <View accessibilityLiveRegion="polite" style={styles.sourceBanner}>
                <Feather name="check-circle" size={16} color={Colors.primary} />
                <Text style={styles.sourceBannerText}>Ready from today&apos;s goals</Text>
              </View>
            ) : null}
            <AppInput
              label="Outcome for this block"
              value={task}
              onChangeText={(value) => {
                setTask(value);
                if (prefilledFromGoals) setPrefilledFromGoals(false);
              }}
              maxLength={200}
              placeholder="By the bell, I will..."
            />
            <View style={styles.numberRow}>
              <AppInput
                label="Focus"
                value={focusMinutes}
                onChangeText={setFocusMinutes}
                keyboardType="number-pad"
                helper="5–120 min"
                style={{ flex: 1 }}
              />
              <AppInput
                label="Break"
                value={breakMinutes}
                onChangeText={setBreakMinutes}
                keyboardType="number-pad"
                helper="1–30 min"
                style={{ flex: 1 }}
              />
              <AppInput
                label="Cycles"
                value={cycles}
                onChangeText={setCycles}
                keyboardType="number-pad"
                helper="1–12"
                style={{ flex: 1 }}
              />
            </View>
            <Text style={styles.presetsLabel}>Quick setup</Text>
            <View style={styles.presets}>
              {[
                ['15 / 3', '15', '3'],
                ['25 / 5', '25', '5'],
                ['50 / 10', '50', '10'],
              ].map(([label, focus, rest]) => (
                <ChoiceChip
                  key={label}
                  label={label}
                  selected={focusMinutes === focus && breakMinutes === rest}
                  onPress={() => {
                    setFocusMinutes(focus);
                    setBreakMinutes(rest);
                  }}
                />
              ))}
            </View>
            {error ? (
              <Text style={[appUiStyles.error, { marginTop: 13 }]}>{error}</Text>
            ) : null}
            <AppButton
              label="Begin focus block"
              icon="play"
              loading={starting}
              disabled={!task.trim() || authLoading || !context.user_id}
              onPress={() => void start()}
              style={{ marginTop: 18 }}
            />
          </>
        )}
      </AppCard>

      <OptionalSoundscape
        title="Focus sound"
        compact
        backgroundPlayback
        onChange={changeSound}
      />

      <AppCard quiet>
        <View style={styles.stats}>
          <Stat label="Completed this week" value={completedThisWeek} suffix="sessions" />
          <Stat
            label="Current plan"
            value={active && config ? `${config.focusMinutes}/${config.breakMinutes}` : '—'}
            suffix={active ? 'min' : undefined}
          />
        </View>
      </AppCard>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  timerCard: { padding: 21 },
  formTitle: {
    color: Colors.text,
    fontSize: 22,
    lineHeight: 27,
    fontWeight: '700',
    marginBottom: 17,
  },
  sourceBanner: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 12,
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 12,
    marginBottom: 14,
  },
  sourceBannerText: { color: Colors.text, fontSize: 13, fontWeight: '600' },
  numberRow: { flexDirection: 'row', gap: 8 },
  presetsLabel: { color: Colors.text, fontSize: 13, fontWeight: '700' },
  presets: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  activeTask: {
    color: Colors.text,
    fontSize: 20,
    lineHeight: 25,
    fontWeight: '700',
    marginTop: 7,
  },
  clock: {
    color: Colors.text,
    fontSize: 60,
    lineHeight: 68,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    letterSpacing: -2,
    textAlign: 'center',
    marginTop: 24,
  },
  progress: {
    height: 9,
    borderRadius: 9,
    backgroundColor: Colors.border,
    overflow: 'hidden',
    marginTop: 17,
  },
  progressFill: { height: '100%', backgroundColor: Colors.accent },
  controls: { flexDirection: 'row', gap: 9, marginTop: 20 },
  complete: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 13,
    backgroundColor: Colors.successLight,
    padding: 13,
    marginTop: 18,
  },
  completeTitle: { color: Colors.text, fontSize: 15, fontWeight: '700' },
  stats: { flexDirection: 'row', gap: 18 },
});
