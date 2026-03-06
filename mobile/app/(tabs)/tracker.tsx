import { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet, ActivityIndicator } from 'react-native';
import { supabase } from '@/lib/supabase';
import { useDataContext } from '@/lib/hooks/use-data-context';
import { Colors } from '@/lib/constants';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import type { MoodEmoji } from '@/lib/types';

const moodEmojis: MoodEmoji[] = ['\u{1F604}', '\u{1F642}', '\u{1F610}', '\u{1F61E}', '\u{1F622}'];
const moodLabels = ['Great', 'Good', 'Okay', 'Low', 'Very Low'];

interface MoodEntry {
  id: string;
  emoji: MoodEmoji;
  note: string | null;
  tags: string[];
  created_at: string;
}

export default function TrackerScreen() {
  const { context, query } = useDataContext();
  const [moods, setMoods] = useState<MoodEntry[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [newMood, setNewMood] = useState<MoodEmoji | null>(null);
  const [newNote, setNewNote] = useState('');
  const [newTags, setNewTags] = useState('');
  const [filterTag, setFilterTag] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMoods();
  }, [query, filterTag]);

  const loadMoods = async () => {
    if (!query) return;
    setLoading(true);
    const monthStart = startOfMonth(new Date()).toISOString();
    const monthEnd = endOfMonth(new Date()).toISOString();

    let qb = supabase
      .from('moods')
      .select('*')
      .eq(query.column, query.value)
      .gte('created_at', monthStart)
      .lte('created_at', monthEnd)
      .order('created_at', { ascending: false });

    if (filterTag) qb = qb.contains('tags', [filterTag]);

    const { data } = await qb;
    if (data) setMoods(data);
    setLoading(false);
  };

  const handleAdd = async () => {
    if (!newMood) return;
    const tags = newTags.split(',').map((t) => t.trim()).filter((t) => t);
    const { error } = await supabase.from('moods').insert({
      ...context,
      emoji: newMood,
      note: newNote || null,
      tags,
    } as any);
    if (!error) {
      setNewMood(null);
      setNewNote('');
      setNewTags('');
      setShowAdd(false);
      loadMoods();
    }
  };

  const allTags = [...new Set(moods.flatMap((m) => m.tags))];

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      <View style={s.header}>
        <View>
          <Text style={s.title}>Mood Tracker</Text>
          <Text style={s.subtitle}>Your emotional journey over time</Text>
        </View>
        <TouchableOpacity style={s.addBtn} onPress={() => setShowAdd(!showAdd)}>
          <Text style={s.addBtnText}>{showAdd ? 'Cancel' : '+ Add'}</Text>
        </TouchableOpacity>
      </View>

      {showAdd && (
        <View style={s.card}>
          <Text style={s.cardTitle}>Add Mood Entry</Text>
          <Text style={[s.label, { marginTop: 12 }]}>How are you feeling?</Text>
          <View style={s.moodRow}>
            {moodEmojis.map((emoji, i) => (
              <TouchableOpacity
                key={emoji}
                onPress={() => setNewMood(emoji)}
                style={[s.moodBtn, newMood === emoji && s.moodBtnActive]}
              >
                <Text style={s.moodEmoji}>{emoji}</Text>
                <Text style={s.moodLabel}>{moodLabels[i]}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={s.label}>Note (optional)</Text>
          <TextInput
            style={s.textArea}
            placeholder="What's affecting your mood?"
            value={newNote}
            onChangeText={setNewNote}
            multiline
            placeholderTextColor={Colors.textSecondary}
          />
          <Text style={s.label}>Tags (comma-separated)</Text>
          <TextInput
            style={s.input}
            placeholder="e.g., sleep, work, exercise"
            value={newTags}
            onChangeText={setNewTags}
            placeholderTextColor={Colors.textSecondary}
          />
          <TouchableOpacity
            style={[s.saveBtn, !newMood && s.saveBtnDisabled]}
            onPress={handleAdd}
            disabled={!newMood}
          >
            <Text style={s.saveBtnText}>Save Mood</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Tag Filter */}
      {allTags.length > 0 && (
        <View style={s.card}>
          <Text style={s.cardTitle}>Filter by Tag</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 12 }}>
            <TouchableOpacity
              style={[s.tagBtn, !filterTag && s.tagBtnActive]}
              onPress={() => setFilterTag(null)}
            >
              <Text style={[s.tagText, !filterTag && s.tagTextActive]}>All</Text>
            </TouchableOpacity>
            {allTags.map((tag) => (
              <TouchableOpacity
                key={tag}
                style={[s.tagBtn, filterTag === tag && s.tagBtnActive]}
                onPress={() => setFilterTag(tag)}
              >
                <Text style={[s.tagText, filterTag === tag && s.tagTextActive]}>{tag}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Mood History */}
      <View style={s.card}>
        <Text style={s.cardTitle}>Mood History</Text>
        {loading ? (
          <ActivityIndicator style={{ marginTop: 20 }} color={Colors.primary} />
        ) : moods.length === 0 ? (
          <Text style={s.empty}>No mood entries for this period</Text>
        ) : (
          moods.map((mood) => (
            <View key={mood.id} style={s.moodEntry}>
              <Text style={s.entryEmoji}>{mood.emoji}</Text>
              <View style={{ flex: 1 }}>
                <Text style={s.entryDate}>
                  {format(new Date(mood.created_at), 'MMMM dd, yyyy - h:mm a')}
                </Text>
                {mood.note && <Text style={s.entryNote}>{mood.note}</Text>}
                {mood.tags.length > 0 && (
                  <View style={s.entryTags}>
                    {mood.tags.map((tag, i) => (
                      <View key={i} style={s.entryTag}>
                        <Text style={s.entryTagText}>{tag}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 16, paddingBottom: 40 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  title: { fontSize: 28, fontWeight: '700', color: Colors.text },
  subtitle: { fontSize: 14, color: Colors.textSecondary, marginTop: 4 },
  addBtn: { backgroundColor: Colors.primary, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 16 },
  addBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  card: { backgroundColor: Colors.card, borderRadius: 16, padding: 20, marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  cardTitle: { fontSize: 18, fontWeight: '600', color: Colors.text },
  label: { fontSize: 14, fontWeight: '500', color: Colors.text, marginBottom: 8, marginTop: 16 },
  moodRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  moodBtn: { alignItems: 'center', padding: 8, borderRadius: 12 },
  moodBtnActive: { backgroundColor: '#dbeafe', borderWidth: 2, borderColor: Colors.primary },
  moodEmoji: { fontSize: 28 },
  moodLabel: { fontSize: 11, color: Colors.textSecondary, marginTop: 4 },
  input: { backgroundColor: Colors.background, borderWidth: 1, borderColor: Colors.border, borderRadius: 10, padding: 12, fontSize: 15, color: Colors.text },
  textArea: { backgroundColor: Colors.background, borderWidth: 1, borderColor: Colors.border, borderRadius: 10, padding: 12, fontSize: 15, color: Colors.text, minHeight: 80, textAlignVertical: 'top' },
  saveBtn: { backgroundColor: Colors.primary, borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 20 },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  tagBtn: { borderWidth: 1, borderColor: Colors.border, borderRadius: 8, paddingVertical: 6, paddingHorizontal: 14, marginRight: 8 },
  tagBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  tagText: { fontSize: 13, color: Colors.text },
  tagTextActive: { color: '#fff' },
  empty: { textAlign: 'center', color: Colors.textSecondary, paddingVertical: 24 },
  moodEntry: { flexDirection: 'row', gap: 14, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.border },
  entryEmoji: { fontSize: 36 },
  entryDate: { fontSize: 12, color: Colors.textSecondary, marginBottom: 4 },
  entryNote: { fontSize: 14, color: Colors.text, marginBottom: 6 },
  entryTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  entryTag: { backgroundColor: Colors.background, borderRadius: 6, paddingVertical: 3, paddingHorizontal: 8 },
  entryTagText: { fontSize: 11, color: Colors.textSecondary },
});
