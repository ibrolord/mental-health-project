import { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Platform,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { format, subDays } from 'date-fns';
import { useRouter } from 'expo-router';
import { AppButton, AppCard, AppScreen, InlineStatus, PageHeader, SupportAction } from '@/components/AppUI';
import { LeafMark } from '@/components/LeafMark';
import { getMoodLabel } from '@/components/MoodPicker';
import { useAuth } from '@/lib/auth-context';
import { appleHealthPreference } from '@/lib/apple-health-preference';
import { loadAppleHealthSnapshot } from '@/lib/apple-health';
import {
  createAdvisorHealthFeatures,
  createAdvisorContextSnapshot,
  createAdvisorRecommendation,
  type AdvisorContext,
  type AdvisorGoal,
  type AdvisorHabit,
  type AdvisorRecommendation,
  type AdvisorSourceKey,
} from '@/lib/advisor-core';
import { Colors, Radius, Spacing, Typography } from '@/lib/constants';
import {
  cancelAdvisorReminder,
  hasAdvisorReminder,
  scheduleAdvisorReminder,
} from '@/lib/notifications';
import { supabase } from '@/lib/supabase';
import type { MoodEmoji } from '@/lib/types';

type Phase = 'choose' | 'preview' | 'result';
type Sources = Record<AdvisorSourceKey, boolean>;
type MissingSource = { key: AdvisorSourceKey; message: string };

const INITIAL_SOURCES: Sources = {
  mood: false,
  health: false,
  goals: false,
  habits: false,
};

const SOURCE_COPY: Record<AdvisorSourceKey, { label: string; description: string }> = {
  mood: { label: 'Mood check-ins', description: 'Recent emoji and dates. Notes stay private.' },
  health: { label: 'Apple Health summary', description: 'On-device sleep and movement averages.' },
  goals: { label: 'Goals', description: 'Active goal titles and due dates.' },
  habits: { label: 'Habits', description: 'Active habits and today’s completion.' },
};

function formatAdvisorDueDate(value: string): string {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? format(date, 'MMM d, yyyy') : 'Invalid date';
}

export default function AdvisorScreen() {
  const router = useRouter();
  const { user, sessionId, isAuthenticated, isAnonymous } = useAuth();
  const queryColumn = isAuthenticated ? 'user_id' : 'session_id';
  const queryValue = isAuthenticated ? user?.id : sessionId;
  const ownerKey = queryValue ? `${queryColumn}:${queryValue}` : null;
  const canUseTogether = isAuthenticated && !isAnonymous;
  const ownerRef = useRef(ownerKey);
  ownerRef.current = ownerKey;
  const requestRef = useRef(0);
  const reminderRequestRef = useRef(0);
  const mountedRef = useRef(true);

  const [phase, setPhase] = useState<Phase>('choose');
  const [sources, setSources] = useState<Sources>(INITIAL_SOURCES);
  const [previewSources, setPreviewSources] = useState<Sources>(INITIAL_SOURCES);
  const [context, setContext] = useState<AdvisorContext | null>(null);
  const [missing, setMissing] = useState<MissingSource[]>([]);
  const [recommendation, setRecommendation] = useState<AdvisorRecommendation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [showWhy, setShowWhy] = useState(false);
  const [useSmallerStep, setUseSmallerStep] = useState(false);
  const [advisorReminderSet, setAdvisorReminderSet] = useState(false);
  const [reminderBusy, setReminderBusy] = useState(false);

  useEffect(() => () => {
    mountedRef.current = false;
    requestRef.current += 1;
    reminderRequestRef.current += 1;
  }, []);

  useEffect(() => {
    requestRef.current += 1;
    reminderRequestRef.current += 1;
    setPhase('choose');
    setSources(INITIAL_SOURCES);
    setPreviewSources(INITIAL_SOURCES);
    setContext(null);
    setMissing([]);
    setRecommendation(null);
    setLoading(false);
    setError('');
    setStatus('');
    setShowWhy(false);
    setUseSmallerStep(false);
    setAdvisorReminderSet(false);
    setReminderBusy(false);
    void hasAdvisorReminder()
      .then((active) => {
        if (ownerRef.current === ownerKey) setAdvisorReminderSet(active);
      })
      .catch(() => undefined);
  }, [ownerKey]);

  const selectedCount = Object.values(sources).filter(Boolean).length;
  const activeAction = recommendation
    ? useSmallerStep
      ? recommendation.smallerAction
      : recommendation.action
    : '';
  const toggleSource = (key: AdvisorSourceKey) => {
    if (loading) return;
    setSources((current) => ({ ...current, [key]: !current[key] }));
    setError('');
  };

  const prepareContext = async (withoutContext = false) => {
    if (!withoutContext && selectedCount === 0) {
      setError('Choose at least one source, or continue without personal context.');
      return;
    }

    const selectedSources: Sources = withoutContext
      ? INITIAL_SOURCES
      : { ...sources };
    if (withoutContext) setSources(INITIAL_SOURCES);

    const request = ++requestRef.current;
    const expectedOwner = ownerKey;
    setLoading(true);
    setError('');
    setStatus('');
    const nextMissing: MissingSource[] = [];
    let mood: AdvisorContext['mood'] = null;
    let goals: AdvisorGoal[] = [];
    let habits: AdvisorHabit[] = [];
    let health: AdvisorContext['health'] = null;

    try {
      if (selectedSources.mood) {
        if (!queryValue) {
          nextMissing.push({ key: 'mood', message: 'No recent mood check-in is available.' });
        } else {
          const result = await supabase
            .from('moods')
            .select('emoji, local_date, created_at')
            .eq(queryColumn, queryValue)
            .gte('created_at', subDays(new Date(), 7).toISOString())
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          if (result.error) {
            nextMissing.push({ key: 'mood', message: 'Mood check-ins could not be loaded.' });
          } else if (!result.data) {
            nextMissing.push({ key: 'mood', message: 'No recent mood check-in is available.' });
          } else {
            mood = {
              emoji: result.data.emoji as MoodEmoji,
              localDate: result.data.local_date ?? result.data.created_at.slice(0, 10),
            };
          }
        }
      }

      if (selectedSources.goals) {
        if (!queryValue) {
          nextMissing.push({ key: 'goals', message: 'No active goals are available.' });
        } else {
          const result = await supabase
            .from('goals')
            .select('id, content, due_at')
            .eq(queryColumn, queryValue)
            .eq('status', 'pending')
            .order('created_at', { ascending: true })
            .limit(10);
          if (result.error) {
            nextMissing.push({ key: 'goals', message: 'Goals could not be loaded.' });
          } else if (!result.data?.length) {
            nextMissing.push({ key: 'goals', message: 'No active goals are available.' });
          } else {
            goals = result.data.map((goal) => ({
              id: goal.id,
              title: goal.content,
              dueAt: goal.due_at,
            }));
          }
        }
      }

      if (selectedSources.habits) {
        if (!user?.id || !isAuthenticated) {
          nextMissing.push({ key: 'habits', message: 'Sign in to use habits with Advisor.' });
        } else {
          const result = await supabase
            .from('habits')
            .select('id, name, tiny_step')
            .eq('user_id', user.id)
            .eq('is_active', true)
            .order('created_at', { ascending: true })
            .limit(10);
          if (result.error) {
            nextMissing.push({ key: 'habits', message: 'Habits could not be loaded.' });
          } else if (!result.data?.length) {
            nextMissing.push({ key: 'habits', message: 'No active habits are available.' });
          } else {
            const ids = result.data.map(({ id }) => id);
            const logsResult = await supabase
              .from('habit_logs')
              .select('habit_id, completed')
              .in('habit_id', ids)
              .eq('log_date', format(new Date(), 'yyyy-MM-dd'));
            if (logsResult.error) {
              nextMissing.push({ key: 'habits', message: 'Habit completion could not be loaded.' });
            } else {
              const completed = new Map(
                (logsResult.data ?? []).map((row) => [row.habit_id, Boolean(row.completed)])
              );
              habits = result.data.map((habit) => ({
                id: habit.id,
                name: habit.name,
                tinyStep: habit.tiny_step,
                completedToday: completed.get(habit.id) ?? false,
              }));
            }
          }
        }
      }

      if (selectedSources.health) {
        if (Platform.OS !== 'ios' || !user?.id) {
          nextMissing.push({ key: 'health', message: 'Apple Health is not available for this profile.' });
        } else {
          let enabled: boolean | null = null;
          try {
            enabled = await appleHealthPreference.read(user.id);
          } catch {
            nextMissing.push({ key: 'health', message: 'Apple Health settings could not be loaded.' });
          }
          if (enabled === false) {
            nextMissing.push({ key: 'health', message: 'No Health summary is available. Connect it in Settings or continue without it.' });
          } else if (enabled) {
            try {
              const snapshot = await loadAppleHealthSnapshot();
              health = createAdvisorHealthFeatures(snapshot);
              if (
                health.sleepMinutes.recentCoverageDays === 0 &&
                health.steps.recentCoverageDays === 0
              ) {
                health = null;
                nextMissing.push({ key: 'health', message: 'No recent Health summary is available.' });
              }
            } catch {
              nextMissing.push({ key: 'health', message: 'No Health summary is available right now.' });
            }
          }
        }
      }

      if (request !== requestRef.current || ownerRef.current !== expectedOwner) return;
      const nextContext = createAdvisorContextSnapshot({
        nowIso: new Date().toISOString(),
        mood,
        goals,
        habits,
        health,
      });
      setContext(nextContext);
      setPreviewSources(selectedSources);
      setMissing(nextMissing);
      setPhase('preview');
      requestAnimationFrame(() =>
        AccessibilityInfo.announceForAccessibility('Context ready for review')
      );
    } catch (loadError) {
      console.warn('Advisor context could not be prepared:', loadError);
      if (request === requestRef.current && ownerRef.current === expectedOwner) {
        setError('Advisor could not prepare your context. You can still continue without it.');
      }
    } finally {
      if (request === requestRef.current && ownerRef.current === expectedOwner) setLoading(false);
    }
  };

  const buildRecommendation = () => {
    if (!context) return;
    setRecommendation(createAdvisorRecommendation(context));
    setUseSmallerStep(false);
    setShowWhy(false);
    setStatus('');
    setPhase('result');
    requestAnimationFrame(() =>
      AccessibilityInfo.announceForAccessibility('Suggestion ready')
    );
  };

  const scheduleReminder = async () => {
    if (reminderBusy) return;
    const reminderRequest = ++reminderRequestRef.current;
    const expectedOwner = ownerRef.current;
    setReminderBusy(true);
    setStatus('');
    setError('');
    try {
      const target = new Date(Date.now() + 2 * 60 * 60 * 1000);
      const scheduled = await scheduleAdvisorReminder(target);
      if (
        !mountedRef.current ||
        reminderRequestRef.current !== reminderRequest ||
        ownerRef.current !== expectedOwner
      ) {
        if (scheduled) {
          await cancelAdvisorReminder().catch((cleanupError) =>
            console.warn('Stale Advisor reminder could not be removed:', cleanupError)
          );
        }
        return;
      }
      setAdvisorReminderSet(scheduled);
      setStatus(
        scheduled
          ? `Reminder set for ${format(target, 'h:mm a')}.`
          : 'Advisor check-ins are paused. You can turn them on in Notification settings.'
      );
    } catch (reminderError) {
      if (
        mountedRef.current &&
        reminderRequestRef.current === reminderRequest &&
        ownerRef.current === expectedOwner
      ) {
        const active = await hasAdvisorReminder().catch(() => false);
        setAdvisorReminderSet(active);
        setError(
          reminderError instanceof Error
            ? reminderError.message
            : 'The reminder could not be scheduled.'
        );
      }
    } finally {
      if (mountedRef.current && reminderRequestRef.current === reminderRequest) {
        setReminderBusy(false);
      }
    }
  };

  const removeReminder = async () => {
    if (reminderBusy) return;
    const reminderRequest = ++reminderRequestRef.current;
    setReminderBusy(true);
    setStatus('');
    setError('');
    try {
      await cancelAdvisorReminder();
      setAdvisorReminderSet(false);
      setStatus('Advisor reminder cancelled.');
    } catch (reminderError) {
      const active = await hasAdvisorReminder().catch(() => true);
      if (mountedRef.current && reminderRequestRef.current === reminderRequest) {
        setAdvisorReminderSet(active);
        setError(
          reminderError instanceof Error
            ? reminderError.message
            : 'The reminder could not be cancelled.'
        );
      }
    } finally {
      if (mountedRef.current && reminderRequestRef.current === reminderRequest) {
        setReminderBusy(false);
      }
    }
  };

  const toggleSmallerStep = () => {
    if (!recommendation) return;
    const nextUsesSmallerStep = !useSmallerStep;
    const nextAction = nextUsesSmallerStep
      ? recommendation.smallerAction
      : recommendation.action;
    setUseSmallerStep(nextUsesSmallerStep);
    AccessibilityInfo.announceForAccessibility(nextAction);
  };

  const reset = () => {
    requestRef.current += 1;
    setPhase('choose');
    setSources(INITIAL_SOURCES);
    setPreviewSources(INITIAL_SOURCES);
    setContext(null);
    setMissing([]);
    setRecommendation(null);
    setStatus('');
    setError('');
    setShowWhy(false);
    setUseSmallerStep(false);
  };

  return (
    <AppScreen>
      <View style={styles.leafRow}>
        <LeafMark size={52} />
      </View>
      <PageHeader
        eyebrow="Advisor"
        title="Your next step"
        description="One practical action, using only the context you choose."
        action={<SupportAction label="Support" onPress={() => router.push('/resources')} />}
      />

      {phase === 'choose' ? (
        <>
          <Text accessibilityRole="header" style={styles.sectionTitle}>Choose what Advisor can use</Text>
          <Text style={styles.sectionDescription}>Everything starts off. You can change this for every suggestion.</Text>
          <AppCard style={styles.sourceCard}>
            {(Object.keys(SOURCE_COPY) as AdvisorSourceKey[]).map((key, index) => (
              <View key={key} style={[styles.sourceRow, index > 0 && styles.sourceDivider]}>
                <View style={styles.sourceCopy}>
                  <Text style={styles.sourceTitle}>{SOURCE_COPY[key].label}</Text>
                  <Text style={styles.sourceDescription}>{SOURCE_COPY[key].description}</Text>
                </View>
                <Switch
                  accessibilityLabel={SOURCE_COPY[key].label}
                  accessibilityHint={SOURCE_COPY[key].description}
                  disabled={loading}
                  value={sources[key]}
                  onValueChange={() => toggleSource(key)}
                  trackColor={{ false: Colors.border, true: Colors.sage }}
                  thumbColor={sources[key] ? Colors.primary : Colors.card}
                />
              </View>
            ))}
          </AppCard>
          {error ? <InlineStatus tone="error" message={error} /> : null}
          <AppButton
            label={selectedCount ? 'Review my context' : 'Choose some context'}
            icon="arrow-right"
            loading={loading}
            disabled={selectedCount === 0}
            onPress={() => void prepareContext(false)}
          />
          <AppButton
            label="Continue without personal context"
            variant="quiet"
            disabled={loading}
            onPress={() => void prepareContext(true)}
          />
          <Text style={styles.boundary}>Advisor is not therapy, diagnosis, medical advice, treatment, or emergency response. It runs only when you ask and never schedules or shares on its own.</Text>
        </>
      ) : null}

      {phase === 'preview' && context ? (
        <>
          <Text accessibilityRole="header" style={styles.sectionTitle}>Review what Advisor will use</Text>
          <Text style={styles.sectionDescription}>Nothing is sent to an AI provider. These summaries are used on this device.</Text>
          <AppCard>
            {previewSources.mood && context.mood ? (
              <ContextLine icon="smile" label="Mood check-in" value={`${getMoodLabel(context.mood.emoji)} · ${context.mood.localDate}`} />
            ) : null}
            {previewSources.goals && context.goals.length ? (
              <ContextLine icon="flag" label="Goal" value={`${context.goals[0].title}${context.goals[0].dueAt ? ` · Due ${formatAdvisorDueDate(context.goals[0].dueAt)}` : ' · No due date'}`} />
            ) : null}
            {previewSources.habits && context.habits.length ? (
              <ContextLine icon="repeat" label="Habit" value={`${context.habits[0].name} · Smallest step: ${context.habits[0].tinyStep?.trim() || 'Not set'}`} />
            ) : null}
            {previewSources.health && context.health ? (
              <ContextLine
                icon="heart"
                label="Apple Health summary"
                value={`Sleep: ${context.health.sleepMinutes.recentAverage === null ? 'unavailable' : `${Math.round(context.health.sleepMinutes.recentAverage / 6) / 10} hr average`} · Steps: ${context.health.steps.recentAverage?.toLocaleString() ?? 'unavailable'} average`}
              />
            ) : null}
            {!context.mood && !context.goals.length && !context.habits.length && !context.health ? (
              <Text style={styles.emptyText}>No personal context will be used.</Text>
            ) : null}
          </AppCard>
          {missing.map((item) => (
            <InlineStatus key={item.key} tone="info" message={item.message} />
          ))}
          <Text style={styles.boundary}>Mood notes, raw Health samples, assessments, journals, AI chats, and partner data are not included.</Text>
          <AppButton label="Get my next step" icon="arrow-right" onPress={buildRecommendation} />
          <AppButton label="Change context" variant="quiet" onPress={() => setPhase('choose')} />
        </>
      ) : null}

      {phase === 'result' && recommendation ? (
        <>
          <AppCard style={styles.resultCard} tone="tinted">
            <Text style={styles.resultEyebrow}>WHAT I NOTICED</Text>
            <Text style={styles.observation}>{recommendation.observation}</Text>
            <View style={styles.actionDivider} />
            <Text style={styles.resultEyebrow}>ONE SMALL NEXT STEP</Text>
            <Text accessibilityRole="header" style={styles.action}>{activeAction}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded: showWhy }}
              onPress={() => setShowWhy((current) => !current)}
              style={styles.whyButton}
            >
              <Text style={styles.whyButtonText}>Why this?</Text>
              <Feather name={showWhy ? 'chevron-up' : 'chevron-down'} size={18} color={Colors.primary} />
            </Pressable>
            {showWhy ? (
              <View style={styles.whyPanel}>
                <Text style={styles.whyText}>
                  {recommendation.kind === 'safety'
                    ? 'Advisor could not safely turn the selected item into an action.'
                    : recommendation.sourceLabels.length
                    ? `Based on: ${recommendation.sourceLabels.join(' and ')}.`
                    : 'This is a general starting point because no personal context was included.'}
                </Text>
                <Text style={styles.whyText}>This is a suggestion, not a diagnosis or treatment plan.</Text>
                {context?.health ? (
                  <Text style={styles.whyText}>Apple Health was available as context. Advisor did not use it to infer your capacity or health.</Text>
                ) : null}
              </View>
            ) : null}
          </AppCard>

          {status ? <InlineStatus tone="success" message={status} /> : null}
          {error ? <InlineStatus tone="error" message={error} /> : null}

          <AppButton
            label={recommendation.resourceLabel}
            icon="arrow-right"
            onPress={() => router.push(recommendation.route)}
          />
          {recommendation.kind === 'standard' ? (
            <>
              <View style={styles.buttonGrid}>
                <AppButton
                  label={useSmallerStep ? 'Use original step' : 'Make it smaller'}
                  variant="secondary"
                  onPress={toggleSmallerStep}
                  style={styles.halfButton}
                />
              <AppButton
                  label={advisorReminderSet ? 'Replace 2-hour reminder' : 'Remind me in 2 hours'}
                  variant="secondary"
                  icon="bell"
                  onPress={() => void scheduleReminder()}
                  disabled={reminderBusy}
                  loading={reminderBusy}
                  style={styles.halfButton}
              />
            </View>
              {advisorReminderSet ? (
                <AppButton
                  label="Cancel Advisor reminder"
                  variant="quiet"
                  icon="bell-off"
                  onPress={() => void removeReminder()}
                  disabled={reminderBusy}
                />
              ) : null}
              <AppButton
                label={canUseTogether ? 'Share just this step with Together' : 'Sign in to share with Together'}
                variant="secondary"
                icon="users"
                onPress={() => canUseTogether
                  ? router.push({
                      pathname: '/accountability/create',
                      params: { title: activeAction, source: 'advisor' },
                    })
                  : router.push({
                      pathname: '/auth/login',
                      params: { returnTo: '/accountability' },
                    })}
              />
              <AppButton
                label="Talk this through"
                variant="quiet"
                icon="message-circle"
                onPress={() => router.push('/(tabs)/chat')}
              />
            </>
          ) : null}
          <Text style={styles.boundary}>Advisor is not therapy, diagnosis, medical advice, treatment, or emergency response.</Text>
          <AppButton label="Choose another" variant="quiet" onPress={reset} />
        </>
      ) : null}
    </AppScreen>
  );
}

function ContextLine({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.contextLine}>
      <View style={styles.contextIcon}>
        <Feather accessible={false} name={icon} size={17} color={Colors.primary} />
      </View>
      <View style={styles.contextCopy}>
        <Text style={styles.contextLabel}>{label}</Text>
        <Text style={styles.contextValue}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  leafRow: { alignItems: 'flex-start', marginBottom: Spacing.sm },
  sectionTitle: { color: Colors.text, ...Typography.sectionTitle, marginTop: Spacing.xs },
  sectionDescription: { color: Colors.textSecondary, ...Typography.body, lineHeight: 22, marginTop: Spacing.xs, marginBottom: Spacing.md },
  sourceCard: { paddingVertical: 0 },
  sourceRow: { minHeight: 78, flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.sm },
  sourceDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border },
  sourceCopy: { flex: 1, minWidth: 0 },
  sourceTitle: { color: Colors.text, ...Typography.cardTitle },
  sourceDescription: { color: Colors.textSecondary, ...Typography.bodySmall, lineHeight: 18, marginTop: Spacing.xxs },
  boundary: { color: Colors.textSecondary, ...Typography.caption, lineHeight: 18, marginTop: Spacing.sm, marginBottom: Spacing.lg },
  contextLine: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, paddingVertical: Spacing.sm },
  contextIcon: { width: 34, height: 34, borderRadius: Radius.pill, backgroundColor: Colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  contextCopy: { flex: 1, minWidth: 0 },
  contextLabel: { color: Colors.text, ...Typography.label },
  contextValue: { color: Colors.textSecondary, ...Typography.bodySmall, lineHeight: 18, marginTop: Spacing.xxs },
  emptyText: { color: Colors.textSecondary, ...Typography.body, lineHeight: 22, paddingVertical: Spacing.sm },
  resultCard: { borderColor: Colors.sage, borderWidth: 1 },
  resultEyebrow: { color: Colors.accent, ...Typography.eyebrow, marginBottom: Spacing.xs },
  observation: { color: Colors.textSecondary, ...Typography.body, lineHeight: 23 },
  actionDivider: { height: 1, backgroundColor: Colors.border, marginVertical: Spacing.lg },
  action: { color: Colors.text, fontFamily: 'Georgia', fontSize: 25, fontWeight: '700', lineHeight: 32 },
  whyButton: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginTop: Spacing.md, alignSelf: 'flex-start' },
  whyButtonText: { color: Colors.primary, ...Typography.label },
  whyPanel: { backgroundColor: Colors.card, borderRadius: Radius.md, padding: Spacing.md, gap: Spacing.xs },
  whyText: { color: Colors.textSecondary, ...Typography.bodySmall, lineHeight: 19 },
  buttonGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  halfButton: { flexGrow: 1, flexBasis: 150 },
});
