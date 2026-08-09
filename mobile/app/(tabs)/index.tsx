import { useEffect, useRef, useState } from 'react';
import { Alert, View, Text, ScrollView, TouchableOpacity, StyleSheet, Share } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { Colors } from '@/lib/constants';
import { format, subDays, startOfDay } from 'date-fns';
import type { MoodEmoji } from '@/lib/types';
import { saveCheckInWithAttribution } from '@/lib/acquisition';
import {
  getLatestCheckInForDate,
  getLocalCheckInFields,
  getSevenDayHistoryStart,
} from '@/lib/check-in';
import { chooseRandomAffirmation } from '@/lib/affirmations';
import { loadAffirmationCatalog } from '@/lib/affirmations-client';
import { GoToActions } from '@/components/GoToActions';
import { getMoodLabel, MoodGlyph, MoodPicker } from '@/components/MoodPicker';
import { WeeklyInsight } from '@/components/weekly-insight';
import {
  loadWeeklyOwnerSummary,
  type WeeklyOwnerSummary,
  type WeeklySummaryRpc,
} from '@/lib/weekly-insights';
import { UNIFIED_LIBRARY } from '@/lib/library/content';
import {
  composeSavedCollection,
  parsePracticeProgressRow,
  type PracticeProgressRow,
  type SavedLibraryStateRow,
  type SavedLibraryViewItem,
} from '@/lib/product-state';

const CHALLENGE_SHARE_URL =
  'https://mhtoolkit.vercel.app/?utm_source=referral&utm_medium=referral&utm_campaign=seven_day_check_in&utm_content=member_share';

export default function DashboardScreen() {
  const router = useRouter();
  const { user, sessionId, isAuthenticated } = useAuth();
  const [todayMood, setTodayMood] = useState<MoodEmoji | null>(null);
  const [weekMoods, setWeekMoods] = useState<any[]>([]);
  const [affirmation, setAffirmation] = useState('');
  const [affirmationBy, setAffirmationBy] = useState('');
  const [savingMood, setSavingMood] = useState(false);
  const [lowEnergyMode, setLowEnergyMode] = useState(false);
  const [moodStatus, setMoodStatus] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  const [weeklySummary, setWeeklySummary] =
    useState<WeeklyOwnerSummary | null>(null);
  const [resumeProgress, setResumeProgress] =
    useState<PracticeProgressRow | null>(null);
  const [savedItem, setSavedItem] = useState<SavedLibraryViewItem | null>(null);
  const [moodOwnerKey, setMoodOwnerKey] = useState<string | null>(null);
  const [weeklyOwnerId, setWeeklyOwnerId] = useState<string | null>(null);
  const [productOwnerId, setProductOwnerId] = useState<string | null>(null);

  const queryColumn = isAuthenticated ? 'user_id' : 'session_id';
  const queryValue = isAuthenticated ? user?.id : sessionId;
  const ownerKey = queryValue ? `${queryColumn}:${queryValue}` : null;
  const ownerKeyRef = useRef(ownerKey);
  ownerKeyRef.current = ownerKey;
  const canSaveMood = Boolean(queryValue && user?.id);
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
      const todayStart = startOfDay(new Date()).toISOString();
      const sevenDaysAgo = getSevenDayHistoryStart();
      const [moodRes, weekRes] = await Promise.all([
        supabase.from('moods').select('emoji').eq(queryColumn, queryValue).gte('created_at', todayStart).order('created_at', { ascending: false }).limit(1).single(),
        supabase.from('moods').select('emoji, created_at').eq(queryColumn, queryValue).gte('created_at', sevenDaysAgo).order('created_at', { ascending: false }),
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
  }, [ownerKey, queryColumn, queryValue]);

  useEffect(() => {
    const ownerId = user?.id ?? null;
    setWeeklyOwnerId(null);
    setWeeklySummary(null);
    if (!ownerId) return;

    let active = true;
    const rpc: WeeklySummaryRpc = async (args) => {
      const result = await supabase.rpc('weekly_owner_summary', args);
      return { data: result.data, error: result.error };
    };
    void loadWeeklyOwnerSummary(rpc)
      .then((summary) => {
        if (active && user?.id === ownerId) {
          setWeeklySummary(summary);
          setWeeklyOwnerId(ownerId);
        }
      })
      .catch(() => {
        if (active && user?.id === ownerId) setWeeklySummary(null);
      });

    return () => {
      active = false;
    };
  }, [user?.id]);

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
      await saveCheckInWithAttribution(expectedUserId, {
        emoji: mood,
        ...getLocalCheckInFields(),
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

  const lowEnergyActions = [
    { label: 'Ground me', icon: 'compass' as const, route: '/ground' as const },
    { label: 'One small step', icon: 'repeat' as const, route: '/habits' as const },
    { label: 'Write a note', icon: 'edit-3' as const, route: '/journal' as const },
  ];
  const visibleTodayMood = moodOwnerKey === ownerKey ? todayMood : null;
  const visibleWeekMoods = moodOwnerKey === ownerKey ? weekMoods : [];
  const visibleAffirmation = moodOwnerKey === ownerKey ? affirmation : '';
  const visibleAffirmationBy = moodOwnerKey === ownerKey ? affirmationBy : '';
  const visibleWeeklySummary = weeklyOwnerId === user?.id ? weeklySummary : null;
  const visibleResumeProgress = productOwnerId === user?.id ? resumeProgress : null;
  const visibleSavedItem = productOwnerId === user?.id ? savedItem : null;
  const challengeDays = new Set(
    visibleWeekMoods.map((entry) => format(new Date(entry.created_at), 'yyyy-MM-dd'))
  ).size;

  const shareChallenge = async () => {
    try {
      await Share.share({
        message:
          `I found a private 30-second check-in with no signup required. ` +
          `Try it for seven days: ${CHALLENGE_SHARE_URL}`,
      });
    } catch (error) {
      console.warn('Unable to share challenge:', error);
    }
  };

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      <View style={s.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={s.eyebrow}>{lowEnergyMode ? 'ONE STEP' : 'TODAY'}</Text>
          <Text style={s.title}>{lowEnergyMode ? 'Keep it simple' : 'How are you today?'}</Text>
          <Text style={s.subtitle}>
            {lowEnergyMode ? 'Choose one thing. You can stop there.' : 'Start with a quick, private check-in.'}
          </Text>
        </View>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityState={{ selected: lowEnergyMode }}
          accessibilityLabel={lowEnergyMode ? 'Show full dashboard' : 'Use low-energy view'}
          style={s.energyToggle}
          onPress={() => setLowEnergyMode((current) => !current)}
        >
          <Feather name={lowEnergyMode ? 'sun' : 'battery'} size={17} color={Colors.primary} />
          <Text style={s.energyToggleText}>{lowEnergyMode ? 'Full view' : 'Low energy'}</Text>
        </TouchableOpacity>
      </View>

      {/* Mood Check-in */}
      <View style={[s.card, s.checkInCard]}>
        <View style={s.cardHeadingRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.cardTitle}>Name the feeling</Text>
            <Text style={s.cardSubtitle}>No score. Just a moment to notice.</Text>
          </View>
          {visibleTodayMood ? (
            <View style={s.todayMood}>
              <MoodGlyph mood={visibleTodayMood} size={25} />
            </View>
          ) : null}
        </View>
        <MoodPicker
          value={visibleTodayMood}
          onChange={(mood) => void saveMood(mood)}
          disabled={savingMood || !canSaveMood}
        />
        {moodStatus ? (
          <Text
            accessibilityRole={moodStatus.type === 'error' ? 'alert' : 'text'}
            style={[
              s.moodStatus,
              moodStatus.type === 'error' && s.moodStatusError,
            ]}
          >
            {moodStatus.message}
          </Text>
        ) : null}
      </View>

      {/* Week Overview */}
      {!lowEnergyMode ? <View style={[s.card, s.weekCard]}>
        <View style={s.cardHeadingRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.cardTitle}>Last 7 days</Text>
            <Text style={s.cardSubtitle}>Your recent check-ins</Text>
          </View>
          <Feather name="calendar" size={18} color={Colors.sage} />
        </View>
        <View style={s.weekRow}>
          {Array.from({ length: 7 }).map((_, i) => {
            const date = subDays(new Date(), 6 - i);
            const dayMood = getLatestCheckInForDate(visibleWeekMoods, date);
            return (
              <View
                key={i}
                accessible
                accessibilityLabel={`${format(date, 'EEEE')}, ${
                  dayMood
                    ? `${getMoodLabel(dayMood.emoji as MoodEmoji)} mood`
                    : 'no check-in'
                }`}
                style={s.weekDay}
              >
                <View style={[s.weekMarker, dayMood && s.weekMarkerActive]}>
                  {dayMood ? (
                    <MoodGlyph mood={dayMood.emoji as MoodEmoji} size={20} />
                  ) : (
                    <Text style={s.weekEmoji}>–</Text>
                  )}
                </View>
                <Text style={s.weekLabel}>{format(date, 'EEE')}</Text>
              </View>
            );
          })}
        </View>
      </View> : null}

      {visibleWeeklySummary && !lowEnergyMode ? (
        <WeeklyInsight summary={visibleWeeklySummary} />
      ) : null}

      {!lowEnergyMode && (visibleResumeProgress || visibleSavedItem) ? (
        <View style={s.continueGrid} accessibilityLabel="Continue and saved">
          {visibleResumeProgress ? (
            <TouchableOpacity
              accessibilityRole="button"
              style={s.continueCard}
              onPress={() => router.push(visibleResumeProgress.route)}
            >
              <Text style={s.continueEyebrow}>CONTINUE</Text>
              <Text style={s.continueTitle}>Resume meditation</Text>
              <Text style={s.continueCopy}>Return to your paused practice.</Text>
            </TouchableOpacity>
          ) : null}
          {visibleSavedItem ? (
            <TouchableOpacity
              accessibilityRole="button"
              style={s.continueCard}
              onPress={() => router.push('/saved')}
            >
              <Text style={s.continueEyebrow}>SAVED FOR LATER</Text>
              <Text style={s.continueTitle}>{visibleSavedItem.title}</Text>
              <Text style={s.continueCopy}>Open your saved space.</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}

      {visibleTodayMood && !lowEnergyMode ? (
        <View style={s.challengeCard}>
          <Text style={s.challengeEyebrow}>7-DAY PRIVATE CHECK-IN</Text>
          <Text style={s.challengeTitle}>{Math.min(challengeDays, 7)} of 7 check-in days</Text>
          <View
            style={s.challengeProgress}
            accessibilityLabel={`${Math.min(challengeDays, 7)} of 7 days complete`}
          >
            {Array.from({ length: 7 }).map((_, index) => (
              <View
                key={index}
                style={[s.challengeBar, index < challengeDays && s.challengeBarDone]}
              />
            ))}
          </View>
          <Text style={s.challengeCopy}>A missed day does not reset your progress.</Text>
          <TouchableOpacity
            style={s.shareBtn}
            onPress={shareChallenge}
            accessibilityRole="button"
            accessibilityLabel="Invite someone to try the 7-day private check-in"
          >
            <Text style={s.shareBtnText}>Invite someone</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* Affirmation */}
      {visibleAffirmation && !lowEnergyMode ? (
        <View style={[s.card, { backgroundColor: Colors.primaryLight }]}>
          <Feather
            name={visibleAffirmationBy ? 'message-circle' : 'sun'}
            size={21}
            color={Colors.primary}
            style={{ alignSelf: 'center', marginBottom: 12 }}
          />
          <Text style={s.affirmationText}>{visibleAffirmation}</Text>
          <Text style={s.affirmationLabel}>
            {visibleAffirmationBy || 'Daily affirmation'}
          </Text>
        </View>
      ) : null}

      {lowEnergyMode ? (
        <View style={s.card}>
          <Text style={s.cardTitle}>Choose one</Text>
          <View style={s.actionsGrid}>
            {lowEnergyActions.map((action) => (
              <TouchableOpacity
                key={action.route}
                style={s.actionBtn}
                onPress={() => router.push(action.route)}
              >
                <Feather name={action.icon} size={18} color={Colors.primary} />
                <Text style={s.actionLabel}>{action.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ) : (
        <GoToActions
          key={ownerKey ?? 'pending'}
          ownerKey={ownerKey}
          onNavigate={(route) => router.push(route)}
        />
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 18, paddingBottom: 42 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 22 },
  eyebrow: { color: Colors.accent, fontSize: 11, lineHeight: 14, fontWeight: '800', letterSpacing: 1.7, marginBottom: 6 },
  title: { fontSize: 30, lineHeight: 35, fontWeight: '700', letterSpacing: -0.6, color: Colors.text, marginBottom: 5 },
  subtitle: { fontSize: 15, lineHeight: 21, color: Colors.textSecondary },
  energyToggle: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: Colors.border, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 9, backgroundColor: Colors.card },
  energyToggleText: { color: Colors.primary, fontSize: 12, fontWeight: '700' },
  card: { backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border, borderRadius: 18, padding: 17, marginBottom: 13, shadowColor: '#163a32', shadowOpacity: 0.055, shadowRadius: 14, shadowOffset: { width: 0, height: 7 }, elevation: 2 },
  checkInCard: { paddingBottom: 15 },
  cardHeadingRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 14 },
  cardTitle: { fontSize: 19, lineHeight: 24, fontWeight: '700', color: Colors.text },
  cardSubtitle: { fontSize: 13, lineHeight: 18, color: Colors.textSecondary, marginTop: 3 },
  todayMood: { minWidth: 31, minHeight: 31, alignItems: 'center', justifyContent: 'center' },
  moodStatus: { color: Colors.primary, fontSize: 13, marginTop: 12 },
  moodStatusError: { color: '#b42318' },
  weekCard: { paddingBottom: 15 },
  weekRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  weekDay: { flex: 1, alignItems: 'center' },
  weekMarker: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.background, alignItems: 'center', justifyContent: 'center' },
  weekMarkerActive: { backgroundColor: Colors.primaryLight },
  weekEmoji: { color: Colors.textSecondary, fontSize: 17, lineHeight: 22 },
  weekLabel: { fontSize: 11, color: Colors.textSecondary, marginTop: 4 },
  challengeCard: { backgroundColor: '#edf4ea', borderWidth: 1, borderColor: '#bfd0c4', borderRadius: 16, padding: 20, marginBottom: 16 },
  challengeEyebrow: { color: '#a84c34', fontSize: 11, fontWeight: '700', letterSpacing: 1.4 },
  challengeTitle: { color: '#173d34', fontSize: 20, fontWeight: '700', marginTop: 8 },
  challengeProgress: { flexDirection: 'row', gap: 6, marginTop: 16 },
  challengeBar: { flex: 1, height: 8, borderRadius: 8, backgroundColor: '#cbd8ce' },
  challengeBarDone: { backgroundColor: '#c65f3d' },
  challengeCopy: { color: '#587169', fontSize: 13, marginTop: 12 },
  continueGrid: { gap: 10, marginBottom: 16 },
  continueCard: {
    backgroundColor: Colors.card,
    borderColor: Colors.border,
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
  continueEyebrow: {
    color: Colors.accent,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.3,
  },
  continueTitle: {
    color: Colors.text,
    fontSize: 17,
    fontWeight: '700',
    marginTop: 6,
  },
  continueCopy: { color: Colors.textSecondary, fontSize: 13, marginTop: 3 },
  shareBtn: { alignSelf: 'flex-start', borderWidth: 1, borderColor: '#9db4a6', backgroundColor: '#fff', borderRadius: 999, paddingVertical: 10, paddingHorizontal: 16, marginTop: 16 },
  shareBtnText: { color: '#24483e', fontSize: 14, fontWeight: '600' },
  affirmationText: { fontSize: 18, fontStyle: 'italic', color: Colors.text, textAlign: 'center', marginBottom: 8 },
  affirmationLabel: { fontSize: 13, color: Colors.textSecondary, textAlign: 'center' },
  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.background, borderWidth: 1, borderColor: Colors.border, borderRadius: 10, paddingVertical: 12, paddingHorizontal: 14, width: '48%' as any },
  actionLabel: { fontSize: 14, color: Colors.text, fontWeight: '500' },
});
