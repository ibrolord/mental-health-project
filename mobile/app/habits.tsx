import { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet } from 'react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { Colors } from '@/lib/constants';
import { format } from 'date-fns';

interface Habit {
  id: string;
  name: string;
  description: string | null;
  streak_count: number;
}

export default function HabitsScreen() {
  const { user, sessionId, isAuthenticated } = useAuth();
  const [habits, setHabits] = useState<Habit[]>([]);
  const [logs, setLogs] = useState<Record<string, boolean>>({});
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');

  const queryColumn = isAuthenticated ? 'user_id' : 'session_id';
  const queryValue = isAuthenticated ? user?.id : sessionId;
  const context = isAuthenticated ? { user_id: user?.id, session_id: null } : { user_id: null, session_id: sessionId };

  useEffect(() => {
    if (!queryValue) return;
    (async () => {
      const { data: habitsData } = await supabase.from('habits').select('id, name, description, streak_count').eq(queryColumn, queryValue).eq('is_active', true).order('created_at', { ascending: true });
      if (habitsData && habitsData.length > 0) {
        setHabits(habitsData);
        const today = format(new Date(), 'yyyy-MM-dd');
        const { data: logsData } = await supabase.from('habit_logs').select('habit_id, completed').in('habit_id', habitsData.map((h) => h.id)).eq('log_date', today);
        if (logsData) {
          const map: Record<string, boolean> = {};
          logsData.forEach((l) => { map[l.habit_id] = l.completed; });
          setLogs(map);
        }
      }
    })();
  }, [queryColumn, queryValue]);

  const addHabit = async () => {
    if (!name.trim() || !queryValue) return;
    const { data, error } = await supabase.from('habits').insert({ ...context, name, description: desc || null, frequency: 'daily' } as any).select().single();
    if (!error && data) { setHabits([...habits, data]); setName(''); setDesc(''); setShowAdd(false); }
  };

  const toggleHabit = async (habitId: string) => {
    const today = format(new Date(), 'yyyy-MM-dd');
    const isCompleted = logs[habitId];
    const newCompleted = !isCompleted;
    if (isCompleted !== undefined) {
      await supabase.from('habit_logs').update({ completed: newCompleted } as any).eq('habit_id', habitId).eq('log_date', today);
    } else {
      await supabase.from('habit_logs').insert({ habit_id: habitId, completed: newCompleted, log_date: today } as any);
    }
    setLogs({ ...logs, [habitId]: newCompleted });
  };

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      <View style={s.header}>
        <TouchableOpacity style={s.headerBtn} onPress={() => setShowAdd(!showAdd)}>
          <Text style={s.headerBtnText}>{showAdd ? 'Cancel' : '+ New Habit'}</Text>
        </TouchableOpacity>
      </View>

      {showAdd && (
        <View style={s.card}>
          <Text style={s.cardTitle}>Create New Habit</Text>
          <Text style={s.label}>Habit Name</Text>
          <TextInput style={s.input} value={name} onChangeText={setName} placeholder="e.g., Meditate for 10 minutes" placeholderTextColor={Colors.textSecondary} />
          <Text style={s.label}>Description (optional)</Text>
          <TextInput style={s.textArea} value={desc} onChangeText={setDesc} placeholder="Why is this habit important?" placeholderTextColor={Colors.textSecondary} multiline />
          <TouchableOpacity style={[s.btn, !name.trim() && { opacity: 0.5 }]} onPress={addHabit} disabled={!name.trim()}>
            <Text style={s.btnText}>Create Habit</Text>
          </TouchableOpacity>
        </View>
      )}

      {habits.length === 0 ? (
        <View style={s.card}>
          <Text style={s.empty}>No habits yet. Start building positive routines!</Text>
          <TouchableOpacity style={s.btn} onPress={() => setShowAdd(true)}>
            <Text style={s.btnText}>Create Your First Habit</Text>
          </TouchableOpacity>
        </View>
      ) : (
        habits.map((habit) => {
          const done = logs[habit.id] || false;
          return (
            <View key={habit.id} style={[s.card, done && { backgroundColor: Colors.successLight, borderColor: '#bbf7d0', borderWidth: 1 }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, flex: 1 }}>
                  <TouchableOpacity
                    onPress={() => toggleHabit(habit.id)}
                    style={[s.habitCheck, done && s.habitCheckDone]}
                  >
                    {done && <Text style={{ color: '#fff', fontWeight: '700' }}>✓</Text>}
                  </TouchableOpacity>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.habitName, done && { color: '#15803d' }]}>{habit.name}</Text>
                    {habit.description && <Text style={s.habitDesc}>{habit.description}</Text>}
                  </View>
                </View>
                <View style={{ alignItems: 'center' }}>
                  <Text style={s.streak}>🔥 {habit.streak_count}</Text>
                  <Text style={s.streakLabel}>day streak</Text>
                </View>
              </View>
            </View>
          );
        })
      )}

      <View style={[s.card, { backgroundColor: '#eff6ff' }]}>
        <Text style={{ fontWeight: '600', color: '#1e40af', marginBottom: 8 }}>💡 Habit Tips</Text>
        <Text style={s.tip}>• Start small — 2 minutes is better than nothing</Text>
        <Text style={s.tip}>• Stack habits — attach new ones to existing routines</Text>
        <Text style={s.tip}>• Track progress — seeing streaks is motivating</Text>
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 16, paddingBottom: 40 },
  header: { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 16 },
  headerBtn: { backgroundColor: Colors.primary, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 16 },
  headerBtnText: { color: '#fff', fontWeight: '600' },
  card: { backgroundColor: Colors.card, borderRadius: 16, padding: 20, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  cardTitle: { fontSize: 18, fontWeight: '600', color: Colors.text, marginBottom: 12 },
  label: { fontSize: 14, fontWeight: '500', color: Colors.text, marginBottom: 6, marginTop: 12 },
  input: { backgroundColor: Colors.background, borderWidth: 1, borderColor: Colors.border, borderRadius: 10, padding: 12, fontSize: 15, color: Colors.text },
  textArea: { backgroundColor: Colors.background, borderWidth: 1, borderColor: Colors.border, borderRadius: 10, padding: 12, fontSize: 15, color: Colors.text, minHeight: 80, textAlignVertical: 'top' },
  btn: { backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 16 },
  btnText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  empty: { textAlign: 'center', color: Colors.textSecondary, marginBottom: 16 },
  habitCheck: { width: 32, height: 32, borderRadius: 16, borderWidth: 2, borderColor: Colors.border, justifyContent: 'center', alignItems: 'center' },
  habitCheckDone: { backgroundColor: Colors.success, borderColor: Colors.success },
  habitName: { fontSize: 16, fontWeight: '600', color: Colors.text },
  habitDesc: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  streak: { fontSize: 20, fontWeight: '700', color: Colors.orange },
  streakLabel: { fontSize: 11, color: Colors.textSecondary },
  tip: { fontSize: 13, color: '#1e40af', marginBottom: 4, lineHeight: 20 },
});
