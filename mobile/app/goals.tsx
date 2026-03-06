import { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet, ActivityIndicator } from 'react-native';
import { supabase } from '@/lib/supabase';
import { useDataContext } from '@/lib/hooks/use-data-context';
import { Colors } from '@/lib/constants';
import { format } from 'date-fns';
import type { FrameworkType } from '@/lib/types';

interface Goal {
  id: string;
  content: string;
  status: 'pending' | 'completed' | 'cancelled';
  framework: FrameworkType;
  priority: string | null;
  eisenhower_quadrant: string | null;
}

const FRAMEWORKS: { id: FrameworkType; label: string; icon: string }[] = [
  { id: 'simple', label: 'Simple', icon: '📝' },
  { id: 'eisenhower', label: 'Eisenhower', icon: '📊' },
  { id: 'ivy_lee', label: 'Ivy Lee', icon: '📋' },
  { id: '1-3-5', label: '1-3-5', icon: '🎯' },
  { id: 'abcde', label: 'ABCDE', icon: '🔤' },
];

const EISENHOWER_QUADRANTS = [
  { id: 'urgent-important', label: 'Do First', color: '#fef2f2', icon: '🔥' },
  { id: 'not-urgent-important', label: 'Schedule', color: '#eff6ff', icon: '📅' },
  { id: 'urgent-not-important', label: 'Delegate', color: '#fefce8', icon: '👋' },
  { id: 'not-urgent-not-important', label: 'Eliminate', color: '#f8fafc', icon: '🗑️' },
];

const PRIORITIES_135 = [
  { id: 'big', label: '1 Big Thing', limit: 1, icon: '🎯' },
  { id: 'medium', label: '3 Medium Tasks', limit: 3, icon: '📋' },
  { id: 'small', label: '5 Small Tasks', limit: 5, icon: '✅' },
];

export default function GoalsScreen() {
  const { context, query } = useDataContext();
  const [framework, setFramework] = useState<FrameworkType>('simple');
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState('');
  const [activeSection, setActiveSection] = useState<string | null>(null);

  useEffect(() => { loadGoals(); }, [query]);

  const loadGoals = async () => {
    if (!query) return;
    const { data } = await supabase.from('goals').select('*').eq(query.column, query.value).eq('date', format(new Date(), 'yyyy-MM-dd')).order('created_at', { ascending: true });
    if (data) setGoals(data);
    setLoading(false);
  };

  const addGoal = async (content: string, priority?: string, quadrant?: string) => {
    if (!content.trim() || (!context.user_id && !context.session_id)) return;
    const { data, error } = await supabase.from('goals').insert({ ...context, content: content.trim(), framework, priority: priority || null, eisenhower_quadrant: quadrant || null, date: format(new Date(), 'yyyy-MM-dd') } as any).select().single();
    if (!error && data) { setGoals([...goals, data]); setInput(''); }
  };

  const toggleGoal = async (id: string, status: string) => {
    const newStatus = status === 'completed' ? 'pending' : 'completed';
    await supabase.from('goals').update({ status: newStatus, completed_at: newStatus === 'completed' ? new Date().toISOString() : null } as any).eq('id', id);
    setGoals(goals.map((g) => (g.id === id ? { ...g, status: newStatus as any } : g)));
  };

  const deleteGoal = async (id: string) => {
    await supabase.from('goals').delete().eq('id', id);
    setGoals(goals.filter((g) => g.id !== id));
  };

  const completed = goals.filter((g) => g.status === 'completed').length;
  const frameworkGoals = goals.filter((g) => g.framework === framework);

  if (loading) return <View style={s.centered}><ActivityIndicator size="large" color={Colors.primary} /></View>;

  const renderGoalItem = (g: Goal, num?: number) => (
    <View key={g.id} style={[s.goalRow, g.status === 'completed' && { opacity: 0.5 }]}>
      {num !== undefined && <Text style={s.goalNum}>{num}</Text>}
      <TouchableOpacity
        style={[s.checkbox, g.status === 'completed' && s.checkboxDone]}
        onPress={() => toggleGoal(g.id, g.status)}
      >
        {g.status === 'completed' && <Text style={s.checkmark}>✓</Text>}
      </TouchableOpacity>
      <Text style={[s.goalText, g.status === 'completed' && s.goalTextDone]}>{g.content}</Text>
      <TouchableOpacity onPress={() => deleteGoal(g.id)}>
        <Text style={s.deleteBtn}>×</Text>
      </TouchableOpacity>
    </View>
  );

  const renderAddInput = (onSubmit: () => void) => (
    <View style={s.inputRow}>
      <TextInput
        style={s.input}
        placeholder="Add task..."
        value={input}
        onChangeText={setInput}
        onSubmitEditing={onSubmit}
        placeholderTextColor={Colors.textSecondary}
      />
      <TouchableOpacity style={s.addSmallBtn} onPress={onSubmit}>
        <Text style={s.addSmallBtnText}>+</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      {/* Framework Picker */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
        {FRAMEWORKS.map((fw) => (
          <TouchableOpacity
            key={fw.id}
            style={[s.fwBtn, framework === fw.id && s.fwBtnActive]}
            onPress={() => setFramework(fw.id)}
          >
            <Text style={s.fwBtnText}>{fw.icon} {fw.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Progress */}
      {goals.length > 0 && (
        <View style={s.progressRow}>
          <Text style={s.progressLabel}>Today's Progress</Text>
          <Text style={s.progressLabel}>{completed}/{goals.length}</Text>
        </View>
      )}
      {goals.length > 0 && (
        <View style={s.progressBar}>
          <View style={[s.progressFill, { width: `${goals.length > 0 ? (completed / goals.length) * 100 : 0}%` }]} />
        </View>
      )}

      {/* Goals by Framework */}
      <View style={s.card}>
        <Text style={s.cardTitle}>📅 Today's Goals ({format(new Date(), 'MMM dd')})</Text>

        {framework === 'simple' && (
          <>
            {frameworkGoals.length < 3 && renderAddInput(() => { addGoal(input); })}
            {frameworkGoals.map((g, i) => renderGoalItem(g, i + 1))}
            {frameworkGoals.length === 0 && <Text style={s.empty}>What are your top priorities today?</Text>}
          </>
        )}

        {framework === 'eisenhower' && EISENHOWER_QUADRANTS.map((q) => {
          const list = goals.filter((g) => g.eisenhower_quadrant === q.id);
          return (
            <View key={q.id} style={[s.section, { backgroundColor: q.color }]}>
              <Text style={s.sectionTitle}>{q.icon} {q.label}</Text>
              {activeSection === q.id ? (
                <View style={s.inputRow}>
                  <TextInput style={s.input} placeholder="Add task..." value={input} onChangeText={setInput} onSubmitEditing={() => { addGoal(input, undefined, q.id); setActiveSection(null); }} placeholderTextColor={Colors.textSecondary} autoFocus />
                  <TouchableOpacity style={s.addSmallBtn} onPress={() => { addGoal(input, undefined, q.id); setActiveSection(null); }}>
                    <Text style={s.addSmallBtnText}>+</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity onPress={() => setActiveSection(q.id)}>
                  <Text style={s.addLink}>+ Add task</Text>
                </TouchableOpacity>
              )}
              {list.map((g) => renderGoalItem(g))}
            </View>
          );
        })}

        {framework === 'ivy_lee' && (
          <>
            {frameworkGoals.length < 6 && renderAddInput(() => addGoal(input))}
            {frameworkGoals.length >= 6 && <Text style={s.limitMsg}>✓ You have your 6 tasks. Now focus on #1!</Text>}
            {frameworkGoals.map((g, i) => renderGoalItem(g, i + 1))}
          </>
        )}

        {framework === '1-3-5' && PRIORITIES_135.map((p) => {
          const list = frameworkGoals.filter((g) => g.priority === p.id);
          const atLimit = list.length >= p.limit;
          return (
            <View key={p.id} style={s.section}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={s.sectionTitle}>{p.icon} {p.label}</Text>
                <Text style={s.sectionCount}>{list.length}/{p.limit}</Text>
              </View>
              {!atLimit && activeSection === p.id ? (
                <View style={s.inputRow}>
                  <TextInput style={s.input} placeholder="Add task..." value={input} onChangeText={setInput} onSubmitEditing={() => { addGoal(input, p.id); setActiveSection(null); }} placeholderTextColor={Colors.textSecondary} autoFocus />
                  <TouchableOpacity style={s.addSmallBtn} onPress={() => { addGoal(input, p.id); setActiveSection(null); }}>
                    <Text style={s.addSmallBtnText}>+</Text>
                  </TouchableOpacity>
                </View>
              ) : !atLimit ? (
                <TouchableOpacity onPress={() => setActiveSection(p.id)}>
                  <Text style={s.addLink}>+ Add task</Text>
                </TouchableOpacity>
              ) : (
                <Text style={s.limitMsg}>✓ Section complete!</Text>
              )}
              {list.map((g) => renderGoalItem(g))}
            </View>
          );
        })}

        {framework === 'abcde' && ['A', 'B', 'C', 'D', 'E'].map((p) => {
          const labels: Record<string, string> = { A: '🚨 A — Must Do', B: '⚠️ B — Should Do', C: '💡 C — Nice to Do', D: '🤝 D — Delegate', E: '🗑️ E — Eliminate' };
          const list = frameworkGoals.filter((g) => g.priority === p);
          return (
            <View key={p} style={s.section}>
              <Text style={s.sectionTitle}>{labels[p]}</Text>
              {activeSection === p ? (
                <View style={s.inputRow}>
                  <TextInput style={s.input} placeholder="Add task..." value={input} onChangeText={setInput} onSubmitEditing={() => { addGoal(input, p); setActiveSection(null); }} placeholderTextColor={Colors.textSecondary} autoFocus />
                  <TouchableOpacity style={s.addSmallBtn} onPress={() => { addGoal(input, p); setActiveSection(null); }}>
                    <Text style={s.addSmallBtnText}>+</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity onPress={() => setActiveSection(p)}>
                  <Text style={s.addLink}>+ Add task</Text>
                </TouchableOpacity>
              )}
              {list.map((g) => renderGoalItem(g))}
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 16, paddingBottom: 40 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  card: { backgroundColor: Colors.card, borderRadius: 16, padding: 20, marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  cardTitle: { fontSize: 18, fontWeight: '600', color: Colors.text, marginBottom: 16 },
  fwBtn: { borderWidth: 1, borderColor: Colors.border, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 16, marginRight: 8, backgroundColor: Colors.card },
  fwBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  fwBtnText: { fontSize: 13, fontWeight: '500', color: Colors.text },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  progressLabel: { fontSize: 13, fontWeight: '500', color: Colors.textSecondary },
  progressBar: { height: 10, backgroundColor: Colors.border, borderRadius: 5, marginBottom: 16, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: Colors.success, borderRadius: 5 },
  section: { backgroundColor: Colors.background, borderRadius: 12, padding: 14, marginBottom: 12 },
  sectionTitle: { fontSize: 15, fontWeight: '600', color: Colors.text, marginBottom: 8 },
  sectionCount: { fontSize: 13, color: Colors.textSecondary },
  inputRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  input: { flex: 1, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border, borderRadius: 10, padding: 10, fontSize: 14, color: Colors.text },
  addSmallBtn: { backgroundColor: Colors.primary, borderRadius: 10, width: 40, justifyContent: 'center', alignItems: 'center' },
  addSmallBtnText: { color: '#fff', fontSize: 20, fontWeight: '600' },
  addLink: { color: Colors.primary, fontSize: 14, fontWeight: '500', marginBottom: 8 },
  limitMsg: { color: Colors.success, fontSize: 13, marginBottom: 8 },
  goalRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border },
  goalNum: { fontSize: 16, fontWeight: '700', color: Colors.textSecondary, width: 20 },
  checkbox: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: Colors.border, justifyContent: 'center', alignItems: 'center' },
  checkboxDone: { backgroundColor: Colors.success, borderColor: Colors.success },
  checkmark: { color: '#fff', fontSize: 14, fontWeight: '700' },
  goalText: { flex: 1, fontSize: 15, color: Colors.text },
  goalTextDone: { textDecorationLine: 'line-through', color: Colors.textSecondary },
  deleteBtn: { fontSize: 22, color: Colors.danger, paddingHorizontal: 8 },
  empty: { textAlign: 'center', color: Colors.textSecondary, paddingVertical: 16 },
});
