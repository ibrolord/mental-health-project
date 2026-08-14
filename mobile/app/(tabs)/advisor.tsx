import { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { format, formatDistanceToNow } from 'date-fns';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  ActionRow,
  AppButton,
  AppCard,
  AppScreen,
  DisclosureCard,
  InlineStatus,
  PageHeader,
  SupportAction,
} from '@/components/AppUI';
import { BotanicalHero } from '@/components/BotanicalHero';
import { AdvisorTrendCard } from '@/components/AdvisorTrendCard';
import { loadAmbientAdvisorContext } from '@/lib/advisor-context';
import { requestModelAdvisorRecommendation } from '@/lib/advisor-ai';
import {
  createAdvisorBriefFingerprint,
  createAdvisorBriefSignals,
  type AdvisorBriefFocus,
  type AdvisorDailyBrief,
} from '@/lib/advisor-brief-core';
import { advisorBriefStorage } from '@/lib/advisor-brief-storage';
import {
  createAdvisorCandidateSet,
  createAdvisorTrendSummary,
  selectAdvisorRecommendation,
  type AdvisorContext,
  type AdvisorRecentRecommendation,
  type AdvisorRecommendation,
  type AdvisorSelectionOptions,
} from '@/lib/advisor-core';
import {
  answerAdvisorHelpfulness,
  loadAdvisorOutcomes,
  markAdvisorStarted,
  recordAdvisorOffered,
  type AdvisorOutcome,
} from '@/lib/advisor-outcome-storage';
import { useAuth } from '@/lib/auth-context';
import { ensureAiDataSharingConsent } from '@/lib/ai-consent';
import { appleHealthPreference } from '@/lib/apple-health-preference';
import { loadAppleHealthSnapshot } from '@/lib/apple-health';
import {
  createAppleHealthAiSummary,
  createAppleHealthOverview,
  type AppleHealthAiSummary,
} from '@/lib/apple-health-core';
import { confirmAppleHealthAiShare } from '@/lib/apple-health-ai-consent';
import { refreshReminders } from '@/lib/notifications';
import { Colors, Radius, Spacing, Typography } from '@/lib/constants';

const APPLE_HEALTH_AI_ENABLED =
  process.env.EXPO_PUBLIC_HEALTH_AI_ENABLED === 'true';

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

function fallbackFocus(recommendation: AdvisorRecommendation): AdvisorBriefFocus {
  if (recommendation.kind === 'safety' || recommendation.id.startsWith('low-')) {
    return 'recover';
  }
  if (
    recommendation.id.startsWith('goal:') ||
    recommendation.id.startsWith('due-goal')
  ) {
    return 'deadline';
  }
  if (recommendation.id.startsWith('habit:')) return 'routine';
  if (recommendation.id.startsWith('health-')) return 'baseline';
  return 'steady';
}

const FALLBACK_HEADLINES: Record<AdvisorBriefFocus, string> = {
  steady: 'Keep today clear.',
  deadline: 'Protect the next deadline.',
  routine: 'Keep the routine moving.',
  baseline: 'Support your baseline.',
  recover: 'Make today lighter.',
};

function deterministicBrief(
  context: AdvisorContext,
  recommendation: AdvisorRecommendation,
  appleHealthSummary: AppleHealthAiSummary | null
): AdvisorDailyBrief {
  const focus = fallbackFocus(recommendation);
  return {
    focus,
    headline: FALLBACK_HEADLINES[focus],
    signals: createAdvisorBriefSignals(context, appleHealthSummary).slice(0, 2),
    usedAppleHealth: Boolean(appleHealthSummary),
  };
}

async function selectModelBackedRecommendation(
  context: AdvisorContext,
  recent: readonly AdvisorRecentRecommendation[],
  ownerKey: string | null,
  options: AdvisorSelectionOptions = {},
  appleHealthSummary: AppleHealthAiSummary | null = null
): Promise<{
  recommendation: AdvisorRecommendation;
  model: 'gemini' | 'claude' | null;
  brief: AdvisorDailyBrief;
}> {
  const fallback = selectAdvisorRecommendation(context, recent, options);
  if (fallback.kind === 'safety' || !ownerKey) {
    return {
      recommendation: fallback,
      model: null,
      brief: deterministicBrief(context, fallback, appleHealthSummary),
    };
  }
  if (!(await ensureAiDataSharingConsent(ownerKey))) {
    return {
      recommendation: fallback,
      model: null,
      brief: deterministicBrief(context, fallback, appleHealthSummary),
    };
  }

  try {
    const modelContext: AdvisorContext = appleHealthSummary
      ? context
      : { ...context, health: null };
    const candidates = createAdvisorCandidateSet(
      modelContext,
      recent,
      options
    );
    const result = await requestModelAdvisorRecommendation(
      modelContext,
      candidates,
      recent,
      appleHealthSummary
    );
    return {
      recommendation: result.recommendation,
      model: result.personalized ? result.model : null,
      brief: result.brief,
    };
  } catch {
    return {
      recommendation: fallback,
      model: null,
      brief: deterministicBrief(context, fallback, appleHealthSummary),
    };
  }
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
  const [brief, setBrief] = useState<AdvisorDailyBrief | null>(null);
  const [advisorModel, setAdvisorModel] = useState<'gemini' | 'claude' | null>(null);
  const [outcomes, setOutcomes] = useState<AdvisorOutcome[]>([]);
  const [stateOwnerKey, setStateOwnerKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [useSmallerStep, setUseSmallerStep] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const canUseTogether = isAuthenticated && !isAnonymous;

  useFocusEffect(
    useCallback(() => {
      const request = ++requestRef.current;
      const expectedOwner = ownerKey;
      setContext(null);
      setRecommendation(null);
      setBrief(null);
      setAdvisorModel(null);
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
          const localDate = format(new Date(context.nowIso), 'yyyy-MM-dd');
          const fingerprint = createAdvisorBriefFingerprint(context, localOutcomes);
          const cached = expectedOwner
            ? await advisorBriefStorage.read(
                expectedOwner,
                localDate,
                fingerprint
              ).catch(() => null)
            : null;
          const generated = cached
            ? {
                recommendation: cached.recommendation,
                model: cached.model,
                brief: cached.brief,
              }
            : await selectModelBackedRecommendation(
                context,
                localOutcomes,
                expectedOwner
              );
          const currentRecommendation = generated.recommendation;
          if (request !== requestRef.current || ownerRef.current !== expectedOwner) return;
          let updatedOutcomes = localOutcomes;
          if (!cached) {
            await recordAdvisorOffered(expectedOwner, currentRecommendation).catch(
              () => undefined
            );
            updatedOutcomes = await loadAdvisorOutcomes(expectedOwner);
            if (request !== requestRef.current || ownerRef.current !== expectedOwner) return;
            if (expectedOwner) {
              await advisorBriefStorage.write({
                version: 1,
                ownerKey: expectedOwner,
                localDate,
                fingerprint: createAdvisorBriefFingerprint(
                  context,
                  updatedOutcomes
                ),
                generatedAt: new Date().toISOString(),
                model: generated.model,
                recommendation: currentRecommendation,
                brief: generated.brief,
              }).catch(() => undefined);
              void refreshReminders().catch(() => undefined);
            }
          }
          setContext(context);
          setRecommendation(currentRecommendation);
          setBrief(generated.brief);
          setAdvisorModel(generated.model);
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
    ? `${advisorModel === 'gemini' ? 'Gemini-guided · ' : advisorModel === 'claude' ? 'Claude-guided · ' : ''}${recommendation.sourceLabels.length
      ? `Based on ${Array.from(
          new Set(
            recommendation.sourceLabels.map(
              (label) => SOURCE_LABELS[label] ?? label
            )
          )
        ).join(' · ')}`
      : 'General guidance · no personal context used'}`
    : '';
  const visibleOutcomes = outcomes
    .filter((outcome) => outcome.startedAt || outcome.completedAt || outcome.helpful !== null)
    .slice(0, 5);
  const pendingFeedback = outcomes
    .filter((outcome) => outcome.startedAt && !outcome.feedbackAt)
    .sort(
      (left, right) =>
        new Date(right.startedAt ?? 0).getTime() -
        new Date(left.startedAt ?? 0).getTime()
    )[0] ?? null;
  const trend = context && stateOwnerKey === ownerKey
    ? createAdvisorTrendSummary(context)
    : null;
  const openAiSupport = () =>
    router.push({
      pathname: '/(tabs)/chat',
      params: { from: 'advisor' },
    });

  const refreshWithAppleHealth = async () => {
    if (
      !context ||
      !recommendation ||
      !ownerKey ||
      !user?.id ||
      !APPLE_HEALTH_AI_ENABLED ||
      busy ||
      stateOwnerKey !== ownerKey
    ) {
      return;
    }
    const expectedOwner = ownerKey;
    setBusy(true);
    setError('');
    setStatus('');
    try {
      if (!(await ensureAiDataSharingConsent(expectedOwner))) return;
      if (!(await appleHealthPreference.read(user.id))) {
        Alert.alert(
          'Set up Apple Health',
          'Choose the Health categories you want MHtoolkit to read in Settings.',
          [
            { text: 'Not now', style: 'cancel' },
            { text: 'Open Settings', onPress: () => router.push('/settings') },
          ]
        );
        return;
      }
      const snapshot = await loadAppleHealthSnapshot();
      const summary = createAppleHealthAiSummary(
        createAppleHealthOverview(snapshot)
      );
      if (summary.thirtyDay.coverageDays === 0) {
        setError('No permitted Apple Health data was found.');
        return;
      }
      if (!(await confirmAppleHealthAiShare(summary))) return;

      const generated = await selectModelBackedRecommendation(
        context,
        outcomes,
        expectedOwner,
        {},
        summary
      );
      if (ownerRef.current !== expectedOwner) return;
      await recordAdvisorOffered(expectedOwner, generated.recommendation).catch(
        () => undefined
      );
      const updatedOutcomes = await loadAdvisorOutcomes(expectedOwner);
      if (ownerRef.current !== expectedOwner) return;
      await advisorBriefStorage.write({
        version: 1,
        ownerKey: expectedOwner,
        localDate: format(new Date(context.nowIso), 'yyyy-MM-dd'),
        fingerprint: createAdvisorBriefFingerprint(
          context,
          updatedOutcomes,
          summary
        ),
        generatedAt: new Date().toISOString(),
        model: generated.model,
        recommendation: generated.recommendation,
        brief: generated.brief,
      }).catch(() => undefined);
      if (ownerRef.current !== expectedOwner) return;
      setRecommendation(generated.recommendation);
      setBrief(generated.brief);
      setAdvisorModel(generated.model);
      setOutcomes(updatedOutcomes);
      setUseSmallerStep(false);
      setStatus('Today’s brief now includes the Health summary you approved.');
      void refreshReminders().catch(() => undefined);
    } catch {
      if (ownerRef.current === expectedOwner) {
        setError('Apple Health could not be added to today’s brief.');
      }
    } finally {
      if (ownerRef.current === expectedOwner) setBusy(false);
    }
  };

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
      const generated = await selectModelBackedRecommendation(
        context,
        [
          {
            recommendationId: currentRecommendation.id,
            offeredAt: new Date().toISOString(),
          },
          ...outcomes,
        ],
        expectedOwner,
        {
          preserveToday: false,
          excludeRecommendationId: currentRecommendation.id,
          candidateFamily: currentRecommendation.id.split(':')[0],
        }
      );
      const nextRecommendation: AdvisorRecommendation = generated.recommendation;
      if (ownerRef.current !== expectedOwner) return;
      await recordAdvisorOffered(expectedOwner, nextRecommendation);
      const updatedOutcomes = await loadAdvisorOutcomes(expectedOwner);
      if (ownerRef.current !== expectedOwner) return;
      await advisorBriefStorage.write({
        version: 1,
        ownerKey: expectedOwner,
        localDate: format(new Date(context.nowIso), 'yyyy-MM-dd'),
        fingerprint: createAdvisorBriefFingerprint(context, updatedOutcomes),
        generatedAt: new Date().toISOString(),
        model: generated.model,
        recommendation: nextRecommendation,
        brief: generated.brief,
      }).catch(() => undefined);
      setRecommendation(nextRecommendation);
      setBrief(generated.brief);
      setAdvisorModel(generated.model);
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

  const answerHelpfulness = async (helpful: boolean | null) => {
    if (!pendingFeedback || !ownerKey || busy || stateOwnerKey !== ownerKey) return;
    const expectedOwner = ownerKey;
    setBusy(true);
    setError('');
    setStatus('');
    try {
      await answerAdvisorHelpfulness(
        expectedOwner,
        pendingFeedback.recommendationId,
        helpful
      );
      const updatedOutcomes = await loadAdvisorOutcomes(expectedOwner);
      if (ownerRef.current !== expectedOwner) return;
      setOutcomes(updatedOutcomes);
      setStatus(helpful === null ? 'Feedback skipped.' : 'Thanks. Advisor will use that next time.');
    } catch {
      if (ownerRef.current === expectedOwner) {
        setError('Feedback could not be saved. Please try again.');
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
      <BotanicalHero style={styles.hero}>
        <View style={styles.headerRow}>
          <Text style={styles.brand}>MHtoolkit</Text>
          <SupportAction label="Support" onPress={() => router.push('/resources')} />
        </View>
        <View style={styles.headerCopy}>
          <PageHeader
            eyebrow="PERSONAL GUIDANCE"
            title="Advisor"
            description="One useful read on your day. One step to take next."
          />
        </View>
      </BotanicalHero>

      {loading ? <InlineStatus tone="info" message="Loading your current recommendation…" /> : null}
      {error ? <InlineStatus tone="error" message={error} /> : null}

      {!loading && recommendation && stateOwnerKey === ownerKey ? (
        <>
          {brief ? (
            <AppCard style={styles.briefCard}>
              <View style={styles.briefHeader}>
                <View style={styles.briefHeadingCopy}>
                  <Text style={styles.eyebrow}>TODAY’S BRIEF</Text>
                  <Text accessibilityRole="header" style={styles.briefHeadline}>
                    {brief.headline}
                  </Text>
                </View>
                {brief.usedAppleHealth ? (
                  <Text style={styles.healthBadge}>Health included</Text>
                ) : null}
              </View>
              {brief.signals.length > 0 ? (
                <View style={styles.briefSignals}>
                  {brief.signals.map((signal) => (
                    <View key={signal.id} style={styles.briefSignalRow}>
                      <View style={styles.briefDot} />
                      <Text style={styles.briefSignalText}>{signal.text}</Text>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={styles.briefEmpty}>
                  Add a goal, routine, or check-in to make tomorrow’s brief more specific.
                </Text>
              )}
              {Platform.OS === 'ios' &&
              APPLE_HEALTH_AI_ENABLED &&
              user?.id &&
              recommendation.kind === 'standard' ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={
                    brief.usedAppleHealth
                      ? 'Refresh today’s brief with Apple Health'
                      : 'Include Apple Health in today’s brief'
                  }
                  disabled={busy}
                  onPress={() => void refreshWithAppleHealth()}
                  style={({ pressed }) => [
                    styles.healthAction,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={styles.healthActionText}>
                    {brief.usedAppleHealth
                      ? 'Refresh Health summary'
                      : 'Include Apple Health'}
                  </Text>
                </Pressable>
              ) : null}
            </AppCard>
          ) : null}
          {trend && recommendation.kind !== 'safety' ? (
            <AdvisorTrendCard
              trend={trend}
              onTalkThrough={openAiSupport}
            />
          ) : null}
          <AppCard style={styles.currentCard} tone="tinted">
            <Text style={styles.eyebrow}>FOR RIGHT NOW</Text>
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
            <Text style={styles.boundaryLine}>
              Personal guidance, not a clinical assessment.
            </Text>
          </AppCard>

          {pendingFeedback ? (
            <AppCard quiet style={styles.feedbackCard}>
              <Text accessibilityRole="header" style={styles.feedbackTitle}>
                Did your last step help?
              </Text>
              <View style={styles.feedbackActions}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Yes, my last Advisor step helped"
                  disabled={busy}
                  onPress={() => void answerHelpfulness(true)}
                  style={({ pressed }) => [styles.feedbackButton, pressed && styles.pressed]}
                >
                  <Text style={styles.feedbackButtonText}>Yes</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="My last Advisor step did not help"
                  disabled={busy}
                  onPress={() => void answerHelpfulness(false)}
                  style={({ pressed }) => [styles.feedbackButton, pressed && styles.pressed]}
                >
                  <Text style={styles.feedbackButtonText}>Not for me</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Skip Advisor feedback"
                  disabled={busy}
                  onPress={() => void answerHelpfulness(null)}
                  style={({ pressed }) => [styles.feedbackButton, pressed && styles.pressed]}
                >
                  <Text style={styles.feedbackButtonText}>Skip</Text>
                </Pressable>
              </View>
            </AppCard>
          ) : null}

          {status ? <InlineStatus tone="success" message={status} /> : null}
          <AppButton
            label={recommendation.kind === 'safety' ? 'Find support' : 'Start'}
            icon="arrow-right"
            loading={busy}
            onPress={() => void startRecommendation()}
          />
          <DisclosureCard
            title="Why this step?"
            description="What informed this suggestion"
            icon="eye"
            expanded={detailsOpen}
            onToggle={() => setDetailsOpen((current) => !current)}
          >
            {recommendation.observations.length ? (
              <View accessibilityLabel="What informed this suggestion">
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
          </DisclosureCard>
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
                  onPress: openAiSupport,
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
                  onPress: openAiSupport,
                  disabled: busy,
                },
              ]}
            />
          )}
        </>
      ) : null}

      {!loading && error ? (
        <AppButton
          label="Talk this through"
          icon="message-circle"
          onPress={openAiSupport}
        />
      ) : null}

      {!loading && !error && stateOwnerKey === ownerKey ? (
        <View style={styles.historySection}>
          <DisclosureCard
            title="Recent steps"
            description="What you started or completed"
            icon="clock"
            expanded={historyOpen}
            onToggle={() => setHistoryOpen((current) => !current)}
          >
            {visibleOutcomes.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyText}>
                  Start a step and it will show up here.
                </Text>
              </View>
            ) : (
              <View style={styles.historyCard}>
                {visibleOutcomes.map((outcome, index) => {
                  const title = outcome.recommendationId === recommendation?.id
                    ? recommendation.action
                    : outcomeTitle(outcome.recommendationId);
                  return (
                    <View
                      key={`${outcome.recommendationId}:${outcome.offeredAt}`}
                      accessible
                      accessibilityLabel={`${title}, ${outcomeStatus(outcome)}, ${formatDistanceToNow(new Date(outcome.offeredAt), { addSuffix: true })}`}
                      style={[styles.outcomeRow, index > 0 && styles.outcomeDivider]}
                    >
                      <View style={styles.outcomeCopy}>
                        <Text style={styles.outcomeTitle}>{title}</Text>
                        <Text style={styles.outcomeDate}>
                          {formatDistanceToNow(new Date(outcome.offeredAt), { addSuffix: true })}
                        </Text>
                      </View>
                      <Text style={styles.outcomeBadge}>{outcomeStatus(outcome)}</Text>
                    </View>
                  );
                })}
              </View>
            )}
          </DisclosureCard>
        </View>
      ) : null}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  hero: {
    minHeight: 212,
    borderRadius: 24,
    marginBottom: Spacing.lg,
    padding: Spacing.md,
  },
  headerRow: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  brand: { color: Colors.text, fontFamily: 'Georgia', fontSize: 22, fontWeight: '700' },
  headerCopy: { maxWidth: '78%' },
  eyebrow: { color: Colors.accent, ...Typography.eyebrow, marginBottom: Spacing.xs },
  briefCard: { marginBottom: Spacing.sm },
  briefHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  briefHeadingCopy: { flex: 1 },
  briefHeadline: {
    color: Colors.text,
    fontFamily: 'Georgia',
    fontSize: 24,
    fontWeight: '700',
    lineHeight: 30,
  },
  healthBadge: {
    color: Colors.primary,
    ...Typography.caption,
    backgroundColor: Colors.primaryLight,
    borderRadius: Radius.pill,
    overflow: 'hidden',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  briefSignals: { marginTop: Spacing.md, gap: Spacing.sm },
  briefSignalRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  briefDot: {
    width: 6,
    height: 6,
    borderRadius: Radius.pill,
    backgroundColor: Colors.accent,
    marginTop: 7,
  },
  briefSignalText: {
    flex: 1,
    color: Colors.textSecondary,
    ...Typography.bodySmall,
    lineHeight: 20,
  },
  briefEmpty: {
    color: Colors.textSecondary,
    ...Typography.bodySmall,
    lineHeight: 20,
    marginTop: Spacing.md,
  },
  healthAction: {
    minHeight: 44,
    alignSelf: 'flex-start',
    justifyContent: 'center',
    marginTop: Spacing.md,
  },
  healthActionText: { color: Colors.primary, ...Typography.label },
  observationText: { color: Colors.textSecondary, ...Typography.bodySmall, lineHeight: 20 },
  observationSpacing: {
    marginTop: Spacing.xs,
  },
  currentCard: { borderColor: Colors.sage, marginBottom: Spacing.sm },
  feedbackCard: { marginBottom: Spacing.sm },
  feedbackTitle: { color: Colors.text, ...Typography.cardTitle },
  feedbackActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginTop: Spacing.xs,
  },
  feedbackButton: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: Spacing.sm,
  },
  feedbackButtonText: { color: Colors.primary, ...Typography.label },
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
  boundaryLine: {
    color: Colors.textSecondary,
    ...Typography.caption,
    marginTop: Spacing.xs,
  },
  contextEmpty: {
    color: Colors.textSecondary,
    ...Typography.bodySmall,
    lineHeight: 20,
  },
  historySection: { marginTop: Spacing.lg },
  emptyText: { color: Colors.textSecondary, ...Typography.body, lineHeight: 22 },
  emptyCard: { backgroundColor: Colors.surfaceMuted, borderRadius: Radius.md, padding: Spacing.md },
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
