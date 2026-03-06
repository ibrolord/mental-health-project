import { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { supabase } from '@/lib/supabase';
import { useDataContext } from '@/lib/hooks/use-data-context';
import { Colors } from '@/lib/constants';
import { apiRequest } from '@/lib/api';
import { subDays } from 'date-fns';

interface Affirmation { id: string; content: string; category: string; }

const MAX_DAILY = 3;

export default function AffirmationsScreen() {
  const { context, query } = useDataContext();
  const [current, setCurrent] = useState<Affirmation | null>(null);
  const [viewed, setViewed] = useState(0);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  useEffect(() => { loadToday(); }, [query]);

  const loadToday = async () => {
    if (!query) return;
    setLoading(true);
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const { data: history } = await supabase.from('user_affirmation_history').select('affirmation_id, shown_at').eq(query.column, query.value).gte('shown_at', todayStart.toISOString());

    if (history && history.length > 0) {
      setViewed(history.length);
      const last = history[history.length - 1] as { affirmation_id: string };
      const { data } = await supabase.from('affirmations').select('*').eq('id', last.affirmation_id).single();
      if (data) setCurrent(data);
    } else {
      setViewed(0);
      await loadNew();
    }
    setLoading(false);
  };

  const loadNew = async () => {
    if (viewed >= MAX_DAILY || !query) return;
    setLoading(true);
    const sevenDaysAgo = subDays(new Date(), 7).toISOString();
    const { data: moods } = await supabase.from('moods').select('emoji').eq(query.column, query.value).gte('created_at', sevenDaysAgo).order('created_at', { ascending: false }).limit(7);

    let qb = supabase.from('affirmations').select('*');
    if (moods && moods.length > 0) {
      qb = qb.contains('mood_tags', [(moods[0] as { emoji: string }).emoji]);
    }

    const { data: affirmations } = await qb;
    if (affirmations && affirmations.length > 0) {
      const aff = affirmations[Math.floor(Math.random() * affirmations.length)] as Affirmation;
      setCurrent(aff);
      await supabase.from('user_affirmation_history').insert({ ...context, affirmation_id: aff.id } as any);
      setViewed(viewed + 1);
    }
    setLoading(false);
  };

  const generateAI = async () => {
    if (!query) return;
    setGenerating(true);
    const sevenDaysAgo = subDays(new Date(), 7).toISOString();
    const [m, a, g] = await Promise.all([
      supabase.from('moods').select('emoji, note').eq(query.column, query.value).gte('created_at', sevenDaysAgo).order('created_at', { ascending: false }).limit(7),
      supabase.from('assessments').select('type, score, max_score').eq(query.column, query.value).order('created_at', { ascending: false }).limit(3),
      supabase.from('goals').select('content, status').eq(query.column, query.value).order('created_at', { ascending: false }).limit(5),
    ]);

    try {
      const data = await apiRequest('/api/affirmations/generate', {
        moods: m.data,
        assessments: a.data,
        goals: g.data,
      });
      if (data.affirmation) {
        setCurrent({ id: 'personalized', content: data.affirmation, category: 'personalized' });
      }
    } catch (e) {
      console.error(e);
    }
    setGenerating(false);
  };

  if (loading) return <View style={s.centered}><ActivityIndicator size="large" color={Colors.primary} /></View>;

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      <Text style={s.title}>Daily Affirmations</Text>
      <Text style={s.subtitle}>You can view {MAX_DAILY} affirmations per day ({viewed}/{MAX_DAILY} today)</Text>

      <View style={s.card}>
        {current ? (
          <View style={{ alignItems: 'center', paddingVertical: 40 }}>
            <Text style={{ fontSize: 48, marginBottom: 20 }}>✨</Text>
            <Text style={s.affirmation}>"{current.content}"</Text>
            <Text style={s.category}>{current.category}</Text>
          </View>
        ) : (
          <Text style={s.empty}>No affirmation loaded yet.</Text>
        )}
      </View>

      <TouchableOpacity style={[s.btn, viewed >= MAX_DAILY && { opacity: 0.5 }]} onPress={loadNew} disabled={viewed >= MAX_DAILY || loading}>
        <Text style={s.btnText}>{viewed >= MAX_DAILY ? 'Daily Limit Reached' : 'Show Another Affirmation'}</Text>
      </TouchableOpacity>

      <TouchableOpacity style={s.btnOutline} onPress={generateAI} disabled={generating}>
        <Text style={s.btnOutlineText}>{generating ? 'Generating...' : 'Generate Personalized Affirmation (AI)'}</Text>
      </TouchableOpacity>

      <View style={[s.card, { backgroundColor: '#eff6ff', marginTop: 24 }]}>
        <Text style={{ fontWeight: '600', color: Colors.text, marginBottom: 8 }}>Why limit affirmations?</Text>
        <Text style={{ fontSize: 13, color: Colors.textSecondary, lineHeight: 20 }}>
          Affirmations are most effective when given time to resonate. Viewing too many at once can dilute their impact.
        </Text>
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 16, paddingBottom: 40 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 28, fontWeight: '700', color: Colors.text, textAlign: 'center', marginBottom: 4 },
  subtitle: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', marginBottom: 20 },
  card: { backgroundColor: Colors.card, borderRadius: 16, padding: 20, marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  affirmation: { fontSize: 22, fontStyle: 'italic', color: Colors.text, textAlign: 'center', lineHeight: 32, marginBottom: 12 },
  category: { fontSize: 13, color: Colors.textSecondary },
  empty: { textAlign: 'center', color: Colors.textSecondary, paddingVertical: 40 },
  btn: { backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginBottom: 10 },
  btnText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  btnOutline: { borderWidth: 1, borderColor: Colors.border, borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  btnOutlineText: { color: Colors.text, fontWeight: '500', fontSize: 15 },
});
