import { useEffect, useState } from 'react';
import { Feather } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import {
  AppButton,
  AppCard,
  ChoiceChip,
  appUiStyles,
} from '@/components/AppUI';
import { Colors } from '@/lib/constants';
import {
  advanceGuidedTimer,
  IDLE_GUIDED_TIMER,
  resetGuidedTimer,
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

export function GuidedPractice({
  steps,
  startLabel = 'Begin',
  onComplete,
}: {
  steps: readonly GuidedStep[];
  startLabel?: string;
  onComplete?: () => void;
}) {
  const [timer, setTimer] = useState(IDLE_GUIDED_TIMER);
  const activeStep = steps[timer.stepIndex] ?? steps[0];

  useEffect(() => {
    setTimer(IDLE_GUIDED_TIMER);
  }, [steps]);

  useEffect(() => {
    if (!timer.running || timer.complete || !activeStep) return;
    const interval = setInterval(() => {
      setTimer((current) =>
        advanceGuidedTimer(current, activeStep.seconds, steps.length)
      );
    }, 1000);
    return () => clearInterval(interval);
  }, [activeStep, steps.length, timer.complete, timer.running]);

  useEffect(() => {
    if (timer.complete) onComplete?.();
  }, [onComplete, timer.complete]);

  if (!activeStep) return null;

  const remaining = Math.max(0, activeStep.seconds - timer.elapsed);
  const progress =
    activeStep.seconds > 0
      ? Math.min(100, (timer.elapsed / activeStep.seconds) * 100)
      : 0;

  return (
    <AppCard style={styles.practice}>
      <View style={styles.stepMeta}>
        <Text style={appUiStyles.label}>
          Step {Math.min(timer.stepIndex + 1, steps.length)} of {steps.length}
        </Text>
        <Text style={styles.time}>{formatTime(remaining)}</Text>
      </View>
      <Text style={styles.stepTitle}>{activeStep.label}</Text>
      <Text style={styles.instruction}>{activeStep.instruction}</Text>
      <View
        accessibilityRole="progressbar"
        accessibilityValue={{
          min: 0,
          max: activeStep.seconds,
          now: timer.elapsed,
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
            onPress={() =>
              setTimer((current) =>
                current.complete
                  ? resetGuidedTimer(true)
                  : { ...current, running: true }
              )
            }
            style={{ flex: 1 }}
          />
        ) : (
          <AppButton
            label="Pause"
            icon="pause"
            variant="secondary"
            onPress={() =>
              setTimer((current) => ({ ...current, running: false }))
            }
            style={{ flex: 1 }}
          />
        )}
        {!timer.complete ? (
          <AppButton
            label="Reset"
            icon="rotate-ccw"
            variant="quiet"
            onPress={() => setTimer(IDLE_GUIDED_TIMER)}
          />
        ) : null}
      </View>

      {!timer.complete && steps.length > 1 ? (
        <View style={styles.stepChips}>
          {steps.map((step, index) => (
            <ChoiceChip
              key={`${step.label}-${index}`}
              label={`${index + 1}`}
              selected={timer.stepIndex === index}
              onPress={() =>
                setTimer({
                  stepIndex: index,
                  elapsed: 0,
                  running: false,
                  complete: false,
                })
              }
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
  stepChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
    marginTop: 14,
  },
});
