import { useEffect, useRef, useState } from 'react';
import Feather from '@expo/vector-icons/Feather';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { supabase } from '@/lib/supabase';
import { useDataContext } from '@/lib/hooks/use-data-context';
import { Colors } from '@/lib/constants';
import { SleepDiary } from '@/components/SleepDiary';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import type { MoodEmoji } from '@/lib/types';
import { saveCheckInWithAttribution } from '@/lib/acquisition';
import { getLocalCheckInFields } from '@/lib/check-in';
import { collectMoodTags, filterMoodEntriesByTag } from '@/lib/mood-filter';
import { getMoodLabel, MOOD_CHOICES } from '@/components/MoodPicker';
import {
  addCustomMoodEmotion,
  composeMoodTags,
  getMoodEmotionOptions,
  getMoodMetadataLabels,
  getMoodSupportOptions,
  MAX_MOOD_EMOTIONS,
  parseMoodMetadata,
  toggleMoodEmotion,
  type MoodEmotion,
  type MoodSupport,
} from '@/lib/mood-check-in';
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
  const [newEmotions, setNewEmotions] = useState<MoodEmotion[]>([]);
  const [customEmotions, setCustomEmotions] = useState<string[]>([]);
  const [customEmotionInput, setCustomEmotionInput] = useState('');
  const [customEmotionOpen, setCustomEmotionOpen] = useState(false);
  const [customEmotionMessage, setCustomEmotionMessage] = useState('');
  const [newSupport, setNewSupport] = useState<MoodSupport | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [filterTag, setFilterTag] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [saveStatus, setSaveStatus] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  const ownerKey = query ? `${query.column}:${query.value}` : null;
  const ownerKeyRef = useRef(ownerKey);
  ownerKeyRef.current = ownerKey;
  const [moodsOwnerKey, setMoodsOwnerKey] = useState<string | null>(null);
  const [draftOwnerKey, setDraftOwnerKey] = useState<string | null>(null);

  useEffect(() => {
    const expectedOwnerKey = ownerKey;
    setMoodsOwnerKey(null);
    setDraftOwnerKey(null);
    setMoods([]);
    setFilterTag(null);
    setHistoryOpen(false);
    setShowAdd(false);
    setNewMood(null);
    setNewNote('');
    setNewEmotions([]);
    setCustomEmotions([]);
    setCustomEmotionInput('');
    setCustomEmotionOpen(false);
    setCustomEmotionMessage('');
    setNewSupport(null);
    setDetailsOpen(false);
    setSaveStatus(null);
    setSaving(false);
    if (!query || !expectedOwnerKey) {
      setLoading(false);
      return;
    }
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
      if (active && ownerKeyRef.current === expectedOwnerKey) {
        setMoods(data ?? []);
        setMoodsOwnerKey(expectedOwnerKey);
        setLoading(false);
      }
    };

    void loadMoods();

    return () => {
      active = false;
    };
  }, [ownerKey, query, refreshKey]);

  const selectMood = (mood: MoodEmoji) => {
    const allowedEmotions = new Set(
      getMoodEmotionOptions(mood).map(({ id }) => id)
    );
    const allowedSupports = new Set(
      getMoodSupportOptions(mood).map(({ id }) => id)
    );
    setNewMood(mood);
    setNewEmotions((current) =>
      current.filter((emotion) => allowedEmotions.has(emotion))
    );
    setNewSupport((current) =>
      current && allowedSupports.has(current) ? current : null
    );
    setDetailsOpen(true);
  };

  const selectEmotion = (emotion: MoodEmotion) => {
    setNewEmotions((current) =>
      toggleMoodEmotion(current, emotion, customEmotions.length)
    );
  };

  const addCustomEmotion = () => {
    const next = addCustomMoodEmotion(
      customEmotions,
      customEmotionInput,
      newEmotions.length
    );
    if (next === customEmotions) {
      setCustomEmotionMessage(
        newEmotions.length + customEmotions.length >= MAX_MOOD_EMOTIONS
          ? 'Remove a word before adding another.'
          : 'Use a different emotion word.'
      );
      return;
    }
    setCustomEmotions(next);
    setCustomEmotionInput('');
    setCustomEmotionMessage('');
    setCustomEmotionOpen(false);
  };

  const handleAdd = async () => {
    if (!newMood || saving) return;
    if (!user?.id) {
      setSaveStatus({
        type: 'error',
        message: 'Your private profile is not ready. Restart the app and try again.',
      });
      return;
    }
    const expectedOwnerKey = ownerKey;
    const expectedUserId = user.id;
    if (!expectedOwnerKey || draftOwnerKey !== expectedOwnerKey) return;
    setSaving(true);
    setSaveStatus(null);
    try {
      const tags = composeMoodTags({
        emotions: newEmotions,
        customEmotions,
        support: newSupport,
        visibleTags: [],
      });
      await saveCheckInWithAttribution(expectedUserId, {
        emoji: newMood,
        note: newNote.trim() || null,
        tags,
        ...getLocalCheckInFields(),
      });
      if (ownerKeyRef.current !== expectedOwnerKey) return;
      setNewMood(null);
      setNewNote('');
      setNewEmotions([]);
      setCustomEmotions([]);
      setCustomEmotionInput('');
      setCustomEmotionMessage('');
      setCustomEmotionOpen(false);
      setNewSupport(null);
      setDetailsOpen(false);
      setFilterTag(null);
      setShowAdd(false);
      setHistoryOpen(true);
      setRefreshKey((key) => key + 1);
      setSaveStatus({ type: 'success', message: 'Mood entry saved.' });
    } catch (error) {
      if (ownerKeyRef.current !== expectedOwnerKey) return;
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
      if (ownerKeyRef.current === expectedOwnerKey) setSaving(false);
    }
  };

  const visibleMoods = moodsOwnerKey === ownerKey ? moods : [];
  const visibleFilterTag = moodsOwnerKey === ownerKey ? filterTag : null;
  const draftMatchesOwner = draftOwnerKey === ownerKey;
  const visibleShowAdd = draftMatchesOwner ? showAdd : false;
  const visibleNewMood = draftMatchesOwner ? newMood : null;
  const visibleHistoryOpen = moodsOwnerKey === ownerKey ? historyOpen : false;
  const allTags = collectMoodTags(
    visibleMoods.map((mood) => ({
      tags: parseMoodMetadata(mood.tags ?? []).visibleTags,
    }))
  );
  const filteredMoods = filterMoodEntriesByTag(visibleMoods, visibleFilterTag);
  const emotionOptions = visibleNewMood ? getMoodEmotionOptions(visibleNewMood) : [];
  const supportOptions = visibleNewMood ? getMoodSupportOptions(visibleNewMood) : [];
  const emotionCount = newEmotions.length + customEmotions.length;

  return (
    <AppScreen>
      <PageHeader
        eyebrow="NOTICE THE PATTERN"
        title="Mood"
        description="Check in, add context if it helps, and look back without judgment."
        action={
          <AppButton
            label={visibleShowAdd ? 'Close' : 'Check in'}
            icon={visibleShowAdd ? 'x' : 'plus'}
            variant={visibleShowAdd ? 'secondary' : 'primary'}
            onPress={() => {
              setDraftOwnerKey(ownerKey);
              setShowAdd(draftMatchesOwner ? !showAdd : true);
            }}
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

      {visibleShowAdd && (
        <AppCard style={s.checkInCard}>
          <SectionHeader
            title="How are you right now?"
            description="Choose the closest fit, then save."
          />
          <View
            accessibilityRole="radiogroup"
            accessibilityLabel="Choose how you feel"
            style={s.moodRow}
          >
            {MOOD_CHOICES.map((choice) => {
              const selected = visibleNewMood === choice.emoji;
              return (
                <Pressable
                  key={choice.emoji}
                  accessibilityRole="radio"
                  accessibilityLabel={`${choice.label} mood`}
                  accessibilityState={{ selected, disabled: saving }}
                  disabled={saving}
                  onPress={() => selectMood(choice.emoji)}
                  style={({ pressed }) => [
                    s.moodChoice,
                    selected && { backgroundColor: choice.tint },
                    selected && s.moodChoiceSelected,
                    pressed && !saving && s.pressed,
                  ]}
                >
                  <Text style={s.moodEmoji}>{choice.emoji}</Text>
                  <Text style={[s.moodLabel, selected && s.moodLabelSelected]}>
                    {choice.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {visibleNewMood ? (
            <>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded: detailsOpen }}
                onPress={() => setDetailsOpen((current) => !current)}
                style={({ pressed }) => [
                  s.disclosure,
                  pressed && s.pressed,
                ]}
              >
                <Text style={s.disclosureText}>
                  {detailsOpen ? 'Hide details' : 'Add details'}
                </Text>
                <Feather
                  name={detailsOpen ? 'chevron-up' : 'chevron-down'}
                  size={18}
                  color={Colors.primary}
                />
              </Pressable>

              {detailsOpen ? (
                <View style={s.details}>
                  <View>
                    <Text style={s.detailTitle}>Put words to it</Text>
                    <Text style={s.detailHelper}>
                      Optional. Choose up to {MAX_MOOD_EMOTIONS}.
                    </Text>
                    <View style={[appUiStyles.wrap, s.choiceWrap]}>
                      {emotionOptions.map((emotion) => (
                        <ChoiceChip
                          key={emotion.id}
                          label={emotion.label}
                          selected={newEmotions.includes(emotion.id)}
                          onPress={() => selectEmotion(emotion.id)}
                        />
                      ))}
                      {customEmotions.map((emotion) => (
                        <ChoiceChip
                          key={emotion}
                          label={emotion}
                          accessibilityLabel={`Remove ${emotion}`}
                          selected
                          icon="x"
                          onPress={() =>
                            setCustomEmotions((current) =>
                              current.filter((item) => item !== emotion)
                            )
                          }
                        />
                      ))}
                      <ChoiceChip
                        label="Add your own"
                        selected={customEmotionOpen}
                        icon="plus"
                        onPress={() => {
                          setCustomEmotionMessage('');
                          setCustomEmotionOpen((current) => !current);
                        }}
                      />
                    </View>
                    {customEmotionOpen ? (
                      <View style={s.customEmotionForm}>
                        <View style={s.customEmotionInput}>
                          <AppInput
                            accessibilityLabel="Custom emotion"
                            placeholder="Type a feeling"
                            value={customEmotionInput}
                            maxLength={32}
                            returnKeyType="done"
                            onSubmitEditing={addCustomEmotion}
                            onChangeText={(value) => {
                              setCustomEmotionInput(value);
                              setCustomEmotionMessage('');
                            }}
                          />
                        </View>
                        <AppButton
                          label="Add"
                          icon="plus"
                          variant="secondary"
                          onPress={addCustomEmotion}
                          disabled={!customEmotionInput.trim() || emotionCount >= MAX_MOOD_EMOTIONS}
                          style={s.customEmotionButton}
                        />
                      </View>
                    ) : null}
                    {customEmotionMessage ? (
                      <Text accessibilityRole="alert" style={s.detailMessage}>
                        {customEmotionMessage}
                      </Text>
                    ) : null}
                  </View>

                  <View>
                    <Text style={s.detailTitle}>Something that might help</Text>
                    <Text style={s.detailHelper}>Optional. Choose one next action.</Text>
                    <View style={[appUiStyles.wrap, s.choiceWrap]}>
                      {supportOptions.map((support) => (
                        <ChoiceChip
                          key={support.id}
                          label={support.label}
                          selected={newSupport === support.id}
                          onPress={() =>
                            setNewSupport((current) =>
                              current === support.id ? null : support.id
                            )
                          }
                        />
                      ))}
                    </View>
                  </View>

                  <AppInput
                    label="Add context (optional)"
                    placeholder="Anything you want to remember?"
                    value={newNote}
                    onChangeText={setNewNote}
                    multiline
                  />
                </View>
              ) : null}
            </>
          ) : null}

          <AppButton
            label="Save check-in"
            icon="check"
            onPress={handleAdd}
            disabled={!visibleNewMood || saving || !user?.id}
            loading={saving}
          />
        </AppCard>
      )}

      <AppCard style={s.historyCard}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: visibleHistoryOpen }}
          onPress={() => setHistoryOpen((current) => !current)}
          style={({ pressed }) => [s.historyHeader, pressed && s.pressed]}
        >
          <View style={s.historyHeaderCopy}>
            <Text style={s.historyTitle}>Recent check-ins</Text>
            <Text style={s.historyDescription}>
              {visibleFilterTag ? `Showing entries tagged ${visibleFilterTag}` : 'This month'}
            </Text>
          </View>
          <Feather
            name={visibleHistoryOpen ? 'chevron-up' : 'chevron-down'}
            size={20}
            color={Colors.textSecondary}
          />
        </Pressable>

        {visibleHistoryOpen ? (
          <View style={s.historyBody}>
            {allTags.length > 0 ? (
              <View style={s.filterBlock}>
                <Text style={s.detailTitle}>Filter</Text>
                <View style={[appUiStyles.wrap, s.choiceWrap]}>
                  <ChoiceChip
                    label="All"
                    selected={!visibleFilterTag}
                    onPress={() => setFilterTag(null)}
                  />
                  {allTags.map((tag) => (
                    <ChoiceChip
                      key={tag}
                      label={tag}
                      selected={visibleFilterTag === tag}
                      onPress={() => setFilterTag(tag)}
                    />
                  ))}
                </View>
              </View>
            ) : null}

            {loading ? (
              <View style={s.loadingCard}>
                <ActivityIndicator color={Colors.primary} />
                <Text style={appUiStyles.muted}>Loading your check-ins...</Text>
              </View>
            ) : filteredMoods.length === 0 ? (
              <EmptyState
                icon="bar-chart-2"
                title={visibleFilterTag ? 'No matching check-ins' : 'Your first check-in starts here'}
                description={
                  visibleFilterTag
                    ? 'Try another tag or show all entries.'
                    : 'A quick check-in gives you something useful to notice over time.'
                }
                action={
                  <AppButton
                    label={visibleFilterTag ? 'Show all' : 'Check in now'}
                    icon={visibleFilterTag ? 'x' : 'plus'}
                    variant={visibleFilterTag ? 'secondary' : 'primary'}
                    onPress={() => {
                      if (visibleFilterTag) setFilterTag(null);
                      else {
                        setDraftOwnerKey(ownerKey);
                        setShowAdd(true);
                      }
                    }}
                    disabled={!visibleFilterTag && !user?.id}
                  />
                }
              />
            ) : (
              <View>
                {filteredMoods.map((mood) => {
                  const tags = mood.tags ?? [];
                  const metadataLabels = getMoodMetadataLabels(tags);
                  const visibleTags = parseMoodMetadata(tags).visibleTags;
                  return (
                    <View key={mood.id} style={s.moodEntry}>
                      <View
                        accessible
                        accessibilityLabel={`${getMoodLabel(mood.emoji)} mood`}
                        style={s.entryEmojiWrap}
                      >
                        <Text style={s.entryEmoji}>{mood.emoji}</Text>
                      </View>
                      <View style={s.entryCopy}>
                        <Text style={s.entryDate}>
                          {format(new Date(mood.created_at), 'MMM d, h:mm a')}
                        </Text>
                        {metadataLabels.length > 0 ? (
                          <Text style={s.entryMetadata}>
                            {metadataLabels.join(' / ')}
                          </Text>
                        ) : null}
                        {mood.note ? <Text style={s.entryNote}>{mood.note}</Text> : null}
                        {visibleTags.length > 0 ? (
                          <View style={s.entryTags}>
                            {visibleTags.map((tag, index) => (
                              <View key={`${mood.id}:${tag}:${index}`} style={s.entryTag}>
                                <Text style={s.entryTagText}>{tag}</Text>
                              </View>
                            ))}
                          </View>
                        ) : null}
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        ) : null}
      </AppCard>
      <SleepDiary />
    </AppScreen>
  );
}

const s = StyleSheet.create({
  headerButton: { minHeight: 42, paddingHorizontal: 14 },
  saveStatus: { color: Colors.primary, fontSize: 13, marginBottom: 12 },
  saveStatusError: { color: '#b42318' },
  checkInCard: { paddingTop: 5 },
  moodRow: { flexDirection: 'row', gap: 5, marginBottom: 12 },
  moodChoice: {
    minWidth: 0,
    minHeight: 80,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
    borderRadius: 14,
    paddingHorizontal: 2,
    paddingVertical: 8,
  },
  moodChoiceSelected: { borderColor: Colors.primary },
  moodEmoji: { fontSize: 27, lineHeight: 34 },
  moodLabel: {
    color: Colors.textSecondary,
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 3,
  },
  moodLabelSelected: { color: Colors.text, fontWeight: '800' },
  disclosure: {
    minHeight: 48,
    marginBottom: 13,
    paddingHorizontal: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  disclosureText: { color: Colors.primary, fontSize: 13, fontWeight: '700' },
  details: { gap: 22, marginBottom: 18 },
  detailTitle: { color: Colors.text, fontSize: 14, fontWeight: '700' },
  detailHelper: { color: Colors.textSecondary, fontSize: 11, lineHeight: 16, marginTop: 3 },
  choiceWrap: { marginTop: 9 },
  customEmotionForm: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 10 },
  customEmotionInput: { flex: 1 },
  customEmotionButton: { minWidth: 76, marginTop: 0 },
  detailMessage: { color: Colors.danger, fontSize: 12, marginTop: -5 },
  historyCard: { padding: 0, overflow: 'hidden' },
  historyHeader: {
    minHeight: 70,
    paddingHorizontal: 17,
    paddingVertical: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  historyHeaderCopy: { flex: 1 },
  historyTitle: { color: Colors.text, fontSize: 18, lineHeight: 23, fontWeight: '700' },
  historyDescription: { color: Colors.textSecondary, fontSize: 12, marginTop: 3 },
  historyBody: { borderTopWidth: StyleSheet.hairlineWidth, borderColor: Colors.border, padding: 17 },
  filterBlock: { marginBottom: 16 },
  loadingCard: { minHeight: 108, alignItems: 'center', justifyContent: 'center', gap: 10 },
  moodEntry: { flexDirection: 'row', gap: 12, paddingVertical: 13, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border },
  entryEmojiWrap: { width: 46, height: 46, borderRadius: 16, backgroundColor: Colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  entryEmoji: { fontSize: 24, lineHeight: 31 },
  entryCopy: { flex: 1 },
  entryDate: { fontSize: 12, color: Colors.textSecondary, marginBottom: 4 },
  entryMetadata: { color: Colors.primary, fontSize: 12, lineHeight: 18, marginBottom: 4 },
  entryNote: { fontSize: 14, lineHeight: 20, color: Colors.text, marginBottom: 7 },
  entryTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  entryTag: { backgroundColor: Colors.background, borderRadius: 999, paddingVertical: 4, paddingHorizontal: 8 },
  entryTagText: { fontSize: 11, color: Colors.textSecondary },
  pressed: { opacity: 0.76 },
});
