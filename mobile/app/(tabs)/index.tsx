import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { Colors, Spacing, Typography } from '@/lib/constants';
import { format, subDays } from 'date-fns';
import type { MoodEmoji } from '@/lib/types';
import { saveCheckInWithAttribution } from '@/lib/acquisition';
import {
  getLatestCheckInForDate,
  getLocalCheckInFields,
  getSevenDayHistoryStart,
} from '@/lib/check-in';
import { chooseRandomAffirmation } from '@/lib/affirmations';
import { loadAffirmationCatalog } from '@/lib/affirmations-client';
import { getMoodLabel, MoodGlyph, MoodPicker } from '@/components/MoodPicker';
import { AppScreen, InlineStatus, ListRow, SupportAction } from '@/components/AppUI';
import { AdvisorHomeCard } from '@/components/AdvisorHomeCard';
import { LeafMark } from '@/components/LeafMark';
import { loadAmbientAdvisorContext } from '@/lib/advisor-context';
import {
  createAdvisorRecommendation,
  getAdvisorChangeSignals,
  selectAdvisorRecommendation,
  type AdvisorContext,
  type AdvisorRecommendation,
} from '@/lib/advisor-core';
import {
  answerAdvisorHelpfulness,
  loadAdvisorOutcomes,
  markAdvisorStarted,
  recordAdvisorOffered,
  type AdvisorOutcome,
} from '@/lib/advisor-outcome-storage';
import {
  evaluateAdvisorChangeSignals,
  keepAdvisorChangeSignalVisible,
  suppressAdvisorChangeSignal,
} from '@/lib/advisor-observation-ledger';
import { UNIFIED_LIBRARY } from '@/lib/library/content';
import {
  composeSavedCollection,
  parsePracticeProgressRow,
  type PracticeProgressRow,
  type SavedLibraryStateRow,
  type SavedLibraryViewItem,
} from '@/lib/product-state';
import { dashboardPreferences } from '@/lib/dashboard-preferences';

const GENERIC_ADVISOR_RECOMMENDATION = createAdvisorRecommendation({
  nowIso: new Date(0).toISOString(),
  mood: null,
  goals: [],
  habits: [],
  health: null,
});

function greetingForHour(hour: number): string {
  if (hour < 12) return 'Good morning.';
  if (hour < 17) return 'Good afternoon.';
  return 'Good evening.';
}

function newestPendingAdvisorFeedback(
  outcomes: readonly AdvisorOutcome[]
): AdvisorOutcome | null {
  return outcomes
    .filter((outcome) => outcome.startedAt && !outcome.feedbackAt)
    .sort(
      (left, right) =>
        new Date(right.startedAt ?? 0).getTime() -
        new Date(left.startedAt ?? 0).getTime()
    )[0] ?? null;
}

export default function DashboardScreen() {
  const router = useRouter();
  const { user, sessionId, isAuthenticated } = useAuth();
  const [todayMood, setTodayMood] = useState<MoodEmoji | null>(null);
  const [weekMoods, setWeekMoods] = useState<any[]>([]);
  const [affirmation, setAffirmation] = useState('');
  const [affirmationBy, setAffirmationBy] = useState('');
  const [savingMood, setSavingMood] = useState(false);
  const [lowEnergyMode, setLowEnergyMode] = useState(false);
  const [lowEnergyOwnerKey, setLowEnergyOwnerKey] = useState<string | null>(null);
  const [lowEnergyLoadAttempt, setLowEnergyLoadAttempt] = useState(0);
  const [moodStatus, setMoodStatus] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  const [patternsOpen, setPatternsOpen] = useState(false);
  const [resumeProgress, setResumeProgress] =
    useState<PracticeProgressRow | null>(null);
  const [savedItem, setSavedItem] = useState<SavedLibraryViewItem | null>(null);
  const [moodOwnerKey, setMoodOwnerKey] = useState<string | null>(null);
  const [productOwnerId, setProductOwnerId] = useState<string | null>(null);
  const [moodRefreshKey, setMoodRefreshKey] = useState(0);
  const focusedMoodOwnerRef = useRef<string | null>(null);
  const advisorRequestRef = useRef(0);
  const advisorOwnerRef = useRef<string | null>(null);
  const startedRecommendationRef = useRef<{
    ownerKey: string;
    recommendation: AdvisorRecommendation;
    shownSignalId: string | null;
  } | null>(null);
  const advisorReselectionRef = useRef<{
    ownerKey: string;
    recommendationId: string;
  } | null>(null);
  const announcedAdvisorActionRef = useRef<{
    ownerKey: string;
    action: string;
    changeSignalLine: string | null;
    pendingFeedback: boolean;
  } | null>(null);
  const [advisorContext, setAdvisorContext] = useState<AdvisorContext | null>(null);
  const [advisorOutcomes, setAdvisorOutcomes] = useState<AdvisorOutcome[]>([]);
  const [advisorStateOwnerKey, setAdvisorStateOwnerKey] = useState<string | null>(null);
  const [advisorChangeSignalVisibility, setAdvisorChangeSignalVisibility] = useState<{
    ownerKey: string;
    recommendationId: string;
    signalId: string;
    visible: boolean;
  } | null>(null);
  const [recommendation, setRecommendation] = useState<AdvisorRecommendation>(() =>
    GENERIC_ADVISOR_RECOMMENDATION
  );
  const [advisorBusy, setAdvisorBusy] = useState(false);
  const [advisorStatus, setAdvisorStatus] = useState('');
  const [pendingCompletion, setPendingCompletion] = useState<string | null>(null);
  const [pendingFeedbackSignalId, setPendingFeedbackSignalId] = useState<string | null>(null);
  const [advisorRefreshKey, setAdvisorRefreshKey] = useState(0);
  const advisorRefreshRef = useRef(advisorRefreshKey);
  advisorRefreshRef.current = advisorRefreshKey;

  const queryColumn = isAuthenticated ? 'user_id' : 'session_id';
  const queryValue = isAuthenticated ? user?.id : sessionId;
  const ownerKey = queryValue ? `${queryColumn}:${queryValue}` : null;
  const ownerKeyRef = useRef(ownerKey);
  ownerKeyRef.current = ownerKey;
  const canSaveMood = Boolean(queryValue && user?.id);

  useFocusEffect(
    useCallback(() => {
      if (!ownerKey) return;
      setLowEnergyLoadAttempt((attempt) => attempt + 1);
      if (focusedMoodOwnerRef.current === ownerKey) {
        setMoodRefreshKey((key) => key + 1);
      } else {
        focusedMoodOwnerRef.current = ownerKey;
      }
    }, [ownerKey])
  );

  useFocusEffect(
    useCallback(() => {
      const request = ++advisorRequestRef.current;
      const expectedOwnerKey = ownerKey;
      const expectedRefreshKey = advisorRefreshKey;
      if (!expectedOwnerKey) {
        advisorOwnerRef.current = null;
        advisorReselectionRef.current = null;
        setAdvisorStateOwnerKey(null);
        setAdvisorChangeSignalVisibility(null);
        setAdvisorContext(null);
        setAdvisorOutcomes([]);
        setPendingCompletion(null);
        setPendingFeedbackSignalId(null);
        setRecommendation(GENERIC_ADVISOR_RECOMMENDATION);
        setAdvisorBusy(false);
        return;
      }
      if (advisorOwnerRef.current !== expectedOwnerKey) {
        advisorOwnerRef.current = expectedOwnerKey;
        advisorReselectionRef.current = null;
        setAdvisorStateOwnerKey(null);
        startedRecommendationRef.current = null;
        setAdvisorContext(null);
        setAdvisorOutcomes([]);
        setAdvisorChangeSignalVisibility(null);
        setPendingCompletion(null);
        setPendingFeedbackSignalId(null);
        setRecommendation(GENERIC_ADVISOR_RECOMMENDATION);
      }
      setAdvisorBusy(true);
      setAdvisorStatus('');

      void Promise.all([
        loadAmbientAdvisorContext({
          ownerKey: expectedOwnerKey,
          queryColumn,
          queryValue: queryValue ?? null,
          userId: user?.id ?? null,
        }),
        loadAdvisorOutcomes(expectedOwnerKey),
      ])
        .then(async ([context, outcomes]) => {
          if (
            request !== advisorRequestRef.current ||
            advisorRefreshRef.current !== expectedRefreshKey ||
            ownerKeyRef.current !== expectedOwnerKey
          ) {
            return;
          }
          const started = startedRecommendationRef.current;
          const returningFromStarted =
            started?.ownerKey === expectedOwnerKey ? started : null;
          const forcedReselection =
            advisorReselectionRef.current?.ownerKey === expectedOwnerKey
              ? advisorReselectionRef.current
              : null;
          const pendingFeedback = newestPendingAdvisorFeedback(outcomes);
          const nextRecommendation = returningFromStarted
            ? returningFromStarted.recommendation
            : selectAdvisorRecommendation(
                context,
                pendingFeedback
                  ? [
                      { ...pendingFeedback, offeredAt: context.nowIso },
                      ...outcomes,
                    ]
                  : outcomes,
                forcedReselection
                  ? {
                      preserveToday: false,
                      excludeRecommendationId:
                        forcedReselection.recommendationId,
                    }
                  : undefined
              );
          const activeSignals = getAdvisorChangeSignals(context, outcomes);
          const changeSignalVisible = await evaluateAdvisorChangeSignals(
            expectedOwnerKey,
            activeSignals,
            nextRecommendation.changeSignal?.id ?? null,
            context.nowIso
          );

          if (
            request !== advisorRequestRef.current ||
            advisorRefreshRef.current !== expectedRefreshKey ||
            ownerKeyRef.current !== expectedOwnerKey
          ) {
            return;
          }

          setAdvisorContext(context);
          if (forcedReselection) advisorReselectionRef.current = null;
          setAdvisorOutcomes(outcomes);
          setRecommendation(nextRecommendation);
          setAdvisorStateOwnerKey(expectedOwnerKey);
          setAdvisorChangeSignalVisibility((current) => {
            const nextSignalId = nextRecommendation.changeSignal?.id ?? null;
            const visible = keepAdvisorChangeSignalVisible(
              current?.ownerKey === expectedOwnerKey && current.visible,
              current?.ownerKey === expectedOwnerKey ? current.signalId : null,
              nextSignalId,
              changeSignalVisible
            );
            return nextSignalId
              ? {
                  ownerKey: expectedOwnerKey,
                  recommendationId: nextRecommendation.id,
                  signalId: nextSignalId,
                  visible,
                }
              : null;
          });
          setPendingCompletion(
            pendingFeedback?.recommendationId ??
              returningFromStarted?.recommendation.id ??
              null
          );
          setPendingFeedbackSignalId(
            pendingFeedback?.shownSignalId ??
              returningFromStarted?.shownSignalId ??
              null
          );

          if (!returningFromStarted && !pendingFeedback) {
            await recordAdvisorOffered(expectedOwnerKey, nextRecommendation).catch(
              () => undefined
            );
          }
        })
        .catch(() => {
          if (
            request === advisorRequestRef.current &&
            advisorRefreshRef.current === expectedRefreshKey &&
            ownerKeyRef.current === expectedOwnerKey
          ) {
            setRecommendation(GENERIC_ADVISOR_RECOMMENDATION);
            setAdvisorStateOwnerKey(expectedOwnerKey);
            setAdvisorChangeSignalVisibility(null);
            setPendingCompletion(null);
            setPendingFeedbackSignalId(null);
            setAdvisorStatus('A general step is ready. Personal context is unavailable right now.');
            void recordAdvisorOffered(
              expectedOwnerKey,
              GENERIC_ADVISOR_RECOMMENDATION
            ).catch(() => undefined);
          }
        })
        .finally(() => {
          if (
            request === advisorRequestRef.current &&
            advisorRefreshRef.current === expectedRefreshKey &&
            ownerKeyRef.current === expectedOwnerKey
          ) {
            setAdvisorBusy(false);
          }
        });

      return () => {
        if (request === advisorRequestRef.current) advisorRequestRef.current += 1;
      };
    }, [advisorRefreshKey, ownerKey, queryColumn, queryValue, user?.id])
  );

  useEffect(() => {
    const expectedOwnerKey = ownerKey;
    setLowEnergyMode(false);
    setLowEnergyOwnerKey(null);
    if (!expectedOwnerKey) return;

    let active = true;
    void dashboardPreferences
      .readLowEnergyMode(expectedOwnerKey)
      .then((enabled) => {
        if (!active || ownerKeyRef.current !== expectedOwnerKey) return;
        setLowEnergyMode(enabled);
        setLowEnergyOwnerKey(expectedOwnerKey);
      })
      .catch((error) => {
        console.warn('Unable to restore the dashboard view preference:', error);
        if (active && ownerKeyRef.current === expectedOwnerKey) {
          setLowEnergyMode(false);
          setLowEnergyOwnerKey(expectedOwnerKey);
        }
      });

    return () => {
      active = false;
    };
  }, [lowEnergyLoadAttempt, ownerKey]);

  useEffect(() => {
    const expectedOwnerKey = ownerKey;
    setMoodOwnerKey(null);
    setTodayMood(null);
    setWeekMoods([]);
    setAffirmation('');
    setAffirmationBy('');
    setMoodStatus(null);
    setSavingMood(false);
    if (!queryValue || !expectedOwnerKey) return;
    let active = true;
    const loadData = async () => {
      const localDate = getLocalCheckInFields().local_date;
      const sevenDaysAgo = getSevenDayHistoryStart();
      const [moodRes, weekRes] = await Promise.all([
        supabase.from('moods').select('emoji').eq(queryColumn, queryValue).eq('local_date', localDate).order('created_at', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('moods').select('emoji, created_at, local_date').eq(queryColumn, queryValue).gte('created_at', sevenDaysAgo).order('created_at', { ascending: false }),
      ]);
      if (!active || ownerKeyRef.current !== expectedOwnerKey) return;
      setTodayMood((moodRes.data?.emoji as MoodEmoji | undefined) ?? null);
      setWeekMoods(weekRes.data ?? []);
      setMoodOwnerKey(expectedOwnerKey);
      try {
        const catalog = await loadAffirmationCatalog(
          moodRes.data?.emoji ?? null
        );
        const selected = chooseRandomAffirmation(catalog.records);
        if (
          selected &&
          active &&
          ownerKeyRef.current === expectedOwnerKey
        ) {
          setAffirmation(selected.content);
          setAffirmationBy(selected.attribution_name ?? '');
        }
      } catch {
        if (active && ownerKeyRef.current === expectedOwnerKey) {
          setAffirmation('');
          setAffirmationBy('');
        }
      }
    };
    void loadData();
    return () => {
      active = false;
    };
  }, [moodRefreshKey, ownerKey, queryColumn, queryValue]);

  useEffect(() => {
    const ownerId = user?.id ?? null;
    setProductOwnerId(null);
    setResumeProgress(null);
    setSavedItem(null);
    if (!ownerId) return;

    let active = true;
    void Promise.all([
      supabase
        .from('practice_progress')
        .select('*')
        .eq('user_id', ownerId)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('user_library_items')
        .select('content_id, media_type, is_saved, priority, updated_at')
        .eq('user_id', ownerId)
        .or('is_saved.eq.true,priority.eq.next')
        .order('updated_at', { ascending: false }),
    ]).then(([progressResult, libraryResult]) => {
      if (!active || user?.id !== ownerId) return;
      setResumeProgress(parsePracticeProgressRow(progressResult.data));
      setProductOwnerId(ownerId);
      if (libraryResult.error) return;
      const collection = composeSavedCollection(
        UNIFIED_LIBRARY,
        (libraryResult.data ?? []) as SavedLibraryStateRow[],
        []
      );
      setSavedItem(collection.upNext[0] ?? collection.saved[0] ?? null);
    });

    return () => {
      active = false;
    };
  }, [user?.id]);

  const saveMood = async (mood: MoodEmoji) => {
    if (savingMood) return;
    if (!canSaveMood) {
      setMoodStatus({
        type: 'error',
        message: 'Your private profile is not ready. Restart the app and try again.',
      });
      return;
    }
    const expectedOwnerKey = ownerKey;
    const expectedUserId = user?.id;
    if (!expectedOwnerKey || !expectedUserId) return;
    setSavingMood(true);
    setMoodStatus(null);
    try {
      const localFields = getLocalCheckInFields();
      await saveCheckInWithAttribution(expectedUserId, {
        emoji: mood,
        ...localFields,
      });
      if (ownerKeyRef.current !== expectedOwnerKey) return;
      setTodayMood(mood);
      setWeekMoods((current) => [
        ...current.filter(
          (entry) =>
            format(new Date(entry.created_at), 'yyyy-MM-dd') !==
            format(new Date(), 'yyyy-MM-dd')
        ),
        { emoji: mood, created_at: new Date().toISOString() },
      ]);
      setMoodOwnerKey(expectedOwnerKey);
      setMoodStatus({ type: 'success', message: 'Check-in saved.' });
      setAdvisorRefreshKey((key) => key + 1);
    } catch (error) {
      if (ownerKeyRef.current !== expectedOwnerKey) return;
      console.warn('Unable to save check-in:', error);
      Alert.alert(
        'Unable to Save Check-In',
        'Your check-in was not saved. Please try again.'
      );
      setMoodStatus({
        type: 'error',
        message: 'Your check-in was not saved. Please try again.',
      });
    } finally {
      if (ownerKeyRef.current === expectedOwnerKey) setSavingMood(false);
    }
  };

  const visibleTodayMood = moodOwnerKey === ownerKey ? todayMood : null;
  const visibleWeekMoods = moodOwnerKey === ownerKey ? weekMoods : [];
  const visibleAffirmation = moodOwnerKey === ownerKey ? affirmation : '';
  const visibleAffirmationBy = moodOwnerKey === ownerKey ? affirmationBy : '';
  const visibleResumeProgress = productOwnerId === user?.id ? resumeProgress : null;
  const visibleSavedItem = productOwnerId === user?.id ? savedItem : null;
  const visibleLowEnergyMode = lowEnergyOwnerKey === ownerKey && lowEnergyMode;
  const advisorStateIsCurrent =
    Boolean(ownerKey) && advisorStateOwnerKey === ownerKey;
  const visibleAdvisorRecommendation = advisorStateIsCurrent
    ? recommendation
    : GENERIC_ADVISOR_RECOMMENDATION;
  const showAdvisorChangeSignal =
    advisorStateIsCurrent &&
    advisorChangeSignalVisibility?.ownerKey === ownerKey &&
    advisorChangeSignalVisibility.recommendationId === recommendation.id &&
    advisorChangeSignalVisibility.signalId === recommendation.changeSignal?.id &&
    advisorChangeSignalVisibility.visible;

  useEffect(() => {
    if (!advisorStateIsCurrent || !ownerKey) return;
    const previous = announcedAdvisorActionRef.current;
    const changeSignalLine = showAdvisorChangeSignal
      ? recommendation.changeSignal?.line ?? null
      : null;
    const hasPendingFeedback = pendingCompletion !== null;
    announcedAdvisorActionRef.current = {
      ownerKey,
      action: recommendation.action,
      changeSignalLine,
      pendingFeedback: hasPendingFeedback,
    };
    if (previous?.ownerKey !== ownerKey) return;
    if (previous.action !== recommendation.action) {
      AccessibilityInfo.announceForAccessibility(
        `Advisor action changed. ${recommendation.action}`
      );
    } else if (changeSignalLine && previous.changeSignalLine !== changeSignalLine) {
      AccessibilityInfo.announceForAccessibility(
        `Advisor noticed. ${changeSignalLine}`
      );
    } else if (!previous.pendingFeedback && hasPendingFeedback) {
      AccessibilityInfo.announceForAccessibility(
        'Advisor is asking whether the last suggestion was useful.'
      );
    }
  }, [
    advisorStateIsCurrent,
    ownerKey,
    pendingCompletion,
    recommendation.action,
    recommendation.changeSignal?.line,
    recommendation.id,
    showAdvisorChangeSignal,
  ]);

  const checkInDays = new Set(
    visibleWeekMoods.map((entry) => format(new Date(entry.created_at), 'yyyy-MM-dd'))
  ).size;
  const now = new Date();

  const startAdvisorRecommendation = async () => {
    if (advisorBusy) return;
    const expectedOwnerKey = ownerKey;
    if (!expectedOwnerKey || advisorStateOwnerKey !== expectedOwnerKey) {
      setAdvisorStatus('Your private profile is still getting ready.');
      return;
    }
    const selectedRecommendation = recommendation;
    setAdvisorBusy(true);
    setAdvisorStatus('');
    try {
      const shownSignalId = showAdvisorChangeSignal
        ? selectedRecommendation.changeSignal?.id ?? null
        : null;
      await markAdvisorStarted(
        expectedOwnerKey,
        selectedRecommendation.id,
        undefined,
        shownSignalId
      );
      if (ownerKeyRef.current !== expectedOwnerKey) return;
      startedRecommendationRef.current = {
        ownerKey: expectedOwnerKey,
        recommendation: selectedRecommendation,
        shownSignalId,
      };
      router.push(selectedRecommendation.route as never);
    } catch {
      if (ownerKeyRef.current === expectedOwnerKey) {
        setAdvisorStatus('This step could not be started. Please try again.');
      }
    } finally {
      if (ownerKeyRef.current === expectedOwnerKey) setAdvisorBusy(false);
    }
  };

  const answerAdvisorPrompt = async (helpful: boolean | null) => {
    if (advisorBusy || !pendingCompletion) return;
    const expectedOwnerKey = ownerKey;
    if (!expectedOwnerKey || advisorStateOwnerKey !== expectedOwnerKey) return;
    const feedbackRecommendationId = pendingCompletion;
    const displayedSignalId = pendingFeedbackSignalId;
    let shouldRefresh = false;
    setAdvisorBusy(true);
    setAdvisorStatus('');
    try {
      await answerAdvisorHelpfulness(
        expectedOwnerKey,
        feedbackRecommendationId,
        helpful
      );
      if (helpful === false && displayedSignalId) {
        await suppressAdvisorChangeSignal(expectedOwnerKey, displayedSignalId);
      }
      if (ownerKeyRef.current !== expectedOwnerKey) return;
      startedRecommendationRef.current = null;
      advisorReselectionRef.current = {
        ownerKey: expectedOwnerKey,
        recommendationId: feedbackRecommendationId,
      };
      setAdvisorChangeSignalVisibility(null);
      setPendingCompletion(null);
      setPendingFeedbackSignalId(null);
      shouldRefresh = true;
      AccessibilityInfo.announceForAccessibility(
        helpful === null
          ? 'Feedback skipped. Advisor is refreshing your action.'
          : 'Feedback saved. Advisor is refreshing your action.'
      );
    } catch {
      if (ownerKeyRef.current === expectedOwnerKey) {
        setAdvisorStatus('Your answer could not be saved. Please try again.');
      }
    } finally {
      if (ownerKeyRef.current === expectedOwnerKey) {
        setAdvisorBusy(false);
        if (shouldRefresh) setAdvisorRefreshKey((key) => key + 1);
      }
    }
  };

  const tryAnotherAdvisorRecommendation = async () => {
    if (advisorBusy) return;
    const expectedOwnerKey = ownerKey;
    const context = advisorContext;
    if (!context || !expectedOwnerKey || advisorStateOwnerKey !== expectedOwnerKey) {
      setAdvisorRefreshKey((key) => key + 1);
      return;
    }
    setAdvisorBusy(true);
    setAdvisorStatus('');
    try {
      const recent = [
        { recommendationId: recommendation.id, offeredAt: new Date().toISOString() },
        ...advisorOutcomes,
      ];
      const selectedRecommendation = selectAdvisorRecommendation(context, recent, {
        preserveToday: false,
        excludeRecommendationId: recommendation.id,
        candidateFamily: recommendation.id.split(':')[0],
      });
      const nextRecommendation: AdvisorRecommendation = {
        ...selectedRecommendation,
        observation: recommendation.observation,
        observations: recommendation.observations,
        changeSignal: recommendation.changeSignal,
        sourceLabels: Array.from(
          new Set([
            ...recommendation.sourceLabels,
            ...selectedRecommendation.sourceLabels,
          ])
        ),
      };
      await recordAdvisorOffered(expectedOwnerKey, nextRecommendation);
      const nextOutcomes = await loadAdvisorOutcomes(expectedOwnerKey);
      if (ownerKeyRef.current !== expectedOwnerKey) return;
      startedRecommendationRef.current = null;
      setRecommendation(nextRecommendation);
      setAdvisorChangeSignalVisibility((current) =>
        current?.ownerKey === expectedOwnerKey &&
        current.recommendationId === recommendation.id
          ? { ...current, recommendationId: nextRecommendation.id }
          : null
      );
      setPendingCompletion(null);
      setPendingFeedbackSignalId(null);
      setAdvisorOutcomes(nextOutcomes);
    } catch {
      if (ownerKeyRef.current === expectedOwnerKey) {
        setAdvisorStatus('Another step could not be loaded. Please try again.');
      }
    } finally {
      if (ownerKeyRef.current === expectedOwnerKey) setAdvisorBusy(false);
    }
  };

  return (
    <AppScreen>
      <View style={s.brandRow}>
        <View style={s.brandIdentity}>
          <LeafMark size={34} />
          <Text style={s.brand}>MHtoolkit</Text>
        </View>
        <SupportAction label="Support" onPress={() => router.push('/resources')} />
      </View>

      <Text style={s.date}>{format(now, 'MMMM d, yyyy').toUpperCase()}</Text>
      <Text accessibilityRole="header" style={s.title}>
        {greetingForHour(now.getHours())}
      </Text>
      <Text style={s.subtitle}>
        {visibleLowEnergyMode
          ? 'You only need one small step.'
          : visibleAffirmation || 'Start with what you can notice and control.'}
      </Text>
      {!visibleLowEnergyMode && visibleAffirmationBy ? (
        <Text style={s.attribution}>— {visibleAffirmationBy}</Text>
      ) : null}

      <AdvisorHomeCard
        recommendation={visibleAdvisorRecommendation}
        showChangeSignal={showAdvisorChangeSignal}
        busy={advisorBusy || !advisorStateIsCurrent}
        pendingFeedback={advisorStateIsCurrent && pendingCompletion !== null}
        onStart={() => void startAdvisorRecommendation()}
        onTryAnother={() => void tryAnotherAdvisorRecommendation()}
        onAnswerFeedback={(helpful) => void answerAdvisorPrompt(helpful)}
      />
      {advisorStatus ? <InlineStatus tone="info" message={advisorStatus} /> : null}

      <View style={s.moodSection}>
        <Text style={s.moodLabel}>HOW ARE YOU?</Text>
        <MoodPicker
          value={visibleTodayMood}
          onChange={(mood) => void saveMood(mood)}
          disabled={savingMood || !canSaveMood}
        />
        {moodStatus ? (
          <InlineStatus
            tone={moodStatus.type}
            message={moodStatus.type === 'success' ? 'Saved. That is enough for now.' : moodStatus.message}
            action={moodStatus.type === 'success' ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push('/(tabs)/tracker')}
                style={s.addDetailsButton}
              >
                <Text style={s.addDetailsButtonText}>Add context</Text>
              </Pressable>
            ) : undefined}
          />
        ) : null}
      </View>

      <Text style={s.sectionLabel}>YOUR DAY</Text>
      <View style={s.dayList}>
        <ListRow
          icon="users"
          title="Together"
          description={
            isAuthenticated
              ? 'Share one commitment with someone you trust.'
              : 'Set up an accountability partner when you’re ready.'
          }
          onPress={() => router.push('/accountability')}
        />
            {visibleResumeProgress ? (
              <ListRow
                icon="play-circle"
                title="Resume your practice"
                description="Continue where you paused"
                onPress={() => router.push(visibleResumeProgress.route)}
              />
            ) : null}
            {visibleSavedItem ? (
              <ListRow
                icon="bookmark"
                title={visibleSavedItem.title}
                description="Saved for later"
                onPress={() => router.push('/saved')}
              />
            ) : null}
            {checkInDays > 0 ? (
              <>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ expanded: patternsOpen }}
                  onPress={() => setPatternsOpen((current) => !current)}
                  style={({ pressed }) => [s.patternsRow, pressed && s.pressed]}
                >
                  <View style={s.patternsIcon}>
                    <Feather name="trending-up" size={19} color={Colors.primary} />
                  </View>
                  <View style={s.patternsCopy}>
                    <Text style={s.patternsTitle}>Patterns</Text>
                    <Text style={s.patternsDescription}>
                      {`${checkInDays} check-in ${checkInDays === 1 ? 'day' : 'days'} this week`}
                    </Text>
                  </View>
                  <Feather name={patternsOpen ? 'chevron-up' : 'chevron-down'} size={19} color={Colors.primary} />
                </Pressable>
                {patternsOpen ? (
                  <View style={s.weekRow}>
                    {Array.from({ length: 7 }).map((_, i) => {
                      const date = subDays(new Date(), 6 - i);
                      const dayMood = getLatestCheckInForDate(visibleWeekMoods, date);
                      return (
                        <View
                          key={format(date, 'yyyy-MM-dd')}
                          accessible
                          accessibilityLabel={`${format(date, 'EEEE')}, ${dayMood ? `${getMoodLabel(dayMood.emoji as MoodEmoji)} mood` : 'no check-in'}`}
                          style={s.weekDay}
                        >
                          <View style={[s.weekMarker, dayMood && s.weekMarkerActive]}>
                            {dayMood ? <MoodGlyph mood={dayMood.emoji as MoodEmoji} size={20} /> : <Text style={s.weekEmpty}>–</Text>}
                          </View>
                          <Text style={s.weekLabel}>{format(date, 'EEE')}</Text>
                        </View>
                      );
                    })}
                  </View>
                ) : null}
              </>
            ) : null}
      </View>
    </AppScreen>
  );
}

const s = StyleSheet.create({
  brandRow: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  brandIdentity: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  brand: { color: Colors.text, fontFamily: 'Georgia', fontSize: 22, fontWeight: '700' },
  date: { color: Colors.accent, ...Typography.eyebrow, marginBottom: Spacing.xs },
  title: { color: Colors.text, ...Typography.display, fontSize: 27, lineHeight: 33, marginBottom: Spacing.xs, maxWidth: 600 },
  subtitle: { color: Colors.textSecondary, ...Typography.body, fontSize: 14, lineHeight: 20 },
  attribution: { color: Colors.textSecondary, ...Typography.caption, marginTop: Spacing.xs },
  moodSection: { marginBottom: Spacing.md },
  moodLabel: { color: Colors.textSecondary, ...Typography.eyebrow, marginBottom: Spacing.xs },
  sectionLabel: { color: Colors.text, ...Typography.eyebrow, marginBottom: Spacing.sm },
  addDetailsButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 4 },
  addDetailsButtonText: { color: Colors.primary, fontSize: 13, fontWeight: '700' },
  dayList: { marginBottom: Spacing.xl },
  patternsRow: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  patternsIcon: { width: 42, alignItems: 'center', justifyContent: 'center' },
  patternsCopy: { flex: 1 },
  patternsTitle: { color: Colors.text, ...Typography.cardTitle },
  patternsDescription: { color: Colors.textSecondary, ...Typography.bodySmall, marginTop: Spacing.xxs },
  weekRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  weekDay: { flex: 1, alignItems: 'center' },
  weekMarker: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.background, alignItems: 'center', justifyContent: 'center' },
  weekMarkerActive: { backgroundColor: Colors.primaryLight },
  weekEmpty: { color: Colors.textSecondary, fontSize: 17 },
  weekLabel: { fontSize: 11, color: Colors.textSecondary, marginTop: 4 },
  pressed: { opacity: 0.76 },
});
