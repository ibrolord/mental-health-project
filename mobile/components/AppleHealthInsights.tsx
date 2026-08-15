import { useCallback, useEffect, useState } from 'react';
import Feather from '@expo/vector-icons/Feather';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  ActivityIndicator,
  AppState,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { AppButton, Stat, appUiStyles } from '@/components/AppUI';
import { appleHealthPreference } from '@/lib/apple-health-preference';
import { loadAppleHealthSnapshot } from '@/lib/apple-health';
import {
  createAppleHealthOverview,
  formatHealthMinutes,
  type AppleHealthOverview,
} from '@/lib/apple-health-core';
import { Colors } from '@/lib/constants';

export function AppleHealthInsights({ ownerId }: { ownerId: string | null }) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [resolvedOwnerId, setResolvedOwnerId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [overview, setOverview] = useState<AppleHealthOverview | null>(null);
  const [error, setError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let active = true;
    setEnabled(null);
    setResolvedOwnerId(null);
    setExpanded(false);
    setOverview(null);
    setError('');
    if (!ownerId || Platform.OS !== 'ios') {
      setEnabled(false);
      return () => {
        active = false;
      };
    }
    const unsubscribe = appleHealthPreference.subscribe(ownerId, (value) => {
      if (!active) return;
      setEnabled(value);
      setResolvedOwnerId(ownerId);
      setOverview(null);
      setError('');
      if (!value) setExpanded(false);
    });
    void appleHealthPreference
      .read(ownerId)
      .then((value) => {
        if (active) {
          setEnabled(value);
          setResolvedOwnerId(ownerId);
        }
      })
      .catch((preferenceError) => {
        console.warn('Unable to read Apple Health preference:', preferenceError);
        if (active) setEnabled(false);
      });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [ownerId]);

  useFocusEffect(
    useCallback(() => {
      if (!ownerId || Platform.OS !== 'ios') return undefined;
      let active = true;
      void appleHealthPreference
        .read(ownerId)
        .then((value) => {
          if (!active) return;
          setEnabled(value);
          setResolvedOwnerId(ownerId);
          setOverview(null);
          setError('');
          if (value) setRefreshKey((key) => key + 1);
        })
        .catch(() => {
          if (!active) return;
          setEnabled(false);
          setResolvedOwnerId(ownerId);
          setOverview(null);
        });
      return () => {
        active = false;
      };
    }, [ownerId])
  );

  useEffect(() => {
    if (!ownerId || Platform.OS !== 'ios') return undefined;
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      setOverview(null);
      setError('');
      if (enabled) setRefreshKey((key) => key + 1);
    });
    return () => subscription.remove();
  }, [enabled, ownerId]);

  useEffect(() => {
    if (!expanded || !enabled || !ownerId || resolvedOwnerId !== ownerId) return;
    let active = true;
    setLoading(true);
    setError('');
    void loadAppleHealthSnapshot()
      .then((snapshot) => {
        if (active) setOverview(createAppleHealthOverview(snapshot));
      })
      .catch((loadError) => {
        console.warn('Unable to load Apple Health insights:', loadError);
        if (active) {
          setOverview(null);
          setError('Apple Health data could not be loaded.');
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [enabled, expanded, ownerId, refreshKey, resolvedOwnerId]);

  if (
    Platform.OS !== 'ios' ||
    enabled === null ||
    !ownerId ||
    resolvedOwnerId !== ownerId
  ) return null;

  const coverage = overview?.thirtyDay.coverageDays ?? 0;
  return (
    <View style={s.section}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Apple Health insights"
        accessibilityState={{ expanded }}
        onPress={() => setExpanded((current) => !current)}
        style={({ pressed }) => [s.header, pressed && s.pressed]}
      >
        <View style={s.headerIcon}>
          <Feather name="heart" size={17} color={Colors.primary} />
        </View>
        <View style={s.headerCopy}>
          <Text style={s.title}>Apple Health</Text>
          <Text style={s.description}>
            {enabled ? 'Sleep · movement · mindfulness' : 'Connect for read-only summaries'}
          </Text>
        </View>
        <Feather
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={20}
          color={Colors.textSecondary}
        />
      </Pressable>

      {expanded ? (
        <View style={s.body}>
          {!enabled ? (
            <View style={s.stateRow}>
              <View style={s.stateCopy}>
                <Text style={s.stateTitle}>Not connected</Text>
                <Text style={s.stateDescription}>Choose access in Settings.</Text>
              </View>
              <AppButton
                label="Set up"
                icon="settings"
                variant="quiet"
                style={s.compactAction}
                onPress={() => router.push('/settings')}
              />
            </View>
          ) : loading ? (
            <View style={s.loading}>
              <ActivityIndicator color={Colors.primary} />
              <Text style={appUiStyles.muted}>Reading permitted Apple Health data...</Text>
            </View>
          ) : error ? (
            <View style={s.stateRow}>
              <View style={s.stateCopy}>
                <Text accessibilityRole="alert" style={s.error}>
                  {error}
                </Text>
              </View>
              <AppButton
                label="Try again"
                icon="refresh-cw"
                variant="quiet"
                style={s.compactAction}
                onPress={() => setRefreshKey((key) => key + 1)}
              />
            </View>
          ) : overview && coverage > 0 ? (
            <>
              <Text style={s.windowLabel}>LAST 7 DAYS</Text>
              <View style={s.stats}>
                <Stat
                  label="Steps / day"
                  value={overview.sevenDay.averageSteps?.toLocaleString() ?? '—'}
                />
                <Stat
                  label="Sleep / night"
                  value={formatHealthMinutes(overview.sevenDay.averageSleepMinutes)}
                />
                <Stat label="Exercise" value={overview.sevenDay.exerciseMinutes} suffix="min" />
                <Stat label="Mindful" value={overview.sevenDay.mindfulMinutes} suffix="min" />
              </View>

              <Text style={s.windowLabel}>LAST 30 DAYS</Text>
              <View style={s.summaryRow}>
                <Text style={s.summaryText}>{overview.thirtyDay.workoutCount} workouts</Text>
                <Text style={s.dot}>·</Text>
                <Text style={s.summaryText}>{coverage} days with data</Text>
              </View>
              <AppButton
                label="Open today’s suggestion"
                accessibilityLabel="Open today’s Advisor suggestion"
                icon="compass"
                variant="secondary"
                style={s.aiAction}
                onPress={() =>
                  router.navigate({
                    pathname: '/advisor',
                    params: { health: '1' },
                  })
                }
              />
              <AppButton
                label="Refresh"
                icon="refresh-cw"
                variant="quiet"
                style={s.refreshAction}
                onPress={() => setRefreshKey((key) => key + 1)}
              />
            </>
          ) : (
            <View style={s.stateRow}>
              <View style={s.stateCopy}>
                <Text style={s.stateTitle}>No recent Health data</Text>
                <Text style={s.stateDescription}>Nothing available from the last 30 days.</Text>
              </View>
              <AppButton
                label="Refresh"
                icon="refresh-cw"
                variant="quiet"
                style={s.compactAction}
                onPress={() => setRefreshKey((key) => key + 1)}
              />
            </View>
          )}

        </View>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  section: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  header: {
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primaryLight,
  },
  headerCopy: { flex: 1 },
  title: { color: Colors.text, fontSize: 16, fontWeight: '700' },
  description: { color: Colors.textSecondary, fontSize: 12, marginTop: 2 },
  body: { borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 13, paddingBottom: 11 },
  loading: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44 },
  stateRow: {
    minHeight: 48,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  stateCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 180 },
  stateTitle: { color: Colors.text, fontSize: 14, fontWeight: '700' },
  stateDescription: { color: Colors.textSecondary, fontSize: 12, lineHeight: 17, marginTop: 2 },
  compactAction: { paddingVertical: 7, paddingHorizontal: 13 },
  refreshAction: { alignSelf: 'flex-start', marginTop: 12 },
  error: { color: Colors.danger, fontSize: 14, lineHeight: 20 },
  windowLabel: {
    color: Colors.accent,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.4,
    marginBottom: 10,
  },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  aiAction: { alignSelf: 'flex-start', marginTop: 16 },
  summaryRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  summaryText: { color: Colors.textSecondary, fontSize: 13, lineHeight: 19 },
  dot: { color: Colors.sage },
  pressed: { opacity: 0.72 },
});
