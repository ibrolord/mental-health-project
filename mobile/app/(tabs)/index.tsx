import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { Colors, Radius, Spacing, Typography } from '@/lib/constants';
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
import { AppScreen, InlineStatus, ListRow } from '@/components/AppUI';
import { UNIFIED_LIBRARY } from '@/lib/library/content';
import {
  composeSavedCollection,
  parsePracticeProgressRow,
  type PracticeProgressRow,
  type SavedLibraryStateRow,
  type SavedLibraryViewItem,
} from '@/lib/product-state';
import {
  createDashboardPreferenceWriter,
  dashboardPreferences,
} from '@/lib/dashboard-preferences';

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
  const [lowEnergyLoadError, setLowEnergyLoadError] = useState(false);
  const [lowEnergyLoadAttempt, setLowEnergyLoadAttempt] = useState(0);
  const [viewPreferenceError, setViewPreferenceError] = useState(false);
  const preferenceWriterRef = useRef(
    createDashboardPreferenceWriter(dashboardPreferences)
  );
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

  useEffect(() => {
    const expectedOwnerKey = ownerKey;
    setLowEnergyMode(false);
    setLowEnergyOwnerKey(null);
    setLowEnergyLoadError(false);
    setViewPreferenceError(false);
    preferenceWriterRef.current.invalidate();
    if (!expectedOwnerKey) return;

    let active = true;
    void dashboardPreferences
      .readLowEnergyMode(expectedOwnerKey)
      .then((enabled) => {
        if (!active || ownerKeyRef.current !== expectedOwnerKey) return;
        preferenceWriterRef.current.hydrate(expectedOwnerKey, enabled);
        setLowEnergyMode(enabled);
        setLowEnergyOwnerKey(expectedOwnerKey);
      })
      .catch((error) => {
        console.warn('Unable to restore the dashboard view preference:', error);
        if (active && ownerKeyRef.current === expectedOwnerKey) {
          setLowEnergyLoadError(true);
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
  const checkInDays = new Set(
    visibleWeekMoods.map((entry) => format(new Date(entry.created_at), 'yyyy-MM-dd'))
  ).size;

  const nextStep =
    visibleLowEnergyMode || visibleTodayMood === '😞' || visibleTodayMood === '😢'
      ? {
          eyebrow: 'FOR RIGHT NOW',
          title: 'Steady myself',
          description: 'A 90-second grounding practice to help you reconnect with the present.',
          label: 'Start 90-second practice',
          icon: 'wind' as const,
          route: '/ground' as const,
        }
      : visibleTodayMood === '😄' || visibleTodayMood === '🙂'
        ? {
            eyebrow: 'BUILD ON THIS MOMENT',
            title: 'Choose one meaningful step',
            description: 'Use the energy you have without filling the whole day.',
            label: 'Open my goals',
            icon: 'flag' as const,
            route: '/goals' as const,
          }
        : {
            eyebrow: 'FOR RIGHT NOW',
            title: 'Take one small step',
            description: 'Choose something realistic enough to begin today.',
            label: 'Choose a next step',
            icon: 'arrow-right' as const,
            route: '/habits' as const,
          };

  if (ownerKey && lowEnergyOwnerKey !== ownerKey) {
    return (
      <AppScreen>
        <View style={s.brandRow}>
          <Text style={s.brand}>MHtoolkit</Text>
        </View>
        <View style={s.preferenceLoadingCard}>
          {lowEnergyLoadError ? (
            <>
              <Text accessibilityRole="alert" style={s.preferenceError}>
                Your saved dashboard view could not be loaded.
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Retry loading dashboard view"
                onPress={() => setLowEnergyLoadAttempt((attempt) => attempt + 1)}
                style={s.preferenceRetry}
              >
                <Text style={s.preferenceRetryText}>Retry</Text>
              </Pressable>
            </>
          ) : (
            <ActivityIndicator accessibilityLabel="Loading dashboard view" color={Colors.primary} />
          )}
        </View>
      </AppScreen>
    );
  }

  return (
    <AppScreen>
      <View style={s.brandRow}>
        <Text style={s.brand}>MHtoolkit</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Get urgent and local support"
          onPress={() => router.push('/resources')}
          style={({ pressed }) => [s.supportAction, pressed && s.pressed]}
        >
          <Feather name="life-buoy" size={19} color={Colors.accent} />
          <Text style={s.supportText}>Get support</Text>
        </Pressable>
      </View>

      <Text style={s.date}>{format(new Date(), 'MMMM d, yyyy').toUpperCase()}</Text>
      <Text accessibilityRole="header" style={s.title}>
        {visibleLowEnergyMode ? 'You only need one small step.' : 'You’re doing enough for today.'}
      </Text>
      <Text style={s.subtitle}>
        {visibleAffirmation || 'Start with what you can notice and control.'}
      </Text>
      {visibleAffirmationBy ? <Text style={s.attribution}>— {visibleAffirmationBy}</Text> : null}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          isAuthenticated
            ? 'Open Together accountability partner'
            : 'Set up Together accountability partner'
        }
        accessibilityHint="Share a commitment and check in with someone you trust"
        onPress={() => router.push('/accountability')}
        style={({ pressed }) => [
          s.togetherCard,
          visibleLowEnergyMode && s.togetherCardCompact,
          pressed && s.pressed,
        ]}
      >
        <View style={s.togetherLeaf}>
          <MaterialCommunityIcons
            accessible={false}
            name="leaf"
            size={24}
            color={Colors.primary}
          />
        </View>
        <View style={s.togetherCopy}>
          <Text style={s.togetherEyebrow}>ACCOUNTABILITY PARTNER</Text>
          <Text style={s.togetherTitle}>Do it together</Text>
          {!visibleLowEnergyMode ? (
            <Text style={s.togetherDescription}>
              {isAuthenticated
                ? 'Share one commitment, check in, and celebrate progress.'
                : 'Invite someone you trust and share only what you choose.'}
            </Text>
          ) : null}
        </View>
        <View style={s.togetherArrow}>
          <Feather name="arrow-right" size={20} color={Colors.primary} />
        </View>
      </Pressable>

      {viewPreferenceError ? (
        <InlineStatus
          tone="error"
          message="Your saved view could not be restored. This simpler view is still available."
        />
      ) : null}

      <View style={s.moodSection}>
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

      <View style={s.nextStepCard}>
        <View pointerEvents="none" style={s.nextStepArtwork}>
          <Image
            accessible={false}
            source={require('../../assets/today-botanical.png')}
            resizeMode="cover"
            style={StyleSheet.absoluteFillObject}
          />
        </View>
        <View style={s.nextStepContent}>
          <Text style={s.nextStepEyebrow}>{nextStep.eyebrow}</Text>
          <Text accessibilityRole="header" style={s.nextStepTitle}>{nextStep.title}</Text>
          <Text style={s.nextStepCopy}>{nextStep.description}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={nextStep.label}
            onPress={() => router.push(nextStep.route)}
            style={({ pressed }) => [s.nextStepButton, pressed && s.pressed]}
          >
            <Feather name={nextStep.icon} size={18} color={Colors.card} />
            <Text style={s.nextStepButtonText}>{nextStep.label}</Text>
          </Pressable>
        </View>
      </View>

      <Text style={s.sectionLabel}>YOUR DAY</Text>
      <View style={s.dayList}>
        <ListRow
          icon={visibleResumeProgress ? 'play-circle' : 'sun'}
          title={visibleResumeProgress ? 'Resume your practice' : 'Morning reset'}
          description={visibleResumeProgress ? 'Continue where you paused' : 'A gentle routine · 10 min'}
          onPress={() => router.push(visibleResumeProgress?.route ?? '/plans')}
        />
        <ListRow
          icon={visibleSavedItem ? 'bookmark' : 'flag'}
          title={visibleSavedItem?.title ?? 'Choose today’s priority'}
          description={visibleSavedItem ? 'Saved for later' : 'Goal · one next step'}
          onPress={() => router.push(visibleSavedItem ? '/saved' : '/goals')}
        />
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
              {checkInDays > 0 ? `${checkInDays} check-in ${checkInDays === 1 ? 'day' : 'days'} this week` : 'See how things shift over time'}
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
  brand: { color: Colors.text, fontFamily: 'Georgia', fontSize: 22, fontWeight: '700' },
  supportAction: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  supportText: { color: Colors.text, ...Typography.label },
  date: { color: Colors.accent, ...Typography.eyebrow, marginBottom: Spacing.xs },
  title: { color: Colors.text, ...Typography.display, fontSize: 27, lineHeight: 33, marginBottom: Spacing.xs, maxWidth: 600 },
  subtitle: { color: Colors.textSecondary, ...Typography.body, fontSize: 14, lineHeight: 20 },
  attribution: { color: Colors.textSecondary, ...Typography.caption, marginTop: Spacing.xs },
  moodSection: { marginTop: Spacing.sm, marginBottom: Spacing.md },
  sectionLabel: { color: Colors.text, ...Typography.eyebrow, marginBottom: Spacing.sm },
  addDetailsButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 4 },
  addDetailsButtonText: { color: Colors.primary, fontSize: 13, fontWeight: '700' },
  preferenceLoadingCard: { minHeight: 160, alignItems: 'center', justifyContent: 'center' },
  preferenceError: { color: '#b42318', fontSize: 13, lineHeight: 18, marginBottom: 10 },
  preferenceRetry: { minHeight: 42, justifyContent: 'center', paddingHorizontal: 12 },
  preferenceRetryText: { color: Colors.primary, fontSize: 13, fontWeight: '700' },
  nextStepCard: {
    minHeight: 188,
    overflow: 'hidden',
    borderRadius: Radius.lg,
    backgroundColor: '#f3efe3',
    marginBottom: Spacing.xl,
  },
  nextStepArtwork: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  nextStepContent: {
    minHeight: 188,
    padding: Spacing.md,
    justifyContent: 'center',
  },
  nextStepEyebrow: { color: Colors.text, ...Typography.eyebrow, marginBottom: Spacing.sm },
  nextStepTitle: { color: Colors.text, ...Typography.display, fontSize: 25, lineHeight: 29, maxWidth: '70%' },
  nextStepCopy: { color: Colors.textSecondary, ...Typography.bodySmall, lineHeight: 18, maxWidth: '66%', marginTop: Spacing.xs },
  nextStepButton: {
    alignSelf: 'flex-start',
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    borderRadius: Radius.md,
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.md,
    marginTop: Spacing.sm,
  },
  nextStepButtonText: { color: Colors.card, ...Typography.label },
  togetherCard: {
    minHeight: 104,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    borderWidth: 1,
    borderColor: '#c7d7c8',
    borderRadius: Radius.lg,
    backgroundColor: '#e9f1e8',
    padding: Spacing.md,
    marginTop: Spacing.md,
    marginBottom: Spacing.md,
  },
  togetherCardCompact: { minHeight: 88 },
  togetherLeaf: {
    width: 44,
    height: 44,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
    backgroundColor: Colors.card,
  },
  togetherCopy: { flex: 1 },
  togetherEyebrow: { color: Colors.accent, ...Typography.eyebrow, marginBottom: Spacing.xxs },
  togetherTitle: { color: Colors.text, ...Typography.cardTitle },
  togetherDescription: { color: Colors.textSecondary, ...Typography.bodySmall, lineHeight: 18, marginTop: Spacing.xxs },
  togetherArrow: {
    width: 32,
    height: 44,
    flexShrink: 0,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
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
