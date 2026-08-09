'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Bookmark,
  BookmarkCheck,
  Check,
  ExternalLink,
  ListStart,
  LockKeyhole,
  NotebookPen,
  Play,
  Quote,
  Repeat2,
  Search,
  Target,
  Video,
} from 'lucide-react';
import { DismissibleNotice } from '@/components/dismissible-notice';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useDataContext } from '@/lib/hooks/use-data-context';
import {
  BOOK_PRACTICE_TEMPLATES,
  bookPracticeTemplatesFor,
  filterLibraryItems,
  filterBookPracticeTemplates,
  BOOK_LIBRARY_ITEMS,
  isBookItem,
  isStoryItem,
  isVideoItem,
  practiceDestinationFor,
  STORY_LIBRARY_ITEMS,
  UNIFIED_LIBRARY,
  VIDEO_LIBRARY_ITEMS,
  type LibraryItem,
  type LibraryMediaFilter,
  type LibraryTemplateFilter,
} from '@/lib/library/content';
import {
  LIBRARY_TOPICS,
  type LibraryIntegration,
  type LibraryTopic,
} from '@/lib/library/editorial';
import {
  hasMeaningfulLibraryState,
  indexLibraryItemStates,
  LIBRARY_NOTE_LIMIT,
  nextLibraryState,
  type LibraryItemState,
  type LibraryItemStateDraft,
} from '@/lib/library/user-state';
import { canPersistLibraryMedia } from '@/lib/release-capabilities';
import { supabase } from '@/lib/supabase/client';

function integrationHref(item: LibraryItem, integration: LibraryIntegration): string {
  const params = new URLSearchParams({
    source: 'library',
    item: item.id,
    itemTitle: item.title,
    mediaType: item.mediaType,
  });

  // Keep released mobile and older shared links compatible until the bulk parity migration.
  if (item.mediaType === 'book') {
    params.set('book', item.id);
    params.set('bookTitle', item.title);
  }

  const destination = practiceDestinationFor(integration);
  if (!destination) return '/library';
  for (const [key, value] of Object.entries(destination.params)) params.set(key, value);
  return `${destination.pathname}?${params.toString()}`;
}

const integrationStyle = {
  journal: {
    icon: NotebookPen,
    card: 'border-rose-200 bg-rose-50',
    label: 'text-rose-900',
  },
  goal: {
    icon: Target,
    card: 'border-sky-200 bg-sky-50',
    label: 'text-sky-900',
  },
  habit: {
    icon: Repeat2,
    card: 'border-amber-200 bg-amber-50',
    label: 'text-amber-900',
  },
  routine: {
    icon: ListStart,
    card: 'border-emerald-200 bg-emerald-50',
    label: 'text-emerald-900',
  },
} as const;

const mediaFilters: { value: LibraryMediaFilter; label: string }[] = [
  { value: 'all', label: 'Everything' },
  { value: 'book', label: 'Books' },
  { value: 'video', label: 'Videos' },
  { value: 'story', label: 'Stories' },
  { value: 'saved', label: 'Saved' },
  { value: 'next', label: 'Up next' },
];

const templateFilters: { value: LibraryTemplateFilter; label: string }[] = [
  { value: 'all', label: 'All templates' },
  { value: 'journal', label: 'Journal' },
  { value: 'goal', label: 'Goal' },
  { value: 'habit', label: 'Habit' },
  { value: 'routine', label: 'Routine' },
];

type LibraryView = 'resources' | 'templates';

type Feedback = {
  tone: 'success' | 'error';
  message: string;
} | null;

const EMPTY_ITEM_STATES: Record<string, LibraryItemState> = {};

function emptyState(mediaType: LibraryItem['mediaType']): LibraryItemStateDraft {
  return {
    media_type: mediaType,
    is_saved: false,
    priority: 'none',
    custom_notes: '',
  };
}

export default function LibraryPage() {
  const { context, authLoading } = useDataContext();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTopic, setSelectedTopic] = useState<LibraryTopic>('All');
  const [mediaFilter, setMediaFilter] = useState<LibraryMediaFilter>('all');
  const [libraryView, setLibraryView] = useState<LibraryView>('resources');
  const [templateFilter, setTemplateFilter] = useState<LibraryTemplateFilter>('all');
  const [selectedItem, setSelectedItem] = useState<LibraryItem | null>(null);
  const [itemStates, setItemStates] = useState<Record<string, LibraryItemState>>({});
  const [stateLoading, setStateLoading] = useState(true);
  const [savingItemId, setSavingItemId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState('');
  const [noteDirty, setNoteDirty] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [quoteStorySchemaReady, setQuoteStorySchemaReady] = useState<
    boolean | null
  >(null);
  const stateOwnerIdRef = useRef<string | null>(null);
  const currentOwnerIdRef = useRef(context.user_id);
  const appliedRequestRef = useRef<string | null>(null);
  const ownerGenerationRef = useRef(0);
  currentOwnerIdRef.current = context.user_id;
  const stateOwnerMatches = Boolean(
    context.user_id && stateOwnerIdRef.current === context.user_id
  );
  const scopedItemStates = stateOwnerMatches
    ? itemStates
    : EMPTY_ITEM_STATES;
  const scopedNoteDraft = stateOwnerMatches ? noteDraft : '';

  useEffect(() => {
    let active = true;
    const detectSchema = async () => {
      const { error } = await supabase.from('affirmations').select('kind').limit(1);
      if (active) setQuoteStorySchemaReady(!error);
    };
    void detectSchema();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const ownerGeneration = ++ownerGenerationRef.current;
    if (authLoading) return;
    stateOwnerIdRef.current = null;
    setSavingItemId(null);
    setItemStates({});
    setSelectedItem(null);
    setNoteDraft('');
    setNoteDirty(false);
    if (!context.user_id) {
      setStateLoading(false);
      return;
    }

    const ownerId = context.user_id;
    let active = true;
    const loadLibraryState = async () => {
      setStateLoading(true);
      const { data, error } = await supabase
        .from('user_library_items')
        .select('*')
        .eq('user_id', ownerId)
        .order('updated_at', { ascending: false });

      if (
        !active ||
        currentOwnerIdRef.current !== ownerId ||
        ownerGenerationRef.current !== ownerGeneration
      ) {
        return;
      }
      if (error) {
        stateOwnerIdRef.current = ownerId;
        setItemStates({});
        setFeedback({
          tone: 'error',
          message: 'Your saved library could not be loaded. The catalog is still available.',
        });
      } else {
        stateOwnerIdRef.current = ownerId;
        setItemStates(indexLibraryItemStates((data ?? []) as LibraryItemState[]));
      }
      setStateLoading(false);
    };

    void loadLibraryState();
    return () => {
      active = false;
    };
  }, [authLoading, context.user_id]);

  useEffect(() => {
    if (
      authLoading ||
      stateLoading ||
      !context.user_id ||
      stateOwnerIdRef.current !== context.user_id
    ) {
      return;
    }
    const requestedItemId = new URLSearchParams(window.location.search).get(
      'item'
    );
    if (!requestedItemId) return;
    const requestKey = `${context.user_id}:${requestedItemId}`;
    if (appliedRequestRef.current === requestKey) return;
    appliedRequestRef.current = requestKey;
    const requestedItem = UNIFIED_LIBRARY.find(
      ({ id }) => id === requestedItemId
    );
    if (!requestedItem) {
      setSelectedItem(null);
      setFeedback({
        tone: 'error',
        message: 'That saved library item is no longer available.',
      });
      return;
    }
    setSelectedItem(requestedItem);
    setNoteDraft(scopedItemStates[requestedItem.id]?.custom_notes ?? '');
    setNoteDirty(false);
  }, [authLoading, context.user_id, scopedItemStates, stateLoading]);

  const savedIds = useMemo(
    () =>
      new Set(
        Object.values(scopedItemStates)
          .filter(({ is_saved }) => is_saved)
          .map(({ content_id }) => content_id)
      ),
    [scopedItemStates]
  );
  const nextIds = useMemo(
    () =>
      new Set(
        Object.values(scopedItemStates)
          .filter(({ priority }) => priority === 'next')
          .map(({ content_id }) => content_id)
      ),
    [scopedItemStates]
  );
  const filteredItems = useMemo(
    () =>
      filterLibraryItems(UNIFIED_LIBRARY, {
        query: searchQuery,
        topic: selectedTopic,
        media: mediaFilter,
        savedIds,
        nextIds,
      }),
    [mediaFilter, nextIds, savedIds, searchQuery, selectedTopic]
  );
  const filteredTemplates = useMemo(
    () =>
      filterBookPracticeTemplates(BOOK_PRACTICE_TEMPLATES, {
        query: searchQuery,
        topic: selectedTopic,
        action: templateFilter,
      }),
    [searchQuery, selectedTopic, templateFilter]
  );

  const persistItemState = async (
    item: LibraryItem,
    patch: Partial<LibraryItemStateDraft>,
    successMessage: string
  ) => {
    const userId = context.user_id;
    if (!userId) {
      setFeedback({
        tone: 'error',
        message: 'Your private profile is still loading. Please try again.',
      });
      return false;
    }
    if (!stateOwnerMatches) {
      setFeedback({
        tone: 'error',
        message: 'Your saved library is still syncing. Please try again.',
      });
      return false;
    }
    if (!canPersistLibraryMedia(item.mediaType, quoteStorySchemaReady)) {
      setFeedback({
        tone: 'error',
        message: 'Story saving will be available after the library update finishes.',
      });
      return false;
    }

    const previous = scopedItemStates[item.id];
    const next = nextLibraryState(previous, item.mediaType, patch);
    const now = new Date().toISOString();
    const ownerGeneration = ownerGenerationRef.current;
    const optimistic: LibraryItemState = {
      id: previous?.id ?? `pending-${item.id}`,
      user_id: userId,
      content_id: item.id,
      ...next,
      created_at: previous?.created_at ?? now,
      updated_at: now,
    };

    setSavingItemId(item.id);
    setFeedback(null);
    setItemStates((current) => ({ ...current, [item.id]: optimistic }));
    const operationIsCurrent = () =>
      currentOwnerIdRef.current === userId &&
      stateOwnerIdRef.current === userId &&
      ownerGenerationRef.current === ownerGeneration;

    try {
      if (!hasMeaningfulLibraryState(next)) {
        const { error } = await supabase
          .from('user_library_items')
          .delete()
          .eq('user_id', userId)
          .eq('content_id', item.id);
        if (!operationIsCurrent()) return false;
        if (error) throw error;

        setItemStates((current) => {
          const updated = { ...current };
          delete updated[item.id];
          return updated;
        });
      } else {
        const { data, error } = await supabase
          .from('user_library_items')
          .upsert(
            {
              user_id: userId,
              content_id: item.id,
              media_type: next.media_type,
              is_saved: next.is_saved,
              priority: next.priority,
              custom_notes: next.custom_notes,
              updated_at: now,
            },
            { onConflict: 'user_id,content_id' }
          )
          .select()
          .single();
        if (!operationIsCurrent()) return false;
        if (error || !data) throw error ?? new Error('Missing saved library row');
        setItemStates((current) => ({
          ...current,
          [item.id]: data as LibraryItemState,
        }));
      }

      if (!operationIsCurrent()) return false;
      setFeedback({ tone: 'success', message: successMessage });
      return true;
    } catch {
      if (!operationIsCurrent()) return false;
      setItemStates((current) => {
        const updated = { ...current };
        if (previous) updated[item.id] = previous;
        else delete updated[item.id];
        return updated;
      });
      setFeedback({
        tone: 'error',
        message: 'That library change could not be saved. Your previous state is unchanged.',
      });
      return false;
    } finally {
      if (operationIsCurrent()) {
        setSavingItemId((current) => (current === item.id ? null : current));
      }
    }
  };

  const openItem = (item: LibraryItem) => {
    setSelectedItem(item);
    setNoteDraft(scopedItemStates[item.id]?.custom_notes ?? '');
    setNoteDirty(false);
    setFeedback(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const toggleSaved = async (item: LibraryItem) => {
    const current = scopedItemStates[item.id] ?? emptyState(item.mediaType);
    const isSaving = !current.is_saved;
    await persistItemState(
      item,
      {
        is_saved: isSaving,
        priority: isSaving ? current.priority : 'none',
      },
      isSaving ? 'Saved to your library.' : 'Removed from saved items.'
    );
  };

  const toggleNext = async (item: LibraryItem) => {
    const current = scopedItemStates[item.id] ?? emptyState(item.mediaType);
    const isAdding = current.priority !== 'next';
    await persistItemState(
      item,
      { priority: isAdding ? 'next' : 'none' },
      isAdding ? 'Added to Up next.' : 'Removed from Up next.'
    );
  };

  const saveNote = async (item: LibraryItem) => {
    const saved = await persistItemState(
      item,
      { custom_notes: scopedNoteDraft },
      scopedNoteDraft.trim()
        ? 'Your private note was saved.'
        : 'Your private note was cleared.'
    );
    if (saved) {
      setNoteDraft(scopedNoteDraft.trim().slice(0, LIBRARY_NOTE_LIMIT));
      setNoteDirty(false);
    }
  };

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedTopic('All');
    setMediaFilter('all');
    setTemplateFilter('all');
  };

  if (selectedItem) {
    const selectedState =
      scopedItemStates[selectedItem.id] ?? emptyState(selectedItem.mediaType);
    const selectedIsBook = isBookItem(selectedItem);
    const selectedIsVideo = isVideoItem(selectedItem);
    const selectedIsStory = isStoryItem(selectedItem);
    const selectedIntegrations = selectedIsBook
      ? bookPracticeTemplatesFor(selectedItem.id).map(({ integration }) => integration)
      : selectedItem.integrations;
    const storyPersistenceUnavailable =
      selectedIsStory &&
      !canPersistLibraryMedia(selectedItem.mediaType, quoteStorySchemaReady);
    const selectedIsSaving =
      savingItemId === selectedItem.id ||
      Boolean(context.user_id && !stateOwnerMatches) ||
      storyPersistenceUnavailable;

    return (
      <main className="min-h-screen bg-[#f4f1e8] px-4 py-8 pb-28 md:py-14">
        <article className="mx-auto max-w-5xl">
          <button
            type="button"
            onClick={() => {
              setSelectedItem(null);
              setNoteDirty(false);
              setFeedback(null);
            }}
            className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-emerald-900"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to library
          </button>

          <div className="overflow-hidden rounded-[2rem] border border-emerald-950/10 bg-white shadow-[0_24px_70px_rgba(23,63,56,0.12)]">
            <header className="relative overflow-hidden bg-[#173f38] px-6 py-9 text-white md:px-10 md:py-12">
              <div className="absolute -right-14 -top-16 h-52 w-52 rounded-full bg-amber-300/20 blur-2xl" />
              <div className="relative">
                <div className="flex flex-wrap items-center gap-2 text-sm font-semibold uppercase tracking-[0.16em] text-emerald-200">
                  {selectedIsVideo ? (
                    <Video className="h-4 w-4" aria-hidden="true" />
                  ) : selectedIsStory ? (
                    <Quote className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <BookOpen className="h-4 w-4" aria-hidden="true" />
                  )}
                  {selectedIsVideo
                    ? 'Curated motivational talk'
                    : selectedIsStory
                      ? 'True-life profile'
                      : 'Source-backed reading guide'}
                </div>
                <h1 className="mt-3 max-w-4xl font-[family-name:var(--font-display)] text-4xl leading-tight md:text-6xl">
                  {selectedItem.title}
                </h1>
                <p className="mt-3 text-emerald-50/85">
                  {selectedIsVideo ? 'with' : selectedIsStory ? 'about' : 'by'}{' '}
                  {selectedItem.creator} ·{' '}
                  {selectedItem.durationLabel}
                </p>
                <div className="mt-5 flex flex-wrap gap-2">
                  <span className="rounded-full border border-amber-200/40 bg-amber-300/15 px-3 py-1 text-xs text-amber-100">
                    {selectedItem.topic}
                  </span>
                  {selectedItem.displayTags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
                <div className="mt-7 flex flex-wrap gap-3">
                  <Button
                    type="button"
                    onClick={() => void toggleSaved(selectedItem)}
                    disabled={selectedIsSaving}
                    className={
                      selectedState.is_saved
                        ? 'bg-amber-300 text-emerald-950 hover:bg-amber-200'
                        : 'border border-white/25 bg-white/10 text-white hover:bg-white/20'
                    }
                  >
                    {selectedState.is_saved ? (
                      <BookmarkCheck className="mr-2 h-4 w-4" aria-hidden="true" />
                    ) : (
                      <Bookmark className="mr-2 h-4 w-4" aria-hidden="true" />
                    )}
                    {selectedState.is_saved ? 'Saved' : 'Save'}
                  </Button>
                  <Button
                    type="button"
                    onClick={() => void toggleNext(selectedItem)}
                    disabled={selectedIsSaving}
                    className={
                      selectedState.priority === 'next'
                        ? 'bg-white text-emerald-950 hover:bg-emerald-50'
                        : 'border border-white/25 bg-transparent text-white hover:bg-white/10'
                    }
                  >
                    <ListStart className="mr-2 h-4 w-4" aria-hidden="true" />
                    {selectedState.priority === 'next' ? 'Up next' : 'Add to Up next'}
                  </Button>
                  {!isBookItem(selectedItem) && (
                    <a
                      href={selectedItem.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex h-10 items-center justify-center rounded-md bg-rose-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-rose-500"
                    >
                      {selectedIsVideo ? (
                        <Play
                          className="mr-2 h-4 w-4"
                          fill="currentColor"
                          aria-hidden="true"
                        />
                      ) : (
                        <Quote className="mr-2 h-4 w-4" aria-hidden="true" />
                      )}
                      {selectedIsVideo
                        ? `Watch on ${selectedItem.provider}`
                        : 'View the source record'}
                      <ExternalLink className="ml-2 h-3.5 w-3.5" aria-hidden="true" />
                    </a>
                  )}
                </div>
              </div>
            </header>

            <div className="space-y-9 p-6 md:p-10">
              <div aria-live="polite">
                {feedback && (
                  <p
                    className={`rounded-xl border p-3 text-sm ${
                      feedback.tone === 'error'
                        ? 'border-red-200 bg-red-50 text-red-900'
                        : 'border-emerald-200 bg-emerald-50 text-emerald-900'
                    }`}
                  >
                    {feedback.message}
                  </p>
                )}
              </div>

              {storyPersistenceUnavailable && (
                <p className="rounded-xl border border-sky-200 bg-sky-50 p-3 text-sm text-sky-950">
                  Story saving will be available after the library update finishes.
                </p>
              )}

              {!isBookItem(selectedItem) && selectedItem.contentNote && (
                <DismissibleNotice
                  noticeKey={`library-content-${selectedItem.id}`}
                  title="Content note"
                  className="rounded-2xl border border-amber-300 bg-amber-50 text-amber-950"
                >
                  <p className="text-amber-900">{selectedItem.contentNote}</p>
                </DismissibleNotice>
              )}

              <aside className="rounded-2xl border border-sky-200 bg-sky-50 p-5 text-sm leading-6 text-sky-950">
                {selectedIsVideo
                  ? 'This guide paraphrases an educational talk. Use the official link for the full argument and context.'
                  : selectedIsStory
                    ? 'This is an original in-app profile based on the sources listed below.'
                    : 'The premises below are paraphrased and linked to author, publisher, research, or clinical-context sources. They cannot replace the complete book.'}
              </aside>

              <section>
                <h2 className="font-[family-name:var(--font-display)] text-3xl text-slate-950">
                  A useful orientation
                </h2>
                <p className="mt-3 text-lg leading-8 text-slate-700">{selectedItem.summary}</p>
              </section>

              <section className="rounded-2xl bg-emerald-950 p-6 text-white">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-200">
                  Central premise
                </p>
                <p className="mt-3 text-lg leading-8 text-emerald-50">
                  {selectedItem.centralPremise}
                </p>
              </section>

              {selectedIsStory && (
                <>
                  <section>
                    <p className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-800">
                      The story in context
                    </p>
                    <div className="mt-4 space-y-4">
                      {selectedItem.storySections.map((section, index) => (
                        <article
                          key={section.heading}
                          className="rounded-2xl border border-slate-200 bg-slate-50 p-5 md:p-6"
                        >
                          <div className="flex items-start gap-3">
                            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-emerald-950 text-sm font-semibold text-white">
                              {index + 1}
                            </span>
                            <div>
                              <h2 className="font-[family-name:var(--font-display)] text-2xl text-slate-950">
                                {section.heading}
                              </h2>
                              <p className="mt-3 text-base leading-7 text-slate-700">
                                {section.body}
                              </p>
                            </div>
                          </div>
                        </article>
                      ))}
                    </div>
                  </section>

                  <section>
                    <p className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-800">
                      Key moments
                    </p>
                    <ol className="relative mt-5 space-y-5 border-l-2 border-emerald-200 pl-6">
                      {selectedItem.timeline.map((milestone) => (
                        <li key={`${milestone.period}-${milestone.title}`} className="relative">
                          <span
                            className="absolute -left-[1.9rem] top-1.5 h-3 w-3 rounded-full border-2 border-white bg-emerald-700 ring-2 ring-emerald-200"
                            aria-hidden="true"
                          />
                          <p className="text-xs font-bold uppercase tracking-[0.12em] text-emerald-800">
                            {milestone.period}
                          </p>
                          <h2 className="mt-1 text-lg font-semibold text-slate-950">
                            {milestone.title}
                          </h2>
                          <p className="mt-1 text-sm leading-6 text-slate-600">
                            {milestone.description}
                          </p>
                        </li>
                      ))}
                    </ol>
                  </section>
                </>
              )}

              {isBookItem(selectedItem) && (
                <section>
                  <h2 className="font-[family-name:var(--font-display)] text-3xl text-slate-950">
                    Core premises, unpacked
                  </h2>
                  <ol className="mt-5 grid gap-5">
                    {selectedItem.corePremises.map((idea, index) => (
                      <li
                        key={idea.title}
                        className="rounded-2xl border border-slate-200 bg-slate-50 p-5 md:p-6"
                      >
                        <div className="flex items-start gap-3">
                          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-emerald-950 text-sm font-semibold text-white">
                            {index + 1}
                          </span>
                          <div>
                            <h3 className="text-lg font-semibold text-slate-950">{idea.title}</h3>
                            <p className="mt-2 text-sm leading-6 text-slate-700">{idea.premise}</p>
                          </div>
                        </div>
                        <div className="mt-4 grid gap-3 border-t border-slate-200 pt-4 md:grid-cols-2">
                          <div>
                            <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
                              Why it matters
                            </p>
                            <p className="mt-2 text-sm leading-6 text-slate-700">
                              {idea.whyItMatters}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
                              Try it
                            </p>
                            <p className="mt-2 text-sm leading-6 text-slate-700">
                              {idea.practice}
                            </p>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ol>
                </section>
              )}

              <section>
                <h2 className="font-[family-name:var(--font-display)] text-3xl text-slate-950">
                  Takeaways you can use
                </h2>
                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  {selectedItem.practicalTakeaways.map((takeaway) => (
                    <article
                      key={takeaway.title}
                      className="flex flex-col rounded-2xl border border-amber-200 bg-amber-50 p-5"
                    >
                      <h3 className="font-semibold text-amber-950">{takeaway.title}</h3>
                      <p className="mt-2 text-sm leading-6 text-amber-950/80">
                        {takeaway.description}
                      </p>
                      <p className="mt-auto border-t border-amber-200 pt-4 text-sm font-medium leading-6 text-amber-950">
                        {takeaway.nextStep}
                      </p>
                    </article>
                  ))}
                </div>
              </section>

              <section className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-5 md:p-6">
                <div className="flex items-start gap-3">
                  <LockKeyhole
                    className="mt-1 h-5 w-5 shrink-0 text-emerald-800"
                    aria-hidden="true"
                  />
                  <div className="w-full">
                    <h2 className="font-[family-name:var(--font-display)] text-2xl text-slate-950">
                      Your private note
                    </h2>
                    <p className="mt-1 text-sm leading-6 text-slate-600">
                      Capture what matters. AI can use this note when context is on.
                    </p>
                    <div className="mt-4 flex items-center justify-between gap-3">
                      <label htmlFor="library-private-note" className="text-sm font-semibold">
                        Notes on {selectedItem.title}
                      </label>
                      <span className="text-xs text-slate-500">
                        {scopedNoteDraft.length.toLocaleString()} /{' '}
                        {LIBRARY_NOTE_LIMIT.toLocaleString()}
                      </span>
                    </div>
                    <Textarea
                      id="library-private-note"
                      value={scopedNoteDraft}
                      onChange={(event) => {
                        setNoteDraft(event.target.value);
                        setNoteDirty(true);
                      }}
                      maxLength={LIBRARY_NOTE_LIMIT}
                      disabled={storyPersistenceUnavailable}
                      placeholder="What fits? What will you try? What do you want to question?"
                      className="mt-2 min-h-36 resize-y bg-white text-base leading-7"
                    />
                    <Button
                      type="button"
                      onClick={() => void saveNote(selectedItem)}
                      disabled={!noteDirty || selectedIsSaving}
                      className="mt-3 bg-emerald-950 text-white hover:bg-emerald-900"
                    >
                      <Check className="mr-2 h-4 w-4" aria-hidden="true" />
                      {selectedIsSaving ? 'Saving...' : 'Save note'}
                    </Button>
                  </div>
                </div>
              </section>

              {selectedIntegrations.length > 0 && (
              <section>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-800">
                  Practice templates
                </p>
                <h2 className="mt-1 font-[family-name:var(--font-display)] text-3xl text-slate-950">
                  Start with a ready-to-use practice
                </h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                  These original MHtoolkit templates are based on paraphrased ideas from this guide.
                  Review the draft before saving it.
                </p>
                <div className="mt-5 grid gap-4 md:grid-cols-3">
                  {selectedIntegrations.map((integration) => {
                    const style = integrationStyle[integration.actionType];
                    const Icon = style.icon;
                    const integrationUnavailable =
                      storyPersistenceUnavailable &&
                      integration.actionType === 'journal';
                    return (
                      <article
                        key={integration.title}
                        className={`flex flex-col rounded-2xl border p-5 ${style.card}`}
                      >
                        <Icon className={`h-5 w-5 ${style.label}`} aria-hidden="true" />
                        <p className={`mt-3 text-xs font-bold uppercase tracking-[0.12em] ${style.label}`}>
                          {integration.actionType} template
                        </p>
                        <h3 className="mt-2 font-semibold text-slate-950">{integration.title}</h3>
                        <p className="mt-2 text-sm leading-6 text-slate-700">
                          {integration.description}
                        </p>
                        {integrationUnavailable ? (
                          <span className="mt-auto inline-flex items-center gap-2 pt-5 text-sm font-semibold text-slate-500">
                            Available after update
                          </span>
                        ) : (
                          <Link
                            href={integrationHref(selectedItem, integration)}
                            className={`mt-auto inline-flex items-center gap-2 pt-5 text-sm font-semibold ${style.label}`}
                          >
                            {integration.actionLabel}
                            <ArrowRight className="h-4 w-4" aria-hidden="true" />
                          </Link>
                        )}
                      </article>
                    );
                  })}
                </div>
              </section>
              )}

              <section className="rounded-2xl border border-slate-200 p-6">
                <h2 className="font-[family-name:var(--font-display)] text-2xl text-slate-950">
                  Questions to carry forward
                </h2>
                <ol className="mt-4 space-y-3">
                  {selectedItem.reflectionPrompts.map((prompt, index) => (
                    <li key={prompt} className="flex gap-3 text-sm leading-6 text-slate-700">
                      <span className="font-semibold text-emerald-800">{index + 1}.</span>
                      <span>{prompt}</span>
                    </li>
                  ))}
                </ol>
              </section>

              {selectedItem.medicalCaveat && (
                <aside className="rounded-2xl border border-red-200 bg-red-50 p-5">
                  <div className="flex items-start gap-3">
                    <AlertTriangle
                      className="mt-0.5 h-5 w-5 shrink-0 text-red-800"
                      aria-hidden="true"
                    />
                    <div>
                      <h2 className="font-semibold text-red-950">Important clinical boundary</h2>
                      <p className="mt-2 text-sm leading-6 text-red-900">
                        {selectedItem.medicalCaveat}
                      </p>
                    </div>
                  </div>
                </aside>
              )}

              <section>
                <h2 className="font-[family-name:var(--font-display)] text-2xl text-slate-950">
                  Sources and verification
                </h2>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {selectedItem.sources.map((source) => (
                    <a
                      key={source.url}
                      href={source.url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 p-4 text-sm font-semibold text-emerald-900 hover:border-emerald-300 hover:bg-emerald-50"
                    >
                      <span>
                        {source.label}
                        <span className="mt-1 block text-xs font-normal uppercase tracking-[0.1em] text-slate-500">
                          {source.sourceType.replaceAll('-', ' ')}
                        </span>
                      </span>
                      <ExternalLink className="h-4 w-4 shrink-0" aria-hidden="true" />
                    </a>
                  ))}
                </div>
              </section>

              <aside className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <h2 className="font-semibold text-slate-950">Editorial scope</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {selectedItem.editorialNote}
                </p>
              </aside>
            </div>
          </div>
        </article>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f4f1e8] px-4 py-10 pb-28 md:py-14">
      <div className="mx-auto max-w-6xl">
        <section className="relative overflow-hidden rounded-[2rem] border border-emerald-950/10 bg-[#173f38] px-6 py-9 text-white shadow-[0_24px_70px_rgba(23,63,56,0.18)] md:px-10 md:py-12">
          <div className="absolute -right-16 -top-20 h-64 w-64 rounded-full bg-amber-300/20 blur-2xl" />
          <div className="absolute -bottom-24 left-1/3 h-48 w-48 rounded-full bg-sky-300/10 blur-2xl" />
          <div className="relative grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end">
            <div className="max-w-3xl">
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-sm text-emerald-50">
                <BookOpen className="h-4 w-4" aria-hidden="true" />
                Books + talks + true stories
              </div>
              <h1 className="font-[family-name:var(--font-display)] text-4xl leading-tight md:text-6xl">
                Find an idea worth using.
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-emerald-50/90 md:text-lg">
                Explore reviewed book guides, official talks, and true-life profiles by the need
                they address. Save what helps or turn one idea into a practical next step.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 text-center">
              {[
                [BOOK_LIBRARY_ITEMS.length.toString(), 'books'],
                [VIDEO_LIBRARY_ITEMS.length.toString(), 'videos'],
                [STORY_LIBRARY_ITEMS.length.toString(), 'stories'],
                [BOOK_PRACTICE_TEMPLATES.length.toString(), 'curated tools'],
              ].map(([value, label]) => (
                <div
                  key={label}
                  className="min-w-20 rounded-2xl border border-white/15 bg-white/10 px-3 py-3"
                >
                  <p className="text-2xl font-semibold text-amber-200">{value}</p>
                  <p className="mt-1 text-xs uppercase tracking-[0.12em] text-emerald-100">
                    {label}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <div className="mt-4" aria-live="polite">
          {feedback && (
            <p
              className={`rounded-xl border p-3 text-sm ${
                feedback.tone === 'error'
                  ? 'border-red-200 bg-red-50 text-red-900'
                  : 'border-emerald-200 bg-emerald-50 text-emerald-900'
              }`}
            >
              {feedback.message}
            </p>
          )}
        </div>

        <section className="mt-8" aria-labelledby="library-heading">
          <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-800">
                {libraryView === 'resources' ? 'One practical library' : 'Turn insight into action'}
              </p>
              <h2
                id="library-heading"
                className="mt-1 font-[family-name:var(--font-display)] text-3xl text-slate-950"
              >
                {libraryView === 'resources'
                  ? 'Browse by need, not format.'
                  : 'Start with a ready-to-use practice.'}
              </h2>
            </div>
            <p className="text-sm text-slate-600">
              {stateLoading
                ? 'Syncing your saved library...'
                : libraryView === 'resources'
                  ? `${filteredItems.length} of ${UNIFIED_LIBRARY.length} resources`
                  : `${filteredTemplates.length} of ${BOOK_PRACTICE_TEMPLATES.length} templates`}
            </p>
          </div>

          <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-4 md:p-5">
            <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1" aria-label="Library view">
              {([
                ['resources', 'Resources', BookOpen],
                ['templates', 'Practice templates', Repeat2],
              ] as const).map(([value, label, Icon]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setLibraryView(value)}
                  aria-pressed={libraryView === value}
                  className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-3 text-sm font-semibold transition-colors ${
                    libraryView === value
                      ? 'bg-white text-emerald-950 shadow-sm'
                      : 'text-slate-600 hover:text-slate-950'
                  }`}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  {label}
                </button>
              ))}
            </div>

            <label htmlFor="library-search" className="sr-only">
              {libraryView === 'resources'
                ? 'Search books, videos, and stories'
                : 'Search practice templates'}
            </label>
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                aria-hidden="true"
              />
              <Input
                id="library-search"
                placeholder={
                  libraryView === 'resources'
                    ? 'Search title, creator, topic, premise, or takeaway'
                    : 'Search templates, books, authors, or topics'
                }
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className="h-11 pl-10"
              />
            </div>

            <div
              className="mt-4 flex gap-2 overflow-x-auto pb-1"
              aria-label={
                libraryView === 'resources'
                  ? 'Library media filters'
                  : 'Practice template filters'
              }
            >
              {(libraryView === 'resources' ? mediaFilters : templateFilters).map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => {
                    if (libraryView === 'resources') {
                      setMediaFilter(value as LibraryMediaFilter);
                    } else {
                      setTemplateFilter(value as LibraryTemplateFilter);
                    }
                  }}
                  aria-pressed={
                    libraryView === 'resources'
                      ? mediaFilter === value
                      : templateFilter === value
                  }
                  className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                    (libraryView === 'resources' ? mediaFilter : templateFilter) === value
                      ? 'bg-emerald-950 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div
              className="mt-3 flex gap-2 overflow-x-auto border-t border-slate-100 pt-3"
              aria-label="Library topics"
            >
              {LIBRARY_TOPICS.map((topic) => (
                <button
                  key={topic}
                  type="button"
                  onClick={() => setSelectedTopic(topic)}
                  aria-pressed={selectedTopic === topic}
                  className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                    selectedTopic === topic
                      ? 'bg-amber-200 text-amber-950'
                      : 'bg-amber-50 text-amber-900 hover:bg-amber-100'
                  }`}
                >
                  {topic}
                </button>
              ))}
            </div>
          </div>

          {(libraryView === 'resources' ? filteredItems.length : filteredTemplates.length) === 0 && (
            <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-10 text-center">
              <p className="font-semibold text-slate-950">
                No {libraryView === 'resources' ? 'resources' : 'templates'} match this view.
              </p>
              <p className="mt-1 text-sm text-slate-600">
                Try another phrase or clear the filters.
              </p>
              <button
                type="button"
                onClick={clearFilters}
                className="mt-3 text-sm font-semibold text-emerald-800 underline underline-offset-4"
              >
                Clear filters
              </button>
            </div>
          )}

          {libraryView === 'templates' && filteredTemplates.length > 0 && (
            <div className="mt-6 grid gap-5 md:grid-cols-2">
              {filteredTemplates.map((template) => {
                const style = integrationStyle[template.integration.actionType];
                const Icon = style.icon;
                return (
                  <article
                    key={template.id}
                    className={`flex min-h-64 flex-col rounded-2xl border p-6 ${style.card}`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className={`inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] ${style.label}`}>
                        <Icon className="h-4 w-4" aria-hidden="true" />
                        {template.integration.actionType} template
                      </span>
                      <span className="text-xs text-slate-500">{template.book.topic}</span>
                    </div>
                    <h3 className="mt-5 font-[family-name:var(--font-display)] text-2xl leading-tight text-slate-950">
                      {template.integration.title}
                    </h3>
                    <p className="mt-3 text-sm leading-6 text-slate-700">
                      {template.integration.description}
                    </p>
                    <p className="mt-4 text-xs leading-5 text-slate-600">
                      From <span className="font-semibold text-slate-800">{template.book.title}</span>{' '}
                      by {template.book.author}
                    </p>
                    <div className="mt-auto flex flex-wrap items-center gap-4 pt-6">
                      <Link
                        href={integrationHref(template.book, template.integration)}
                        className={`inline-flex items-center gap-2 text-sm font-semibold ${style.label}`}
                      >
                        Use template
                        <ArrowRight className="h-4 w-4" aria-hidden="true" />
                      </Link>
                      <button
                        type="button"
                        onClick={() => openItem(template.book)}
                        className="text-sm font-semibold text-slate-600 underline decoration-slate-300 underline-offset-4"
                      >
                        Open guide
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          {libraryView === 'resources' && filteredItems.length > 0 && (
            <div className="mt-6 grid gap-5 md:grid-cols-2">
              {filteredItems.map((item) => {
                const itemState =
                  scopedItemStates[item.id] ?? emptyState(item.mediaType);
                const itemIsVideo = isVideoItem(item);
                const itemIsStory = isStoryItem(item);
                const storyPersistenceUnavailable =
                  itemIsStory &&
                  !canPersistLibraryMedia(item.mediaType, quoteStorySchemaReady);
                const itemIsSaving =
                  savingItemId === item.id ||
                  Boolean(context.user_id && !stateOwnerMatches) ||
                  storyPersistenceUnavailable;

                return (
                  <article
                    key={item.id}
                    className="group flex min-h-72 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all hover:-translate-y-1 hover:border-emerald-800/30 hover:shadow-lg"
                  >
                    <button
                      type="button"
                      onClick={() => openItem(item)}
                      className="flex flex-1 flex-col p-6 text-left"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
                              itemIsVideo
                                ? 'bg-rose-50 text-rose-900'
                                : itemIsStory
                                  ? 'bg-sky-50 text-sky-900'
                                  : 'bg-emerald-50 text-emerald-900'
                            }`}
                          >
                            {itemIsVideo ? (
                              <Video className="h-3.5 w-3.5" aria-hidden="true" />
                            ) : itemIsStory ? (
                              <Quote className="h-3.5 w-3.5" aria-hidden="true" />
                            ) : (
                              <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
                            )}
                            {itemIsVideo ? 'Video' : itemIsStory ? 'Story' : 'Book'}
                          </span>
                          <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-900">
                            {item.topic}
                          </span>
                        </div>
                        <span className="shrink-0 text-xs text-slate-500">
                          {item.durationLabel}
                        </span>
                      </div>
                      <h3 className="mt-5 font-[family-name:var(--font-display)] text-3xl leading-tight text-slate-950">
                        {item.title}
                      </h3>
                      <p className="mt-1 text-sm text-slate-500">
                        {itemIsVideo ? 'with' : itemIsStory ? 'about' : 'by'} {item.creator}
                      </p>
                      <p className="mt-4 line-clamp-3 text-sm leading-6 text-slate-600">
                        {item.summary}
                      </p>
                      <span className="mt-auto flex items-center gap-2 pt-5 text-sm font-semibold text-emerald-800">
                        {itemIsVideo
                          ? 'Open the talk guide'
                          : itemIsStory
                            ? 'Open the story'
                            : 'Open the full guide'}
                        <ArrowRight
                          className="h-4 w-4 transition-transform group-hover:translate-x-1"
                          aria-hidden="true"
                        />
                      </span>
                    </button>
                    <div className="flex items-center gap-2 border-t border-slate-100 px-4 py-3">
                      <button
                        type="button"
                        onClick={() => void toggleSaved(item)}
                        disabled={itemIsSaving}
                        aria-pressed={itemState.is_saved}
                        className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition-colors disabled:opacity-50 ${
                          itemState.is_saved
                            ? 'bg-emerald-100 text-emerald-950'
                            : 'text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        {itemState.is_saved ? (
                          <BookmarkCheck className="h-4 w-4" aria-hidden="true" />
                        ) : (
                          <Bookmark className="h-4 w-4" aria-hidden="true" />
                        )}
                        {itemState.is_saved ? 'Saved' : 'Save'}
                      </button>
                      <button
                        type="button"
                        onClick={() => void toggleNext(item)}
                        disabled={itemIsSaving}
                        aria-pressed={itemState.priority === 'next'}
                        className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition-colors disabled:opacity-50 ${
                          itemState.priority === 'next'
                            ? 'bg-amber-100 text-amber-950'
                            : 'text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        <ListStart className="h-4 w-4" aria-hidden="true" />
                        {itemState.priority === 'next' ? 'Up next' : 'Add next'}
                      </button>
                      {itemState.custom_notes && (
                        <span
                          className="ml-auto inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500"
                          title="Private note saved"
                        >
                          <LockKeyhole className="h-3.5 w-3.5" aria-hidden="true" />
                          Note
                        </span>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          <aside className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 text-sm leading-6 text-slate-600">
            Guides and profiles link to their sources and flag sensitive content. These profiles
            offer perspective, not medical guidance or a promise that one path will work for
            everyone.
          </aside>
        </section>
      </div>
    </main>
  );
}
