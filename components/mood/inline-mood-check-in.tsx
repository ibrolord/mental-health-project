'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Check, ChevronDown, Plus, X } from 'lucide-react';
import { saveCheckInWithAttribution } from '@/lib/acquisition';
import { getLocalCheckInFields } from '@/lib/check-in';
import {
  addCustomMoodEmotion,
  composeMoodTags,
  createMoodUndoPlan,
  getMoodEmotionOptions,
  getMoodSupportOptions,
  isCurrentOwnerGeneration,
  MAX_MOOD_EMOTIONS,
  moodDraftFromEntry,
  serializeMoodDraft,
  toggleMoodEmotion,
  type MoodDraft,
  type MoodEmotion,
  type MoodUndoPlan,
  type OwnerGeneration,
  type MoodSupport,
} from '@/lib/mood-check-in';
import { supabase } from '@/lib/supabase/client';
import type { MoodEmoji } from '@/lib/supabase/types';
import { cn } from '@/lib/utils';

export interface TrackerMoodEntry {
  id: string;
  emoji: MoodEmoji;
  note: string | null;
  tags: string[];
  created_at: string;
  local_date: string;
  utc_offset_minutes: number;
}

interface MoodOwner {
  column: 'user_id' | 'session_id';
  value: string;
}

interface InlineMoodCheckInProps {
  owner: MoodOwner | null;
  ownerGeneration: number;
  initialEntry: TrackerMoodEntry | null;
  loading: boolean;
  onEntryChange: (
    previousId: string | null,
    entry: TrackerMoodEntry | null
  ) => void;
}

type SaveState = 'idle' | 'saving' | 'saved-fresh' | 'saved-aged' | 'error';

const moods: Array<{
  emoji: MoodEmoji;
  label: string;
  color: string;
}> = [
  { emoji: '😄', label: 'Great', color: 'bg-[#CFE3F0]' },
  { emoji: '🙂', label: 'Good', color: 'bg-[#D7E8DC]' },
  { emoji: '😐', label: 'Okay', color: 'bg-[#E9E7DA]' },
  { emoji: '😞', label: 'Low', color: 'bg-[#F4D8CE]' },
  { emoji: '😢', label: 'Very low', color: 'bg-[#EBD6E2]' },
];

function toEntry(
  id: string,
  draft: MoodDraft,
  fallbackCreatedAt: string
): TrackerMoodEntry {
  const localFields = getLocalCheckInFields();
  return {
    id,
    emoji: draft.emoji as MoodEmoji,
    note: draft.note.trim() || null,
    tags: composeMoodTags(draft),
    created_at: fallbackCreatedAt,
    ...localFields,
  };
}

export function InlineMoodCheckIn({
  owner,
  ownerGeneration,
  initialEntry,
  loading,
  onEntryChange,
}: InlineMoodCheckInProps) {
  const ownerKey = owner ? `${owner.column}:${owner.value}` : null;
  const operationOwner: OwnerGeneration = {
    ownerKey,
    generation: ownerGeneration,
  };
  const initialDraft = moodDraftFromEntry(initialEntry);
  const [draft, setDraft] = useState<MoodDraft>(initialDraft);
  const [saveState, setSaveState] = useState<SaveState>(
    initialEntry ? 'saved-aged' : 'idle'
  );
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [contextOpen, setContextOpen] = useState(false);
  const [customEmotionOpen, setCustomEmotionOpen] = useState(false);
  const [customEmotionInput, setCustomEmotionInput] = useState('');

  const cardRef = useRef<HTMLDivElement>(null);
  const draftRef = useRef(initialDraft);
  const entryRef = useRef<TrackerMoodEntry | null>(initialEntry);
  const undoPlanRef = useRef<MoodUndoPlan<TrackerMoodEntry> | null>(null);
  const persistedDraftRef = useRef(serializeMoodDraft(initialDraft));
  const desiredRevisionRef = useRef(0);
  const persistedRevisionRef = useRef(0);
  const failedRevisionRef = useRef<number | null>(null);
  const persistenceRunningRef = useRef(false);
  const deleteRunningRef = useRef(false);
  const [deleteRunning, setDeleteRunning] = useState(false);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const contextSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const contextSaveOwnerRef = useRef<OwnerGeneration | null>(null);
  const flushContextDraftRef = useRef<() => void>(() => undefined);
  const mountedRef = useRef(true);
  const ownerRef = useRef(owner);
  const onEntryChangeRef = useRef(onEntryChange);
  const ownerGenerationRef = useRef(operationOwner);
  const stateOwnerGenerationRef = useRef(operationOwner);
  ownerRef.current = owner;
  onEntryChangeRef.current = onEntryChange;
  ownerGenerationRef.current = operationOwner;

  const clearSavedTimer = () => {
    if (savedTimerRef.current) {
      clearTimeout(savedTimerRef.current);
      savedTimerRef.current = null;
    }
  };

  const showFreshSavedState = (savedForOwner: OwnerGeneration) => {
    clearSavedTimer();
    setSaveState('saved-fresh');
    savedTimerRef.current = setTimeout(() => {
      if (
        mountedRef.current &&
        isCurrentOwnerGeneration(ownerGenerationRef.current, savedForOwner)
      ) {
        setSaveState('saved-aged');
      }
    }, 6000);
  };

  const clearContextSaveTimer = () => {
    if (contextSaveTimerRef.current) {
      clearTimeout(contextSaveTimerRef.current);
      contextSaveTimerRef.current = null;
    }
  };

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clearSavedTimer();
    };
  }, []);

  useEffect(() => {
    const effectOwner: OwnerGeneration = {
      ownerKey,
      generation: ownerGeneration,
    };
    const ownerChanged = !isCurrentOwnerGeneration(
      stateOwnerGenerationRef.current,
      effectOwner
    );
    if (!ownerChanged && persistenceRunningRef.current) return;
    if (!ownerChanged && entryRef.current?.id === initialEntry?.id) return;

    const nextDraft = moodDraftFromEntry(initialEntry);
    stateOwnerGenerationRef.current = effectOwner;
    entryRef.current = initialEntry;
    undoPlanRef.current = null;
    draftRef.current = nextDraft;
    persistedDraftRef.current = serializeMoodDraft(nextDraft);
    if (ownerChanged) {
      clearSavedTimer();
      clearContextSaveTimer();
      contextSaveOwnerRef.current = null;
      desiredRevisionRef.current = 0;
      persistedRevisionRef.current = 0;
      failedRevisionRef.current = null;
    }
    setDraft(nextDraft);
    setSaveState(initialEntry ? 'saved-aged' : 'idle');
    setDetailsOpen(false);
    setContextOpen(false);
    setCustomEmotionOpen(false);
    setCustomEmotionInput('');
  }, [initialEntry, ownerGeneration, ownerKey]);

  const persistQueuedDraft = async (): Promise<void> => {
    const persistenceOwner = ownerRef.current;
    const persistenceGeneration = ownerGenerationRef.current;
    if (
      persistenceRunningRef.current ||
      !persistenceOwner ||
      !persistenceGeneration.ownerKey ||
      !draftRef.current.emoji
    ) {
      return;
    }
    persistenceRunningRef.current = true;

    try {
      while (persistedRevisionRef.current < desiredRevisionRef.current) {
        if (
          !isCurrentOwnerGeneration(
            ownerGenerationRef.current,
            persistenceGeneration
          )
        ) {
          break;
        }
        const targetRevision = desiredRevisionRef.current;
        const snapshot: MoodDraft = {
          ...draftRef.current,
          emotions: [...draftRef.current.emotions],
          customEmotions: [...draftRef.current.customEmotions],
          visibleTags: [...draftRef.current.visibleTags],
        };
        const serializedSnapshot = serializeMoodDraft(snapshot);
        if (mountedRef.current) setSaveState('saving');

        try {
          let currentEntry = entryRef.current;

          if (!currentEntry) {
            const localDate = getLocalCheckInFields().local_date;
            const { data: existing, error: existingError } = await supabase
              .from('moods')
              .select('*')
              .eq(persistenceOwner.column, persistenceOwner.value)
              .eq('local_date', localDate)
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle();

            if (existingError) throw existingError;
            if (
              !isCurrentOwnerGeneration(
                ownerGenerationRef.current,
                persistenceGeneration
              )
            ) {
              break;
            }
            if (existing) currentEntry = existing as TrackerMoodEntry;
          }

          const previousId = currentEntry?.id ?? null;
          let savedEntry: TrackerMoodEntry;

          if (currentEntry) {
            const { data, error } = await supabase
              .from('moods')
              .update({
                emoji: snapshot.emoji as MoodEmoji,
                note: snapshot.note.trim() || null,
                tags: composeMoodTags(snapshot),
              })
              .eq('id', currentEntry.id)
              .eq(persistenceOwner.column, persistenceOwner.value)
              .select('*')
              .single();

            if (error) throw error;
            savedEntry = data as TrackerMoodEntry;
          } else {
            if (persistenceOwner.column !== 'user_id') {
              throw new Error('Your private profile is not ready.');
            }
            const localFields = getLocalCheckInFields();
            const id = await saveCheckInWithAttribution(persistenceOwner.value, {
              emoji: snapshot.emoji as MoodEmoji,
              note: snapshot.note.trim() || null,
              tags: composeMoodTags(snapshot),
              ...localFields,
            });
            savedEntry = toEntry(id, snapshot, new Date().toISOString());
          }

          if (
            !isCurrentOwnerGeneration(
              ownerGenerationRef.current,
              persistenceGeneration
            )
          ) {
            break;
          }

          entryRef.current = savedEntry;
          undoPlanRef.current = createMoodUndoPlan(currentEntry, savedEntry);
          persistedDraftRef.current = serializedSnapshot;
          persistedRevisionRef.current = targetRevision;
          failedRevisionRef.current = null;
          if (mountedRef.current) {
            onEntryChangeRef.current(previousId, savedEntry);
          }

          if (targetRevision === desiredRevisionRef.current && mountedRef.current) {
            showFreshSavedState(persistenceGeneration);
          }
        } catch (error) {
          console.error('Unable to save mood check-in:', error);
          if (
            !isCurrentOwnerGeneration(
              ownerGenerationRef.current,
              persistenceGeneration
            )
          ) {
            break;
          }
          failedRevisionRef.current = targetRevision;
          if (targetRevision === desiredRevisionRef.current && mountedRef.current) {
            clearSavedTimer();
            setSaveState('error');
          }
          break;
        }
      }
    } finally {
      persistenceRunningRef.current = false;
      if (
        ownerGenerationRef.current.ownerKey !== null &&
        persistedRevisionRef.current < desiredRevisionRef.current &&
        failedRevisionRef.current !== desiredRevisionRef.current
      ) {
        void persistQueuedDraft();
      }
    }
  };

  const queueDraftPersistence = () => {
    if (
      !draftRef.current.emoji ||
      !isCurrentOwnerGeneration(
        stateOwnerGenerationRef.current,
        ownerGenerationRef.current
      ) ||
      serializeMoodDraft(draftRef.current) === persistedDraftRef.current
    ) {
      return;
    }

    desiredRevisionRef.current += 1;
    failedRevisionRef.current = null;
    void persistQueuedDraft();
  };

  const applyDraft = (nextDraft: MoodDraft, persist = true) => {
    if (deleteRunningRef.current) return;
    draftRef.current = nextDraft;
    setDraft(nextDraft);
    if (!persist || !nextDraft.emoji) return;
    queueDraftPersistence();
  };

  const flushContextDraft = (
    scheduledFor = contextSaveOwnerRef.current
  ): void => {
    clearContextSaveTimer();
    contextSaveOwnerRef.current = null;
    if (
      !scheduledFor ||
      !isCurrentOwnerGeneration(ownerGenerationRef.current, scheduledFor)
    ) {
      return;
    }
    queueDraftPersistence();
  };
  flushContextDraftRef.current = () => flushContextDraft();

  const scheduleContextDraft = (nextDraft: MoodDraft) => {
    applyDraft(nextDraft, false);
    clearContextSaveTimer();
    const scheduledFor = ownerGenerationRef.current;
    contextSaveOwnerRef.current = scheduledFor;
    contextSaveTimerRef.current = setTimeout(
      () => flushContextDraft(scheduledFor),
      500
    );
  };

  useEffect(() => {
    const handlePageHide = () => flushContextDraftRef.current();
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        flushContextDraftRef.current();
      }
    };

    window.addEventListener('pagehide', handlePageHide);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.removeEventListener('pagehide', handlePageHide);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      flushContextDraftRef.current();
    };
  }, []);

  const selectMood = (emoji: MoodEmoji) => {
    const allowedEmotions = new Set(
      getMoodEmotionOptions(emoji).map(({ id }) => id)
    );
    const allowedSupports = new Set(
      getMoodSupportOptions(emoji).map(({ id }) => id)
    );
    applyDraft({
      ...draftRef.current,
      emoji,
      emotions: draftRef.current.emotions.filter((emotion) =>
        allowedEmotions.has(emotion)
      ),
      support:
        draftRef.current.support && allowedSupports.has(draftRef.current.support)
          ? draftRef.current.support
          : null,
    });
    setDetailsOpen(true);
  };

  const toggleEmotion = (emotion: MoodEmotion) => {
    const emotions = toggleMoodEmotion(
      draftRef.current.emotions,
      emotion,
      draftRef.current.customEmotions.length
    );
    if (emotions === draftRef.current.emotions) return;
    applyDraft({ ...draftRef.current, emotions });
  };

  const submitCustomEmotion = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const customEmotions = addCustomMoodEmotion(
      draftRef.current.customEmotions,
      customEmotionInput,
      draftRef.current.emotions.length
    );
    if (customEmotions === draftRef.current.customEmotions) return;
    applyDraft({ ...draftRef.current, customEmotions });
    setCustomEmotionInput('');
    setCustomEmotionOpen(false);
  };

  const removeCustomEmotion = (emotion: string) => {
    applyDraft({
      ...draftRef.current,
      customEmotions: draftRef.current.customEmotions.filter(
        (item) => item !== emotion
      ),
    });
  };

  const toggleSupport = (support: MoodSupport) => {
    applyDraft({
      ...draftRef.current,
      support: draftRef.current.support === support ? null : support,
    });
  };

  const retrySave = () => {
    if (!draftRef.current.emoji) return;
    desiredRevisionRef.current += 1;
    failedRevisionRef.current = null;
    void persistQueuedDraft();
  };

  const undoCheckIn = async () => {
    const undoOwner = ownerRef.current;
    const undoGeneration = ownerGenerationRef.current;
    const currentEntry = entryRef.current;
    const undoPlan = undoPlanRef.current;
    if (
      !undoOwner ||
      !undoGeneration.ownerKey ||
      !currentEntry ||
      !undoPlan ||
      undoPlan.savedEntry.id !== currentEntry.id ||
      persistenceRunningRef.current ||
      deleteRunningRef.current
    ) {
      return;
    }

    deleteRunningRef.current = true;
    setDeleteRunning(true);
    clearSavedTimer();
    setSaveState('saving');
    try {
      let restoredEntry: TrackerMoodEntry | null = null;
      if (undoPlan.kind === 'delete') {
        const { error } = await supabase
          .from('moods')
          .delete()
          .eq('id', currentEntry.id)
          .eq(undoOwner.column, undoOwner.value);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('moods')
          .update({
            emoji: undoPlan.previousEntry.emoji,
            note: undoPlan.previousEntry.note,
            tags: undoPlan.previousEntry.tags,
          })
          .eq('id', currentEntry.id)
          .eq(undoOwner.column, undoOwner.value)
          .select('*')
          .single();
        if (error || !data) throw error ?? new Error('Mood undo returned no row');
        restoredEntry = data as TrackerMoodEntry;
      }
      if (
        !isCurrentOwnerGeneration(
          ownerGenerationRef.current,
          undoGeneration
        )
      ) {
        return;
      }

      const restoredDraft = moodDraftFromEntry(restoredEntry);
      entryRef.current = restoredEntry;
      undoPlanRef.current = null;
      draftRef.current = restoredDraft;
      persistedDraftRef.current = serializeMoodDraft(restoredDraft);
      desiredRevisionRef.current = 0;
      persistedRevisionRef.current = 0;
      failedRevisionRef.current = null;
      setDraft(restoredDraft);
      setDetailsOpen(false);
      setContextOpen(false);
      setCustomEmotionOpen(false);
      setCustomEmotionInput('');
      setSaveState(restoredEntry ? 'saved-aged' : 'idle');
      if (mountedRef.current) {
        onEntryChangeRef.current(currentEntry.id, restoredEntry);
      }
    } catch (error) {
      console.error('Unable to undo mood check-in:', error);
      if (
        mountedRef.current &&
        isCurrentOwnerGeneration(ownerGenerationRef.current, undoGeneration)
      ) {
        setSaveState('error');
      }
    } finally {
      deleteRunningRef.current = false;
      if (mountedRef.current) setDeleteRunning(false);
    }
  };

  const draftMatchesOwner = isCurrentOwnerGeneration(
    stateOwnerGenerationRef.current,
    operationOwner
  );
  const visibleDraft = draftMatchesOwner ? draft : moodDraftFromEntry(null);
  const controlsUnavailable =
    loading || !owner || deleteRunning || !draftMatchesOwner;
  const emotionLimitReached =
    visibleDraft.emotions.length + visibleDraft.customEmotions.length >=
    MAX_MOOD_EMOTIONS;
  const emotionOptions = visibleDraft.emoji
    ? getMoodEmotionOptions(visibleDraft.emoji)
    : [];
  const supportOptions = visibleDraft.emoji
    ? getMoodSupportOptions(visibleDraft.emoji)
    : [];

  return (
    <section
      ref={cardRef}
      className="app-panel overflow-hidden rounded-[1.35rem] border-[#E4DFD2] bg-[#FDFBF5] p-5 sm:p-6"
      aria-labelledby="mood-check-in-title"
    >
      <h2
        id="mood-check-in-title"
        className="font-display text-[1.65rem] font-medium leading-tight tracking-[-0.02em] text-[#14402F] sm:text-[1.9rem]"
      >
        How are you right now?
      </h2>

      <div
        className="mt-5 grid grid-cols-5 gap-1.5 sm:gap-2.5"
        role="group"
        aria-label="Choose your mood"
      >
        {moods.map(({ emoji, label, color }) => {
          const selected = visibleDraft.emoji === emoji;
          return (
            <button
              key={emoji}
              type="button"
              data-mood-choice
              disabled={controlsUnavailable}
              aria-label={`Feeling ${label}`}
              aria-pressed={selected}
              onClick={() => selectMood(emoji)}
              className={cn(
                'relative min-h-14 rounded-xl border px-1 py-1.5 text-center text-[0.65rem] font-semibold leading-tight text-[#14402F] outline-none transition duration-150 active:scale-[0.98] motion-reduce:transform-none motion-reduce:transition-opacity sm:min-h-16 sm:rounded-2xl sm:px-3 sm:text-sm',
                color,
                selected
                  ? 'border-[#14402F] ring-1 ring-[#14402F]'
                  : 'border-transparent hover:border-[#14402F]/25',
                'focus-visible:ring-2 focus-visible:ring-[#14402F] focus-visible:ring-offset-2 focus-visible:ring-offset-[#FDFBF5]',
                'disabled:cursor-wait disabled:opacity-55'
              )}
            >
              {selected && (
                <Check
                  aria-hidden="true"
                  className="absolute right-1 top-1 h-3 w-3 sm:right-2 sm:top-2 sm:h-3.5 sm:w-3.5"
                />
              )}
              <span aria-hidden="true" className="block text-lg leading-none sm:text-xl">
                {emoji}
              </span>
              <span className="mt-1 block">{label}</span>
            </button>
          );
        })}
      </div>

      {(loading || !owner || saveState !== 'saved-aged') && (
        <div
          className={cn(
            'mt-3 flex min-h-12 items-center justify-between rounded-xl border px-3.5 text-sm transition-colors duration-150 sm:min-h-14 sm:px-4',
            saveState === 'saved-fresh' && 'border-transparent bg-[#DDEDE3] text-[#14402F]',
            saveState === 'error' && 'border-[#C64A22] bg-[#F9E4DC] text-[#7D2D14]',
            (saveState === 'idle' || saveState === 'saving') &&
              'border-transparent bg-[#F1ECDF] text-[#5A6B62]'
          )}
          aria-live="polite"
        >
        {loading ? (
          <span>Getting your check-in ready…</span>
        ) : !owner ? (
          <span role="alert">Your private profile is not ready.</span>
        ) : saveState === 'idle' ? (
          <span>One tap is enough.</span>
        ) : saveState === 'saving' ? (
          <span>Saving…</span>
        ) : saveState === 'saved-fresh' ? (
          <>
            <span className="font-semibold">Saved</span>
            <button
              type="button"
              onClick={undoCheckIn}
              className="font-semibold text-[#A8451A] underline-offset-4 hover:underline focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#14402F]"
            >
              Undo
            </button>
          </>
        ) : (
          <>
            <span role="alert" className="font-medium">Not saved</span>
            <button
              type="button"
              onClick={retrySave}
              className="font-semibold text-[#A8451A] underline-offset-4 hover:underline focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#14402F]"
            >
              Retry
            </button>
          </>
        )}
        </div>
      )}

      {visibleDraft.emoji && (
        <div className="mt-2 flex justify-end">
          <button
            type="button"
            aria-expanded={detailsOpen}
            aria-controls="mood-optional-details"
            onClick={() => setDetailsOpen((current) => !current)}
            className="flex min-h-10 items-center gap-1.5 rounded-lg px-2 text-sm font-semibold text-[#1E5C43] outline-none hover:bg-[#F4F0E5] focus-visible:ring-2 focus-visible:ring-[#14402F]"
          >
            {detailsOpen ? 'Hide details' : 'Add details'}
            <ChevronDown
              aria-hidden="true"
              className={cn(
                'h-4 w-4 transition-transform duration-200 motion-reduce:transition-none',
                detailsOpen && 'rotate-180'
              )}
            />
          </button>
        </div>
      )}

      {visibleDraft.emoji && detailsOpen && (
        <div
          id="mood-optional-details"
          className="mt-2 space-y-4 animate-in fade-in slide-in-from-top-2 duration-200 motion-reduce:slide-in-from-top-0"
        >
          <div>
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <p className="text-[0.7rem] font-bold uppercase tracking-[0.12em] text-[#A8451A]">
                Put words to it
              </p>
              <p className="text-xs text-[#5A6B62]">Choose up to 3</p>
            </div>
            <div
              className="mt-2 flex flex-wrap gap-1.5 sm:gap-2"
              role="group"
              aria-label="Optional emotion words"
            >
              {emotionOptions.map(({ id, label }) => {
                const selected = visibleDraft.emotions.includes(id);
                const unavailable = emotionLimitReached && !selected;
                return (
                  <button
                    key={id}
                    type="button"
                    aria-pressed={selected}
                    aria-disabled={unavailable}
                    onClick={() => toggleEmotion(id)}
                    className={cn(
                      'min-h-10 rounded-full border px-3.5 py-2 text-[0.8rem] font-medium outline-none transition duration-150 active:scale-[0.98] motion-reduce:transform-none motion-reduce:transition-opacity sm:min-h-11 sm:px-4 sm:text-sm',
                      selected
                        ? 'border-[#14402F] bg-[#14402F] text-white'
                        : 'border-[#E4DFD2] bg-transparent text-[#14402F] hover:border-[#14402F]/40',
                      unavailable && 'cursor-not-allowed opacity-45',
                      'focus-visible:ring-2 focus-visible:ring-[#14402F] focus-visible:ring-offset-2 focus-visible:ring-offset-[#FDFBF5]'
                    )}
                  >
                    {label}
                  </button>
                );
              })}
              {visibleDraft.customEmotions.map((emotion) => (
                <button
                  key={emotion}
                  type="button"
                  aria-label={`Remove ${emotion}`}
                  onClick={() => removeCustomEmotion(emotion)}
                  className="flex min-h-10 items-center gap-1.5 rounded-full border border-[#14402F] bg-[#14402F] px-3.5 py-2 text-[0.8rem] font-medium text-white outline-none transition duration-150 active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-[#14402F] focus-visible:ring-offset-2 focus-visible:ring-offset-[#FDFBF5] motion-reduce:transform-none motion-reduce:transition-opacity sm:min-h-11 sm:px-4 sm:text-sm"
                >
                  {emotion}
                  <X aria-hidden="true" className="h-3.5 w-3.5" />
                </button>
              ))}
              {!emotionLimitReached && !customEmotionOpen && (
                <button
                  type="button"
                  onClick={() => setCustomEmotionOpen(true)}
                  className="flex min-h-10 items-center gap-1.5 rounded-full border border-dashed border-[#9AA89F] px-3.5 py-2 text-[0.8rem] font-medium text-[#1E5C43] outline-none hover:border-[#14402F] focus-visible:ring-2 focus-visible:ring-[#14402F] focus-visible:ring-offset-2 focus-visible:ring-offset-[#FDFBF5] sm:min-h-11 sm:px-4 sm:text-sm"
                >
                  <Plus aria-hidden="true" className="h-3.5 w-3.5" />
                  Add your own
                </button>
              )}
            </div>
            {customEmotionOpen && !emotionLimitReached && (
              <form
                onSubmit={submitCustomEmotion}
                className="mt-2 flex flex-col gap-2 sm:flex-row"
              >
                <label htmlFor="custom-mood-emotion" className="sr-only">
                  Custom feeling
                </label>
                <input
                  id="custom-mood-emotion"
                  autoFocus
                  value={customEmotionInput}
                  maxLength={32}
                  placeholder="Type a feeling"
                  onChange={(event) => setCustomEmotionInput(event.target.value)}
                  className="min-h-11 flex-1 rounded-xl border border-[#D5CFC1] bg-white/70 px-3 text-sm text-[#14402F] outline-none placeholder:text-[#5A6B62]/75 focus:border-[#14402F] focus:ring-1 focus:ring-[#14402F]"
                />
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={!customEmotionInput.trim()}
                    className="min-h-11 rounded-xl bg-[#14402F] px-4 text-sm font-semibold text-white outline-none hover:bg-[#1E5C43] focus-visible:ring-2 focus-visible:ring-[#14402F] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    Add
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCustomEmotionOpen(false);
                      setCustomEmotionInput('');
                    }}
                    className="min-h-11 rounded-xl px-3 text-sm font-semibold text-[#5A6B62] outline-none hover:bg-[#F4F0E5] focus-visible:ring-2 focus-visible:ring-[#14402F]"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>

          <div>
            <p className="text-[0.7rem] font-bold uppercase tracking-[0.12em] text-[#A8451A]">
              Something that might help
            </p>
            <div
              className="mt-2 flex flex-wrap gap-1.5 sm:gap-2"
              role="group"
              aria-label="Optional support choice"
            >
              {supportOptions.map(({ id, label }) => {
                const selected = visibleDraft.support === id;
                return (
                  <button
                    key={id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => toggleSupport(id)}
                    className={cn(
                      'min-h-10 rounded-full border px-3.5 py-2 text-[0.8rem] font-medium outline-none transition duration-150 active:scale-[0.98] motion-reduce:transform-none motion-reduce:transition-opacity sm:min-h-11 sm:px-5 sm:text-sm',
                      selected
                        ? 'border-[#14402F] bg-[#14402F] text-white'
                        : 'border-[#E4DFD2] bg-transparent text-[#14402F] hover:border-[#14402F]/40',
                      'focus-visible:ring-2 focus-visible:ring-[#14402F] focus-visible:ring-offset-2 focus-visible:ring-offset-[#FDFBF5]'
                    )}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-[#E4DFD2]">
            <button
              type="button"
              aria-expanded={contextOpen}
              aria-controls="mood-context-field"
              onClick={() => setContextOpen((current) => !current)}
              className="flex min-h-12 w-full items-center justify-between gap-4 px-4 py-3 text-left text-sm font-semibold text-[#14402F] outline-none hover:bg-[#F4F0E5] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#14402F]"
            >
              <span>Add context</span>
              <span className="flex items-center gap-2 font-normal text-[#5A6B62]">
                Optional
                <ChevronDown
                  aria-hidden="true"
                  className={cn(
                    'h-4 w-4 transition-transform duration-200 motion-reduce:transition-none',
                    contextOpen && 'rotate-180'
                  )}
                />
              </span>
            </button>
            {contextOpen && (
              <div id="mood-context-field" className="border-t border-[#E4DFD2] p-3">
                <label htmlFor="mood-context" className="sr-only">
                  Optional mood context
                </label>
                <textarea
                  id="mood-context"
                  value={visibleDraft.note}
                  maxLength={1000}
                  rows={4}
                  placeholder="Anything you want to remember."
                  onChange={(event) =>
                    scheduleContextDraft({
                      ...draftRef.current,
                      note: event.target.value,
                    })
                  }
                  onBlur={() => flushContextDraft()}
                  className="w-full resize-y rounded-lg border border-[#D5CFC1] bg-white/70 px-3 py-2 text-sm leading-6 text-[#14402F] outline-none placeholder:text-[#5A6B62]/75 focus:border-[#14402F] focus:ring-1 focus:ring-[#14402F]"
                />
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
