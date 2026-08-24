import { useCallback, useEffect, useRef, useState } from 'react';
import Feather from '@expo/vector-icons/Feather';
import { useFocusEffect, useRouter } from 'expo-router';
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
import { format, subDays } from 'date-fns';
import type { MoodEmoji } from '@/lib/types';
import { saveCheckInWithAttribution } from '@/lib/acquisition';
import { getLocalCheckInFields } from '@/lib/check-in';
import { collectMoodTags, filterMoodEntriesByTag } from '@/lib/mood-filter';
import { getMoodLabel, MoodPicker } from '@/components/MoodPicker';
import {
  addCustomMoodEmotion,
  composeMoodTags,
  getMoodEmotionOptions,
  getMoodMetadataLabels,
  getMoodSupportOptions,
  MAX_MOOD_EMOTIONS,
  normalizeCustomMoodSupport,
  parseMoodMetadata,
  reconcileMoodTagsForMood,
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
  InlineStatus,
  PageHeader,
  SectionHeader,
  SupportAction,
  appUiStyles,
} from '@/components/AppUI';
import {
  createMoodDraftPersistenceQueue,
  hasMoodCheckInDraft,
  type MoodCheckInDraft,
} from '@/lib/mood-draft';
import { moodDraftStorage } from '@/lib/mood-draft-storage';
import { AppleHealthInsights } from '@/components/AppleHealthInsights';

interface MoodEntry {
  id: string;
  emoji: MoodEmoji;
  note: string | null;
  tags: string[];
  local_date: string | null;
  created_at: string;
}

export default function TrackerScreen() {
  const router = useRouter();
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
  const [customSupport, setCustomSupport] = useState<string | null>(null);
  const [customSupportInput, setCustomSupportInput] = useState('');
  const [customSupportOpen, setCustomSupportOpen] = useState(false);
  const [customSupportMessage, setCustomSupportMessage] = useState('');
  const [visibleTags, setVisibleTags] = useState<string[]>([]);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(true);
  const [filterTag, setFilterTag] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [moodsLoadError, setMoodsLoadError] = useState(false);
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
  const [draftHydratedOwnerKey, setDraftHydratedOwnerKey] = useState<string | null>(null);
  const [editorHydratedOwnerKey, setEditorHydratedOwnerKey] = useState<string | null>(null);
  const [draftRestored, setDraftRestored] = useState(false);
  const [detailsDirty, setDetailsDirty] = useState(false);
  const [draftLoadError, setDraftLoadError] = useState(false);
  const [draftLoadAttempt, setDraftLoadAttempt] = useState(0);
  const draftPersistenceRef = useRef(
    createMoodDraftPersistenceQueue(moodDraftStorage)
  );
  const detailsOpenRef = useRef(detailsOpen);
  const focusedOwnerRef = useRef<string | null>(null);
  detailsOpenRef.current = detailsOpen;

  useFocusEffect(
    useCallback(() => {
      if (!ownerKey) return;
      if (focusedOwnerRef.current === ownerKey) {
        if (!detailsOpenRef.current) {
          setMoodsOwnerKey(null);
          setEditorHydratedOwnerKey(null);
          setRefreshKey((key) => key + 1);
        }
      } else {
        focusedOwnerRef.current = ownerKey;
      }
    }, [ownerKey])
  );

  useEffect(() => {
    const expectedOwnerKey = ownerKey;
    setMoodsOwnerKey(null);
    setMoods([]);
    setMoodsLoadError(false);
    if (!query || !expectedOwnerKey) {
      setLoading(false);
      return;
    }
    let active = true;

    const loadMoods = async () => {
      setLoading(true);
      const now = new Date();
      const rangeStart = format(subDays(now, 29), 'yyyy-MM-dd');
      const rangeEnd = format(now, 'yyyy-MM-dd');

      try {
        const { data, error } = await supabase
          .from('moods')
          .select('*')
          .eq(query.column, query.value)
          .gte('local_date', rangeStart)
          .lte('local_date', rangeEnd)
          .order('created_at', { ascending: false });
        if (error) throw error;
        if (active && ownerKeyRef.current === expectedOwnerKey) {
          setMoods(data ?? []);
          setMoodsOwnerKey(expectedOwnerKey);
          setMoodsLoadError(false);
          setLoading(false);
        }
      } catch (error) {
        console.warn('Unable to load mood history:', error);
        if (active && ownerKeyRef.current === expectedOwnerKey) {
          setMoodsLoadError(true);
          setLoading(false);
        }
      }
    };

    void loadMoods();

    return () => {
      active = false;
    };
  }, [ownerKey, query, refreshKey]);

  useEffect(() => {
    const expectedOwnerKey = ownerKey;
    const expectedOwnerId = user?.id ?? null;
    setDraftOwnerKey(null);
    setDraftHydratedOwnerKey(null);
    setEditorHydratedOwnerKey(null);
    setDraftRestored(false);
    setDetailsDirty(false);
    setDraftLoadError(false);
    draftPersistenceRef.current.invalidatePendingWrites();
    setFilterTag(null);
    setHistoryOpen(true);
    setShowAdd(false);
    setNewMood(null);
    setNewNote('');
    setNewEmotions([]);
    setCustomEmotions([]);
    setCustomEmotionInput('');
    setCustomEmotionOpen(false);
    setCustomEmotionMessage('');
    setNewSupport(null);
    setCustomSupport(null);
    setCustomSupportInput('');
    setCustomSupportOpen(false);
    setCustomSupportMessage('');
    setVisibleTags([]);
    setDetailsOpen(false);
    setSaveStatus(null);
    setSaving(false);
    if (!expectedOwnerKey || !expectedOwnerId) return;

    let active = true;
    void moodDraftStorage
      .read(expectedOwnerId)
      .then((draft) => {
        if (!active || ownerKeyRef.current !== expectedOwnerKey) return;
        setDraftOwnerKey(expectedOwnerKey);
        setDraftHydratedOwnerKey(expectedOwnerKey);
        setShowAdd(true);
        if (!draft) return;
        setNewMood(draft.mood);
        setNewNote(draft.note);
        setNewEmotions(draft.emotions);
        setCustomEmotions(draft.customEmotions);
        setNewSupport(draft.support);
        setCustomSupport(draft.customSupport);
        setVisibleTags(draft.visibleTags);
        setDetailsOpen(draft.detailsOpen);
        setDraftRestored(true);
        setDetailsDirty(true);
      })
      .catch((error) => {
        console.warn('Unable to restore the mood check-in draft:', error);
        if (active && ownerKeyRef.current === expectedOwnerKey) {
          setDraftOwnerKey(expectedOwnerKey);
          setDraftLoadError(true);
        }
      });

    return () => {
      active = false;
    };
  }, [draftLoadAttempt, ownerKey, user?.id]);

  useEffect(() => {
    if (
      !ownerKey ||
      moodsOwnerKey !== ownerKey ||
      draftHydratedOwnerKey !== ownerKey ||
      editorHydratedOwnerKey === ownerKey
    ) {
      return;
    }

    const localDate = getLocalCheckInFields().local_date;
    const todayEntry = moods.find((mood) => mood.local_date === localDate);
    setShowAdd(true);
    if (todayEntry) {
      const metadata = parseMoodMetadata(todayEntry.tags ?? []);
      if (draftRestored) {
        setVisibleTags((current) => [
          ...new Set([...metadata.visibleTags, ...current]),
        ]);
      } else {
        setNewMood(todayEntry.emoji);
        setNewNote(todayEntry.note ?? '');
        setNewEmotions(metadata.emotions);
        setCustomEmotions(metadata.customEmotions);
        setNewSupport(metadata.support);
        setCustomSupport(metadata.customSupport ?? null);
        setVisibleTags(metadata.visibleTags);
        setDetailsOpen(false);
      }
    } else if (!draftRestored) {
      setDetailsOpen(false);
    }
    setEditorHydratedOwnerKey(ownerKey);
  }, [draftHydratedOwnerKey, draftRestored, editorHydratedOwnerKey, moods, moodsOwnerKey, ownerKey]);

  useEffect(() => {
    const expectedOwnerKey = ownerKey;
    const expectedOwnerId = user?.id ?? null;
    if (
      !expectedOwnerKey ||
      !expectedOwnerId ||
      draftOwnerKey !== expectedOwnerKey ||
      draftHydratedOwnerKey !== expectedOwnerKey ||
      saving
    ) {
      return;
    }

    const draft: MoodCheckInDraft = {
      mood: newMood,
      note: newNote,
      emotions: newEmotions,
      customEmotions,
      support: newSupport,
      customSupport,
      visibleTags,
      detailsOpen,
    };
    const timeout = setTimeout(() => {
      if (!detailsDirty || !hasMoodCheckInDraft(draft)) return;
      void draftPersistenceRef.current.write(expectedOwnerId, draft).catch((error) => {
        console.warn('Unable to preserve the mood check-in draft:', error);
      });
    }, 250);

    return () => clearTimeout(timeout);
  }, [
    customEmotions,
    customSupport,
    detailsOpen,
    detailsDirty,
    draftHydratedOwnerKey,
    draftOwnerKey,
    newEmotions,
    newMood,
    newNote,
    newSupport,
    ownerKey,
    saving,
    user?.id,
    visibleTags,
  ]);

  const persistMood = async ({
    mood,
    note,
    emotions,
    custom,
    support,
    customSupport: nextCustomSupport,
    message,
    updateContext,
  }: {
    mood: MoodEmoji;
    note: string;
    emotions: MoodEmotion[];
    custom: string[];
    support: MoodSupport | null;
    customSupport: string | null;
    message: string;
    updateContext: boolean;
  }): Promise<boolean> => {
    if (saving) return false;
    if (!user?.id) {
      setSaveStatus({
        type: 'error',
        message: 'Your private profile is not ready. Restart the app and try again.',
      });
      return false;
    }
    const expectedOwnerKey = ownerKey;
    const expectedUserId = user.id;
    if (
      !expectedOwnerKey ||
      draftOwnerKey !== expectedOwnerKey ||
      moodsOwnerKey !== expectedOwnerKey ||
      editorHydratedOwnerKey !== expectedOwnerKey
    ) {
      return false;
    }
    setSaving(true);
    setSaveStatus(null);
    try {
      const checkIn = {
        emoji: mood,
        ...getLocalCheckInFields(),
      };
      await saveCheckInWithAttribution(
        expectedUserId,
        updateContext
          ? {
              ...checkIn,
              note: note.trim() || null,
              tags: composeMoodTags({
                emotions,
                customEmotions: custom,
                support,
                customSupport: nextCustomSupport,
                visibleTags,
              }),
            }
          : checkIn
      );
      if (ownerKeyRef.current !== expectedOwnerKey) return false;
      if (updateContext) {
        setDraftRestored(false);
        setDetailsDirty(false);
      }
      setFilterTag(null);
      if (updateContext) {
        try {
          await draftPersistenceRef.current.clear(expectedUserId);
        } catch (draftError) {
          console.warn('Unable to clear the saved mood check-in draft:', draftError);
        }
      }
      setRefreshKey((key) => key + 1);
      setSaveStatus({ type: 'success', message });
      return true;
    } catch (error) {
      if (ownerKeyRef.current !== expectedOwnerKey) return false;
      console.warn('Unable to save check-in:', error);
      Alert.alert(
        'Unable to Save Check-In',
        'Your check-in was not saved. Please try again.'
      );
      setSaveStatus({
        type: 'error',
        message: 'Your mood entry was not saved. Please try again.',
      });
      return false;
    } finally {
      if (ownerKeyRef.current === expectedOwnerKey) setSaving(false);
    }
  };

  const selectMood = (mood: MoodEmoji) => {
    const reconciled = parseMoodMetadata(
      reconcileMoodTagsForMood(
        composeMoodTags({
          emotions: newEmotions,
          customEmotions,
          support: newSupport,
          customSupport,
          visibleTags,
        }),
        mood
      )
    );
    setNewMood(mood);
    setNewEmotions(reconciled.emotions);
    setCustomEmotions(reconciled.customEmotions);
    setNewSupport(reconciled.support);
    setCustomSupport(reconciled.customSupport ?? null);
    setDetailsOpen(false);
    void persistMood({
      mood,
      note: newNote,
      emotions: reconciled.emotions,
      custom: reconciled.customEmotions,
      support: reconciled.support,
      customSupport: reconciled.customSupport ?? null,
      message: 'Check-in saved.',
      updateContext: true,
    });
  };

  const selectEmotion = (emotion: MoodEmotion) => {
    if (saving) return;
    setNewEmotions((current) =>
      toggleMoodEmotion(current, emotion, customEmotions.length, customEmotions)
    );
    setDetailsDirty(true);
  };

  const addCustomEmotion = () => {
    if (saving) return;
    const next = addCustomMoodEmotion(
      customEmotions,
      customEmotionInput,
      newEmotions.length,
      newEmotions.map((emotion) =>
        emotionOptions.find((option) => option.id === emotion)?.label ?? emotion
      )
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
    setDetailsDirty(true);
  };

  const addCustomSupport = () => {
    if (saving) return;
    const next = normalizeCustomMoodSupport(customSupportInput);
    if (!next) {
      setCustomSupportMessage('Add a short action that would help.');
      return;
    }
    setCustomSupport(next);
    setNewSupport(null);
    setCustomSupportInput('');
    setCustomSupportMessage('');
    setCustomSupportOpen(false);
    setDetailsDirty(true);
  };

  const handleAdd = async () => {
    if (!newMood) return;
    const saved = await persistMood({
      mood: newMood,
      note: newNote,
      emotions: newEmotions,
      custom: customEmotions,
      support: newSupport,
      customSupport,
      message: 'Details saved.',
      updateContext: true,
    });
    if (saved) {
      setDetailsOpen(false);
    }
  };

  const visibleMoods = moodsOwnerKey === ownerKey ? moods : [];
  const visibleFilterTag = moodsOwnerKey === ownerKey ? filterTag : null;
  const draftMatchesOwner = draftOwnerKey === ownerKey;
  const editorReady =
    Boolean(ownerKey) &&
    draftMatchesOwner &&
    moodsOwnerKey === ownerKey &&
    editorHydratedOwnerKey === ownerKey;
  const visibleShowAdd = editorReady ? showAdd : false;
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

  const discardDraft = () => {
    const expectedOwnerId = user?.id;
    setShowAdd(false);
    setNewMood(null);
    setNewNote('');
    setNewEmotions([]);
    setCustomEmotions([]);
    setCustomEmotionInput('');
    setCustomEmotionOpen(false);
    setCustomEmotionMessage('');
    setNewSupport(null);
    setCustomSupport(null);
    setCustomSupportInput('');
    setCustomSupportOpen(false);
    setCustomSupportMessage('');
    setVisibleTags([]);
    setDetailsOpen(false);
    setDraftRestored(false);
    setDetailsDirty(false);
    setEditorHydratedOwnerKey(null);
    setSaveStatus({ type: 'success', message: 'Draft discarded.' });
    if (expectedOwnerId) {
      void draftPersistenceRef.current.clear(expectedOwnerId).catch((error) => {
        console.warn('Unable to clear the mood check-in draft:', error);
      });
    }
  };

  return (
    <AppScreen>
      <PageHeader
        eyebrow="A moment to notice"
        title="Mood"
        description="Name what is here. Add context only if it helps."
        action={<SupportAction onPress={() => router.push('/resources')} />}
      />

      {saveStatus ? (
        <InlineStatus
          tone={saveStatus.type}
          message={saveStatus.type === 'success' && saveStatus.message === 'Check-in saved.'
            ? 'Saved. That is enough for now.'
            : saveStatus.message}
        />
      ) : null}

      {draftLoadError ? (
        <View accessibilityRole="alert" style={s.draftErrorRow}>
          <Text style={s.saveStatusError}>
            Draft protection is temporarily unavailable.
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Retry loading private mood draft"
            onPress={() => setDraftLoadAttempt((attempt) => attempt + 1)}
            style={({ pressed }) => [pressed && s.pressed]}
          >
            <Text style={s.retryDraft}>Retry</Text>
          </Pressable>
        </View>
      ) : null}

      {moodsLoadError ? (
        <View accessibilityRole="alert" style={s.draftErrorRow}>
          <Text style={s.saveStatusError}>
            Your saved check-ins could not be loaded. Nothing can be changed yet.
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Retry loading mood check-ins"
            onPress={() => setRefreshKey((key) => key + 1)}
            style={({ pressed }) => [pressed && s.pressed]}
          >
            <Text style={s.retryDraft}>Retry</Text>
          </Pressable>
        </View>
      ) : null}

      {!moodsLoadError && !draftLoadError && ownerKey && !editorReady ? (
        <AppCard style={s.loadingCard}>
          <ActivityIndicator color={Colors.primary} />
          <Text style={appUiStyles.muted}>Loading your private check-in...</Text>
        </AppCard>
      ) : null}

      {visibleShowAdd && (
        <View style={s.checkInSection}>
          <SectionHeader
            title="How are you right now?"
            description="Tap the closest feeling."
          />
          {draftRestored ? (
            <View
              accessibilityLiveRegion="polite"
              style={s.draftNotice}
            >
              <Feather name="shield" size={16} color={Colors.primary} />
              <Text style={s.draftNoticeText}>Private draft restored</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Discard restored mood draft"
                onPress={discardDraft}
                style={({ pressed }) => [pressed && s.pressed]}
              >
                <Text style={s.discardDraft}>Discard</Text>
              </Pressable>
            </View>
          ) : null}
          <MoodPicker
            value={visibleNewMood}
            onChange={selectMood}
            disabled={saving || !editorReady}
          />

          {visibleNewMood ? (
            <>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded: detailsOpen }}
                disabled={saving}
                onPress={() => setDetailsOpen((current) => !current)}
                style={({ pressed }) => [
                  s.disclosure,
                  saving && s.disabled,
                  pressed && !saving && s.pressed,
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
                          disabled={saving}
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
                          disabled={saving}
                          onPress={() => {
                            setCustomEmotions((current) =>
                              current.filter((item) => item !== emotion)
                            );
                            setDetailsDirty(true);
                          }}
                        />
                      ))}
                      <ChoiceChip
                        label="Add your own"
                        selected={customEmotionOpen}
                        icon="plus"
                        disabled={saving}
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
                            editable={!saving}
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
                          disabled={
                            saving ||
                            !customEmotionInput.trim() ||
                            emotionCount >= MAX_MOOD_EMOTIONS
                          }
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
                          disabled={saving}
                          onPress={() => {
                            setNewSupport((current) =>
                              current === support.id ? null : support.id
                            );
                            setCustomSupport(null);
                            setDetailsDirty(true);
                          }}
                        />
                      ))}
                      {customSupport ? (
                        <ChoiceChip
                          label={customSupport}
                          accessibilityLabel={`Remove ${customSupport}`}
                          selected
                          icon="x"
                          disabled={saving}
                          onPress={() => {
                            setCustomSupport(null);
                            setDetailsDirty(true);
                          }}
                        />
                      ) : null}
                      <ChoiceChip
                        label="Add your own action"
                        selected={customSupportOpen}
                        icon="plus"
                        disabled={saving}
                        onPress={() => {
                          setCustomSupportMessage('');
                          setCustomSupportOpen((current) => !current);
                        }}
                      />
                    </View>
                    {customSupportOpen ? (
                      <View style={s.customEmotionForm}>
                        <View style={s.customEmotionInput}>
                          <AppInput
                            accessibilityLabel="Custom helpful action"
                            placeholder="What might help?"
                            value={customSupportInput}
                            editable={!saving}
                            maxLength={48}
                            returnKeyType="done"
                            onSubmitEditing={addCustomSupport}
                            onChangeText={(value) => {
                              setCustomSupportInput(value);
                              setCustomSupportMessage('');
                            }}
                          />
                        </View>
                        <AppButton
                          label="Add"
                          icon="plus"
                          variant="secondary"
                          onPress={addCustomSupport}
                          disabled={saving || !customSupportInput.trim()}
                          style={s.customEmotionButton}
                        />
                      </View>
                    ) : null}
                    {customSupportMessage ? (
                      <Text accessibilityRole="alert" style={s.detailMessage}>
                        {customSupportMessage}
                      </Text>
                    ) : null}
                  </View>

                  <AppInput
                    label="Add context (optional)"
                    placeholder="Anything you want to remember?"
                    value={newNote}
                    editable={!saving}
                    onChangeText={(value) => {
                      setNewNote(value);
                      setDetailsDirty(true);
                    }}
                    maxLength={500}
                    multiline
                  />
                </View>
              ) : null}
            </>
          ) : null}

          {detailsOpen ? (
            <AppButton
              label="Save details"
              icon="check"
              onPress={handleAdd}
              disabled={!visibleNewMood || saving || !user?.id || !editorReady}
              loading={saving}
            />
          ) : null}
        </View>
      )}

      <View style={s.historySection}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: visibleHistoryOpen }}
          onPress={() => setHistoryOpen((current) => !current)}
          style={({ pressed }) => [s.historyHeader, pressed && s.pressed]}
        >
          <View style={s.historyHeaderCopy}>
            <Text style={s.historyTitle}>Mood history</Text>
            <Text style={s.historyDescription}>
              {visibleFilterTag
                ? `Showing entries tagged ${visibleFilterTag}`
                : loading
                  ? 'Loading the last 30 days'
                  : `${visibleMoods.length} ${visibleMoods.length === 1 ? 'check-in' : 'check-ins'} in the last 30 days`}
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
      </View>
      <AppleHealthInsights ownerId={user?.id ?? null} />
      <SleepDiary />
    </AppScreen>
  );
}

const s = StyleSheet.create({
  saveStatus: { color: Colors.primary, fontSize: 13, marginBottom: 12 },
  saveStatusError: { color: '#b42318' },
  draftErrorRow: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 12,
  },
  retryDraft: { color: Colors.primary, fontSize: 13, fontWeight: '700' },
  disabled: { opacity: 0.48 },
  checkInSection: { paddingTop: 5, marginBottom: 10 },
  draftNotice: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 12,
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 12,
    marginBottom: 14,
  },
  draftNoticeText: { flex: 1, color: Colors.text, fontSize: 13, fontWeight: '600' },
  discardDraft: { color: Colors.primary, fontSize: 13, fontWeight: '700' },
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
  historySection: {
    overflow: 'hidden',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  historyHeader: {
    minHeight: 70,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  historyHeaderCopy: { flex: 1 },
  historyTitle: { color: Colors.text, fontSize: 18, lineHeight: 23, fontWeight: '700' },
  historyDescription: { color: Colors.textSecondary, fontSize: 12, marginTop: 3 },
  historyBody: { borderTopWidth: StyleSheet.hairlineWidth, borderColor: Colors.border, paddingVertical: 17 },
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
