import { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useDataContext } from '@/lib/hooks/use-data-context';
import { Colors } from '@/lib/constants';
import { format } from 'date-fns';
import type { FrameworkType } from '@/lib/types';
import {
  appendUniqueGoal,
  collapseDuplicateGoals,
  createSingleFlight,
  goalCompletionFeedback,
  goalIdentityKey,
  nextGoalCompletionStatus,
} from '@/lib/goals/deduplication';
import { refreshReminders } from '@/lib/notifications';

interface Goal {
  id: string;
  content: string;
  status: 'pending' | 'completed' | 'cancelled';
  framework: FrameworkType;
  priority: string | null;
  eisenhower_quadrant: string | null;
  completed_at: string | null;
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

function firstParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? '' : value ?? '';
}

export default function GoalsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    source?: string | string[];
    content?: string | string[];
    bookTitle?: string | string[];
  }>();
  const { context, query } = useDataContext();
  const [framework, setFramework] = useState<FrameworkType>('simple');
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [goalError, setGoalError] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [librarySourceTitle, setLibrarySourceTitle] = useState('');
  const [statusUpdatingId, setStatusUpdatingId] = useState<string | null>(null);
  const [goalStatusChange, setGoalStatusChange] = useState<{
    id: string;
    from: 'pending' | 'completed';
    to: 'pending' | 'completed';
    fromCompletedAt: string | null;
  } | null>(null);
  const appliedLibraryActionRef = useRef('');
  const goalIdsByKeyRef = useRef(new Map<string, string[]>());
  const runGoalInsertRef = useRef(createSingleFlight());

  const refreshReminderContent = () => {
    void refreshReminders().catch((error) => {
      console.warn('Could not refresh local reminders after a goal change:', error);
    });
  };

  const loadGoals = useCallback(async () => {
    setGoalStatusChange(null);
    if (!query) {
      setGoals([]);
      goalIdsByKeyRef.current = new Map();
      setLoading(false);
      return;
    }

    setLoading(true);
    const { data, error } = await supabase
      .from('goals')
      .select('*')
      .eq(query.column, query.value)
      .eq('date', format(new Date(), 'yyyy-MM-dd'))
      .order('created_at', { ascending: true });

    if (error) {
      setGoalError('Could not load your goals. Please try again.');
    } else if (data) {
      const collapsed = collapseDuplicateGoals(data as Goal[]);
      goalIdsByKeyRef.current = collapsed.idsByKey;
      setGoals(collapsed.goals);
    }
    setLoading(false);
  }, [query]);

  useEffect(() => {
    void loadGoals();
  }, [loadGoals]);

  useEffect(() => {
    if (firstParam(params.source) !== 'library') {
      appliedLibraryActionRef.current = '';
      return;
    }

    const content = firstParam(params.content).trim().slice(0, 500);
    if (!content) {
      appliedLibraryActionRef.current = '';
      return;
    }

    const bookTitle = firstParam(params.bookTitle).slice(0, 200);
    const actionIdentity = `${content}\u0000${bookTitle}`;
    if (appliedLibraryActionRef.current === actionIdentity) return;
    appliedLibraryActionRef.current = actionIdentity;
    setFramework('simple');
    setInput(content);
    setLibrarySourceTitle(bookTitle || 'the library');
  }, [params.bookTitle, params.content, params.source]);

  const addGoal = async (content: string, priority?: string, quadrant?: string) => {
    const normalizedContent = content.trim().replace(/\s+/g, ' ');
    if (!normalizedContent || (!context.user_id && !context.session_id)) return false;

    setGoalError(null);
    const date = format(new Date(), 'yyyy-MM-dd');
    const identity = {
      id: 'pending',
      content: normalizedContent,
      framework,
      priority: priority || null,
      eisenhower_quadrant: quadrant || null,
    };
    const identityKey = goalIdentityKey(identity);

    const saved = await runGoalInsertRef.current(async () => {
      if (goalIdsByKeyRef.current.has(identityKey)) {
        setGoalError('That goal is already in this section.');
        return false;
      }

      setAdding(true);
      try {
        const { data, error } = await supabase
          .from('goals')
          .insert({
            ...context,
            content: normalizedContent,
            framework,
            priority: priority || null,
            eisenhower_quadrant: quadrant || null,
            date,
          } as any)
          .select()
          .single();

        if (error || !data) {
          if (error?.code === '23505') {
            await loadGoals();
            setGoalError('That goal is already in this section.');
          } else {
            setGoalError('Could not add that goal. Please try again.');
          }
          return false;
        }

        goalIdsByKeyRef.current.set(identityKey, [data.id]);
        setGoals((current) => appendUniqueGoal(current, data as Goal));
        setInput((current) =>
          current.trim().replace(/\s+/g, ' ') === normalizedContent ? '' : current
        );
        setActiveSection(null);
        setLibrarySourceTitle('');
        refreshReminderContent();
        return true;
      } catch {
        setGoalError('Could not add that goal. Please try again.');
        return false;
      } finally {
        setAdding(false);
      }
    });

    return saved ?? false;
  };

  const updateGoalStatus = async (
    goal: Goal,
    newStatus: 'pending' | 'completed',
    completedAt = newStatus === 'completed' ? new Date().toISOString() : null
  ) => {
    if (!query) return;
    setStatusUpdatingId(goal.id);
    setGoalError(null);
    const ids = goalIdsByKeyRef.current.get(goalIdentityKey(goal)) ?? [goal.id];
    try {
      const { error } = await supabase.from('goals').update({ status: newStatus, completed_at: completedAt } as any).in('id', ids).eq(query.column, query.value);
      if (error) {
        setGoalError('Could not update that goal. Please try again.');
        return false;
      }
      setGoals((current) => current.map((item) => (item.id === goal.id ? { ...item, status: newStatus, completed_at: completedAt } : item)));
      refreshReminderContent();
      return true;
    } finally {
      setStatusUpdatingId((current) => (current === goal.id ? null : current));
    }
  };

  const toggleGoal = async (id: string) => {
    if (statusUpdatingId) return;
    const goal = goals.find((item) => item.id === id);
    if (!goal || goal.status === 'cancelled') return;
    const from = goal.status;
    const to = nextGoalCompletionStatus(from);
    const completedAt = to === 'completed' ? new Date().toISOString() : null;
    if (await updateGoalStatus(goal, to, completedAt)) {
      setGoalStatusChange({
        id,
        from,
        to,
        fromCompletedAt: goal.completed_at,
      });
    }
  };

  const undoGoalStatus = async () => {
    const change = goalStatusChange;
    if (!change || statusUpdatingId) return;
    const goal = goals.find((item) => item.id === change.id);
    if (!goal || goal.status !== change.to) {
      setGoalStatusChange(null);
      return;
    }
    if (await updateGoalStatus(goal, change.from, change.fromCompletedAt)) {
      setGoalStatusChange(null);
    }
  };

  const deleteGoal = async (id: string) => {
    if (!query) return;
    const goal = goals.find((item) => item.id === id);
    if (!goal) return;
    const identityKey = goalIdentityKey(goal);
    const ids = goalIdsByKeyRef.current.get(identityKey) ?? [id];
    const { error } = await supabase.from('goals').delete().in('id', ids).eq(query.column, query.value);
    if (error) {
      setGoalError('Could not delete that goal. Please try again.');
      return;
    }
    goalIdsByKeyRef.current.delete(identityKey);
    setGoals((current) => current.filter((g) => g.id !== id));
    refreshReminderContent();
  };

  const completed = goals.filter((g) => g.status === 'completed').length;
  const frameworkGoals = goals.filter((g) => g.framework === framework);

  if (loading) return <View style={s.centered}><ActivityIndicator size="large" color={Colors.primary} /></View>;

  const renderGoalItem = (g: Goal, num?: number) => (
    <View key={g.id} style={[s.goalRow, g.status === 'completed' && { opacity: 0.5 }]}>
      {num !== undefined && <Text style={s.goalNum}>{num}</Text>}
      <TouchableOpacity
        accessibilityRole="checkbox"
        accessibilityLabel={`${g.status === 'completed' ? 'Mark pending' : 'Mark complete'}: ${g.content}`}
        accessibilityState={{ checked: g.status === 'completed', disabled: Boolean(statusUpdatingId) || g.status === 'cancelled' }}
        style={[s.checkbox, g.status === 'completed' && s.checkboxDone]}
        onPress={() => void toggleGoal(g.id)}
        disabled={Boolean(statusUpdatingId) || g.status === 'cancelled'}
      >
        {g.status === 'completed' && <Text style={s.checkmark}>✓</Text>}
      </TouchableOpacity>
      <Text style={[s.goalText, g.status === 'completed' && s.goalTextDone]}>{g.content}</Text>
      {g.status === 'pending' ? (
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={`Focus on ${g.content}`}
          style={s.focusBtn}
          onPress={() =>
            router.push({
              pathname: '/focus',
              params: { source: 'goals', goalId: g.id },
            })
          }
        >
          <Text style={s.focusBtnText}>Focus</Text>
        </TouchableOpacity>
      ) : null}
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={`Delete ${g.content}`}
        onPress={() => deleteGoal(g.id)}
      >
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
        onSubmitEditing={() => {
          if (!adding) onSubmit();
        }}
        placeholderTextColor={Colors.textSecondary}
        editable={!adding}
      />
      <TouchableOpacity
        style={[s.addSmallBtn, adding && s.addSmallBtnDisabled]}
        onPress={onSubmit}
        disabled={adding || !input.trim()}
      >
        {adding ? <ActivityIndicator size="small" color="#fff" /> : <Text style={s.addSmallBtnText}>+</Text>}
      </TouchableOpacity>
    </View>
  );

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      {librarySourceTitle ? (
        <View style={s.libraryDraft}>
          <Text style={s.libraryDraftLabel}>FROM {librarySourceTitle.toUpperCase()}</Text>
          <Text style={s.libraryDraftText}>{input}</Text>
          <Text style={s.libraryDraftHint}>Review this draft in Simple priorities before adding it.</Text>
        </View>
      ) : null}

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
          <Text style={s.progressLabel}>{"Today's Progress"}</Text>
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
        <Text style={s.cardTitle}>{"📅 Today's Goals"} ({format(new Date(), 'MMM dd')})</Text>
        {goalError ? <Text style={s.errorText}>{goalError}</Text> : null}
        {goalStatusChange ? (
          <View accessibilityLiveRegion="polite" style={s.undoBanner}>
            <Text style={s.undoText}>{goalCompletionFeedback(goalStatusChange.to)}</Text>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Undo goal status change"
              onPress={() => void undoGoalStatus()}
              disabled={Boolean(statusUpdatingId)}
            >
              <Text style={s.undoAction}>Undo</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {framework === 'simple' && (
          <>
            {frameworkGoals.length < 3 && renderAddInput(() => { void addGoal(input); })}
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
                  <TextInput style={s.input} placeholder="Add task..." value={input} onChangeText={setInput} onSubmitEditing={() => { void addGoal(input, undefined, q.id); }} placeholderTextColor={Colors.textSecondary} editable={!adding} autoFocus />
                  <TouchableOpacity style={[s.addSmallBtn, adding && s.addSmallBtnDisabled]} onPress={() => { void addGoal(input, undefined, q.id); }} disabled={adding || !input.trim()}>
                    {adding ? <ActivityIndicator size="small" color="#fff" /> : <Text style={s.addSmallBtnText}>+</Text>}
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
            {frameworkGoals.length < 6 && renderAddInput(() => { void addGoal(input); })}
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
                  <TextInput style={s.input} placeholder="Add task..." value={input} onChangeText={setInput} onSubmitEditing={() => { void addGoal(input, p.id); }} placeholderTextColor={Colors.textSecondary} editable={!adding} autoFocus />
                  <TouchableOpacity style={[s.addSmallBtn, adding && s.addSmallBtnDisabled]} onPress={() => { void addGoal(input, p.id); }} disabled={adding || !input.trim()}>
                    {adding ? <ActivityIndicator size="small" color="#fff" /> : <Text style={s.addSmallBtnText}>+</Text>}
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
                  <TextInput style={s.input} placeholder="Add task..." value={input} onChangeText={setInput} onSubmitEditing={() => { void addGoal(input, p); }} placeholderTextColor={Colors.textSecondary} editable={!adding} autoFocus />
                  <TouchableOpacity style={[s.addSmallBtn, adding && s.addSmallBtnDisabled]} onPress={() => { void addGoal(input, p); }} disabled={adding || !input.trim()}>
                    {adding ? <ActivityIndicator size="small" color="#fff" /> : <Text style={s.addSmallBtnText}>+</Text>}
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
  libraryDraft: { backgroundColor: '#ecfdf5', borderWidth: 1, borderColor: '#a7f3d0', borderRadius: 14, padding: 14, marginBottom: 14 },
  libraryDraftLabel: { color: '#047857', fontSize: 10, fontWeight: '700', letterSpacing: 0.8 },
  libraryDraftText: { color: '#064e3b', fontSize: 14, lineHeight: 20, fontWeight: '600', marginTop: 5 },
  libraryDraftHint: { color: '#065f46', fontSize: 11, lineHeight: 17, marginTop: 5 },
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
  addSmallBtnDisabled: { opacity: 0.55 },
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
  focusBtn: { minHeight: 36, justifyContent: 'center', borderRadius: 9, backgroundColor: Colors.primaryLight, paddingHorizontal: 10 },
  focusBtnText: { color: Colors.primary, fontSize: 12, fontWeight: '700' },
  deleteBtn: { fontSize: 22, color: Colors.danger, paddingHorizontal: 8 },
  empty: { textAlign: 'center', color: Colors.textSecondary, paddingVertical: 16 },
  errorText: { color: Colors.danger, fontSize: 13, marginBottom: 10 },
  undoBanner: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 11, backgroundColor: Colors.successLight, paddingHorizontal: 12, marginBottom: 12 },
  undoText: { flex: 1, color: Colors.text, fontSize: 13, fontWeight: '600' },
  undoAction: { color: Colors.primary, fontSize: 13, fontWeight: '800' },
});
