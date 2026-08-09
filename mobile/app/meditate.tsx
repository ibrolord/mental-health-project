import { useEffect, useMemo, useRef, useState } from 'react';
import { Feather } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  AppButton,
  AppCard,
  AppScreen,
  ChoiceChip,
  PageHeader,
  SectionHeader,
  appUiStyles,
} from '@/components/AppUI';
import { GuidedPractice } from '@/components/GuidedPractice';
import { OptionalSoundscape } from '@/components/OptionalSoundscape';
import {
  MEDITATION_ISSUES,
  MEDITATION_PRACTICES,
  type MeditationIssue,
  type MeditationPractice,
} from '@/lib/meditation';
import { Colors } from '@/lib/constants';
import { IDLE_GUIDED_TIMER, type GuidedTimerState } from '@/lib/guided-timer';
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
import { supabase } from '@/lib/supabase';

export default function MeditateScreen() {
  const { context, authLoading } = useDataContext();
  const [issue, setIssue] = useState<MeditationIssue | 'all'>('all');
  const [selected, setSelected] = useState<MeditationPractice | null>(null);
  const [selectedOwnerId, setSelectedOwnerId] = useState<string | null>(null);
  const [initialTimer, setInitialTimer] =
    useState<GuidedTimerState>(IDLE_GUIDED_TIMER);
  const [storedProgress, setStoredProgress] =
    useState<PracticeProgressRow | null>(null);
  const [progressLoading, setProgressLoading] = useState(true);
  const [progressBusy, setProgressBusy] = useState(false);
  const [progressConflict, setProgressConflict] = useState(false);
  const [progressMessage, setProgressMessage] = useState('');
  const [progressOwnerId, setProgressOwnerId] = useState<string | null>(null);
  const ownerRef = useRef(context.user_id);
  const progressRef = useRef<PracticeProgressRow | null>(storedProgress);
  const pendingPauseRef = useRef<Promise<void> | null>(null);
  ownerRef.current = context.user_id;
  progressRef.current = storedProgress;
  const practices = useMemo(
    () =>
      issue === 'all'
        ? MEDITATION_PRACTICES
        : MEDITATION_PRACTICES.filter((practice) =>
            practice.issues.includes(issue)
          ),
    [issue]
  );
  const rpc: ProductStateRpc = (name, args) => supabase.rpc(name, args);
  const ownerReady = Boolean(
    context.user_id && progressOwnerId === context.user_id && !authLoading
  );
  const selectedPractice =
    ownerReady && selectedOwnerId === context.user_id ? selected : null;

  useEffect(() => {
    if (authLoading) return;
    const ownerId = context.user_id;
    setStoredProgress(null);
    progressRef.current = null;
    setProgressBusy(false);
    setProgressConflict(false);
    setInitialTimer(IDLE_GUIDED_TIMER);
    setSelected(null);
    setSelectedOwnerId(null);
    setProgressOwnerId(null);
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
        setProgressOwnerId(ownerId);
        if (error) {
          setProgressMessage('Paused progress could not be loaded.');
          return;
        }
        if (!data) return;

        const parsed = parsePracticeProgressRow(data);
        const practice = parsed
          ? MEDITATION_PRACTICES.find(({ id }) => id === parsed.practice_id)
          : null;
        if (!parsed || parsed.user_id !== ownerId || !practice) {
          setProgressMessage('Saved practice progress was invalid and was not resumed.');
          return;
        }
        progressRef.current = parsed;
        setStoredProgress(parsed);
        setInitialTimer(pausedTimerFromProgress(parsed));
        setSelected(practice);
        setSelectedOwnerId(ownerId);
        setProgressMessage('Paused progress restored. Continue when you are ready.');
      });

    return () => {
      active = false;
    };
  }, [authLoading, context.user_id]);

  const clearStored = async (expectedOwnerId: string): Promise<boolean> => {
    await pendingPauseRef.current;
    if (ownerRef.current !== expectedOwnerId) return false;
    const current = progressRef.current;
    if (!current) return true;
    if (current.user_id !== expectedOwnerId) return false;

    setProgressBusy(true);
    setProgressMessage('');
    try {
      await clearPausedPracticeProgress(rpc, expectedOwnerId, current);
      if (ownerRef.current !== expectedOwnerId) return false;
      progressRef.current = null;
      setStoredProgress(null);
      return true;
    } catch (error) {
      if (ownerRef.current !== expectedOwnerId) return false;
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
      if (ownerRef.current === expectedOwnerId) setProgressBusy(false);
    }
  };

  const persistPaused = async (
    timer: GuidedTimerState,
    practiceId: string,
    expectedOwnerId: string
  ): Promise<void> => {
    if (ownerRef.current !== expectedOwnerId) return;
    const draft = pausedProgressFromTimer('meditation', practiceId, timer);
    if (!draft) {
      await clearStored(expectedOwnerId);
      return;
    }

    const previous = pendingPauseRef.current;
    const operation = (previous
      ? previous.catch(() => undefined)
      : Promise.resolve()
    ).then(async () => {
      if (ownerRef.current !== expectedOwnerId) return;
      const current = progressRef.current;
      if (current && current.user_id !== expectedOwnerId) return;
      const expectedVersion = current?.version ?? 0;
      setProgressBusy(true);
      setProgressMessage('Saving paused progress...');
      try {
        const saved = await savePausedPracticeProgress(
          rpc,
          expectedOwnerId,
          draft,
          expectedVersion
        );
        if (ownerRef.current !== expectedOwnerId) return;
        progressRef.current = saved;
        setStoredProgress(saved);
        setProgressMessage('Paused progress saved.');
      } catch (error) {
        if (ownerRef.current !== expectedOwnerId) return;
        if (error instanceof PracticeProgressConflictError) {
          setProgressConflict(true);
        }
        setProgressMessage(
          error instanceof PracticeProgressConflictError
            ? 'Progress changed in another session. Reload before saving again.'
            : 'Paused progress could not be saved.'
        );
      } finally {
        if (ownerRef.current === expectedOwnerId) setProgressBusy(false);
      }
    });
    pendingPauseRef.current = operation;
    try {
      await operation;
    } finally {
      if (pendingPauseRef.current === operation) pendingPauseRef.current = null;
    }
  };

  const choosePractice = (practice: MeditationPractice) => {
    const ownerId = context.user_id;
    if (!ownerId || progressOwnerId !== ownerId) return;
    const current = progressRef.current;
    setInitialTimer(
      current?.practice_id === practice.id
        ? pausedTimerFromProgress(current)
        : IDLE_GUIDED_TIMER
    );
    setSelected(practice);
    setSelectedOwnerId(ownerId);
  };

  return (
    <AppScreen>
      <PageHeader
        eyebrow="Meditation"
        title="A practice for this moment."
        description="Choose a short guided exercise. Eyes-open and movement options are included."
        icon="sunrise"
      />

      {selectedPractice && selectedOwnerId ? (
        <>
          <AppButton
            label="Choose another practice"
            icon="arrow-left"
            variant="quiet"
            disabled={progressBusy || progressConflict}
            onPress={() => {
              setSelected(null);
              setSelectedOwnerId(null);
            }}
            style={styles.backButton}
          />
          <AppCard quiet>
            <Text style={appUiStyles.label}>Guided practice</Text>
            <Text style={styles.selectedTitle}>{selectedPractice.title}</Text>
            <Text style={[appUiStyles.muted, { marginTop: 8 }]}>
              {selectedPractice.summary}
            </Text>
            {selectedPractice.safetyNote ? (
              <View style={styles.safety}>
                <Feather name="info" size={16} color={Colors.accent} />
                <Text style={styles.safetyText}>{selectedPractice.safetyNote}</Text>
              </View>
            ) : null}
          </AppCard>
          <GuidedPractice
            key={`${selectedOwnerId}:${selectedPractice.id}`}
            steps={selectedPractice.steps}
            startLabel="Begin practice"
            initialTimer={initialTimer}
            persistenceBusy={progressBusy || progressConflict || progressLoading}
            persistenceMessage={progressMessage}
            onBeforeStart={() => clearStored(selectedOwnerId)}
            onBeforeReset={() => clearStored(selectedOwnerId)}
            onPause={(timer) =>
              persistPaused(timer, selectedPractice.id, selectedOwnerId)
            }
          />
          <OptionalSoundscape title="Background sound" compact />
        </>
      ) : (
        <>
          <SectionHeader
            title="What would help?"
            description="Filter by the kind of support you want."
          />
          <View style={styles.chips}>
            <ChoiceChip
              label="All"
              selected={issue === 'all'}
              onPress={() => setIssue('all')}
            />
            {MEDITATION_ISSUES.map((item) => (
              <ChoiceChip
                key={item.id}
                label={item.label}
                selected={issue === item.id}
                onPress={() => setIssue(item.id)}
              />
            ))}
          </View>

          <View style={styles.list}>
            {practices.map((practice) => {
              const seconds = practice.steps.reduce(
                (total, step) => total + step.seconds,
                0
              );
              return (
                <Pressable
                  key={practice.id}
                  accessibilityRole="button"
                  accessibilityState={{
                    disabled:
                      !ownerReady ||
                      progressBusy ||
                      progressConflict ||
                      progressLoading,
                  }}
                  onPress={() => {
                    if (
                      ownerReady &&
                      !progressBusy &&
                      !progressConflict &&
                      !progressLoading
                    ) {
                      choosePractice(practice);
                    }
                  }}
                  style={({ pressed }) => [
                    styles.practiceCard,
                    pressed && styles.pressed,
                  ]}
                >
                  <View style={styles.practiceIcon}>
                    <Feather
                      name={
                        practice.issues.includes('sleep')
                          ? 'moon'
                          : practice.issues.includes('restlessness')
                            ? 'navigation'
                            : practice.issues.includes('focus')
                              ? 'target'
                              : 'wind'
                      }
                      size={19}
                      color={Colors.primary}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.practiceTitle}>{practice.title}</Text>
                    <Text style={styles.practiceSummary}>{practice.summary}</Text>
                    <Text style={styles.duration}>
                      {Math.max(1, Math.round(seconds / 60))} min
                    </Text>
                  </View>
                  <Feather
                    name="chevron-right"
                    size={20}
                    color={Colors.textSecondary}
                  />
                </Pressable>
              );
            })}
          </View>

          <AppCard quiet style={{ marginTop: 10 }}>
            <View style={styles.noteHeader}>
              <Feather name="shield" size={17} color={Colors.primary} />
              <Text style={styles.noteTitle}>Use what feels steady</Text>
            </View>
            <Text style={appUiStyles.muted}>
              Stop or switch exercises if a practice increases distress. Meditation
              is a skill option, not a treatment requirement.
            </Text>
          </AppCard>
        </>
      )}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  backButton: { alignSelf: 'flex-start', marginBottom: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  list: { marginTop: 18 },
  practiceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 16,
    padding: 15,
    marginBottom: 10,
  },
  pressed: { opacity: 0.76 },
  practiceIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  practiceTitle: { color: Colors.text, fontSize: 15, fontWeight: '700' },
  practiceSummary: {
    color: Colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
  },
  duration: {
    color: Colors.accent,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 6,
  },
  selectedTitle: {
    color: Colors.text,
    fontSize: 24,
    lineHeight: 29,
    fontWeight: '700',
    marginTop: 7,
  },
  safety: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    marginTop: 14,
    paddingTop: 13,
  },
  safetyText: {
    flex: 1,
    color: Colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
  },
  noteHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 7,
  },
  noteTitle: { color: Colors.text, fontSize: 15, fontWeight: '700' },
});
