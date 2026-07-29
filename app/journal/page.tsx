'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  BookOpen,
  CalendarDays,
  Feather,
  Heart,
  LockKeyhole,
  Pencil,
  Plus,
  Quote,
  Save,
  Search,
  Trash2,
  Video,
  X,
} from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { DismissibleNotice } from '@/components/dismissible-notice';
import { useDataContext } from '@/lib/hooks/use-data-context';
import {
  emptyJournalDraft,
  JOURNAL_LIMITS,
  JOURNAL_PROMPTS,
  prepareJournalDraft,
  type JournalDraft,
  type JournalEntry,
  validateJournalDraft,
} from '@/lib/journal';
import { canPersistLibraryMedia } from '@/lib/release-capabilities';
import { supabase } from '@/lib/supabase/client';

type JournalFilter = 'all' | 'favorites' | 'library_notes';

export default function JournalPage() {
  const { context, authLoading } = useDataContext();
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [draft, setDraft] = useState<JournalDraft>(emptyJournalDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<JournalFilter>('all');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editorOpen, setEditorOpen] = useState(true);
  const [error, setError] = useState('');
  const [loadedOwnerId, setLoadedOwnerId] = useState<string | null>(null);
  const [draftOwnerId, setDraftOwnerId] = useState<string | null>(null);
  const [quoteStorySchemaReady, setQuoteStorySchemaReady] = useState<
    boolean | null
  >(null);
  const appliedLinkRef = useRef(false);
  const ownerIdentityRef = useRef<{ userId: string | null } | null>(null);
  const currentOwnerIdRef = useRef(context.user_id);
  currentOwnerIdRef.current = context.user_id;
  const ownerEntries = useMemo(
    () =>
      context.user_id && loadedOwnerId === context.user_id ? entries : [],
    [context.user_id, entries, loadedOwnerId]
  );
  const draftOwnerMatches = Boolean(
    context.user_id && draftOwnerId === context.user_id
  );
  const storyPersistenceUnavailable =
    draft.entryKind === 'story_note' &&
    !canPersistLibraryMedia('story', quoteStorySchemaReady);

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
    if (ownerIdentityRef.current?.userId === context.user_id) return;
    ownerIdentityRef.current = { userId: context.user_id };
    setEntries([]);
    setLoadedOwnerId(null);
    setDraft(emptyJournalDraft());
    setDraftOwnerId(null);
    setEditingId(null);
    setEditorOpen(Boolean(context.user_id));
    setSearch('');
    setFilter('all');
    setError('');
    setSaving(false);
    appliedLinkRef.current = false;
  }, [context.user_id]);

  useEffect(() => {
    if (
      authLoading ||
      !context.user_id ||
      appliedLinkRef.current ||
      typeof window === 'undefined'
    ) {
      return;
    }
    appliedLinkRef.current = true;

    const params = new URLSearchParams(window.location.search);
    const prompt = params.get('prompt')?.slice(0, JOURNAL_LIMITS.prompt) ?? '';
    const linkedBookId =
      params.get('item')?.slice(0, 120) ?? params.get('book')?.slice(0, 120) ?? '';
    const linkedBookTitle =
      params.get('itemTitle')?.slice(0, 200) ??
      params.get('bookTitle')?.slice(0, 200) ??
      '';
    const requestedMediaType = params.get('mediaType');
    const linkedMediaType =
      requestedMediaType === 'video'
        ? 'video'
        : requestedMediaType === 'story'
          ? 'story'
        : linkedBookId || linkedBookTitle
          ? 'book'
          : '';
    if (!prompt && !linkedBookId && !linkedBookTitle) return;

    setDraft({
      ...emptyJournalDraft(),
      title: linkedBookTitle ? `Notes on ${linkedBookTitle}` : '',
      prompt,
      entryKind:
        linkedMediaType === 'video'
          ? 'video_note'
          : linkedMediaType === 'story'
            ? 'story_note'
          : linkedBookId || linkedBookTitle
            ? 'book_note'
            : 'guided',
      linkedBookId,
      linkedBookTitle,
      linkedMediaType,
    });
    setDraftOwnerId(context.user_id);
    setEditorOpen(true);
    window.history.replaceState({}, '', window.location.pathname);
  }, [authLoading, context.user_id]);

  useEffect(() => {
    if (authLoading) return;
    if (!context.user_id) {
      setEntries([]);
      setLoadedOwnerId(null);
      setLoading(false);
      return;
    }

    const ownerId = context.user_id;
    let active = true;
    const loadEntries = async () => {
      setLoading(true);
      setLoadedOwnerId(null);
      const { data, error: loadError } = await supabase
        .from('journal_entries')
        .select('*')
        .eq('user_id', ownerId)
        .order('created_at', { ascending: false });

      if (!active || currentOwnerIdRef.current !== ownerId) return;
      if (loadError) {
        setError('Your journal could not be loaded. Please try again.');
      } else {
        setEntries((data ?? []) as JournalEntry[]);
        setLoadedOwnerId(ownerId);
      }
      setDraftOwnerId((current) => current ?? ownerId);
      setLoading(false);
    };

    void loadEntries();
    return () => {
      active = false;
    };
  }, [authLoading, context.user_id]);

  const visibleEntries = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();

    return ownerEntries.filter((entry) => {
      if (filter === 'favorites' && !entry.is_favorite) return false;
      if (
        filter === 'library_notes' &&
        entry.entry_kind !== 'book_note' &&
        entry.entry_kind !== 'video_note' &&
        entry.entry_kind !== 'story_note'
      ) {
        return false;
      }
      if (!query) return true;

      return [
        entry.title,
        entry.content,
        entry.prompt ?? '',
        entry.linked_book_title ?? '',
        ...entry.tags,
      ].some((value) => value.toLocaleLowerCase().includes(query));
    });
  }, [filter, ownerEntries, search]);

  const resetEditor = () => {
    setDraft(emptyJournalDraft());
    setEditingId(null);
    setError('');
  };

  const startNewEntry = () => {
    resetEditor();
    setDraftOwnerId(context.user_id);
    setEditorOpen(true);
  };

  const selectPrompt = (prompt: (typeof JOURNAL_PROMPTS)[number]) => {
    setDraft((current) => ({
      ...current,
      prompt: prompt.prompt,
      entryKind:
        current.entryKind === 'book_note' ||
        current.entryKind === 'video_note' ||
        current.entryKind === 'story_note'
          ? current.entryKind
          : 'guided',
    }));
    setEditorOpen(true);
  };

  const editEntry = (entry: JournalEntry) => {
    setDraft({
      title: entry.title,
      content: entry.content,
      prompt: entry.prompt ?? '',
      entryKind: entry.entry_kind,
      linkedBookId: entry.linked_book_id ?? '',
      linkedBookTitle: entry.linked_book_title ?? '',
      linkedMediaType:
        entry.linked_media_type ??
        (entry.entry_kind === 'video_note'
          ? 'video'
          : entry.entry_kind === 'story_note'
            ? 'story'
          : entry.entry_kind === 'book_note'
            ? 'book'
            : ''),
      tags: entry.tags.join(', '),
      isFavorite: entry.is_favorite,
    });
    setEditingId(entry.id);
    setDraftOwnerId(context.user_id);
    setEditorOpen(true);
    setError('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const saveEntry = async () => {
    const userId = context.user_id;
    if (!userId) {
      setError('Your private profile is still loading. Please try again.');
      return;
    }
    if (!draftOwnerMatches) {
      setError('Your private profile is still loading. Please try again.');
      return;
    }
    if (storyPersistenceUnavailable) {
      setError('Story notes will be available after the library update finishes.');
      return;
    }

    const errors = validateJournalDraft(draft);
    if (errors.length > 0) {
      setError(errors[0]);
      return;
    }

    setSaving(true);
    setError('');
    const prepared = prepareJournalDraft(draft);
    const now = new Date().toISOString();

    const result = editingId
      ? await supabase
          .from('journal_entries')
          .update({ ...prepared, updated_at: now })
          .eq('id', editingId)
          .eq('user_id', userId)
          .select()
          .single()
      : await supabase
          .from('journal_entries')
          .insert({ ...prepared, user_id: userId })
          .select()
          .single();

    if (currentOwnerIdRef.current !== userId || draftOwnerId !== userId) return;
    setSaving(false);
    if (result.error || !result.data) {
      setError('This entry could not be saved. Your existing entries were not changed.');
      return;
    }

    const savedEntry = result.data as JournalEntry;
    setEntries((current) =>
      editingId
        ? current.map((entry) => (entry.id === editingId ? savedEntry : entry))
        : [savedEntry, ...current]
    );
    resetEditor();
    setEditorOpen(false);
  };

  const deleteEntry = async (entry: JournalEntry) => {
    const userId = context.user_id;
    if (!userId) return;
    if (!window.confirm(`Delete "${entry.title}"? This cannot be undone.`)) return;

    const { error: deleteError } = await supabase
      .from('journal_entries')
      .delete()
      .eq('id', entry.id)
      .eq('user_id', userId);

    if (currentOwnerIdRef.current !== userId) return;
    if (deleteError) {
      setError('The entry could not be deleted.');
      return;
    }

    setEntries((current) => current.filter(({ id }) => id !== entry.id));
    if (editingId === entry.id) {
      resetEditor();
      setEditorOpen(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#f4f1e8] px-4 py-8 pb-28 md:py-12">
      <div className="mx-auto max-w-6xl">
        <section className="relative overflow-hidden rounded-[2rem] bg-[#173f38] px-6 py-8 text-white shadow-[0_24px_70px_rgba(23,63,56,0.18)] md:px-10 md:py-11">
          <div className="absolute -right-10 -top-14 h-52 w-52 rounded-full bg-amber-300/20 blur-2xl" />
          <div className="relative flex flex-col justify-between gap-6 md:flex-row md:items-end">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-sm text-emerald-50">
                <Feather className="h-4 w-4" aria-hidden="true" />
                Private journal
              </div>
              <h1 className="mt-4 font-[family-name:var(--font-display)] text-4xl leading-tight md:text-6xl">
                Think on paper.
              </h1>
              <p className="mt-3 max-w-2xl text-base leading-7 text-emerald-50/90">
                Capture what matters, connect useful ideas to action, and return to your own words.
              </p>
            </div>
            <Button
              type="button"
              onClick={startNewEntry}
              className="w-fit bg-amber-300 text-emerald-950 hover:bg-amber-200"
            >
              <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
              New entry
            </Button>
          </div>
        </section>

        <DismissibleNotice
          noticeKey="journal-sharing-v2"
          className="mt-5 flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 pr-14 text-sm leading-6 text-emerald-950"
        >
          <LockKeyhole className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
          <div>
            <p>Private by default. You choose when AI uses your journal.</p>
            <div className="mt-2 flex flex-wrap gap-3 text-xs font-semibold">
              <Link href="/chat" className="underline underline-offset-4">
                AI context
              </Link>
              <Link href="/partner" className="underline underline-offset-4">
                Partner sharing
              </Link>
            </div>
          </div>
        </DismissibleNotice>

        {editorOpen && draftOwnerMatches && (
          <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 md:px-7">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-800">
                  {editingId ? 'Editing entry' : 'New entry'}
                </p>
                <h2 className="mt-1 text-xl font-semibold text-slate-950">
                  {draft.linkedBookTitle
                    ? `Reflect on ${draft.linkedBookTitle}`
                    : 'Write without needing to perfect it'}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => {
                  resetEditor();
                  setEditorOpen(false);
                }}
                className="rounded-full p-2 text-slate-500 hover:bg-slate-100"
                aria-label="Close journal editor"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <div className="grid gap-6 p-5 md:grid-cols-[1fr_18rem] md:p-7">
              <div className="space-y-5">
                {draft.prompt && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                    <p className="text-xs font-bold uppercase tracking-[0.12em] text-amber-800">
                      Reflection prompt
                    </p>
                    <p className="mt-2 text-sm leading-6 text-amber-950">{draft.prompt}</p>
                  </div>
                )}

                <div>
                  <label htmlFor="journal-title" className="text-sm font-semibold text-slate-800">
                    Title <span className="font-normal text-slate-500">(optional)</span>
                  </label>
                  <Input
                    id="journal-title"
                    value={draft.title}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, title: event.target.value }))
                    }
                    maxLength={JOURNAL_LIMITS.title}
                    placeholder="A title, or we will use your first line"
                    className="mt-2"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between gap-3">
                    <label
                      htmlFor="journal-content"
                      className="text-sm font-semibold text-slate-800"
                    >
                      Your notes
                    </label>
                    <span className="text-xs text-slate-500">
                      {draft.content.length.toLocaleString()} /{' '}
                      {JOURNAL_LIMITS.content.toLocaleString()}
                    </span>
                  </div>
                  <Textarea
                    id="journal-content"
                    value={draft.content}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, content: event.target.value }))
                    }
                    maxLength={JOURNAL_LIMITS.content}
                    placeholder="What are you noticing? What matters? What might you try next?"
                    className="mt-2 min-h-72 resize-y text-base leading-7"
                  />
                </div>

                <div>
                  <label htmlFor="journal-tags" className="text-sm font-semibold text-slate-800">
                    Tags <span className="font-normal text-slate-500">(comma separated)</span>
                  </label>
                  <Input
                    id="journal-tags"
                    value={draft.tags}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, tags: event.target.value }))
                    }
                    placeholder="work, rest, boundaries"
                    className="mt-2"
                  />
                </div>

                {error && (
                  <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">
                    {error}
                  </p>
                )}

                {storyPersistenceUnavailable && !error && (
                  <p className="rounded-xl bg-sky-50 p-3 text-sm text-sky-900">
                    Story notes will be available after the library update finishes.
                  </p>
                )}

                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    type="button"
                    onClick={saveEntry}
                    disabled={saving || storyPersistenceUnavailable}
                  >
                    <Save className="mr-2 h-4 w-4" aria-hidden="true" />
                    {saving ? 'Saving...' : editingId ? 'Save changes' : 'Save entry'}
                  </Button>
                  <button
                    type="button"
                    onClick={() =>
                      setDraft((current) => ({
                        ...current,
                        isFavorite: !current.isFavorite,
                      }))
                    }
                    className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold ${
                      draft.isFavorite
                        ? 'border-rose-200 bg-rose-50 text-rose-800'
                        : 'border-slate-200 text-slate-700'
                    }`}
                    aria-pressed={draft.isFavorite}
                  >
                    <Heart
                      className="h-4 w-4"
                      fill={draft.isFavorite ? 'currentColor' : 'none'}
                      aria-hidden="true"
                    />
                    {draft.isFavorite ? 'Important' : 'Mark important'}
                  </button>
                </div>
              </div>

              <aside>
                <p className="text-sm font-semibold text-slate-900">Need a starting point?</p>
                <div className="mt-3 space-y-2">
                  {JOURNAL_PROMPTS.map((prompt) => (
                    <button
                      key={prompt.id}
                      type="button"
                      onClick={() => selectPrompt(prompt)}
                      className="w-full rounded-xl border border-slate-200 p-3 text-left hover:border-emerald-300 hover:bg-emerald-50"
                    >
                      <span className="text-sm font-semibold text-slate-900">{prompt.title}</span>
                      <span className="mt-1 block text-xs leading-5 text-slate-600">
                        {prompt.prompt}
                      </span>
                    </button>
                  ))}
                </div>
              </aside>
            </div>
          </section>
        )}

        <section className="mt-8" aria-labelledby="journal-entries-heading">
          <div className="flex flex-col justify-between gap-3 md:flex-row md:items-end">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-emerald-800">
                Your writing
              </p>
              <h2
                id="journal-entries-heading"
                className="mt-1 font-[family-name:var(--font-display)] text-3xl text-slate-950"
              >
                Entries you can return to.
              </h2>
            </div>
            <p className="text-sm text-slate-600">
              {ownerEntries.length}{' '}
              {ownerEntries.length === 1 ? 'entry' : 'entries'}
            </p>
          </div>

          <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-4">
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                aria-hidden="true"
              />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search your entries"
                aria-label="Search journal entries"
                className="pl-10"
              />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {(
                [
                  ['all', 'All'],
                  ['favorites', 'Important'],
                  ['library_notes', 'Library notes'],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setFilter(value)}
                  aria-pressed={filter === value}
                  className={`rounded-full px-4 py-2 text-sm font-semibold ${
                    filter === value
                      ? 'bg-emerald-950 text-white'
                      : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {loading && (
            <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-600">
              Loading your journal...
            </div>
          )}

          {!loading && visibleEntries.length === 0 && (
            <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-white/70 p-10 text-center">
              <Feather className="mx-auto h-7 w-7 text-emerald-800" aria-hidden="true" />
              <p className="mt-3 font-semibold text-slate-950">
                {ownerEntries.length === 0
                  ? 'Your journal is ready.'
                  : 'No entries match this view.'}
              </p>
              <p className="mt-1 text-sm text-slate-600">
                {ownerEntries.length === 0
                  ? 'Start with a few honest lines. A title is optional.'
                  : 'Try a different search or filter.'}
              </p>
            </div>
          )}

          {!loading && visibleEntries.length > 0 && (
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {visibleEntries.map((entry) => (
                <article
                  key={entry.id}
                  className="flex min-h-64 flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
                      <CalendarDays className="h-4 w-4" aria-hidden="true" />
                      <time dateTime={entry.created_at}>
                        {format(new Date(entry.created_at), 'MMM d, yyyy')}
                      </time>
                    </div>
                    {entry.is_favorite && (
                      <Heart
                        className="h-4 w-4 text-rose-600"
                        fill="currentColor"
                        aria-label="Important entry"
                      />
                    )}
                  </div>

                  <h3 className="mt-4 text-xl font-semibold text-slate-950">{entry.title}</h3>
                  {entry.linked_book_title && (
                    <p className="mt-2 inline-flex items-center gap-2 text-xs font-semibold text-emerald-800">
                      {entry.linked_media_type === 'video' ||
                      entry.entry_kind === 'video_note' ? (
                        <Video className="h-4 w-4" aria-hidden="true" />
                      ) : entry.linked_media_type === 'story' ||
                        entry.entry_kind === 'story_note' ? (
                        <Quote className="h-4 w-4" aria-hidden="true" />
                      ) : (
                        <BookOpen className="h-4 w-4" aria-hidden="true" />
                      )}
                      {entry.linked_media_type === 'video' ||
                      entry.entry_kind === 'video_note'
                        ? 'Video'
                        : entry.linked_media_type === 'story' ||
                            entry.entry_kind === 'story_note'
                          ? 'Story'
                          : 'Book'}
                      : {entry.linked_book_title}
                    </p>
                  )}
                  <p className="mt-3 line-clamp-5 whitespace-pre-wrap text-sm leading-6 text-slate-600">
                    {entry.content}
                  </p>

                  {entry.tags.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {entry.tags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="mt-auto flex gap-2 pt-5">
                    <Button type="button" variant="outline" size="sm" onClick={() => editEntry(entry)}>
                      <Pencil className="mr-2 h-4 w-4" aria-hidden="true" />
                      Edit
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteEntry(entry)}
                      className="text-red-700 hover:bg-red-50 hover:text-red-800"
                    >
                      <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" />
                      Delete
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
