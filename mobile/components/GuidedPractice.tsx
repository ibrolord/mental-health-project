import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Feather } from '@expo/vector-icons';
import { AccessibilityInfo, AppState, StyleSheet, Text, View } from 'react-native';
import {
  AppButton,
  AppCard,
  ChoiceChip,
  appUiStyles,
} from '@/components/AppUI';
import { Colors } from '@/lib/constants';
import {
  advanceGuidedTimerBy,
  IDLE_GUIDED_TIMER,
  resetGuidedTimer,
  type GuidedTimerState,
} from '@/lib/guided-timer';

export type GuidedStep = {
  label: string;
  instruction: string;
  seconds: number;
};

function formatTime(seconds: number) {
  const safe = Math.max(0, Math.round(seconds));
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, '0')}`;
}

export function GuidedPractice<TStep extends GuidedStep>({
  steps,
  startLabel = 'Begin',
  initialTimer = IDLE_GUIDED_TIMER,
  persistenceBusy = false,
  persistenceMessage = '',
  onBeforeStart,
  onPause,
  onBeforeReset,
  onComplete,
  renderStepVisual,
}: {
  steps: readonly TStep[];
  startLabel?: string;
  initialTimer?: GuidedTimerState;
  persistenceBusy?: boolean;
  persistenceMessage?: string;
  onBeforeStart?: (timer: GuidedTimerState) => Promise<boolean>;
  onPause?: (timer: GuidedTimerState) => void | Promise<void>;
  onBeforeReset?: (timer: GuidedTimerState) => Promise<boolean>;
  onComplete?: () => void;
  renderStepVisual?: (step: TStep, index: number) => ReactNode;
}) {
  const [timer, setTimer] = useState<GuidedTimerState>({
    ...initialTimer,
    running: false,
  });
  const [controlBusy, setControlBusy] = useState(false);
  const [pauseNotice, setPauseNotice] = useState('');
  const lastTickRef = useRef<number | null>(null);
  const announcedStepRef = useRef<number | null>(null);
  const timerRef = useRef(timer);
  const onPauseRef = useRef(onPause);
  timerRef.current = timer;
  onPauseRef.current = onPause;
  const activeStep = steps[timer.stepIndex] ?? steps[0];

  useEffect(() => {
    const restored = { ...initialTimer, running: false };
    timerRef.current = restored;
    setTimer(restored);
    setPauseNotice('');
    announcedStepRef.current = null;
  }, [initialTimer, steps]);

  useEffect(() => {
    if (!timer.running || timer.complete || steps.length === 0) {
      lastTickRef.current = null;
      return;
    }

    lastTickRef.current = Date.now();
    const stepDurations = steps.map(({ seconds }) => seconds);
    const interval = setInterval(() => {
      const now = Date.now();
      const previous = lastTickRef.current ?? now;
      const elapsedSeconds = Math.floor((now - previous) / 1000);
      if (elapsedSeconds < 1) return;

      lastTickRef.current = previous + elapsedSeconds * 1000;
      setTimer((current) => {
        const next = advanceGuidedTimerBy(
          current,
          stepDurations,
          elapsedSeconds
        );
        timerRef.current = next;
        return next;
      });
    }, 250);
    return () => clearInterval(interval);
  }, [steps, timer.complete, timer.running]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      const current = timerRef.current;
      if (state !== 'active' && current.running) {
        const paused = { ...current, running: false };
        timerRef.current = paused;
        setPauseNotice('Paused while the app was in the background.');
        AccessibilityInfo.announceForAccessibility(
          'Practice paused while the app was in the background.'
        );
        setTimer(paused);
        void onPauseRef.current?.(paused);
      }
    });
    return () => {
      subscription.remove();
      const current = timerRef.current;
      if (current.running && !current.complete) {
        const paused = { ...current, running: false };
        timerRef.current = paused;
        void onPauseRef.current?.(paused);
      }
    };
  }, []);

  useEffect(() => {
    if (
      !timer.running ||
      announcedStepRef.current === timer.stepIndex ||
      !activeStep
    ) return;
    announcedStepRef.current = timer.stepIndex;
    AccessibilityInfo.announceForAccessibility(
      `Step ${timer.stepIndex + 1}: ${activeStep.label}. ${activeStep.instruction}`
    );
  }, [activeStep, timer.running, timer.stepIndex]);

  useEffect(() => {
    if (timer.complete) {
      AccessibilityInfo.announceForAccessibility('Practice complete.');
      onComplete?.();
    }
  }, [onComplete, timer.complete]);

  if (!activeStep) return null;

  const start = async () => {
    if (controlBusy || persistenceBusy) return;
    setControlBusy(true);
    try {
      if (onBeforeStart && !(await onBeforeStart(timerRef.current))) return;
      setPauseNotice('');
      const current = timerRef.current;
      if (current.complete) announcedStepRef.current = null;
      const next = current.complete
        ? resetGuidedTimer(true)
        : { ...current, running: true };
      timerRef.current = next;
      setTimer(next);
    } finally {
      setControlBusy(false);
    }
  };

  const pause = () => {
    const current = timerRef.current;
    if (!current.running || current.complete) return;
    const paused = { ...current, running: false };
    timerRef.current = paused;
    setTimer(paused);
    void onPause?.(paused);
  };

  const reset = async () => {
    if (controlBusy || persistenceBusy) return;
    setControlBusy(true);
    try {
      if (onBeforeReset && !(await onBeforeReset(timerRef.current))) return;
      setPauseNotice('');
      announcedStepRef.current = null;
      timerRef.current = IDLE_GUIDED_TIMER;
      setTimer(IDLE_GUIDED_TIMER);
    } finally {
      setControlBusy(false);
    }
  };

  const remaining = Math.max(0, activeStep.seconds - timer.elapsed);
  const totalSeconds = steps.reduce((total, step) => total + step.seconds, 0);
  const completedSeconds = steps
    .slice(0, timer.stepIndex)
    .reduce((total, step) => total + step.seconds, 0);
  const elapsedSeconds = Math.min(
    totalSeconds,
    completedSeconds + timer.elapsed
  );
  const progress =
    totalSeconds > 0 ? Math.min(100, (elapsedSeconds / totalSeconds) * 100) : 0;

  return (
    <AppCard style={styles.practice}>
      <View style={styles.stepMeta}>
        <Text style={appUiStyles.label}>
          Step {Math.min(timer.stepIndex + 1, steps.length)} of {steps.length}
        </Text>
        <Text style={styles.time}>{formatTime(remaining)}</Text>
      </View>
      {renderStepVisual ? renderStepVisual(activeStep, timer.stepIndex) : null}
      <Text style={styles.stepTitle}>{activeStep.label}</Text>
      <Text style={styles.instruction}>{activeStep.instruction}</Text>
      <View
        accessibilityRole="progressbar"
        accessibilityLabel="Practice progress"
        accessibilityValue={{
          min: 0,
          max: totalSeconds,
          now: elapsedSeconds,
        }}
        style={styles.progressTrack}
      >
        <View style={[styles.progressFill, { width: `${progress}%` }]} />
      </View>

      {timer.complete ? (
        <View style={styles.complete}>
          <View style={styles.completeIcon}>
            <Feather name="check" size={20} color="#fffef8" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.completeTitle}>Practice complete</Text>
            <Text style={appUiStyles.muted}>
              Notice what changed, even if the shift was small.
            </Text>
          </View>
        </View>
      ) : null}

      <View style={styles.controls}>
        {!timer.running ? (
          <AppButton
            label={
              timer.complete
                ? 'Start again'
                : timer.elapsed > 0
                  ? 'Continue'
                  : startLabel
            }
            icon={timer.complete ? 'rotate-ccw' : 'play'}
            disabled={controlBusy || persistenceBusy}
            onPress={() => void start()}
            style={{ flex: 1 }}
          />
        ) : (
          <AppButton
            label="Pause"
            icon="pause"
            variant="secondary"
            disabled={controlBusy || persistenceBusy}
            onPress={pause}
            style={{ flex: 1 }}
          />
        )}
        {!timer.complete ? (
          <AppButton
            label="Reset"
            icon="rotate-ccw"
            variant="quiet"
            disabled={controlBusy || persistenceBusy}
            onPress={() => void reset()}
          />
        ) : null}
      </View>

      {pauseNotice ? (
        <Text accessibilityLiveRegion="polite" style={styles.pauseNotice}>
          {pauseNotice}
        </Text>
      ) : null}

      {persistenceMessage ? (
        <Text accessibilityLiveRegion="polite" style={styles.pauseNotice}>
          {persistenceMessage}
        </Text>
      ) : null}

      {!timer.complete && steps.length > 1 ? (
        <View style={styles.stepChips}>
          {steps.map((step, index) => (
            <ChoiceChip
              key={`${step.label}-${index}`}
              label={`${index + 1}`}
              accessibilityLabel={`Go to step ${index + 1}: ${step.label}`}
              selected={timer.stepIndex === index}
              onPress={() => {
                if (controlBusy || persistenceBusy) return;
                const paused = {
                  stepIndex: index,
                  elapsed: 0,
                  running: false,
                  complete: false,
                };
                setPauseNotice('');
                announcedStepRef.current = null;
                timerRef.current = paused;
                setTimer(paused);
                void onPause?.(paused);
              }}
            />
          ))}
        </View>
      ) : null}
    </AppCard>
  );
}

const styles = StyleSheet.create({
  practice: { padding: 20 },
  stepMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  time: {
    color: Colors.accent,
    fontSize: 13,
    fontVariant: ['tabular-nums'],
    fontWeight: '700',
  },
  stepTitle: {
    color: Colors.text,
    fontSize: 25,
    lineHeight: 30,
    fontWeight: '700',
    marginTop: 12,
  },
  instruction: {
    color: Colors.textSecondary,
    fontSize: 16,
    lineHeight: 25,
    marginTop: 10,
  },
  progressTrack: {
    height: 8,
    borderRadius: 8,
    backgroundColor: Colors.border,
    overflow: 'hidden',
    marginTop: 22,
  },
  progressFill: {
    height: '100%',
    borderRadius: 8,
    backgroundColor: Colors.accent,
  },
  complete: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 18,
    padding: 13,
    borderRadius: 13,
    backgroundColor: Colors.successLight,
  },
  completeIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.success,
  },
  completeTitle: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 2,
  },
  controls: { flexDirection: 'row', gap: 9, marginTop: 20 },
  pauseNotice: {
    color: Colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 10,
  },
  stepChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
    marginTop: 14,
  },
});
