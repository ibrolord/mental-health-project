import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { format } from 'date-fns';
import { useFocusEffect, useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { Colors, Spacing, Typography } from '@/lib/constants';
import type { MoodEmoji } from '@/lib/types';
import { saveCheckInWithAttribution } from '@/lib/acquisition';
import { getLocalCheckInFields } from '@/lib/check-in';
import { chooseRandomAffirmation } from '@/lib/affirmations';
import { loadAffirmationCatalog } from '@/lib/affirmations-client';
import { MoodPicker } from '@/components/MoodPicker';
import { AdvisorHomeCard } from '@/components/AdvisorHomeCard';
import {
  AppScreen,
  InlineStatus,
  ListRow,
  RowGroup,
  SectionHeader,
  SupportAction,
} from '@/components/AppUI';
import { BotanicalHero } from '@/components/BotanicalHero';
import { loadAmbientAdvisorContext } from '@/lib/advisor-context';
import { hasUnsafeAdvisorContext } from '@/lib/advisor-core';
import {
  loadAdvisorAction,
  type AdvisorActionInstance,
} from '@/lib/advisor-action-storage';
import { dashboardPreferences } from '@/lib/dashboard-preferences';
import { dashboardModuleById, dashboardModulesForToday } from '@/lib/dashboard-layout';
import { useDashboardLayout } from '@/lib/use-dashboard-layout';
import { useAdvisorProfile } from '@/lib/use-advisor-profile';
import { useLaunchMotion } from '@/components/LaunchExperience';

function greetingForHour(hour: number): string {
  if (hour < 12) return 'Good morning.';
  if (hour < 17) return 'Good afternoon.';
  return 'Good evening.';
}

export default function DashboardScreen() {
  const router = useRouter();
  const { user, sessionId, isAuthenticated } = useAuth();
  const [todayMood, setTodayMood] = useState<MoodEmoji | null>(null);
  const [affirmation, setAffirmation] = useState('');
  const [affirmationBy, setAffirmationBy] = useState('');
  const [savingMood, setSavingMood] = useState(false);
  const [moodStatus, setMoodStatus] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  const [moodOwnerKey, setMoodOwnerKey] = useState<string | null>(null);
  const [moodRefreshKey, setMoodRefreshKey] = useState(0);
  const [lowEnergyMode, setLowEnergyMode] = useState(false);
  const [lowEnergyOwnerKey, setLowEnergyOwnerKey] = useState<string | null>(null);
  const [lowEnergyLoadAttempt, setLowEnergyLoadAttempt] = useState(0);
  const [safetyOwnerKey, setSafetyOwnerKey] = useState<string | null>(null);
  const [showAdvisorSafety, setShowAdvisorSafety] = useState(false);
  const [advisorAction, setAdvisorAction] = useState<AdvisorActionInstance | null>(null);
  const [advisorActionOwnerKey, setAdvisorActionOwnerKey] = useState<string | null>(null);
  const launchMotion = useLaunchMotion();

  const queryColumn = isAuthenticated ? 'user_id' : 'session_id';
  const queryValue = isAuthenticated ? user?.id : sessionId;
  const ownerKey = queryValue ? `${queryColumn}:${queryValue}` : null;
  const ownerKeyRef = useRef(ownerKey);
  const focusedMoodOwnerRef = useRef<string | null>(null);
  ownerKeyRef.current = ownerKey;
  const canSaveMood = Boolean(queryValue && user?.id);
  const { layout: dashboardLayout } = useDashboardLayout(ownerKey);
  const { profile: advisorProfile } = useAdvisorProfile(ownerKey);

  useFocusEffect(
    useCallback(() => {
      if (!ownerKey) return;
      if (focusedMoodOwnerRef.current === ownerKey) {
        setMoodRefreshKey((key) => key + 1);
      } else {
        focusedMoodOwnerRef.current = ownerKey;
      }
      setLowEnergyLoadAttempt((attempt) => attempt + 1);
    }, [ownerKey])
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
    setAdvisorAction(null);
    setAdvisorActionOwnerKey(null);
    if (!expectedOwnerKey) return;

    let active = true;
    void loadAdvisorAction(expectedOwnerKey).then((loadedAction) => {
      if (!active || ownerKeyRef.current !== expectedOwnerKey) return;
      setAdvisorAction(loadedAction);
      setAdvisorActionOwnerKey(expectedOwnerKey);
    });

    return () => {
      active = false;
    };
  }, [lowEnergyLoadAttempt, ownerKey]);

  useEffect(() => {
    const expectedOwnerKey = ownerKey;
    setSafetyOwnerKey(null);
    setShowAdvisorSafety(false);
    if (!expectedOwnerKey) return;

    let active = true;
    void loadAmbientAdvisorContext({
      ownerKey: expectedOwnerKey,
      queryColumn,
      queryValue: queryValue ?? null,
      userId: user?.id ?? null,
    })
      .then((advisorContext) => {
        if (!active || ownerKeyRef.current !== expectedOwnerKey) return;
        setShowAdvisorSafety(hasUnsafeAdvisorContext(advisorContext));
        setSafetyOwnerKey(expectedOwnerKey);
      })
      .catch(() => {
        if (!active || ownerKeyRef.current !== expectedOwnerKey) return;
        setShowAdvisorSafety(false);
        setSafetyOwnerKey(expectedOwnerKey);
      });

    return () => {
      active = false;
    };
  }, [ownerKey, queryColumn, queryValue, user?.id]);

  useEffect(() => {
    const expectedOwnerKey = ownerKey;
    setMoodOwnerKey(null);
    setTodayMood(null);
    setAffirmation('');
    setAffirmationBy('');
    setMoodStatus(null);
    setSavingMood(false);
    if (!queryValue || !expectedOwnerKey) return;

    let active = true;
    const loadData = async () => {
      const localDate = getLocalCheckInFields().local_date;
      const moodResult = await supabase
        .from('moods')
        .select('emoji')
        .eq(queryColumn, queryValue)
        .eq('local_date', localDate)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!active || ownerKeyRef.current !== expectedOwnerKey) return;
      const mood = (moodResult.data?.emoji as MoodEmoji | undefined) ?? null;
      setTodayMood(mood);
      setMoodOwnerKey(expectedOwnerKey);

      try {
        const catalog = await loadAffirmationCatalog(mood);
        const selected = chooseRandomAffirmation(catalog.records);
        if (!selected || !active || ownerKeyRef.current !== expectedOwnerKey) return;
        setAffirmation(selected.content);
        setAffirmationBy(selected.attribution_name ?? '');
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
      setMoodOwnerKey(expectedOwnerKey);
      setMoodStatus({ type: 'success', message: 'Saved.' });
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
  const visibleAffirmation = moodOwnerKey === ownerKey ? affirmation : '';
  const visibleAffirmationBy = moodOwnerKey === ownerKey ? affirmationBy : '';
  const visibleLowEnergyMode = lowEnergyOwnerKey === ownerKey && lowEnergyMode;
  const visibleAdvisorSafety = safetyOwnerKey === ownerKey && showAdvisorSafety;
  const visibleAdvisorAction = advisorActionOwnerKey === ownerKey ? advisorAction : null;
  const visibleAdvisorActionText = visibleAdvisorAction
    ? visibleAdvisorAction.useSmallerStep
      ? visibleAdvisorAction.smallerAction
      : visibleAdvisorAction.action
    : null;
  const visibleModuleIds = dashboardModulesForToday(
    dashboardLayout,
    visibleLowEnergyMode,
    advisorProfile.completedAt ? advisorProfile.lowEnergyEssentials : []
  );
  const now = new Date();

  return (
    <AppScreen>
      <BotanicalHero
        artworkStyle={launchMotion.heroArtwork}
        contentStyle={launchMotion.heroContent}
        style={styles.hero}
      >
          <View style={styles.brandRow}>
            <Text style={styles.brand}>MHtoolkit</Text>
            <SupportAction label="Support" onPress={() => router.push('/resources')} />
          </View>

          <View style={styles.heroCopy}>
            <Text style={styles.date}>{format(now, 'MMMM d, yyyy').toUpperCase()}</Text>
            <Text accessibilityRole="header" style={styles.title}>
              {greetingForHour(now.getHours())}
            </Text>
            <Text style={styles.subtitle}>
              {visibleLowEnergyMode
                ? 'You only need one small step.'
                : visibleAffirmation
                  ? `${visibleAffirmation}${visibleAffirmationBy ? ` — ${visibleAffirmationBy}` : ''}`
                  : 'Take today one step at a time.'}
            </Text>
          </View>
      </BotanicalHero>

      <Animated.View style={[styles.moodSection, launchMotion.mood]}>
        <Text accessibilityRole="header" style={styles.sectionLabel}>
          How are you right now?
        </Text>
        <MoodPicker
          value={visibleTodayMood}
          onChange={(mood) => void saveMood(mood)}
          disabled={savingMood || !canSaveMood}
        />
        {moodStatus ? (
          <InlineStatus
            tone={moodStatus.type}
            message={moodStatus.message}
            action={moodStatus.type === 'success' ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Add context to this check-in"
                onPress={() => router.push('/(tabs)/tracker')}
                style={styles.addDetailsButton}
              >
                <Text style={styles.addDetailsButtonText}>Add context</Text>
              </Pressable>
            ) : undefined}
          />
        ) : null}
      </Animated.View>

      <Animated.View style={launchMotion.advisor}>
        {visibleAdvisorSafety ? (
          <InlineStatus
            tone="error"
            message="A saved goal or habit may need support beyond Advisor."
            action={(
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Find immediate and local support"
                onPress={() => router.push('/resources')}
                style={styles.safetyAction}
              >
                <Text style={styles.safetyActionText}>Find support</Text>
              </Pressable>
            )}
          />
        ) : null}

        {visibleModuleIds.includes('advisor') ? (
          <AdvisorHomeCard
            lowEnergy={visibleLowEnergyMode}
            currentAction={visibleAdvisorActionText}
            actionStatus={visibleAdvisorAction?.status ?? null}
            onOpen={() => router.navigate('/advisor')}
          />
        ) : null}
      </Animated.View>

      <Animated.View style={[styles.daySection, launchMotion.day]}>
        <SectionHeader
          title="Your day"
          description={visibleLowEnergyMode ? 'Just the next few things.' : undefined}
          action={(
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Customize your Today page"
              onPress={() => router.push('/dashboard-layout' as never)}
              style={({ pressed }) => [
                styles.customizeButton,
                pressed && styles.customizeButtonPressed,
              ]}
            >
              <Text style={styles.customizeButtonText}>Customize</Text>
            </Pressable>
          )}
        />
        <RowGroup>
          {visibleModuleIds.filter((moduleId) => moduleId !== 'advisor').map((moduleId) => {
            const module = dashboardModuleById(moduleId);
            if (!module) return null;
            return (
              <ListRow
                key={module.id}
                icon={module.icon}
                title={module.title}
                description={
                  module.id === 'accountability' && visibleLowEnergyMode
                    ? 'Ask someone you trust to check in.'
                    : module.description
                }
                onPress={() => {
                  if (module.navigation === 'navigate') {
                    router.navigate(module.href as never);
                  } else {
                    router.push(module.href as never);
                  }
                }}
              />
            );
          })}
        </RowGroup>
      </Animated.View>
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
  brandRow: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  brand: { color: Colors.text, fontFamily: 'Georgia', fontSize: 22, fontWeight: '700' },
  heroCopy: { maxWidth: '78%' },
  date: { color: Colors.accent, ...Typography.eyebrow, marginBottom: Spacing.xs },
  title: { color: Colors.text, ...Typography.display, fontSize: 27, marginBottom: Spacing.xs },
  subtitle: { color: Colors.textSecondary, ...Typography.body },
  moodSection: { marginBottom: Spacing.lg },
  sectionLabel: { color: Colors.text, ...Typography.cardTitle, marginBottom: Spacing.sm },
  addDetailsButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: Spacing.xs },
  addDetailsButtonText: { color: Colors.primary, ...Typography.label },
  safetyAction: { minHeight: 44, justifyContent: 'center' },
  safetyActionText: { color: Colors.danger, ...Typography.label },
  daySection: { marginBottom: Spacing.xl },
  customizeButton: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: Spacing.xs,
  },
  customizeButtonPressed: { opacity: 0.68 },
  customizeButtonText: { color: Colors.primary, ...Typography.label },
});
