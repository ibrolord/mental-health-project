import { useEffect, useRef, useState } from 'react';
import { Feather } from '@expo/vector-icons';
import {
  Alert,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { subDays } from 'date-fns';
import {
  AppButton,
  AppCard,
  AppScreen,
  PageHeader,
  appUiStyles,
} from '@/components/AppUI';
import {
  chooseRandomAffirmation,
  type AffirmationDisplayRecord,
} from '@/lib/affirmations';
import { loadAffirmationCatalog } from '@/lib/affirmations-client';
import { ensureAiDataSharingConsent } from '@/lib/ai-consent';
import { apiRequest } from '@/lib/api';
import { Colors } from '@/lib/constants';
import { useDataContext } from '@/lib/hooks/use-data-context';
import { supabase } from '@/lib/supabase';

export default function AffirmationsScreen() {
  const { context, query, authLoading } = useDataContext();
  const [catalog, setCatalog] = useState<AffirmationDisplayRecord[]>([]);
  const [current, setCurrent] = useState<AffirmationDisplayRecord | null>(null);
  const [recentIds, setRecentIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const ownerRef = useRef(query?.value ?? null);
  ownerRef.current = query?.value ?? null;

  useEffect(() => {
    if (authLoading || !query) return;
    const ownerId = query.value;
    let active = true;
    setLoading(true);
    setError('');
    const load = async () => {
      try {
        const sevenDaysAgo = subDays(new Date(), 7).toISOString();
        const [moods, history] = await Promise.all([
          supabase
            .from('moods')
            .select('emoji')
            .eq(query.column, ownerId)
            .gte('created_at', sevenDaysAgo)
            .order('created_at', { ascending: false })
            .limit(1),
          supabase
            .from('user_affirmation_history')
            .select('affirmation_id')
            .eq(query.column, ownerId)
            .order('shown_at', { ascending: false })
            .limit(20),
        ]);
        if (moods.error) throw moods.error;
        if (history.error) throw history.error;
        const mood = moods.data?.[0]?.emoji ?? null;
        const result = await loadAffirmationCatalog(mood);
        if (!active || ownerRef.current !== ownerId) return;
        const ids = (history.data ?? []).map(({ affirmation_id }) => affirmation_id);
        const selected = chooseRandomAffirmation(result.records, {
          excludeIds: ids,
        });
        setCatalog(result.records);
        setRecentIds(ids);
        setCurrent(selected);
        if (selected?.historyEligible) {
          await supabase.from('user_affirmation_history').insert({
            ...context,
            affirmation_id: selected.id,
          } as never);
        }
      } catch {
        if (active) setError('Affirmations could not be loaded.');
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [authLoading, context, query]);

  const showAnother = async () => {
    if (!query || loading) return;
    const next = chooseRandomAffirmation(catalog, {
      excludeIds: recentIds,
      currentId: current?.id,
    });
    if (!next) return;
    setCurrent(next);
    setRecentIds((ids) => [next.id, ...ids].slice(0, 20));
    if (next.historyEligible) {
      const { error: historyError } = await supabase
        .from('user_affirmation_history')
        .insert({ ...context, affirmation_id: next.id } as never);
      if (historyError) setError('This affirmation opened, but its history was not saved.');
    }
  };

  const generateAi = async () => {
    if (!query || generating) return;
    if (!(await ensureAiDataSharingConsent(`${query.column}:${query.value}`))) return;
    setGenerating(true);
    setError('');
    try {
      const since = subDays(new Date(), 7).toISOString();
      const [moods, assessments, goals] = await Promise.all([
        supabase
          .from('moods')
          .select('emoji, note')
          .eq(query.column, query.value)
          .gte('created_at', since)
          .order('created_at', { ascending: false })
          .limit(7),
        supabase
          .from('assessments')
          .select('type, score, max_score')
          .eq(query.column, query.value)
          .order('created_at', { ascending: false })
          .limit(3),
        supabase
          .from('goals')
          .select('content, status')
          .eq(query.column, query.value)
          .order('created_at', { ascending: false })
          .limit(5),
      ]);
      if (moods.error || assessments.error || goals.error) {
        throw new Error('Context unavailable');
      }
      const response = await apiRequest<{ affirmation?: unknown }>(
        '/api/affirmations/generate',
        {
          moods: moods.data,
          assessments: assessments.data,
          goals: goals.data,
        }
      );
      if (
        typeof response.affirmation !== 'string' ||
        !response.affirmation.trim()
      ) {
        throw new Error('Empty affirmation');
      }
      setCurrent({
        id: `personalized-${Date.now()}`,
        content: response.affirmation.trim(),
        category: 'personalized',
        kind: 'affirmation',
        attribution_name: null,
        source_title: null,
        source_url: null,
        historyEligible: false,
      });
    } catch {
      setError('A personalized affirmation could not be generated.');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <AppScreen>
      <PageHeader
        eyebrow="Affirmations"
        title="A fresh thought for right now."
        description="Random affirmations and verified quotes from real people."
        icon="sun"
      />
      <AppCard style={styles.quoteCard}>
        {loading ? (
          <Text style={styles.loading}>Loading...</Text>
        ) : current ? (
          <>
            <View style={styles.mark}>
              <Feather
                name={current.kind === 'quote' ? 'message-circle' : 'sun'}
                size={22}
                color={Colors.primary}
              />
            </View>
            <Text style={styles.quote}>{current.content}</Text>
            {current.attribution_name ? (
              <Text style={styles.attribution}>
                {current.attribution_name}
              </Text>
            ) : (
              <Text style={styles.attribution}>{current.category}</Text>
            )}
            {current.source_url ? (
              <Pressable
                accessibilityRole="link"
                onPress={() =>
                  void Linking.openURL(current.source_url!).catch(() =>
                    Alert.alert('Unable to open source')
                  )
                }
                style={styles.source}
              >
                <Text style={styles.sourceText}>
                  {current.source_title ?? 'Source'}
                </Text>
                <Feather
                  name="external-link"
                  size={14}
                  color={Colors.primary}
                />
              </Pressable>
            ) : null}
          </>
        ) : (
          <Text style={styles.loading}>No affirmation is available.</Text>
        )}
      </AppCard>
      {error ? <Text style={appUiStyles.error}>{error}</Text> : null}
      <View style={styles.actions}>
        <AppButton
          label="Show another"
          icon="refresh-cw"
          disabled={loading || catalog.length === 0}
          onPress={() => void showAnother()}
          style={{ flex: 1 }}
        />
        <AppButton
          label="Personalize with AI"
          icon="message-circle"
          variant="secondary"
          loading={generating}
          onPress={() => void generateAi()}
          style={{ flex: 1 }}
        />
      </View>
      <AppCard quiet style={{ marginTop: 14 }}>
        <Text style={appUiStyles.muted}>
          AI personalization sends recent mood, assessment, and goal context
          only after you consent.
        </Text>
      </AppCard>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  quoteCard: {
    minHeight: 310,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
  },
  mark: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primaryLight,
    marginBottom: 20,
  },
  quote: {
    color: Colors.text,
    fontSize: 23,
    lineHeight: 33,
    fontWeight: '600',
    textAlign: 'center',
  },
  attribution: {
    color: Colors.accent,
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 18,
  },
  source: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
  },
  sourceText: { color: Colors.primary, fontSize: 11, fontWeight: '600' },
  loading: { color: Colors.textSecondary, fontSize: 14 },
  actions: { flexDirection: 'row', gap: 9 },
});
