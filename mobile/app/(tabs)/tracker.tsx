import { useEffect, useState } from 'react';
import { Alert, View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { supabase } from '@/lib/supabase';
import { useDataContext } from '@/lib/hooks/use-data-context';
import { Colors } from '@/lib/constants';
import { SleepDiary } from '@/components/SleepDiary';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import type { MoodEmoji } from '@/lib/types';
import { saveCheckInWithAttribution } from '@/lib/acquisition';
import { getLocalCheckInFields } from '@/lib/check-in';
import { collectMoodTags, filterMoodEntriesByTag } from '@/lib/mood-filter';
import { getMoodLabel, MoodGlyph, MoodPicker } from '@/components/MoodPicker';
import {
  AppButton,
  AppCard,
  AppInput,
  AppScreen,
  ChoiceChip,
  EmptyState,
  PageHeader,
  SectionHeader,
  appUiStyles,
} from '@/components/AppUI';

interface MoodEntry {
  id: string;
  emoji: MoodEmoji;
  note: string | null;
  tags: string[];
  created_at: string;
}

export default function TrackerScreen() {
  const { query, user } = useDataContext();
  const [moods, setMoods] = useState<MoodEntry[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [newMood, setNewMood] = useState<MoodEmoji | null>(null);
  const [newNote, setNewNote] = useState('');
  const [newTags, setNewTags] = useState('');
  const [filterTag, setFilterTag] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [saveStatus, setSaveStatus] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  useEffect(() => {
    if (!query) return;
    let active = true;

    const loadMoods = async () => {
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

      const { data } = await qb;
      if (active && data) setMoods(data);
      if (active) setLoading(false);
    };

    void loadMoods();

    return () => {
      active = false;
    };
  }, [query, refreshKey]);

  const handleAdd = async () => {
    if (!newMood || saving) return;
    if (!user?.id) {
      setSaveStatus({
        type: 'error',
        message: 'Your private profile is not ready. Restart the app and try again.',
      });
      return;
    }
    setSaving(true);
    setSaveStatus(null);
    try {
      const tags = [
        ...new Set(newTags.split(',').map((tag) => tag.trim()).filter(Boolean)),
      ];
      await saveCheckInWithAttribution({
        emoji: newMood,
        note: newNote || null,
        tags,
        ...getLocalCheckInFields(),
      });
      setNewMood(null);
      setNewNote('');
      setNewTags('');
      setShowAdd(false);
      setRefreshKey((key) => key + 1);
      setSaveStatus({ type: 'success', message: 'Mood entry saved.' });
    } catch (error) {
      console.warn('Unable to save check-in:', error);
      Alert.alert(
        'Unable to Save Check-In',
        'Your check-in was not saved. Please try again.'
      );
      setSaveStatus({
        type: 'error',
        message: 'Your mood entry was not saved. Please try again.',
      });
    } finally {
      setSaving(false);
    }
  };

  const allTags = collectMoodTags(moods);
  const filteredMoods = filterMoodEntriesByTag(moods, filterTag);

  return (
    <AppScreen>
      <PageHeader
        eyebrow="NOTICE THE PATTERN"
        title="Mood"
        description="Check in, add context if it helps, and look back without judgment."
        action={
          <AppButton
            label={showAdd ? 'Close' : 'Check in'}
            icon={showAdd ? 'x' : 'plus'}
            variant={showAdd ? 'secondary' : 'primary'}
            onPress={() => setShowAdd((current) => !current)}
            disabled={!user?.id}
            style={s.headerButton}
          />
        }
      />

      {saveStatus ? (
        <Text
          accessibilityRole={saveStatus.type === 'error' ? 'alert' : 'text'}
          style={[
            s.saveStatus,
            saveStatus.type === 'error' && s.saveStatusError,
          ]}
        >
          {saveStatus.message}
        </Text>
      ) : null}

      {showAdd && (
        <AppCard style={s.checkInCard}>
          <SectionHeader
            title="How are you feeling?"
            description="Choose the closest fit. You can change it later."
          />
          <MoodPicker value={newMood} onChange={setNewMood} disabled={saving} />
          <AppInput
            label="What is affecting it? (optional)"
            placeholder="What's affecting your mood?"
            value={newNote}
            onChangeText={setNewNote}
            multiline
          />
          <AppInput
            label="Tags (optional)"
            helper="Separate tags with commas."
            placeholder="e.g., sleep, work, exercise"
            value={newTags}
            onChangeText={setNewTags}
          />
          <AppButton
            label="Save check-in"
            icon="check"
            onPress={handleAdd}
            disabled={!newMood || saving || !user?.id}
            loading={saving}
          />
        </AppCard>
      )}

      {/* Tag Filter */}
      {allTags.length > 0 && (
        <AppCard quiet>
          <SectionHeader title="Filter" />
          <View style={appUiStyles.wrap}>
            <ChoiceChip label="All" selected={!filterTag} onPress={() => setFilterTag(null)} />
            {allTags.map((tag) => (
              <ChoiceChip
                key={tag}
                label={tag}
                selected={filterTag === tag}
                onPress={() => setFilterTag(tag)}
              />
            ))}
          </View>
        </AppCard>
      )}

      {/* Mood History */}
      <SectionHeader
        title="Recent check-ins"
        description={filterTag ? `Showing entries tagged ${filterTag}` : 'This month'}
      />
      {loading ? (
        <AppCard style={s.loadingCard}>
          <ActivityIndicator color={Colors.primary} />
          <Text style={appUiStyles.muted}>Loading your check-ins...</Text>
        </AppCard>
      ) : filteredMoods.length === 0 ? (
        <EmptyState
          icon="bar-chart-2"
          title={filterTag ? 'No matching check-ins' : 'Your first check-in starts here'}
          description={
            filterTag
              ? 'Try another tag or show all entries.'
              : 'A quick check-in gives you something useful to notice over time.'
          }
          action={
            <AppButton
              label={filterTag ? 'Show all' : 'Check in now'}
              icon={filterTag ? 'x' : 'plus'}
              variant={filterTag ? 'secondary' : 'primary'}
              onPress={() => {
                if (filterTag) setFilterTag(null);
                else setShowAdd(true);
              }}
              disabled={!filterTag && !user?.id}
            />
          }
        />
      ) : (
        <AppCard>
          {filteredMoods.map((mood) => (
            <View key={mood.id} style={s.moodEntry}>
              <View
                accessible
                accessibilityLabel={`${getMoodLabel(mood.emoji)} mood`}
                style={s.entryEmojiWrap}
              >
                <MoodGlyph mood={mood.emoji} size={27} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.entryDate}>
                  {format(new Date(mood.created_at), 'MMM d, h:mm a')}
                </Text>
                {mood.note ? <Text style={s.entryNote}>{mood.note}</Text> : null}
                {mood.tags.length > 0 ? (
                  <View style={s.entryTags}>
                    {mood.tags.map((tag, index) => (
                      <View key={`${mood.id}:${tag}:${index}`} style={s.entryTag}>
                        <Text style={s.entryTagText}>{tag}</Text>
                      </View>
                    ))}
                  </View>
                ) : null}
              </View>
            </View>
          ))}
        </AppCard>
      )}
      <SleepDiary />
    </AppScreen>
  );
}

const s = StyleSheet.create({
  headerButton: { minHeight: 42, paddingHorizontal: 14 },
  saveStatus: { color: Colors.primary, fontSize: 13, marginBottom: 12 },
  saveStatusError: { color: '#b42318' },
  checkInCard: { paddingTop: 5 },
  loadingCard: { minHeight: 108, alignItems: 'center', justifyContent: 'center', gap: 10 },
  moodEntry: { flexDirection: 'row', gap: 12, paddingVertical: 13, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border },
  entryEmojiWrap: { width: 46, height: 46, borderRadius: 16, backgroundColor: Colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  entryDate: { fontSize: 12, color: Colors.textSecondary, marginBottom: 4 },
  entryNote: { fontSize: 14, lineHeight: 20, color: Colors.text, marginBottom: 7 },
  entryTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  entryTag: { backgroundColor: Colors.background, borderRadius: 999, paddingVertical: 4, paddingHorizontal: 8 },
  entryTagText: { fontSize: 11, color: Colors.textSecondary },
});
