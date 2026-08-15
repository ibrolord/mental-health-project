import { useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  InputAccessoryView,
  Keyboard,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { format } from 'date-fns';
import { Colors } from '@/lib/constants';
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
import { supabase } from '@/lib/supabase';

type JournalFilter = 'all' | 'favorites' | 'library_notes';

function firstParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? '' : value ?? '';
}

function libraryEntryLabel(entry: JournalEntry): 'Book' | 'Video' | 'Story' {
  if (
    entry.linked_media_type === 'video' ||
    entry.entry_kind === 'video_note'
  ) {
    return 'Video';
  }
  if (
    entry.linked_media_type === 'story' ||
    entry.entry_kind === 'story_note'
  ) {
    return 'Story';
  }
  return 'Book';
}

export default function JournalScreen() {
  const params = useLocalSearchParams<{
    prompt?: string | string[];
    item?: string | string[];
    itemTitle?: string | string[];
    mediaType?: string | string[];
    book?: string | string[];
    bookTitle?: string | string[];
    entry?: string | string[];
  }>();
  const { context, authLoading } = useDataContext();
  const notesAccessoryId = `journal-notes-${useId().replace(/:/g, '')}`;
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [draft, setDraft] = useState<JournalDraft>(emptyJournalDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(true);
  const [promptIdeasOpen, setPromptIdeasOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<JournalFilter>('all');
  const [error, setError] = useState('');
  const [loadedOwnerId, setLoadedOwnerId] = useState<string | null>(null);
  const [draftOwnerId, setDraftOwnerId] = useState<string | null>(null);
  const [highlightedEntryId, setHighlightedEntryId] = useState<string | null>(
    null
  );
  const [quoteStorySchemaReady, setQuoteStorySchemaReady] = useState<
    boolean | null
  >(null);
  const appliedLinkRef = useRef('');
  const appliedEntryRef = useRef('');
  const ownerIdentityRef = useRef<{ userId: string | null } | null>(null);
  const currentOwnerIdRef = useRef(context.user_id);
  const ownerGenerationRef = useRef(0);
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
    draft.entryKind === 'story_note' && quoteStorySchemaReady !== true;

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
    ownerGenerationRef.current += 1;
    ownerIdentityRef.current = { userId: context.user_id };
    setEntries([]);
    setLoadedOwnerId(null);
    setDraft(emptyJournalDraft());
    setDraftOwnerId(null);
    setEditingId(null);
    setEditorOpen(Boolean(context.user_id));
    setPromptIdeasOpen(false);
    setSearch('');
    setFilter('all');
    setError('');
    setSaving(false);
    appliedLinkRef.current = '';
    appliedEntryRef.current = '';
    setHighlightedEntryId(null);
  }, [context.user_id]);

  useEffect(() => {
    if (authLoading || !context.user_id) return;
    const prompt = firstParam(params.prompt).slice(0, JOURNAL_LIMITS.prompt);
    const linkedBookId = (
      firstParam(params.item) || firstParam(params.book)
    ).slice(0, 120);
    const linkedBookTitle = (
      firstParam(params.itemTitle) || firstParam(params.bookTitle)
    ).slice(0, 200);
    const requestedMediaType = firstParam(params.mediaType);
    const linkedMediaType =
      requestedMediaType === 'video'
        ? 'video'
        : requestedMediaType === 'story'
          ? 'story'
          : linkedBookId || linkedBookTitle
            ? 'book'
            : '';
    if (!prompt && !linkedBookId && !linkedBookTitle) {
      appliedLinkRef.current = '';
      return;
    }

    const linkIdentity = `${linkedMediaType}\u0000${linkedBookId}\u0000${linkedBookTitle}\u0000${prompt}`;
    if (appliedLinkRef.current === linkIdentity) return;
    appliedLinkRef.current = linkIdentity;

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
  }, [
    authLoading,
    context.user_id,
    params.book,
    params.bookTitle,
    params.item,
    params.itemTitle,
    params.mediaType,
    params.prompt,
  ]);

  useEffect(() => {
    if (authLoading) return;
    if (!context.user_id) {
      setEntries([]);
      setLoadedOwnerId(null);
      setLoading(false);
      return;
    }

    const ownerId = context.user_id;
    const ownerGeneration = ownerGenerationRef.current;
    let active = true;
    const loadEntries = async () => {
      setLoading(true);
      setLoadedOwnerId(null);
      const { data, error: loadError } = await supabase
        .from('journal_entries')
        .select('*')
        .eq('user_id', ownerId)
        .order('created_at', { ascending: false });

      if (
        !active ||
        currentOwnerIdRef.current !== ownerId ||
        ownerGenerationRef.current !== ownerGeneration
      ) {
        return;
      }
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

  useEffect(() => {
    if (authLoading || loading || !context.user_id) return;
    const entryId = firstParam(params.entry);
    if (!entryId) return;
    const requestIdentity = `${context.user_id}:${entryId}`;
    if (appliedEntryRef.current === requestIdentity) return;
    appliedEntryRef.current = requestIdentity;
    if (!ownerEntries.some(({ id }) => id === entryId)) {
      setHighlightedEntryId(null);
      setError('That journal entry is no longer available.');
      return;
    }
    setSearch('');
    setFilter('all');
    setEditorOpen(false);
    setHighlightedEntryId(entryId);
  }, [authLoading, context.user_id, loading, ownerEntries, params.entry]);

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
  const displayedEntries = useMemo(() => {
    if (!highlightedEntryId) return visibleEntries;
    return [...visibleEntries].sort((a, b) => {
      if (a.id === highlightedEntryId) return -1;
      if (b.id === highlightedEntryId) return 1;
      return 0;
    });
  }, [highlightedEntryId, visibleEntries]);

  const resetEditor = () => {
    setDraft(emptyJournalDraft());
    setEditingId(null);
    setPromptIdeasOpen(false);
    setError('');
  };

  const closeEditor = () => {
    const hasUnsavedWork = Boolean(
      editingId ||
        draft.title.trim() ||
        draft.content.trim() ||
        draft.tags.trim() ||
        draft.prompt.trim() ||
        draft.isFavorite
    );
    const close = () => {
      resetEditor();
      setEditorOpen(false);
    };
    if (!hasUnsavedWork) {
      close();
      return;
    }
    Alert.alert(
      'Discard this draft?',
      'Your unsaved changes will be lost.',
      [
        { text: 'Keep writing', style: 'cancel' },
        { text: 'Discard draft', style: 'destructive', onPress: close },
      ]
    );
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
    const ownerGeneration = ownerGenerationRef.current;
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

    if (
      currentOwnerIdRef.current !== userId ||
      ownerGenerationRef.current !== ownerGeneration
    ) {
      return;
    }
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
  };

  const deleteEntry = (entry: JournalEntry) => {
    const ownerId = context.user_id;
    const ownerGeneration = ownerGenerationRef.current;
    if (!ownerId) return;
    Alert.alert(
      'Delete entry?',
      `"${entry.title}" will be permanently deleted.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (
              currentOwnerIdRef.current !== ownerId ||
              ownerGenerationRef.current !== ownerGeneration
            ) {
              return;
            }
            const { error: deleteError } = await supabase
              .from('journal_entries')
              .delete()
              .eq('id', entry.id)
              .eq('user_id', ownerId);
            if (
              currentOwnerIdRef.current !== ownerId ||
              ownerGenerationRef.current !== ownerGeneration
            ) {
              return;
            }
            if (deleteError) {
              setError('The entry could not be deleted.');
              return;
            }
            setEntries((current) => current.filter(({ id }) => id !== entry.id));
            if (editingId === entry.id) {
              resetEditor();
              setEditorOpen(false);
            }
          },
        },
      ]
    );
  };

  return (
    <ScrollView
      style={s.container}
      contentContainerStyle={s.content}
      keyboardShouldPersistTaps="handled"
    >
      <View style={s.hero}>
        <Text style={s.kicker}>PRIVATE JOURNAL</Text>
        <Text style={s.heroTitle}>Think on paper.</Text>
        <Text style={s.heroText}>
          Capture what matters, connect reading to action, and return to your own words.
        </Text>
      </View>

      <View style={s.actionRow}>
        <TouchableOpacity
          style={s.primaryButton}
          accessibilityRole="button"
          accessibilityLabel="New journal entry"
          onPress={() => {
            resetEditor();
            setDraftOwnerId(context.user_id);
            setEditorOpen(true);
          }}
        >
          <Text style={s.primaryButtonText}>+ New entry</Text>
        </TouchableOpacity>
      </View>

      {editorOpen && draftOwnerMatches && (
        <View style={s.editor}>
          <View style={s.editorHeader}>
            <View style={{ flex: 1 }}>
              <Text style={s.sectionKicker}>{editingId ? 'EDITING ENTRY' : 'NEW ENTRY'}</Text>
              <Text style={s.editorTitle}>
                {draft.linkedBookTitle
                  ? `Reflect on ${draft.linkedBookTitle}`
                  : 'Write without perfecting it'}
              </Text>
            </View>
            <TouchableOpacity
              accessibilityRole="button"
              onPress={closeEditor}
              accessibilityLabel="Close journal editor"
              style={s.closeButton}
            >
              <Feather name="x" size={20} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {draft.prompt ? (
            <View style={s.promptBox}>
              <Text style={s.promptLabel}>REFLECTION PROMPT</Text>
              <Text style={s.promptText}>{draft.prompt}</Text>
            </View>
          ) : null}

          <Text style={s.label}>Title (optional)</Text>
          <TextInput
            style={s.input}
            accessibilityLabel="Journal title"
            value={draft.title}
            onChangeText={(title) => setDraft((current) => ({ ...current, title }))}
            maxLength={JOURNAL_LIMITS.title}
            placeholder="A title, or we will use your first line"
            placeholderTextColor={Colors.textSecondary}
          />

          <TouchableOpacity
            accessibilityRole="button"
            accessibilityState={{ expanded: promptIdeasOpen }}
            onPress={() => setPromptIdeasOpen((current) => !current)}
            style={s.promptDisclosure}
          >
            <View style={{ flex: 1 }}>
              <Text style={s.promptDisclosureTitle}>Need a starting point?</Text>
              <Text style={s.promptDisclosureText}>Choose a short guided prompt</Text>
            </View>
            <Feather
              name={promptIdeasOpen ? 'chevron-up' : 'chevron-down'}
              size={18}
              color={Colors.primary}
            />
          </TouchableOpacity>
          {promptIdeasOpen ? (
            <View style={s.promptIdeas}>
              {JOURNAL_PROMPTS.map((prompt) => (
                <TouchableOpacity
                  key={prompt.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Use journal prompt: ${prompt.title}`}
                  style={s.promptChoice}
                  onPress={() => {
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
                    setPromptIdeasOpen(false);
                  }}
                >
                  <Text style={s.promptChoiceTitle}>{prompt.title}</Text>
                  <Text style={s.promptChoiceText}>{prompt.prompt}</Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : null}

          <View style={s.labelRow}>
            <Text style={s.label}>Your notes</Text>
            <Text style={s.counter}>
              {draft.content.length.toLocaleString()} / {JOURNAL_LIMITS.content.toLocaleString()}
            </Text>
          </View>
          <TextInput
            style={s.textArea}
            accessibilityLabel="Journal notes"
            inputAccessoryViewID={Platform.OS === 'ios' ? notesAccessoryId : undefined}
            value={draft.content}
            onChangeText={(content) => setDraft((current) => ({ ...current, content }))}
            maxLength={JOURNAL_LIMITS.content}
            placeholder="What are you noticing? What matters? What might you try next?"
            placeholderTextColor={Colors.textSecondary}
            textAlignVertical="top"
            multiline
          />
          {Platform.OS === 'ios' ? (
            <InputAccessoryView nativeID={notesAccessoryId}>
              <View style={s.keyboardToolbar}>
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel="Save journal entry"
                  disabled={saving || storyPersistenceUnavailable}
                  onPress={() => void saveEntry()}
                  style={s.keyboardSave}
                >
                  <Text style={s.keyboardSaveText}>{saving ? 'Saving...' : 'Save'}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel="Dismiss journal keyboard"
                  onPress={Keyboard.dismiss}
                  style={s.keyboardDone}
                >
                  <Text style={s.keyboardDoneText}>Done</Text>
                </TouchableOpacity>
              </View>
            </InputAccessoryView>
          ) : null}

          <Text style={s.label}>Tags (comma separated)</Text>
          <TextInput
            style={s.input}
            accessibilityLabel="Journal tags"
            value={draft.tags}
            onChangeText={(tags) => setDraft((current) => ({ ...current, tags }))}
            placeholder="work, rest, boundaries"
            placeholderTextColor={Colors.textSecondary}
          />

          <TouchableOpacity
            style={[s.favoriteButton, draft.isFavorite && s.favoriteButtonActive]}
            accessibilityRole="button"
            accessibilityLabel={
              draft.isFavorite ? 'Remove important mark' : 'Mark journal entry important'
            }
            accessibilityState={{ selected: draft.isFavorite }}
            onPress={() =>
              setDraft((current) => ({ ...current, isFavorite: !current.isFavorite }))
            }
          >
            <Text
              style={[
                s.favoriteButtonText,
                draft.isFavorite && s.favoriteButtonTextActive,
              ]}
            >
              {draft.isFavorite ? '♥ Marked important' : '♡ Mark important'}
            </Text>
          </TouchableOpacity>

          {error ? <Text style={s.errorText}>{error}</Text> : null}
          {storyPersistenceUnavailable && !error ? (
            <Text style={s.errorText}>
              Story notes will be available after the library update finishes.
            </Text>
          ) : null}

          <TouchableOpacity
            style={[
              s.saveButton,
              (saving || storyPersistenceUnavailable) && { opacity: 0.6 },
            ]}
            onPress={saveEntry}
            disabled={saving || storyPersistenceUnavailable}
          >
            <Text style={s.saveButtonText}>
              {saving ? 'Saving...' : editingId ? 'Save changes' : 'Save entry'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      <Text style={[s.sectionKicker, { marginTop: 28 }]}>YOUR WRITING</Text>
      <View style={s.entriesHeading}>
        <Text style={s.entriesTitle}>Entries to return to.</Text>
        <Text style={s.entryCount}>{ownerEntries.length}</Text>
      </View>

      <View style={s.filterCard}>
        <TextInput
          style={s.searchInput}
          accessibilityLabel="Search journal entries"
          value={search}
          onChangeText={setSearch}
          placeholder="Search your entries"
          placeholderTextColor={Colors.textSecondary}
        />
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {(
            [
              ['all', 'All'],
              ['favorites', 'Important'],
              ['library_notes', 'Library notes'],
            ] as const
          ).map(([value, label]) => (
            <TouchableOpacity
              key={value}
              accessibilityRole="button"
              accessibilityState={{ selected: filter === value }}
              style={[s.filterButton, filter === value && s.filterButtonActive]}
              onPress={() => setFilter(value)}
            >
              <Text style={[s.filterText, filter === value && s.filterTextActive]}>
                {label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {loading ? (
        <View style={s.emptyBox}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={s.emptyText}>Loading your journal...</Text>
        </View>
      ) : visibleEntries.length === 0 ? (
        <View style={s.emptyBox}>
          <Text style={s.emptyTitle}>
            {ownerEntries.length === 0
              ? 'Your journal is ready.'
              : 'No entries match this view.'}
          </Text>
          <Text style={s.emptyText}>
            {ownerEntries.length === 0
              ? 'Start with a few honest lines. A title is optional.'
              : 'Try a different search or filter.'}
          </Text>
        </View>
      ) : (
        displayedEntries.map((entry) => (
          <View
            key={entry.id}
            style={[
              s.entryCard,
              highlightedEntryId === entry.id && s.entryCardHighlighted,
            ]}
          >
            <View style={s.entryMeta}>
              <Text style={s.entryDate}>{format(new Date(entry.created_at), 'MMM d, yyyy')}</Text>
              {entry.is_favorite ? <Text style={s.heart}>♥</Text> : null}
            </View>
            <Text style={s.entryTitle}>{entry.title}</Text>
            {entry.linked_book_title ? (
              <Text style={s.mediaLabel}>
                {libraryEntryLabel(entry)}: {entry.linked_book_title}
              </Text>
            ) : null}
            <Text style={s.entryPreview} numberOfLines={5}>
              {entry.content}
            </Text>
            {entry.tags.length > 0 ? (
              <View style={s.tagsRow}>
                {entry.tags.map((tag) => (
                  <Text key={tag} style={s.tag}>
                    {tag}
                  </Text>
                ))}
              </View>
            ) : null}
            <View style={s.entryActions}>
              <TouchableOpacity
                style={s.editButton}
                accessibilityRole="button"
                accessibilityLabel={`Edit ${entry.title}`}
                onPress={() => editEntry(entry)}
              >
                <Text style={s.editButtonText}>Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={`Delete ${entry.title}`}
                onPress={() => deleteEntry(entry)}
              >
                <Text style={s.deleteButtonText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f4f1e8' },
  content: { padding: 16, paddingBottom: 48 },
  hero: { borderRadius: 24, backgroundColor: '#173f38', padding: 22 },
  kicker: { color: '#a7f3d0', fontSize: 11, fontWeight: '700', letterSpacing: 1.1 },
  heroTitle: { color: '#fff', fontSize: 31, lineHeight: 37, fontWeight: '700', marginTop: 8 },
  heroText: { color: '#d1fae5', fontSize: 14, lineHeight: 21, marginTop: 9 },
  actionRow: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 14 },
  primaryButton: {
    borderRadius: 10,
    backgroundColor: '#173f38',
    paddingHorizontal: 16,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
  },
  primaryButtonText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  keyboardToolbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f4f1e8',
    borderTopColor: '#cbd8d2',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  keyboardDone: { paddingHorizontal: 10, paddingVertical: 6 },
  keyboardDoneText: { color: '#173f38', fontSize: 16, fontWeight: '700' },
  keyboardSave: { minHeight: 40, minWidth: 68, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: Colors.primary },
  keyboardSaveText: { color: '#fffef8', fontSize: 14, fontWeight: '700' },
  editor: {
    backgroundColor: '#fff',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 18,
    marginTop: 14,
  },
  editorHeader: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  sectionKicker: { color: '#287264', fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  editorTitle: { color: Colors.text, fontSize: 20, lineHeight: 26, fontWeight: '700', marginTop: 4 },
  closeButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  promptBox: { borderRadius: 12, backgroundColor: '#fffbeb', padding: 13, marginTop: 16 },
  promptLabel: { color: '#92400e', fontSize: 10, fontWeight: '700', letterSpacing: 0.8 },
  promptText: { color: '#78350f', fontSize: 13, lineHeight: 20, marginTop: 6 },
  label: { color: Colors.text, fontSize: 13, fontWeight: '600', marginTop: 16, marginBottom: 6 },
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  counter: { color: Colors.textSecondary, fontSize: 11, marginTop: 16 },
  input: {
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.borderStrong,
    borderRadius: 10,
    backgroundColor: '#f8fafc',
    padding: 12,
    fontSize: 14,
  },
  textArea: {
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.borderStrong,
    borderRadius: 10,
    backgroundColor: '#f8fafc',
    padding: 12,
    minHeight: 220,
    fontSize: 15,
    lineHeight: 23,
  },
  promptChoice: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 11,
    padding: 12,
    marginBottom: 8,
  },
  promptDisclosure: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 10, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: Colors.border, marginTop: 14, paddingVertical: 8 },
  promptDisclosureTitle: { color: Colors.text, fontSize: 14, fontWeight: '700' },
  promptDisclosureText: { color: Colors.textSecondary, fontSize: 12, lineHeight: 16, marginTop: 2 },
  promptIdeas: { marginTop: 10 },
  promptChoiceTitle: { color: Colors.text, fontSize: 13, fontWeight: '700' },
  promptChoiceText: { color: Colors.textSecondary, fontSize: 12, lineHeight: 18, marginTop: 3 },
  favoriteButton: {
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingVertical: 11,
    marginTop: 12,
  },
  favoriteButtonActive: { borderColor: '#fecdd3', backgroundColor: '#fff1f2' },
  favoriteButtonText: { color: Colors.textSecondary, fontSize: 13, fontWeight: '600' },
  favoriteButtonTextActive: { color: '#be123c' },
  errorText: {
    color: '#991b1b',
    backgroundColor: '#fef2f2',
    borderRadius: 10,
    padding: 11,
    fontSize: 12,
    marginTop: 12,
  },
  saveButton: {
    alignItems: 'center',
    borderRadius: 11,
    backgroundColor: '#173f38',
    paddingVertical: 14,
    marginTop: 14,
  },
  saveButtonText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  entriesHeading: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 5,
  },
  entriesTitle: { color: Colors.text, fontSize: 24, lineHeight: 30, fontWeight: '700' },
  entryCount: { color: Colors.textSecondary, fontSize: 13 },
  filterCard: { backgroundColor: '#fff', borderRadius: 15, padding: 12, marginTop: 14 },
  searchInput: {
    color: Colors.text,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    marginBottom: 10,
  },
  filterButton: {
    minHeight: 44,
    justifyContent: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: 20,
    paddingHorizontal: 13,
    paddingVertical: 8,
    marginRight: 7,
  },
  filterButtonActive: { backgroundColor: '#173f38' },
  filterText: { color: Colors.textSecondary, fontSize: 12, fontWeight: '600' },
  filterTextActive: { color: '#fff' },
  emptyBox: {
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: '#fff',
    padding: 28,
    marginTop: 12,
  },
  emptyTitle: { color: Colors.text, fontSize: 16, fontWeight: '700', textAlign: 'center' },
  emptyText: { color: Colors.textSecondary, fontSize: 13, lineHeight: 19, textAlign: 'center', marginTop: 6 },
  entryCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 17,
    marginTop: 12,
  },
  entryCardHighlighted: {
    borderColor: Colors.primary,
    borderWidth: 2,
  },
  entryMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  entryDate: { color: Colors.textSecondary, fontSize: 11 },
  heart: { color: '#e11d48', fontSize: 16 },
  entryTitle: { color: Colors.text, fontSize: 19, lineHeight: 24, fontWeight: '700', marginTop: 10 },
  mediaLabel: { color: '#287264', fontSize: 12, fontWeight: '600', marginTop: 6 },
  entryPreview: { color: Colors.textSecondary, fontSize: 13, lineHeight: 20, marginTop: 9 },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 },
  tag: {
    color: Colors.textSecondary,
    backgroundColor: '#f1f5f9',
    borderRadius: 20,
    paddingHorizontal: 9,
    paddingVertical: 4,
    overflow: 'hidden',
    fontSize: 10,
  },
  entryActions: { flexDirection: 'row', alignItems: 'center', gap: 18, marginTop: 15 },
  editButton: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  editButtonText: { color: Colors.text, fontSize: 12, fontWeight: '700' },
  deleteButtonText: { color: '#b91c1c', fontSize: 12, fontWeight: '700' },
});
