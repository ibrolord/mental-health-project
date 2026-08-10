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
import { AppButton, AppCard, Stat, appUiStyles } from '@/components/AppUI';
import { appleHealthPreference } from '@/lib/apple-health-preference';
import { loadAppleHealthSnapshot } from '@/lib/apple-health';
import {
  createAppleHealthOverview,
  formatHealthMinutes,
  type AppleHealthOverview,
  type MoodTimestamp,
} from '@/lib/apple-health-core';
import { Colors } from '@/lib/constants';

export function AppleHealthInsights({
  ownerId,
  moods,
}: {
  ownerId: string | null;
  moods: readonly MoodTimestamp[];
}) {
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
        if (active) setOverview(createAppleHealthOverview(snapshot, moods));
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
  }, [enabled, expanded, moods, ownerId, refreshKey, resolvedOwnerId]);

  if (
    Platform.OS !== 'ios' ||
    enabled === null ||
    !ownerId ||
    resolvedOwnerId !== ownerId
  ) return null;

  const coverage = overview?.thirtyDay.coverageDays ?? 0;

  return (
    <AppCard style={s.card} quiet>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Apple Health context"
        accessibilityState={{ expanded }}
        onPress={() => setExpanded((current) => !current)}
        style={({ pressed }) => [s.header, pressed && s.pressed]}
      >
        <View style={s.headerIcon}>
          <Feather name="heart" size={17} color={Colors.primary} />
        </View>
        <View style={s.headerCopy}>
          <Text style={s.title}>Apple Health context</Text>
          <Text style={s.description}>
            {enabled ? 'Sleep, movement, and mindfulness' : 'Optional and read-only'}
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
            <>
              <Text style={appUiStyles.muted}>
                Choose what MHtoolkit can read, then see it beside your mood check-ins.
              </Text>
              <AppButton
                label="Set up in Settings"
                icon="settings"
                variant="secondary"
                onPress={() => router.push('/settings')}
              />
            </>
          ) : loading ? (
            <View style={s.loading}>
              <ActivityIndicator color={Colors.primary} />
              <Text style={appUiStyles.muted}>Reading permitted Apple Health data...</Text>
            </View>
          ) : error ? (
            <View>
              <Text accessibilityRole="alert" style={s.error}>
                {error}
              </Text>
              <AppButton
                label="Try again"
                icon="refresh-cw"
                variant="secondary"
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

              <View style={s.pattern}>
                <Text style={s.patternText}>{overview.pattern}</Text>
                <Text style={s.patternNote}>A personal pattern, not a cause or diagnosis.</Text>
              </View>

              <Text style={s.windowLabel}>LAST 30 DAYS</Text>
              <View style={s.summaryRow}>
                <Text style={s.summaryText}>{overview.thirtyDay.workoutCount} workouts</Text>
                <Text style={s.dot}>·</Text>
                <Text style={s.summaryText}>
                  {overview.thirtyDay.stateOfMindCount} State of Mind entries
                </Text>
                <Text style={s.dot}>·</Text>
                <Text style={s.summaryText}>{coverage} days with data</Text>
              </View>
              <AppButton
                label="Refresh"
                icon="refresh-cw"
                variant="quiet"
                onPress={() => setRefreshKey((key) => key + 1)}
              />
            </>
          ) : (
            <View>
              <Text style={appUiStyles.muted}>
                No permitted Apple Health data was found in the last 30 days.
              </Text>
              <Text style={s.manage}>You can adjust access in the Apple Health app.</Text>
              <AppButton
                label="Refresh"
                icon="refresh-cw"
                variant="secondary"
                onPress={() => setRefreshKey((key) => key + 1)}
              />
            </View>
          )}

          <View style={s.privateRow}>
            <Feather name="lock" size={13} color={Colors.textSecondary} />
            <Text style={s.privateText}>Raw Health data stays on this device.</Text>
          </View>
        </View>
      ) : null}
    </AppCard>
  );
}

const s = StyleSheet.create({
  card: { paddingVertical: 4 },
  header: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primaryLight,
  },
  headerCopy: { flex: 1 },
  title: { color: Colors.text, fontSize: 17, fontWeight: '700' },
  description: { color: Colors.textSecondary, fontSize: 13, marginTop: 3 },
  body: { borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 16, paddingBottom: 14 },
  loading: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 54 },
  error: { color: Colors.danger, fontSize: 14, lineHeight: 20 },
  windowLabel: {
    color: Colors.accent,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.4,
    marginBottom: 10,
  },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  pattern: { backgroundColor: Colors.primaryLight, borderRadius: 14, padding: 14, marginBottom: 18 },
  patternText: { color: Colors.text, fontSize: 14, lineHeight: 20, fontWeight: '600' },
  patternNote: { color: Colors.textSecondary, fontSize: 11, lineHeight: 16, marginTop: 4 },
  summaryRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  summaryText: { color: Colors.textSecondary, fontSize: 13, lineHeight: 19 },
  dot: { color: Colors.sage },
  manage: { color: Colors.textSecondary, fontSize: 12, marginTop: 6 },
  privateRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 },
  privateText: { color: Colors.textSecondary, fontSize: 11 },
  pressed: { opacity: 0.72 },
});
