import { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { Colors } from '@/lib/constants';
import { format, subDays, startOfDay } from 'date-fns';
import type { MoodEmoji } from '@/lib/types';

const moodEmojis: MoodEmoji[] = ['\u{1F604}', '\u{1F642}', '\u{1F610}', '\u{1F61E}', '\u{1F622}'];
const moodLabels = ['Great', 'Good', 'Okay', 'Low', 'Very Low'];

export default function DashboardScreen() {
  const router = useRouter();
  const { user, sessionId, isAuthenticated } = useAuth();
  const [todayMood, setTodayMood] = useState<MoodEmoji | null>(null);
  const [weekMoods, setWeekMoods] = useState<any[]>([]);
  const [affirmation, setAffirmation] = useState('');

  const queryColumn = isAuthenticated ? 'user_id' : 'session_id';
  const queryValue = isAuthenticated ? user?.id : sessionId;
  const context = isAuthenticated
    ? { user_id: user?.id, session_id: null }
    : { user_id: null, session_id: sessionId };

  useEffect(() => {
    if (!queryValue) return;
    const loadData = async () => {
      const todayStart = startOfDay(new Date()).toISOString();
      const sevenDaysAgo = subDays(new Date(), 7).toISOString();
      const [moodRes, weekRes, affRes] = await Promise.all([
        supabase.from('moods').select('emoji').eq(queryColumn, queryValue).gte('created_at', todayStart).order('created_at', { ascending: false }).limit(1).single(),
        supabase.from('moods').select('emoji, created_at').eq(queryColumn, queryValue).gte('created_at', sevenDaysAgo).order('created_at', { ascending: true }),
        supabase.from('affirmations').select('content').limit(1).single(),
      ]);
      if (moodRes.data) setTodayMood(moodRes.data.emoji as MoodEmoji);
      if (weekRes.data) setWeekMoods(weekRes.data);
      if (affRes.data) setAffirmation(affRes.data.content);
    };
    loadData();
  }, [queryColumn, queryValue]);

  const saveMood = async (mood: MoodEmoji) => {
    if (!queryValue) return;
    await supabase.from('moods').insert({ ...context, emoji: mood } as any);
    setTodayMood(mood);
  };

  const quickActions = [
    { label: '📊 Track Mood', route: '/(tabs)/tracker' as const },
    { label: '💬 AI Chat', route: '/(tabs)/chat' as const },
    { label: '📋 Assessments', route: '/(tabs)/assessments' as const },
    { label: '🎯 Habits', route: '/habits' as const },
    { label: '✅ Goals', route: '/goals' as const },
    { label: '📚 Library', route: '/library' as const },
  ];

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      <Text style={s.title}>Welcome back</Text>
      <Text style={s.subtitle}>Your mental health snapshot</Text>

      {/* Mood Check-in */}
      <View style={s.card}>
        <Text style={s.cardTitle}>How are you feeling?</Text>
        <Text style={s.cardSubtitle}>Track your mood for today</Text>
        <View style={s.moodRow}>
          {moodEmojis.map((emoji, i) => (
            <TouchableOpacity
              key={emoji}
              onPress={() => saveMood(emoji)}
              style={[s.moodBtn, todayMood === emoji && s.moodBtnActive]}
            >
              <Text style={s.moodEmoji}>{emoji}</Text>
              <Text style={s.moodLabel}>{moodLabels[i]}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Week Overview */}
      <View style={s.card}>
        <Text style={s.cardTitle}>This Week</Text>
        <Text style={s.cardSubtitle}>Your mood over the last 7 days</Text>
        <View style={s.weekRow}>
          {Array.from({ length: 7 }).map((_, i) => {
            const date = subDays(new Date(), 6 - i);
            const dayMood = weekMoods.find(
              (m) => format(new Date(m.created_at), 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd')
            );
            return (
              <View key={i} style={s.weekDay}>
                <Text style={s.weekEmoji}>{dayMood?.emoji || '·'}</Text>
                <Text style={s.weekLabel}>{format(date, 'EEE')}</Text>
              </View>
            );
          })}
        </View>
      </View>

      {/* Affirmation */}
      {affirmation ? (
        <View style={[s.card, { backgroundColor: '#eff6ff' }]}>
          <Text style={s.affirmationText}>"{affirmation}"</Text>
          <Text style={s.affirmationLabel}>Daily Affirmation</Text>
        </View>
      ) : null}

      {/* Quick Actions */}
      <View style={s.card}>
        <Text style={s.cardTitle}>Quick Actions</Text>
        <View style={s.actionsGrid}>
          {quickActions.map((action) => (
            <TouchableOpacity
              key={action.route}
              style={s.actionBtn}
              onPress={() => router.push(action.route)}
            >
              <Text style={s.actionLabel}>{action.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 16, paddingBottom: 40 },
  title: { fontSize: 28, fontWeight: '700', color: Colors.text, marginBottom: 4 },
  subtitle: { fontSize: 16, color: Colors.textSecondary, marginBottom: 20 },
  card: { backgroundColor: Colors.card, borderRadius: 16, padding: 20, marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  cardTitle: { fontSize: 18, fontWeight: '600', color: Colors.text, marginBottom: 4 },
  cardSubtitle: { fontSize: 14, color: Colors.textSecondary, marginBottom: 16 },
  moodRow: { flexDirection: 'row', justifyContent: 'space-between' },
  moodBtn: { alignItems: 'center', padding: 10, borderRadius: 12 },
  moodBtnActive: { backgroundColor: '#dbeafe', borderWidth: 2, borderColor: Colors.primary },
  moodEmoji: { fontSize: 28 },
  moodLabel: { fontSize: 11, color: Colors.textSecondary, marginTop: 4 },
  weekRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', height: 60 },
  weekDay: { alignItems: 'center' },
  weekEmoji: { fontSize: 22 },
  weekLabel: { fontSize: 11, color: Colors.textSecondary, marginTop: 4 },
  affirmationText: { fontSize: 18, fontStyle: 'italic', color: Colors.text, textAlign: 'center', marginBottom: 8 },
  affirmationLabel: { fontSize: 13, color: Colors.textSecondary, textAlign: 'center' },
  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  actionBtn: { backgroundColor: Colors.background, borderWidth: 1, borderColor: Colors.border, borderRadius: 10, paddingVertical: 12, paddingHorizontal: 16, width: '48%' as any },
  actionLabel: { fontSize: 14, color: Colors.text, fontWeight: '500' },
});
