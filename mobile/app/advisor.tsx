import { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, Text, View } from 'react-native';
import { formatDistanceToNow } from 'date-fns';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  ActionRow,
  AppButton,
  AppCard,
  AppScreen,
  InlineStatus,
  PageHeader,
  SupportAction,
} from '@/components/AppUI';
import { LeafMark } from '@/components/LeafMark';
import { loadAmbientAdvisorContext } from '@/lib/advisor-context';
import {
  selectAdvisorRecommendation,
  type AdvisorContext,
  type AdvisorRecommendation,
} from '@/lib/advisor-core';
import {
  loadAdvisorOutcomes,
  markAdvisorStarted,
  recordAdvisorOffered,
  type AdvisorOutcome,
} from '@/lib/advisor-outcome-storage';
import { useAuth } from '@/lib/auth-context';
import { Colors, Radius, Spacing, Typography } from '@/lib/constants';

const SOURCE_LABELS: Record<string, string> = {
  'Mood check-in': 'Mood check-in',
  'Mood check-ins': 'Mood check-ins',
  Goal: 'Goal',
  Goals: 'Goals',
  Habit: 'Habit',
  Habits: 'Habits',
  'Apple Health summary': 'Apple Health summary',
};

function outcomeStatus(outcome: AdvisorOutcome): string {
  if (outcome.helpful === true) return 'Helped';
  if (outcome.completedAt) return 'Completed';
  if (outcome.startedAt) return 'Started';
  return 'Suggested';
}

function outcomeTitle(recommendationId: string): string {
  if (recommendationId.startsWith('low-grounding')) return 'Grounding step';
  if (recommendationId.startsWith('low-goal') || recommendationId.startsWith('goal:') || recommendationId.startsWith('due-goal')) return 'Goal step';
  if (recommendationId.startsWith('habit:')) return 'Habit step';
  if (recommendationId.startsWith('health-')) return 'Wellbeing step';
  if (recommendationId.startsWith('check-in')) return 'Mood check-in';
  return 'Suggested step';
}

export default function AdvisorScreen() {
  const router = useRouter();
  const { user, sessionId, isAuthenticated, isAnonymous } = useAuth();
  const queryColumn = isAuthenticated ? 'user_id' : 'session_id';
  const queryValue = isAuthenticated ? user?.id : sessionId;
  const ownerKey = queryValue ? `${queryColumn}:${queryValue}` : null;
  const ownerRef = useRef(ownerKey);
  ownerRef.current = ownerKey;
  const requestRef = useRef(0);
  const announcedActionRef = useRef<{
    ownerKey: string;
    action: string;
  } | null>(null);
  const [context, setContext] = useState<AdvisorContext | null>(null);
  const [recommendation, setRecommendation] = useState<AdvisorRecommendation | null>(null);
  const [outcomes, setOutcomes] = useState<AdvisorOutcome[]>([]);
  const [stateOwnerKey, setStateOwnerKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [useSmallerStep, setUseSmallerStep] = useState(false);
  const canUseTogether = isAuthenticated && !isAnonymous;

  useFocusEffect(
    useCallback(() => {
      const request = ++requestRef.current;
      const expectedOwner = ownerKey;
      setContext(null);
      setRecommendation(null);
      setOutcomes([]);
      setStateOwnerKey(null);
      setLoading(true);
      setError('');
      setStatus('');
      setUseSmallerStep(false);

      void Promise.all([
        loadAmbientAdvisorContext({
          ownerKey: expectedOwner,
          queryColumn,
          queryValue: queryValue ?? null,
          userId: user?.id ?? null,
        }),
        loadAdvisorOutcomes(expectedOwner),
      ])
        .then(async ([context, localOutcomes]) => {
          if (request !== requestRef.current || ownerRef.current !== expectedOwner) return;
          const currentRecommendation = selectAdvisorRecommendation(
            context,
            localOutcomes
          );
          await recordAdvisorOffered(expectedOwner, currentRecommendation).catch(
            () => undefined
          );
          const updatedOutcomes = await loadAdvisorOutcomes(expectedOwner);
          if (request !== requestRef.current || ownerRef.current !== expectedOwner) return;
          setContext(context);
          setRecommendation(currentRecommendation);
          setOutcomes(updatedOutcomes);
          setStateOwnerKey(expectedOwner);
        })
        .catch(() => {
          if (request === requestRef.current && ownerRef.current === expectedOwner) {
            setError('Advisor could not load right now. Please try again.');
          }
        })
        .finally(() => {
          if (request === requestRef.current && ownerRef.current === expectedOwner) {
            setLoading(false);
          }
        });

      return () => {
        if (request === requestRef.current) requestRef.current += 1;
      };
    }, [ownerKey, queryColumn, queryValue, user?.id])
  );

  const activeAction = recommendation
    ? useSmallerStep
      ? recommendation.smallerAction
      : recommendation.action
    : '';
  const sourceLine = recommendation
    ? recommendation.sourceLabels.length
      ? `Based on ${Array.from(
          new Set(
            recommendation.sourceLabels.map(
              (label) => SOURCE_LABELS[label] ?? label
            )
          )
        ).join(' · ')}`
      : 'General guidance · no personal context used'
    : '';

  useEffect(() => {
    if (!activeAction || !ownerKey || stateOwnerKey !== ownerKey) return;
    const previous = announcedActionRef.current;
    announcedActionRef.current = { ownerKey, action: activeAction };
    if (previous?.ownerKey === ownerKey && previous.action !== activeAction) {
      AccessibilityInfo.announceForAccessibility(
        `Advisor action changed. ${activeAction}`
      );
    }
  }, [activeAction, ownerKey, stateOwnerKey]);

  const startRecommendation = async () => {
    if (!recommendation || !ownerKey || busy || stateOwnerKey !== ownerKey) return;
    const expectedOwner = ownerKey;
    const selectedRecommendation = recommendation;
    setBusy(true);
    setError('');
    setStatus('');
    try {
      await recordAdvisorOffered(expectedOwner, selectedRecommendation);
      await markAdvisorStarted(expectedOwner, selectedRecommendation.id);
      if (ownerRef.current !== expectedOwner) return;
      router.push(selectedRecommendation.route as never);
    } catch {
      if (ownerRef.current === expectedOwner) {
        setError('This step could not be started. Please try again.');
      }
    } finally {
      if (ownerRef.current === expectedOwner) setBusy(false);
    }
  };

  const tryAnotherRecommendation = async () => {
    if (!context || !recommendation || !ownerKey || busy || stateOwnerKey !== ownerKey) {
      return;
    }
    const expectedOwner = ownerKey;
    const currentRecommendation = recommendation;
    setBusy(true);
    setError('');
    setStatus('');
    try {
      const selectedRecommendation = selectAdvisorRecommendation(
        context,
        [
          {
            recommendationId: currentRecommendation.id,
            offeredAt: new Date().toISOString(),
          },
          ...outcomes,
        ],
        {
          preserveToday: false,
          excludeRecommendationId: currentRecommendation.id,
          candidateFamily: currentRecommendation.id.split(':')[0],
        }
      );
      const nextRecommendation: AdvisorRecommendation = {
        ...selectedRecommendation,
        observation: currentRecommendation.observation,
        observations: currentRecommendation.observations,
        changeSignal: currentRecommendation.changeSignal,
        sourceLabels: Array.from(
          new Set([
            ...currentRecommendation.sourceLabels,
            ...selectedRecommendation.sourceLabels,
          ])
        ),
      };
      await recordAdvisorOffered(expectedOwner, nextRecommendation);
      const updatedOutcomes = await loadAdvisorOutcomes(expectedOwner);
      if (ownerRef.current !== expectedOwner) return;
      setRecommendation(nextRecommendation);
      setOutcomes(updatedOutcomes);
      setUseSmallerStep(false);
    } catch {
      if (ownerRef.current === expectedOwner) {
        setError('Another step could not be loaded. Please try again.');
      }
    } finally {
      if (ownerRef.current === expectedOwner) setBusy(false);
    }
  };

  const shareWithTogether = () => {
    if (!recommendation || !ownerKey || stateOwnerKey !== ownerKey) return;
    if (canUseTogether) {
      router.push({
        pathname: '/accountability/create',
        params: { title: activeAction, source: 'advisor' },
      });
      return;
    }
    router.push({
      pathname: '/auth/login',
      params: { returnTo: '/accountability' },
    });
  };

  return (
    <AppScreen>
      <View style={styles.headerRow}>
        <LeafMark size={38} />
        <SupportAction label="Support" onPress={() => router.push('/resources')} />
      </View>
      <PageHeader
        title="One step for right now"
        description="Start here, or make the step smaller."
      />

      {loading ? <InlineStatus tone="info" message="Loading your current recommendation…" /> : null}
      {error ? <InlineStatus tone="error" message={error} /> : null}

      {!loading && recommendation && stateOwnerKey === ownerKey ? (
        <>
          <AppCard style={styles.currentCard} tone="tinted">
            <Text accessibilityRole="header" style={styles.action}>{activeAction}</Text>
            {recommendation.kind === 'standard' &&
            recommendation.smallerAction !== recommendation.action ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={
                  useSmallerStep
                    ? `Use original step: ${recommendation.action}`
                    : `Use smaller step: ${recommendation.smallerAction}`
                }
                onPress={() => setUseSmallerStep((current) => !current)}
                style={({ pressed }) => [
                  styles.smallerStep,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.smallerLabel}>
                  {useSmallerStep ? 'Back to the original' : 'If that feels like too much'}
                </Text>
                <Text style={styles.smallerAction}>
                  {useSmallerStep
                    ? recommendation.action
                    : recommendation.smallerAction}
                </Text>
              </Pressable>
            ) : null}
            <Text style={styles.sourceLine}>{sourceLine}</Text>
          </AppCard>

          {recommendation.observations.length ? (
            <View accessibilityLabel="Why this was suggested" style={styles.provenanceBlock}>
              {recommendation.observations.slice(0, 3).map((observation, index) => (
                <Text
                  key={`${index}:${observation}`}
                  style={[
                    styles.observationText,
                    index > 0 && styles.observationSpacing,
                  ]}
                >
                  {observation}
                </Text>
              ))}
            </View>
          ) : (
            <Text style={styles.contextEmpty}>
              No personal pattern was used for this suggestion.
            </Text>
          )}

          {status ? <InlineStatus tone="success" message={status} /> : null}
          <AppButton
            label={recommendation.kind === 'safety' ? 'Find support' : 'Start'}
            icon="arrow-right"
            loading={busy}
            onPress={() => void startRecommendation()}
          />
          {recommendation.kind === 'standard' ? (
            <ActionRow
              actions={[
                {
                  label: 'Try something else',
                  onPress: () => void tryAnotherRecommendation(),
                  disabled: busy,
                },
                {
                  label: canUseTogether ? 'Share with Together' : 'Sign in to share',
                  icon: 'users',
                  onPress: shareWithTogether,
                  disabled: busy,
                },
                {
                  label: 'Talk this through',
                  icon: 'message-circle',
                  onPress: () => router.push('/(tabs)/chat'),
                  disabled: busy,
                },
              ]}
            />
          ) : (
            <ActionRow
              actions={[
                {
                  label: 'Talk this through',
                  icon: 'message-circle',
                  onPress: () => router.push('/(tabs)/chat'),
                  disabled: busy,
                },
              ]}
            />
          )}
        </>
      ) : null}

      {!loading && !error && stateOwnerKey === ownerKey ? (
        <View style={styles.historySection}>
          <Text accessibilityRole="header" style={styles.historyTitle}>Recent outcomes</Text>
          {outcomes.length === 0 ? (
            <AppCard quiet style={styles.emptyCard}>
              <Text style={styles.emptyText}>
                Nothing to review yet. Start today’s step and it will appear here.
              </Text>
            </AppCard>
          ) : (
            <AppCard quiet style={styles.historyCard}>
              {outcomes.map((outcome, index) => (
                <View
                  key={`${outcome.recommendationId}:${outcome.offeredAt}`}
                  accessible
                  accessibilityLabel={`${outcomeStatus(outcome)}, ${formatDistanceToNow(new Date(outcome.offeredAt), { addSuffix: true })}`}
                  style={[styles.outcomeRow, index > 0 && styles.outcomeDivider]}
                >
                  <View style={styles.outcomeCopy}>
                    <Text style={styles.outcomeTitle}>
                      {outcome.recommendationId === recommendation?.id
                        ? recommendation.action
                        : outcomeTitle(outcome.recommendationId)}
                    </Text>
                    <Text style={styles.outcomeDate}>
                      {formatDistanceToNow(new Date(outcome.offeredAt), { addSuffix: true })}
                    </Text>
                  </View>
                  <Text style={styles.outcomeBadge}>{outcomeStatus(outcome)}</Text>
                </View>
              ))}
            </AppCard>
          )}
        </View>
      ) : null}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  provenanceBlock: { marginBottom: Spacing.md, paddingHorizontal: Spacing.xs },
  observationText: { color: Colors.textSecondary, ...Typography.bodySmall, lineHeight: 20 },
  observationSpacing: {
    marginTop: Spacing.xs,
  },
  currentCard: { borderColor: Colors.sage, marginBottom: Spacing.sm },
  action: {
    color: Colors.text,
    fontFamily: 'Georgia',
    fontSize: 24,
    fontWeight: '700',
    lineHeight: 31,
  },
  smallerStep: {
    minHeight: 44,
    justifyContent: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.borderStrong,
    marginTop: Spacing.md,
    paddingTop: Spacing.sm,
  },
  smallerLabel: { color: Colors.primary, ...Typography.label },
  smallerAction: {
    color: Colors.textSecondary,
    ...Typography.bodySmall,
    lineHeight: 19,
    marginTop: Spacing.xxs,
  },
  sourceLine: {
    color: Colors.textSecondary,
    ...Typography.caption,
    lineHeight: 18,
    marginTop: Spacing.md,
  },
  contextEmpty: {
    color: Colors.textSecondary,
    ...Typography.bodySmall,
    lineHeight: 20,
    marginBottom: Spacing.md,
    paddingHorizontal: Spacing.xs,
  },
  historySection: { marginTop: Spacing.lg },
  historyTitle: { color: Colors.text, ...Typography.sectionTitle, marginBottom: Spacing.sm },
  emptyText: { color: Colors.textSecondary, ...Typography.body, lineHeight: 22 },
  emptyCard: { backgroundColor: Colors.surfaceMuted },
  historyCard: { paddingVertical: 0 },
  outcomeRow: {
    minHeight: 68,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
  },
  outcomeDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border },
  outcomeCopy: { flex: 1, minWidth: 180 },
  outcomeTitle: { color: Colors.text, ...Typography.bodySmall, fontWeight: '700', lineHeight: 19 },
  outcomeDate: { color: Colors.textSecondary, ...Typography.caption, marginTop: Spacing.xxs },
  outcomeBadge: {
    color: Colors.primary,
    ...Typography.caption,
    borderRadius: Radius.pill,
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    overflow: 'hidden',
  },
  pressed: { opacity: 0.72 },
});
