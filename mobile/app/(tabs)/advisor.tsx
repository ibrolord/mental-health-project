import { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Alert, AppState, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
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
  acceptAdvisorAction,
  clearAdvisorAction,
  loadAdvisorAction,
  resizeAdvisorAction,
  setAdvisorActionFollowUp,
  setAdvisorActionReminder,
  type AdvisorActionRecoveryReason,
  type AdvisorActionInstance,
} from '@/lib/advisor-action-storage';
import {
  advisorFollowUpState,
  createAdvisorWeeklyReview,
} from '@/lib/advisor-accountability-core';
import { createAdvisorReminderCoordinator } from '@/lib/advisor-reminder-coordinator';
import {
  advisorCadenceLabel,
  createAdvisorReminderChoices,
} from '@/lib/advisor-cadence-core';
import {
  createAdvisorCandidateSet,
  createAdvisorTrendSummary,
  selectAdvisorRecommendation,
  type AdvisorChangeSignal,
  type AdvisorContext,
  type AdvisorRecentRecommendation,
  type AdvisorRecommendation,
  type AdvisorSelectionOptions,
} from '@/lib/advisor-core';
import {
  answerAdvisorHelpfulness,
  loadAdvisorOutcomes,
  recordAdvisorOffered,
  type AdvisorOutcome,
} from '@/lib/advisor-outcome-storage';
import {
  completeAdvisorLifecycle,
  reconcileAdvisorLifecycle,
  recoverAdvisorLifecycle,
  replaceAdvisorLifecycle,
  startAdvisorLifecycle,
} from '@/lib/advisor-lifecycle-runtime';
import { evaluateAdvisorChangeSignals } from '@/lib/advisor-observation-ledger';
import { checkAdvisorTargetCompletion } from '@/lib/advisor-target-completion-runtime';
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
import {
  cancelAdvisorReminder,
  hasAdvisorReminder,
  refreshReminders,
  scheduleAdvisorReminder,
} from '@/lib/notifications';
import { Colors, Radius, Spacing, Typography } from '@/lib/constants';

const APPLE_HEALTH_AI_ENABLED =
  process.env.EXPO_PUBLIC_HEALTH_AI_ENABLED === 'true';

const scheduleAdvisorActionReminder = createAdvisorReminderCoordinator({
  schedule: scheduleAdvisorReminder,
  cancel: cancelAdvisorReminder,
  accept: acceptAdvisorAction,
  setFollowUp: setAdvisorActionFollowUp,
  clear: clearAdvisorAction,
});

const SOURCE_LABELS: Record<string, string> = {
  'Mood check-in': 'Mood check-in',
  'Mood check-ins': 'Mood check-ins',
  Goal: 'Goal',
  Goals: 'Goals',
  Habit: 'Habit',
  Habits: 'Habits',
  'Apple Health summary': 'Apple Health summary',
  'Your Advisor setup': 'Your priorities',
};

function outcomeStatus(outcome: AdvisorOutcome): string {
  if (outcome.helpful === true) return 'Helped';
  if (outcome.resolution === 'partial') return 'Partly done';
  if (outcome.resolution === 'skipped') return 'Reset';
  if (outcome.completedAt) return 'Completed';
  if (outcome.startedAt) return 'Started';
  return 'Suggested';
}

function recoveryCopy(reason: AdvisorActionRecoveryReason | null): string {
  if (reason === 'time') return 'Time got tight. Try the smaller version or choose a new check-in.';
  if (reason === 'energy') return 'Energy was low. Use the smallest useful version of the step.';
  if (reason === 'unclear') return 'The step was unclear. Make it smaller or choose a different one.';
  if (reason === 'priority') return 'Priorities changed. Keep, reschedule, or replace the step.';
  return 'Pick the easiest realistic way back in.';
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

function recommendationForAction(action: AdvisorActionInstance): AdvisorRecommendation {
  const observation = action.observations[0] ?? 'Advisor is keeping this step in view.';
  return {
    id: action.recommendationId,
    kind: 'standard',
    observation,
    observations: action.observations.length ? action.observations : [observation],
    action: action.action,
    smallerAction: action.smallerAction,
    route: action.route,
    sourceLabels: action.sourceLabels,
    resourceLabel: 'Open current step',
    changeSignal: null,
  };
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

function prefersSmallerStep(context: AdvisorContext): boolean {
  const style = context.profile?.supportStyle;
  if (style === 'gentle') return true;
  if (style === 'practical') return context.lowEnergyMode === true;
  return false;
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

async function applyObservationCadence(
  context: AdvisorContext,
  recent: readonly AdvisorRecentRecommendation[],
  ownerKey: string | null,
  generated: Awaited<ReturnType<typeof selectModelBackedRecommendation>>,
  options: AdvisorSelectionOptions = {}
): Promise<Awaited<ReturnType<typeof selectModelBackedRecommendation>>> {
  const promoted = generated.recommendation.changeSignal;
  if (!ownerKey || generated.recommendation.kind === 'safety' || !promoted) {
    return generated;
  }
  const activeSignals = Array.from(
    new Map(
      createAdvisorCandidateSet(context, recent, options)
        .map((candidate) => candidate.changeSignal)
        .filter((signal): signal is AdvisorChangeSignal => Boolean(signal))
        .map((signal) => [signal.id, signal])
    ).values()
  );
  const shouldShow = await evaluateAdvisorChangeSignals(
    ownerKey,
    activeSignals,
    promoted.id,
    context.nowIso
  );
  if (shouldShow) return generated;

  const retainedObservations = generated.recommendation.observations.filter(
    (observation) => observation !== promoted.line
  );
  const observations = retainedObservations.length
    ? retainedObservations
    : ['Advisor is keeping the focus on one manageable next step.'];
  return {
    ...generated,
    recommendation: {
      ...generated.recommendation,
      observation: observations[0],
      observations,
    },
  };
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
  const promptedOwnerRef = useRef<string | null>(null);
  const [context, setContext] = useState<AdvisorContext | null>(null);
  const [recommendation, setRecommendation] = useState<AdvisorRecommendation | null>(null);
  const [brief, setBrief] = useState<AdvisorDailyBrief | null>(null);
  const [advisorModel, setAdvisorModel] = useState<'gemini' | 'claude' | null>(null);
  const [outcomes, setOutcomes] = useState<AdvisorOutcome[]>([]);
  const [activeAdvisorAction, setActiveAdvisorAction] =
    useState<AdvisorActionInstance | null>(null);
  const [stateOwnerKey, setStateOwnerKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [useSmallerStep, setUseSmallerStep] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [signalsOpen, setSignalsOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [weekOpen, setWeekOpen] = useState(false);
  const [nowTick, setNowTick] = useState(() => Date.now());
  const canUseTogether = isAuthenticated && !isAnonymous;

  useFocusEffect(
    useCallback(() => {
      const request = ++requestRef.current;
      const expectedOwner = ownerKey;
      setNowTick(Date.now());
      setContext(null);
      setRecommendation(null);
      setBrief(null);
      setAdvisorModel(null);
      setOutcomes([]);
      setActiveAdvisorAction(null);
      setStateOwnerKey(null);
      setLoading(true);
      setBusy(false);
      setError('');
      setStatus('');
      setUseSmallerStep(false);

      void reconcileAdvisorLifecycle(expectedOwner)
        .then(() => Promise.all([
          loadAmbientAdvisorContext({
            ownerKey: expectedOwner,
            queryColumn,
            queryValue: queryValue ?? null,
            userId: user?.id ?? null,
          }),
          loadAdvisorOutcomes(expectedOwner),
          loadAdvisorAction(expectedOwner),
        ]))
        .then(async ([context, localOutcomes, loadedAction]) => {
          if (request !== requestRef.current || ownerRef.current !== expectedOwner) return;
          let storedAction = loadedAction;
          if (storedAction?.reminderAt) {
            const reminderIsFuture =
              new Date(storedAction.reminderAt).getTime() > Date.now();
            const reminderExists = reminderIsFuture
              ? await hasAdvisorReminder().catch(() => false)
              : false;
            if (!reminderExists) {
              const reconciled = await setAdvisorActionReminder(
                expectedOwner,
                storedAction.id,
                null
              ).catch(() => ({ action: storedAction, changed: false }));
              storedAction = reconciled.action ?? storedAction;
            }
          }
          let reconciledOutcomes = localOutcomes;
          const targetCompleted = storedAction
            ? await checkAdvisorTargetCompletion(
                storedAction,
                {
                  queryColumn,
                  queryValue: queryValue ?? null,
                  userId: user?.id ?? null,
                },
                new Date(context.nowIso)
              ).catch(() => false)
            : false;
          if (storedAction && targetCompleted) {
            await completeAdvisorLifecycle(expectedOwner, storedAction);
            storedAction = null;
            reconciledOutcomes = await loadAdvisorOutcomes(expectedOwner);
          }
          const localDate = format(new Date(context.nowIso), 'yyyy-MM-dd');
          const deterministicSelection = selectAdvisorRecommendation(
            context,
            reconciledOutcomes
          );
          if (deterministicSelection.kind === 'safety') {
            setContext(context);
            setRecommendation(deterministicSelection);
            setBrief(deterministicBrief(context, deterministicSelection, null));
            setAdvisorModel(null);
            setOutcomes(reconciledOutcomes);
            setActiveAdvisorAction(null);
            setUseSmallerStep(false);
            setStateOwnerKey(expectedOwner);
            return;
          }
          if (!context.profile?.completedAt) {
            setContext(context);
            setRecommendation(deterministicSelection);
            setBrief(deterministicBrief(context, deterministicSelection, null));
            setAdvisorModel(null);
            setOutcomes(reconciledOutcomes);
            setActiveAdvisorAction(storedAction);
            setUseSmallerStep(prefersSmallerStep(context));
            setStateOwnerKey(expectedOwner);
            if (expectedOwner && promptedOwnerRef.current !== expectedOwner) {
              promptedOwnerRef.current = expectedOwner;
              setTimeout(() => {
                if (ownerRef.current === expectedOwner) router.push('/advisor-setup' as never);
              }, 0);
            }
            return;
          }
          const fingerprint = createAdvisorBriefFingerprint(context, reconciledOutcomes);
          const cached = expectedOwner
            ? await advisorBriefStorage.read(
                expectedOwner,
                localDate,
                fingerprint
              ).catch(() => null)
            : null;
          const storedRecommendation = storedAction
            ? recommendationForAction(storedAction)
            : null;
          const generated = storedRecommendation
            ? {
                recommendation: storedRecommendation,
                model: null,
                brief: deterministicBrief(context, storedRecommendation, null),
              }
            : cached
              ? {
                  recommendation: cached.recommendation,
                  model: cached.model,
                  brief: cached.brief,
                }
            : await applyObservationCadence(
                context,
                reconciledOutcomes,
                expectedOwner,
                await selectModelBackedRecommendation(
                  context,
                  reconciledOutcomes,
                  expectedOwner
                )
              );
          const currentRecommendation = generated.recommendation;
          if (request !== requestRef.current || ownerRef.current !== expectedOwner) return;
          if (
            storedAction &&
            currentRecommendation.kind === 'safety' &&
            (storedAction.reminderAt || storedAction.followUpAt)
          ) {
            const reminderCleared = await cancelAdvisorReminder().then(
              () => true,
              () => false
            );
            if (reminderCleared) {
              const suspended = await setAdvisorActionFollowUp(
                expectedOwner,
                storedAction.id,
                null,
                null
              ).catch(() => ({ action: storedAction, changed: false }));
              storedAction = suspended.action ?? storedAction;
            }
          }
          let updatedOutcomes = reconciledOutcomes;
          if (!cached) {
            if (!storedAction || currentRecommendation.kind === 'safety') {
              await recordAdvisorOffered(expectedOwner, currentRecommendation).catch(
                () => undefined
              );
              updatedOutcomes = await loadAdvisorOutcomes(expectedOwner);
            }
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
          setActiveAdvisorAction(storedAction);
          setUseSmallerStep(
            storedAction?.useSmallerStep ?? prefersSmallerStep(context)
          );
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
    }, [ownerKey, queryColumn, queryValue, router, user?.id])
  );

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState !== 'active') return;
      setNowTick(Date.now());
      const expectedOwner = ownerRef.current;
      if (!expectedOwner) return;
      void loadAdvisorAction(expectedOwner).then(async (storedAction) => {
        if (!storedAction || ownerRef.current !== expectedOwner) return;
        let reconciled = storedAction;
        if (storedAction.reminderAt) {
          const reminderExists = await hasAdvisorReminder().catch(() => false);
          if (!reminderExists) {
            const result = await setAdvisorActionReminder(
              expectedOwner,
              storedAction.id,
              null
            ).catch(() => ({ action: storedAction, changed: false }));
            reconciled = result.action ?? storedAction;
          }
        }
        if (ownerRef.current === expectedOwner) setActiveAdvisorAction(reconciled);
      }).catch(() => undefined);
    });
    return () => subscription.remove();
  }, []);

  const currentAdvisorAction = recommendation?.kind === 'safety'
    ? null
    : activeAdvisorAction;
  const actionIsPlanned = currentAdvisorAction?.status === 'accepted';
  const actionIsStarted = currentAdvisorAction?.status === 'in_progress'
    || currentAdvisorAction?.status === 'needs_recovery';
  const activeAction = currentAdvisorAction
    ? currentAdvisorAction.useSmallerStep
      ? currentAdvisorAction.smallerAction
      : currentAdvisorAction.action
    : recommendation
      ? useSmallerStep
      ? recommendation.smallerAction
        : recommendation.action
    : '';
  const originalAction = currentAdvisorAction?.action ?? recommendation?.action ?? '';
  const smallerAction = currentAdvisorAction?.smallerAction ?? recommendation?.smallerAction ?? '';
  const activeSourceLabels = currentAdvisorAction?.sourceLabels ?? recommendation?.sourceLabels ?? [];
  const activeObservations = currentAdvisorAction?.observations ?? recommendation?.observations ?? [];
  const sourceLine = recommendation || currentAdvisorAction
    ? `${!currentAdvisorAction && advisorModel === 'gemini' ? 'Gemini-guided · ' : !currentAdvisorAction && advisorModel === 'claude' ? 'Claude-guided · ' : ''}${activeSourceLabels.length
      ? `Based on ${Array.from(
          new Set(
            activeSourceLabels.map(
              (label) => SOURCE_LABELS[label] ?? label
            )
          )
        ).join(' · ')}`
      : context?.profile?.completedAt
        ? 'This step uses your Advisor preferences'
        : 'This step is general guidance'}`
    : '';
  const personalizedHeadline = brief
    ? context?.profile?.preferredName
      ? `${context.profile.preferredName}, ${brief.headline.charAt(0).toLocaleLowerCase()}${brief.headline.slice(1)}`
      : brief.headline
    : '';
  const visibleOutcomes = outcomes
    .filter((outcome) => outcome.startedAt || outcome.completedAt || outcome.helpful !== null)
    .slice(0, 5);
  const pendingFeedback = outcomes
    .filter((outcome) => outcome.completedAt && !outcome.feedbackAt)
    .sort(
      (left, right) =>
        new Date(right.completedAt ?? 0).getTime() -
        new Date(left.completedAt ?? 0).getTime()
    )[0] ?? null;
  const trend = context && stateOwnerKey === ownerKey
    ? createAdvisorTrendSummary(context)
    : null;
  const cadenceLine = advisorCadenceLabel(
    context ? new Date(context.nowIso) : new Date(),
    actionIsStarted
  );
  const followUpState = advisorFollowUpState(
    currentAdvisorAction,
    new Date(nowTick)
  );
  const weeklyReview = createAdvisorWeeklyReview(outcomes, new Date(nowTick));

  useEffect(() => {
    if (!currentAdvisorAction?.followUpAt || followUpState !== 'planned') return;
    const delay = new Date(currentAdvisorAction.followUpAt).getTime() - Date.now();
    if (!Number.isFinite(delay)) return;
    const timeout = setTimeout(
      () => setNowTick(Date.now()),
      Math.max(0, Math.min(delay + 250, 2_147_483_647))
    );
    return () => clearTimeout(timeout);
  }, [currentAdvisorAction?.followUpAt, followUpState]);

  const openAiSupport = () =>
    router.push({
      pathname: '/(tabs)/chat',
      params: { from: 'advisor' },
    });

  const refreshWithAppleHealth = async () => {
    if (
      !context ||
      !recommendation ||
      !context.profile?.completedAt ||
      activeAdvisorAction ||
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

      const generated = await applyObservationCadence(
        context,
        outcomes,
        expectedOwner,
        await selectModelBackedRecommendation(
          context,
          outcomes,
          expectedOwner,
          {},
          summary
        )
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
      if (!activeAdvisorAction) setUseSmallerStep(prefersSmallerStep(context));
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
      if (selectedRecommendation.kind === 'safety') {
        router.push(selectedRecommendation.route as never);
        return;
      }
      if (activeAdvisorAction?.status === 'in_progress') {
        router.push(activeAdvisorAction.route as never);
        return;
      }
      const accepted = activeAdvisorAction
        ? { action: activeAdvisorAction }
        : await acceptAdvisorAction(expectedOwner, selectedRecommendation, {
            useSmallerStep,
          });
      if (!accepted.action) throw new Error('Advisor action was not saved.');
      let actionToStart = accepted.action;
      if (
        actionToStart.status === 'accepted' &&
        advisorFollowUpState(actionToStart, new Date()) === 'planned_due'
      ) {
        await cancelAdvisorReminder();
        const resetFollowUp = await setAdvisorActionFollowUp(
          expectedOwner,
          actionToStart.id,
          null,
          null
        );
        if (!resetFollowUp.action) throw new Error('Advisor check-in state was not cleared.');
        actionToStart = resetFollowUp.action;
      }
      const started = await startAdvisorLifecycle(expectedOwner, actionToStart);
      if (ownerRef.current !== expectedOwner) return;
      setActiveAdvisorAction(started ?? actionToStart);
      router.push(actionToStart.route as never);
    } catch {
      if (ownerRef.current === expectedOwner) {
        setError('This step could not be started. Please try again.');
      }
    } finally {
      if (ownerRef.current === expectedOwner) setBusy(false);
    }
  };

  const generateAnotherRecommendation = async (
    actionToReplace: AdvisorActionInstance | null = null
  ) => {
    if (!context || !recommendation || !ownerKey || busy || stateOwnerKey !== ownerKey) {
      return;
    }
    const expectedOwner = ownerKey;
    const currentRecommendation = recommendation;
    setBusy(true);
    setError('');
    setStatus('');
    try {
      const recent = [
        {
          recommendationId: currentRecommendation.id,
          offeredAt: new Date().toISOString(),
        },
        ...outcomes,
      ];
      const options = {
          preserveToday: false,
          excludeRecommendationId: currentRecommendation.id,
          candidateFamily: currentRecommendation.id.split(':')[0],
      };
      const selected = selectAdvisorRecommendation(
        context,
        recent,
        options
      );
      const generated = await applyObservationCadence(
        context,
        recent,
        expectedOwner,
        {
          recommendation: selected,
          model: null,
          brief: deterministicBrief(context, selected, null),
        },
        options
      );
      const nextRecommendation = generated.recommendation;
      const nextBrief = generated.brief;
      if (ownerRef.current !== expectedOwner) return;
      if (actionToReplace) {
        await replaceAdvisorLifecycle(expectedOwner, actionToReplace);
        if (ownerRef.current !== expectedOwner) return;
        setActiveAdvisorAction(null);
      }
      await recordAdvisorOffered(expectedOwner, nextRecommendation);
      const updatedOutcomes = await loadAdvisorOutcomes(expectedOwner);
      if (ownerRef.current !== expectedOwner) return;
      await advisorBriefStorage.write({
        version: 1,
        ownerKey: expectedOwner,
        localDate: format(new Date(context.nowIso), 'yyyy-MM-dd'),
        fingerprint: createAdvisorBriefFingerprint(context, updatedOutcomes),
        generatedAt: new Date().toISOString(),
        model: null,
        recommendation: nextRecommendation,
        brief: nextBrief,
      }).catch(() => undefined);
      setRecommendation(nextRecommendation);
      setBrief(nextBrief);
      setAdvisorModel(null);
      setOutcomes(updatedOutcomes);
      setUseSmallerStep(prefersSmallerStep(context));
    } catch {
      if (ownerRef.current === expectedOwner) {
        setError('Another step could not be loaded. Please try again.');
      }
    } finally {
      if (ownerRef.current === expectedOwner) setBusy(false);
    }
  };

  const tryAnotherRecommendation = () => {
    if (!activeAdvisorAction) {
      void generateAnotherRecommendation();
      return;
    }
    Alert.alert(
      'Change your current step?',
      'Advisor will prepare a different step. Your current step stays until the replacement is ready.',
      [
        { text: 'Keep current step', style: 'cancel' },
        {
          text: 'Change step',
          style: 'destructive',
          onPress: () => {
            void generateAnotherRecommendation(activeAdvisorAction);
          },
        },
      ]
    );
  };

  const completeCurrentAction = async () => {
    if (!activeAdvisorAction || !ownerKey || !context || busy) return;
    const expectedOwner = ownerKey;
    const completed = activeAdvisorAction;
    setBusy(true);
    setError('');
    setStatus('');
    try {
      await completeAdvisorLifecycle(expectedOwner, completed);
      const updatedOutcomes = await loadAdvisorOutcomes(expectedOwner);
      if (ownerRef.current !== expectedOwner) return;
      const options = {
          preserveToday: false,
          excludeRecommendationId: completed.recommendationId,
          candidateFamily: completed.recommendationId.split(':')[0],
      };
      const selected = selectAdvisorRecommendation(
        context,
        updatedOutcomes,
        options
      );
      const generated = await applyObservationCadence(
        context,
        updatedOutcomes,
        expectedOwner,
        {
          recommendation: selected,
          model: null,
          brief: deterministicBrief(context, selected, null),
        },
        options
      );
      const nextRecommendation = generated.recommendation;
      const nextBrief = generated.brief;
      await recordAdvisorOffered(expectedOwner, nextRecommendation);
      const nextOutcomes = await loadAdvisorOutcomes(expectedOwner);
      await advisorBriefStorage.write({
        version: 1,
        ownerKey: expectedOwner,
        localDate: format(new Date(context.nowIso), 'yyyy-MM-dd'),
        fingerprint: createAdvisorBriefFingerprint(context, nextOutcomes),
        generatedAt: new Date().toISOString(),
        model: null,
        recommendation: nextRecommendation,
        brief: nextBrief,
      }).catch(() => undefined);
      if (ownerRef.current !== expectedOwner) return;
      setActiveAdvisorAction(null);
      setRecommendation(nextRecommendation);
      setBrief(nextBrief);
      setAdvisorModel(null);
      setOutcomes(nextOutcomes);
      setUseSmallerStep(false);
      setStatus('Step completed. Advisor has your next option ready.');
    } catch {
      if (ownerRef.current === expectedOwner) {
        setError('This step could not be completed. Please try again.');
      }
    } finally {
      if (ownerRef.current === expectedOwner) setBusy(false);
    }
  };

  const recordIncompleteAction = async (
    result: 'partial' | 'not_done',
    reason: AdvisorActionRecoveryReason | null = null
  ) => {
    if (!activeAdvisorAction || !ownerKey || busy) return;
    const expectedOwner = ownerKey;
    const current = activeAdvisorAction;
    setBusy(true);
    setError('');
    setStatus('');
    try {
      const updated = await recoverAdvisorLifecycle(
        expectedOwner,
        current,
        result,
        reason
      );
      const updatedOutcomes = await loadAdvisorOutcomes(expectedOwner);
      if (ownerRef.current !== expectedOwner) return;
      setActiveAdvisorAction(updated ?? current);
      setUseSmallerStep(updated?.useSmallerStep ?? current.useSmallerStep);
      setOutcomes(updatedOutcomes);
      setStatus(
        result === 'partial'
          ? 'Progress recorded. The smaller version is ready.'
          : 'No judgment. Reset the step when you are ready.'
      );
    } catch {
      if (ownerRef.current === expectedOwner) {
        setError('This check-in could not be saved. Please try again.');
      }
    } finally {
      if (ownerRef.current === expectedOwner) setBusy(false);
    }
  };

  const askWhyNotDone = () => {
    if (!activeAdvisorAction || busy) return;
    const reasons: { label: string; value: AdvisorActionRecoveryReason }[] = [
      { label: 'Time got away', value: 'time' },
      { label: 'Energy was low', value: 'energy' },
      { label: 'The step was unclear', value: 'unclear' },
      { label: 'Priorities changed', value: 'priority' },
    ];
    Alert.alert(
      'What got in the way?',
      'Choose one so Advisor can make the restart more realistic.',
      [
        ...reasons.map((reason) => ({
          text: reason.label,
          onPress: () => void recordIncompleteAction('not_done', reason.value),
        })),
        { text: 'Something else', onPress: () => void recordIncompleteAction('not_done', 'other') },
        { text: 'Cancel', style: 'cancel' as const },
      ]
    );
  };

  const toggleSmallerStep = async () => {
    const nextValue = !useSmallerStep;
    setUseSmallerStep(nextValue);
    if (!activeAdvisorAction || !ownerKey) return;
    try {
      const updated = await resizeAdvisorAction(
        ownerKey,
        activeAdvisorAction.id,
        nextValue
      );
      if (ownerRef.current === ownerKey && updated.action) {
        setActiveAdvisorAction(updated.action);
      }
    } catch {
      if (ownerRef.current === ownerKey) {
        setUseSmallerStep(activeAdvisorAction.useSmallerStep);
        setError('The smaller step could not be saved.');
      }
    }
  };

  const scheduleCurrentActionReminder = () => {
    if (!recommendation || !ownerKey || busy) return;
    const expectedOwner = ownerKey;
    const choices = createAdvisorReminderChoices(new Date());
    Alert.alert(
      'Set a check-in',
      'Choose when Advisor should ask how this step went.',
      [
        ...choices.map((choice) => ({
          text: choice.label,
          onPress: () => {
            void (async () => {
              setBusy(true);
              setError('');
              try {
                const result = await scheduleAdvisorActionReminder({
                  ownerKey: expectedOwner,
                  recommendation,
                  existingAction: activeAdvisorAction,
                  useSmallerStep,
                  date: choice.date,
                });
                if (!result.scheduled) {
                  Alert.alert(
                    'Turn on Advisor check-ins',
                    'Enable notifications and Advisor check-ins in Settings first.',
                    [
                      { text: 'Not now', style: 'cancel' },
                      { text: 'Open Settings', onPress: () => router.push('/settings') },
                    ]
                  );
                  return;
                }
                if (!result.action) throw new Error('Advisor action was not saved.');
                if (ownerRef.current !== expectedOwner) return;
                setActiveAdvisorAction(result.action);
                setUseSmallerStep(result.action.useSmallerStep);
                setStatus(`Check-in set for ${format(choice.date, 'EEE h:mm a')}.`);
              } catch {
                if (ownerRef.current === expectedOwner) {
                  setError('The reminder could not be set. Please try again.');
                }
              } finally {
                if (ownerRef.current === expectedOwner) setBusy(false);
              }
            })();
          },
        })),
        { text: 'Cancel', style: 'cancel' },
      ]
    );
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
        pendingFeedback.actionId ?? pendingFeedback.recommendationId,
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
            description="One clear brief. One current step. Support that follows through."
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
                    {personalizedHeadline}
                  </Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Tune Advisor"
                  onPress={() => router.push('/advisor-setup' as never)}
                  style={({ pressed }) => [styles.tuneButton, pressed && styles.pressed]}
                >
                  <Text style={styles.tuneButtonText}>Tune</Text>
                </Pressable>
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
              <Text style={styles.cadenceLine}>{cadenceLine}</Text>
              {Platform.OS === 'ios' &&
              APPLE_HEALTH_AI_ENABLED &&
              context?.profile?.completedAt &&
              !activeAdvisorAction &&
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
          <AppCard style={styles.currentCard} tone="tinted">
            <Text style={styles.eyebrow}>
              {actionIsPlanned
                ? 'PLANNED STEP'
                : actionIsStarted
                  ? 'YOUR CURRENT STEP'
                  : 'SUGGESTED NEXT STEP'}
            </Text>
            <Text accessibilityRole="header" style={styles.action}>{activeAction}</Text>
            {recommendation.kind === 'standard' &&
            smallerAction !== originalAction ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={
                  useSmallerStep
                    ? `Use original step: ${originalAction}`
                    : `Use smaller step: ${smallerAction}`
                }
                onPress={() => void toggleSmallerStep()}
                style={({ pressed }) => [
                  styles.smallerStep,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.smallerLabel}>
                  {useSmallerStep ? 'Use original step' : 'Make it smaller'}
                </Text>
                <Text style={styles.smallerAction}>
                  {useSmallerStep
                    ? originalAction
                    : smallerAction}
                </Text>
              </Pressable>
            ) : null}
            <Text style={styles.sourceLine}>{sourceLine}</Text>
            {currentAdvisorAction?.followUpAt ? (
              <Text style={styles.reminderLine}>
                Check-in {format(new Date(currentAdvisorAction.followUpAt), 'EEE h:mm a')}
              </Text>
            ) : null}
          </AppCard>
          {followUpState === 'planned_due' ? null : <AppButton
            label={recommendation.kind === 'safety'
              ? 'Find support'
              : followUpState === 'needs_recovery'
                ? useSmallerStep ? 'Continue smaller step' : 'Continue step'
              : actionIsStarted
                ? 'Continue'
                : 'Start'}
            icon="arrow-right"
            loading={busy}
            onPress={() => void startRecommendation()}
          />}
          {followUpState === 'planned_due' ? (
            <AppCard style={styles.checkInCard}>
              <Text style={styles.eyebrow}>PLANNED CHECK-IN</Text>
              <Text accessibilityRole="header" style={styles.checkInTitle}>Ready to begin?</Text>
              <Text style={styles.checkInBody}>Start now, choose a better time, or change the step.</Text>
              <ActionRow
                actions={[
                  {
                    label: 'Start',
                    icon: 'arrow-right',
                    onPress: () => void startRecommendation(),
                    disabled: busy,
                  },
                  {
                    label: 'Check in later',
                    icon: 'bell',
                    onPress: scheduleCurrentActionReminder,
                    disabled: busy,
                  },
                  {
                    label: 'Choose another',
                    onPress: tryAnotherRecommendation,
                    disabled: busy,
                  },
                ]}
              />
            </AppCard>
          ) : null}
          {followUpState === 'due' ? (
            <AppCard style={styles.checkInCard}>
              <Text style={styles.eyebrow}>ACCOUNTABILITY CHECK-IN</Text>
              <Text accessibilityRole="header" style={styles.checkInTitle}>How did it go?</Text>
              <Text style={styles.checkInBody}>Record what happened, then adjust the next move.</Text>
              <ActionRow
                actions={[
                  {
                    label: 'Done',
                    icon: 'check',
                    onPress: () => void completeCurrentAction(),
                    disabled: busy,
                  },
                  {
                    label: 'Partly',
                    onPress: () => void recordIncompleteAction('partial'),
                    disabled: busy,
                  },
                  {
                    label: 'Not yet',
                    onPress: askWhyNotDone,
                    disabled: busy,
                  },
                ]}
              />
            </AppCard>
          ) : null}
          {followUpState === 'needs_recovery' && currentAdvisorAction ? (
            <AppCard style={styles.checkInCard} tone="tinted">
              <Text style={styles.eyebrow}>RESET, DON’T RESTART</Text>
              <Text accessibilityRole="header" style={styles.checkInTitle}>Choose the way back in.</Text>
              <Text style={styles.checkInBody}>
                {recoveryCopy(currentAdvisorAction.recoveryReason)}
              </Text>
              <ActionRow
                actions={[
                  {
                    label: useSmallerStep ? 'Smaller step ready' : 'Make it smaller',
                    onPress: () => void toggleSmallerStep(),
                    disabled: busy || useSmallerStep,
                  },
                  {
                    label: 'Check in later',
                    icon: 'bell',
                    onPress: scheduleCurrentActionReminder,
                    disabled: busy,
                  },
                  {
                    label: 'Choose another',
                    onPress: tryAnotherRecommendation,
                    disabled: busy,
                  },
                ]}
              />
            </AppCard>
          ) : null}
          {trend && recommendation.kind !== 'safety' ? (
            <DisclosureCard
              title="Your signals"
              description="Momentum and personal baselines"
              icon="activity"
              expanded={signalsOpen}
              onToggle={() => setSignalsOpen((current) => !current)}
            >
              <AdvisorTrendCard
                trend={trend}
                onTalkThrough={openAiSupport}
              />
            </DisclosureCard>
          ) : null}
          {weeklyReview.started + weeklyReview.completed + weeklyReview.partial + weeklyReview.skipped > 0 ? (
            <DisclosureCard
              title="This week"
              description={weeklyReview.summary}
              icon="calendar"
              expanded={weekOpen}
              onToggle={() => setWeekOpen((current) => !current)}
            >
              <View style={styles.weekStats}>
                <Text style={styles.weekStat}>{weeklyReview.completed} done</Text>
                <Text style={styles.weekStat}>{weeklyReview.partial} partly</Text>
                <Text style={styles.weekStat}>{weeklyReview.skipped} reset</Text>
              </View>
            </DisclosureCard>
          ) : null}

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
          <DisclosureCard
            title="Why this step?"
            description="What informed this suggestion"
            icon="eye"
            expanded={detailsOpen}
            onToggle={() => setDetailsOpen((current) => !current)}
          >
            {activeObservations.length ? (
              <View accessibilityLabel="What informed this suggestion">
                {activeObservations.slice(0, 3).map((observation, index) => (
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
            followUpState === 'planned_due' || followUpState === 'due' || followUpState === 'needs_recovery' ? null : <ActionRow
              actions={actionIsStarted
                ? [
                    {
                      label: 'Done',
                      icon: 'check',
                      onPress: () => void completeCurrentAction(),
                      disabled: busy,
                    },
                    {
                      label: 'Remind me',
                      icon: 'bell',
                      onPress: scheduleCurrentActionReminder,
                      disabled: busy,
                    },
                    {
                      label: canUseTogether ? 'Share with Together' : 'Sign in to share',
                      icon: 'users',
                      onPress: shareWithTogether,
                      disabled: busy,
                    },
                    {
                      label: 'Change step',
                      onPress: tryAnotherRecommendation,
                      disabled: busy,
                    },
                  ]
                : [
                    {
                      label: 'Try something else',
                      onPress: tryAnotherRecommendation,
                      disabled: busy,
                    },
                    {
                      label: 'Remind me',
                      icon: 'bell',
                      onPress: scheduleCurrentActionReminder,
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
  tuneButton: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: Spacing.sm,
  },
  tuneButtonText: { color: Colors.primary, ...Typography.bodySmall, fontWeight: '800' },
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
  cadenceLine: {
    color: Colors.primary,
    ...Typography.caption,
    lineHeight: 18,
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
  checkInCard: { marginBottom: Spacing.sm, borderColor: Colors.sage },
  checkInTitle: { color: Colors.text, ...Typography.cardTitle },
  checkInBody: {
    color: Colors.textSecondary,
    ...Typography.bodySmall,
    lineHeight: 20,
    marginTop: Spacing.xs,
  },
  weekStats: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  weekStat: {
    color: Colors.primary,
    ...Typography.label,
    backgroundColor: Colors.primaryLight,
    borderRadius: Radius.pill,
    overflow: 'hidden',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
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
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: Colors.borderStrong,
    borderRadius: Radius.lg,
    marginTop: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.card,
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
  reminderLine: {
    color: Colors.primary,
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
