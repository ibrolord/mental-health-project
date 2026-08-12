import { useEffect, useMemo, useRef, useState } from 'react';
import { Feather } from '@expo/vector-icons';
import {
  Alert,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
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
import { Colors } from '@/lib/constants';
import {
  BOOK_PRACTICE_TEMPLATES,
  bookPracticeTemplatesFor,
  UNIFIED_LIBRARY,
  filterBookPracticeTemplates,
  filterLibraryItems,
  isBookItem,
  isStoryItem,
  isVideoItem,
  practiceDestinationFor,
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
  EMPTY_LIBRARY_ITEM_STATE,
  hasMeaningfulLibraryState,
  indexLibraryItemStates,
  nextLibraryState,
  type LibraryItemState,
  type LibraryItemStateDraft,
} from '@/lib/library/user-state';
import { refreshReminders } from '@/lib/notifications';
import { useDataContext } from '@/lib/hooks/use-data-context';
import { supabase } from '@/lib/supabase';

const MEDIA_FILTERS: {
  id: LibraryMediaFilter;
  label: string;
}[] = [
  { id: 'all', label: 'All' },
  { id: 'book', label: 'Books' },
  { id: 'video', label: 'Talks' },
  { id: 'story', label: 'Stories' },
  { id: 'saved', label: 'Saved' },
  { id: 'next', label: 'Up next' },
];

const TEMPLATE_FILTERS: { id: LibraryTemplateFilter; label: string }[] = [
  { id: 'all', label: 'All templates' },
  { id: 'journal', label: 'Journal' },
  { id: 'goal', label: 'Goal' },
  { id: 'habit', label: 'Habit' },
  { id: 'routine', label: 'Routine' },
];

type LibraryView = 'resources' | 'templates';
const EMPTY_ITEM_STATES: Record<string, LibraryItemState> = {};

function mediaLabel(item: LibraryItem): string {
  if (isVideoItem(item)) return 'Talk';
  if (isStoryItem(item)) return 'Story';
  return 'Book';
}

function integrationRoute(
  item: LibraryItem,
  integration: LibraryIntegration
) {
  const baseParams = {
    source: 'library',
    item: item.id,
    itemTitle: item.title,
    book: item.id,
    bookTitle: item.title,
    mediaType: item.mediaType,
  };
  const destination = practiceDestinationFor(integration);
  if (!destination) return { pathname: '/library' as const };
  return {
    pathname: destination.pathname,
    params: { ...baseParams, ...destination.params },
  };
}

function SourceLink({ label, url }: { label: string; url: string }) {
  return (
    <Pressable
      accessibilityRole="link"
      onPress={() =>
        void Linking.openURL(url).catch(() =>
          Alert.alert('Unable to open link', 'Try again when you are online.')
        )
      }
      style={styles.sourceLink}
    >
      <Text style={styles.sourceText}>{label}</Text>
      <Feather name="external-link" size={15} color={Colors.primary} />
    </Pressable>
  );
}

function DetailSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.detailSection}>
      <Text style={styles.detailSectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

export default function LibraryScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ item?: string }>();
  const { context, authLoading } = useDataContext();
  const [search, setSearch] = useState('');
  const [topic, setTopic] = useState<LibraryTopic>('All');
  const [media, setMedia] = useState<LibraryMediaFilter>('all');
  const [libraryView, setLibraryView] = useState<LibraryView>('resources');
  const [templateFilter, setTemplateFilter] = useState<LibraryTemplateFilter>('all');
  const [showTopics, setShowTopics] = useState(false);
  const [selected, setSelected] = useState<LibraryItem | null>(null);
  const [itemStates, setItemStates] = useState<
    Record<string, LibraryItemState>
  >({});
  const [loadedOwnerId, setLoadedOwnerId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState('');
  const [loadingState, setLoadingState] = useState(true);
  const [savingKey, setSavingKey] = useState('');
  const [error, setError] = useState('');
  const ownerRef = useRef(context.user_id);
  const appliedRequestRef = useRef('');
  ownerRef.current = context.user_id;

  const currentOwnerId = context.user_id ?? null;
  const ownerStateReady =
    !authLoading && loadedOwnerId === currentOwnerId && !loadingState;
  const effectiveItemStates = ownerStateReady ? itemStates : EMPTY_ITEM_STATES;

  useEffect(() => {
    if (authLoading) return;
    const ownerId = context.user_id;
    setSelected(null);
    setNoteDraft('');
    setSavingKey('');
    appliedRequestRef.current = '';
    if (!ownerId) {
      setItemStates({});
      setLoadedOwnerId(null);
      setLoadingState(false);
      return;
    }
    let active = true;
    setLoadingState(true);
    setLoadedOwnerId(null);
    setError('');
    void supabase
      .from('user_library_items')
      .select(
        'id, user_id, content_id, media_type, is_saved, priority, custom_notes, created_at, updated_at'
      )
      .eq('user_id', ownerId)
      .order('updated_at', { ascending: false })
      .then(({ data, error: loadError }) => {
        if (!active || ownerRef.current !== ownerId) return;
        if (loadError) {
          setError('Your saved library items could not be loaded.');
          setItemStates({});
        } else {
          setItemStates(indexLibraryItemStates((data ?? []) as LibraryItemState[]));
        }
        setLoadedOwnerId(ownerId);
        setLoadingState(false);
      });
    return () => {
      active = false;
    };
  }, [authLoading, context.user_id]);

  useEffect(() => {
    if (!ownerStateReady) return;
    const requestedItemId =
      typeof params.item === 'string' ? params.item : params.item?.[0];
    if (!requestedItemId) return;
    const requestIdentity = `${context.user_id ?? 'none'}:${requestedItemId}`;
    if (appliedRequestRef.current === requestIdentity) return;
    appliedRequestRef.current = requestIdentity;
    const requestedItem = UNIFIED_LIBRARY.find(
      ({ id }) => id === requestedItemId
    );
    if (!requestedItem) {
      setError('That saved library item is no longer available.');
      return;
    }
    setSelected(requestedItem);
    setNoteDraft(effectiveItemStates[requestedItem.id]?.custom_notes ?? '');
    setError('');
  }, [
    context.user_id,
    effectiveItemStates,
    ownerStateReady,
    params.item,
  ]);

  const savedIds = useMemo(
    () =>
      new Set(
        Object.values(effectiveItemStates)
          .filter(({ is_saved }) => is_saved)
          .map(({ content_id }) => content_id)
      ),
    [effectiveItemStates]
  );
  const nextIds = useMemo(
    () =>
      new Set(
        Object.values(effectiveItemStates)
          .filter(({ priority }) => priority === 'next')
          .map(({ content_id }) => content_id)
      ),
    [effectiveItemStates]
  );
  const filtered = useMemo(
    () =>
      filterLibraryItems(UNIFIED_LIBRARY, {
        query: search,
        topic,
        media,
        savedIds,
        nextIds,
      }),
    [media, nextIds, savedIds, search, topic]
  );
  const filteredTemplates = useMemo(
    () =>
      filterBookPracticeTemplates(BOOK_PRACTICE_TEMPLATES, {
        query: search,
        topic,
        action: templateFilter,
      }),
    [search, templateFilter, topic]
  );

  const stateFor = (item: LibraryItem): LibraryItemStateDraft =>
    effectiveItemStates[item.id] ?? {
      ...EMPTY_LIBRARY_ITEM_STATE,
      media_type: item.mediaType,
    };

  const refreshReminderContent = () => {
    void refreshReminders().catch((error) => {
      console.warn('Could not refresh local reminders after a library change:', error);
    });
  };

  const persistState = async (
    item: LibraryItem,
    patch: Partial<LibraryItemStateDraft>
  ) => {
    const ownerId = context.user_id;
    if (!ownerId || !ownerStateReady) return;
    const current = stateFor(item);
    const next = nextLibraryState(current, item.mediaType, patch);
    const key = `${item.id}:${Object.keys(patch).join(',')}`;
    if (savingKey) return;
    setSavingKey(key);
    setError('');
    try {
      if (!hasMeaningfulLibraryState(next)) {
        const { error: deleteError } = await supabase
          .from('user_library_items')
          .delete()
          .eq('user_id', ownerId)
          .eq('content_id', item.id);
        if (deleteError) throw deleteError;
        if (ownerRef.current === ownerId) {
          setItemStates((values) => {
            const copy = { ...values };
            delete copy[item.id];
            return copy;
          });
        }
        refreshReminderContent();
        return;
      }

      const { data, error: saveError } = await supabase
        .from('user_library_items')
        .upsert(
          {
            user_id: ownerId,
            content_id: item.id,
            media_type: item.mediaType,
            is_saved: next.is_saved,
            priority: next.priority,
            custom_notes: next.custom_notes,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id,content_id' }
        )
        .select(
          'id, user_id, content_id, media_type, is_saved, priority, custom_notes, created_at, updated_at'
        )
        .single();
      if (saveError) throw saveError;
      if (ownerRef.current === ownerId) {
        setItemStates((values) => ({
          ...values,
          [item.id]: data as LibraryItemState,
        }));
      }
      refreshReminderContent();
    } catch {
      setError('That library change was not saved.');
    } finally {
      if (ownerRef.current === ownerId) setSavingKey('');
    }
  };

  const openItem = (item: LibraryItem) => {
    if (!ownerStateReady) return;
    setSelected(item);
    setNoteDraft(effectiveItemStates[item.id]?.custom_notes ?? '');
    setError('');
  };

  const selectedForOwner = ownerStateReady ? selected : null;
  if (selectedForOwner) {
    const selected = selectedForOwner;
    const selectedState = stateFor(selected);
    const selectedIsBook = isBookItem(selected);
    const selectedIsStory = isStoryItem(selected);
    const selectedIntegrations = selectedIsBook
      ? bookPracticeTemplatesFor(selected.id).map(({ integration }) => integration)
      : selected.integrations;
    return (
      <AppScreen>
        <AppButton
          label="Back to library"
          icon="arrow-left"
          variant="quiet"
          onPress={() => setSelected(null)}
          style={{ alignSelf: 'flex-start', marginBottom: 18 }}
        />
        <PageHeader
          eyebrow={`${mediaLabel(selected)} · ${selected.topic}`}
          title={selected.title}
          description={`${selected.creator} · ${selected.durationLabel}`}
          icon={selectedIsBook ? 'book' : selectedIsStory ? 'user' : 'play'}
        />
        <View style={styles.actions}>
          <AppButton
            label={selectedState.is_saved ? 'Saved' : 'Save'}
            icon={selectedState.is_saved ? 'bookmark' : 'bookmark'}
            loading={savingKey.startsWith(`${selected.id}:is_saved`)}
            variant={selectedState.is_saved ? 'primary' : 'secondary'}
            onPress={() =>
              void persistState(selected, {
                is_saved: !selectedState.is_saved,
                priority: selectedState.is_saved
                  ? 'none'
                  : selectedState.priority,
              })
            }
          />
          <AppButton
            label={selectedState.priority === 'next' ? 'Up next' : 'Add next'}
            icon="list"
            loading={savingKey.startsWith(`${selected.id}:priority`)}
            variant={
              selectedState.priority === 'next' ? 'primary' : 'secondary'
            }
            onPress={() =>
              void persistState(selected, {
                priority:
                  selectedState.priority === 'next' ? 'none' : 'next',
              })
            }
          />
          {!selectedIsBook ? (
            <AppButton
              label={isVideoItem(selected) ? 'Watch' : 'Original source'}
              icon="external-link"
              variant="secondary"
              onPress={() =>
                void Linking.openURL(selected.sourceUrl).catch(() =>
                  setError('That source could not be opened.')
                )
              }
            />
          ) : null}
        </View>

        {!selectedIsBook && selected.contentNote ? (
          <AppCard quiet>
            <Text style={appUiStyles.muted}>{selected.contentNote}</Text>
          </AppCard>
        ) : null}

        <DetailSection title="A useful orientation">
          <Text style={appUiStyles.body}>{selected.summary}</Text>
        </DetailSection>
        <AppCard style={styles.premiseCard}>
          <Text style={appUiStyles.label}>Central premise</Text>
          <Text style={styles.premiseText}>{selected.centralPremise}</Text>
        </AppCard>

        {selectedIsStory ? (
          <>
            <DetailSection title="The story">
              {selected.storySections.map((section) => (
                <View key={section.heading} style={styles.readingBlock}>
                  <Text style={styles.blockTitle}>{section.heading}</Text>
                  <Text style={styles.readingText}>{section.body}</Text>
                </View>
              ))}
            </DetailSection>
            <DetailSection title="Timeline">
              {selected.timeline.map((milestone) => (
                <View
                  key={`${milestone.period}:${milestone.title}`}
                  style={styles.timelineRow}
                >
                  <Text style={styles.timelinePeriod}>{milestone.period}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.blockTitle}>{milestone.title}</Text>
                    <Text style={appUiStyles.muted}>
                      {milestone.description}
                    </Text>
                  </View>
                </View>
              ))}
            </DetailSection>
          </>
        ) : null}

        {selectedIsBook ? (
          <DetailSection title="Core premises">
            {selected.corePremises.map((idea, index) => (
              <AppCard key={idea.title}>
                <Text style={appUiStyles.label}>Idea {index + 1}</Text>
                <Text style={styles.blockTitle}>{idea.title}</Text>
                <Text style={styles.readingText}>{idea.premise}</Text>
                <Text style={[appUiStyles.label, { marginTop: 13 }]}>
                  Why it matters
                </Text>
                <Text style={appUiStyles.muted}>{idea.whyItMatters}</Text>
                <Text style={[appUiStyles.label, { marginTop: 13 }]}>
                  Try it
                </Text>
                <Text style={appUiStyles.muted}>{idea.practice}</Text>
              </AppCard>
            ))}
          </DetailSection>
        ) : null}

        <DetailSection title="Takeaways">
          {selected.practicalTakeaways.map((takeaway) => (
            <AppCard key={takeaway.title} quiet>
              <Text style={styles.blockTitle}>{takeaway.title}</Text>
              <Text style={appUiStyles.muted}>{takeaway.description}</Text>
              <View style={styles.nextStep}>
                <Feather name="arrow-right" size={15} color={Colors.accent} />
                <Text style={styles.nextStepText}>{takeaway.nextStep}</Text>
              </View>
            </AppCard>
          ))}
        </DetailSection>

        <AppCard>
          <SectionHeader
            title="Your private note"
            description="Use this in AI chat only when you turn on library notes there."
          />
          <AppInput
            value={noteDraft}
            onChangeText={setNoteDraft}
            maxLength={4000}
            multiline
            placeholder="What do you want to remember?"
          />
          <AppButton
            label="Save note"
            icon="save"
            loading={savingKey.startsWith(`${selected.id}:custom_notes`)}
            onPress={() =>
              void persistState(selected, { custom_notes: noteDraft })
            }
          />
        </AppCard>

        {selectedIntegrations.length > 0 ? <DetailSection title="Practice templates">
          <Text style={[appUiStyles.muted, { marginBottom: 12 }]}>
            Prefilled drafts based on paraphrased ideas from this guide. Review before saving.
          </Text>
          {selectedIntegrations.map((integration) => (
            <Pressable
              key={integration.title}
              accessibilityRole="button"
              onPress={() =>
                router.push(integrationRoute(selected, integration))
              }
              style={styles.integration}
            >
              <View style={{ flex: 1 }}>
                <Text style={appUiStyles.label}>
                  {integration.actionType} template
                </Text>
                <Text style={styles.blockTitle}>{integration.title}</Text>
                <Text style={appUiStyles.muted}>
                  {integration.description}
                </Text>
              </View>
              <Feather name="arrow-right" size={18} color={Colors.primary} />
            </Pressable>
          ))}
        </DetailSection> : null}

        <DetailSection title="Questions to carry forward">
          {selected.reflectionPrompts.map((prompt, index) => (
            <View key={prompt} style={styles.promptRow}>
              <Text style={styles.promptNumber}>{index + 1}</Text>
              <Text style={styles.promptText}>{prompt}</Text>
            </View>
          ))}
        </DetailSection>

        {selected.medicalCaveat ? (
          <AppCard style={styles.caveat}>
            <Text style={styles.blockTitle}>Keep in mind</Text>
            <Text style={appUiStyles.muted}>{selected.medicalCaveat}</Text>
          </AppCard>
        ) : null}

        <DetailSection title="Sources">
          {selected.sources.map((source) => (
            <SourceLink
              key={`${source.url}:${source.label}`}
              label={source.label}
              url={source.url}
            />
          ))}
        </DetailSection>
        <Text style={[appUiStyles.muted, { marginBottom: 16 }]}>
          {selected.editorialNote}
        </Text>
        {error ? <Text style={appUiStyles.error}>{error}</Text> : null}
      </AppScreen>
    );
  }

  return (
    <AppScreen>
      <PageHeader
        eyebrow="Library"
        title="Ideas, talks, and real stories."
        description="Open the full guide, keep private notes, and turn useful ideas into action."
        icon="book-open"
      />
      <View style={styles.libraryDestinations}>
        <Pressable
          accessibilityRole="tab"
          accessibilityLabel={`${UNIFIED_LIBRARY.length} library resources`}
          accessibilityState={{ selected: libraryView === 'resources' }}
          onPress={() => setLibraryView('resources')}
          style={({ pressed }) => [
            styles.libraryDestination,
            libraryView === 'resources' && styles.libraryDestinationSelected,
            pressed && styles.pressed,
          ]}
        >
          <View
            style={[
              styles.libraryDestinationIcon,
              libraryView === 'resources' && styles.libraryDestinationIconSelected,
            ]}
          >
            <Feather
              name="book-open"
              size={18}
              color={libraryView === 'resources' ? '#fffef8' : Colors.primary}
            />
          </View>
          <Text
            style={[
              styles.libraryDestinationTitle,
              libraryView === 'resources' && styles.libraryDestinationTextSelected,
            ]}
          >
            Resources
          </Text>
          <Text
            style={[
              styles.libraryDestinationDescription,
              libraryView === 'resources' && styles.libraryDestinationTextSelected,
            ]}
          >
            {UNIFIED_LIBRARY.length} guides, talks, and stories
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="tab"
          accessibilityLabel={`${BOOK_PRACTICE_TEMPLATES.length} practice templates`}
          accessibilityState={{ selected: libraryView === 'templates' }}
          onPress={() => setLibraryView('templates')}
          style={({ pressed }) => [
            styles.libraryDestination,
            libraryView === 'templates' && styles.libraryDestinationSelected,
            pressed && styles.pressed,
          ]}
        >
          <View
            style={[
              styles.libraryDestinationIcon,
              libraryView === 'templates' && styles.libraryDestinationIconSelected,
            ]}
          >
            <Feather
              name="clipboard"
              size={18}
              color={libraryView === 'templates' ? '#fffef8' : Colors.primary}
            />
          </View>
          <Text
            style={[
              styles.libraryDestinationTitle,
              libraryView === 'templates' && styles.libraryDestinationTextSelected,
            ]}
          >
            Templates
          </Text>
          <Text
            style={[
              styles.libraryDestinationDescription,
              libraryView === 'templates' && styles.libraryDestinationTextSelected,
            ]}
          >
            {BOOK_PRACTICE_TEMPLATES.length} ready-to-use tools
          </Text>
        </Pressable>
      </View>
      <AppCard>
        <AppInput
          value={search}
          onChangeText={setSearch}
          placeholder={
            libraryView === 'resources'
              ? 'Search all resources'
              : 'Search templates or books'
          }
          accessibilityLabel="Search the library"
        />
        <View style={styles.chips}>
          {(libraryView === 'resources' ? MEDIA_FILTERS : TEMPLATE_FILTERS).map((filter) => (
            <ChoiceChip
              key={filter.id}
              label={filter.label}
              selected={
                libraryView === 'resources'
                  ? media === filter.id
                  : templateFilter === filter.id
              }
              onPress={() => {
                if (libraryView === 'resources') {
                  setMedia(filter.id as LibraryMediaFilter);
                } else {
                  setTemplateFilter(filter.id as LibraryTemplateFilter);
                }
              }}
            />
          ))}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: showTopics }}
          accessibilityLabel={`Filter by need. Current selection: ${topic}`}
          onPress={() => setShowTopics((current) => !current)}
          style={styles.topicDisclosure}
        >
          <View style={styles.topicDisclosureLabel}>
            <Feather name="sliders" size={15} color={Colors.primary} />
            <Text style={styles.topicDisclosureText}>Need: {topic}</Text>
          </View>
          <Feather
            name={showTopics ? 'chevron-up' : 'chevron-down'}
            size={17}
            color={Colors.primary}
          />
        </Pressable>
        {showTopics ? (
          <View style={[styles.chips, { marginTop: 9 }]}>
            {LIBRARY_TOPICS.map((filterTopic) => (
              <ChoiceChip
                key={filterTopic}
                label={filterTopic}
                selected={topic === filterTopic}
                onPress={() => {
                  setTopic(filterTopic);
                  setShowTopics(false);
                }}
              />
            ))}
          </View>
        ) : null}
      </AppCard>
      <SectionHeader
        title={
          libraryView === 'resources'
            ? `${filtered.length} resources`
            : `${filteredTemplates.length} practice templates`
        }
        description={
          libraryView === 'resources'
            ? `${UNIFIED_LIBRARY.length} reviewed items across books, talks, and original profiles.`
            : `${BOOK_PRACTICE_TEMPLATES.length} curated tools across journals, goals, habits, and routines.`
        }
      />
      {error ? <Text style={appUiStyles.error}>{error}</Text> : null}
      {!ownerStateReady ? (
        <Text style={appUiStyles.muted}>Loading your library...</Text>
      ) : (libraryView === 'resources' ? filtered.length : filteredTemplates.length) === 0 ? (
        <EmptyState
          icon="search"
          title={
            libraryView === 'resources'
              ? 'No matching resources'
              : 'No matching templates'
          }
          description="Clear a filter or try a different phrase."
          action={
            <AppButton
              label="Clear filters"
              onPress={() => {
                setSearch('');
                setTopic('All');
                setMedia('all');
                setTemplateFilter('all');
              }}
            />
          }
        />
      ) : libraryView === 'templates' ? (
        filteredTemplates.map((template) => {
          const icon =
            template.integration.actionType === 'journal'
              ? 'edit-3'
              : template.integration.actionType === 'goal'
                ? 'target'
                : template.integration.actionType === 'routine'
                  ? 'layers'
                  : 'repeat';
          return (
            <Pressable
              key={template.id}
              accessibilityRole="button"
              accessibilityLabel={`Use ${template.integration.title} from ${template.book.title}`}
              onPress={() =>
                router.push(integrationRoute(template.book, template.integration))
              }
              style={({ pressed }) => [
                styles.templateCard,
                pressed && { opacity: 0.76 },
              ]}
            >
              <View style={styles.templateTop}>
                <View style={styles.mediaBadge}>
                  <Feather name={icon} size={13} color={Colors.primary} />
                  <Text style={styles.mediaBadgeText}>
                    {template.integration.actionType.toUpperCase()} TEMPLATE
                  </Text>
                </View>
                <Text style={styles.duration}>{template.book.topic}</Text>
              </View>
              <Text style={styles.resourceTitle}>{template.integration.title}</Text>
              <Text style={styles.summary}>{template.integration.description}</Text>
              <Text style={styles.templateSource}>
                From {template.book.title} by {template.book.author}
              </Text>
              <View style={styles.templateAction}>
                <Text style={styles.templateActionText}>Use template</Text>
                <Feather name="arrow-right" size={17} color={Colors.primary} />
              </View>
            </Pressable>
          );
        })
      ) : (
        filtered.map((item) => {
          const itemState = stateFor(item);
          return (
            <Pressable
              key={item.id}
              accessibilityRole="button"
              accessibilityLabel={`Open ${item.title}`}
              onPress={() => openItem(item)}
              style={({ pressed }) => [
                styles.resourceCard,
                pressed && { opacity: 0.76 },
              ]}
            >
              <View style={styles.resourceTop}>
                <View style={styles.mediaBadge}>
                  <Feather
                    name={
                      isBookItem(item)
                        ? 'book'
                        : isStoryItem(item)
                          ? 'user'
                          : 'play'
                    }
                    size={13}
                    color={Colors.primary}
                  />
                  <Text style={styles.mediaBadgeText}>{mediaLabel(item)}</Text>
                </View>
                <Text style={styles.duration}>{item.durationLabel}</Text>
              </View>
              <Text style={styles.resourceTitle}>{item.title}</Text>
              <Text style={styles.creator}>{item.creator}</Text>
              <Text style={styles.summary} numberOfLines={3}>
                {item.summary}
              </Text>
              <View style={styles.resourceFooter}>
                <Text style={styles.topic}>{item.topic}</Text>
                <View style={styles.statuses}>
                  {itemState.priority === 'next' ? (
                    <Feather name="list" size={15} color={Colors.accent} />
                  ) : null}
                  {itemState.is_saved ? (
                    <Feather name="bookmark" size={15} color={Colors.accent} />
                  ) : null}
                  {itemState.custom_notes ? (
                    <Feather name="edit-3" size={15} color={Colors.accent} />
                  ) : null}
                  <Feather
                    name="arrow-right"
                    size={17}
                    color={Colors.primary}
                  />
                </View>
              </View>
            </Pressable>
          );
        })
      )}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  libraryDestinations: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  libraryDestination: {
    flex: 1,
    minHeight: 126,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 17,
    backgroundColor: Colors.card,
    padding: 14,
  },
  libraryDestinationSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary,
  },
  libraryDestinationIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primaryLight,
  },
  libraryDestinationIconSelected: { backgroundColor: 'rgba(255,254,248,0.16)' },
  libraryDestinationTitle: {
    color: Colors.text,
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '800',
    marginTop: 10,
  },
  libraryDestinationDescription: {
    color: Colors.textSecondary,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 3,
  },
  libraryDestinationTextSelected: { color: '#fffef8' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  topicDisclosure: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    marginTop: 12,
    paddingTop: 12,
  },
  topicDisclosureLabel: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  topicDisclosureText: { color: Colors.primary, fontSize: 13, fontWeight: '700' },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  detailSection: { marginTop: 16, marginBottom: 6 },
  detailSectionTitle: {
    color: Colors.text,
    fontSize: 21,
    lineHeight: 26,
    fontWeight: '700',
    marginBottom: 11,
  },
  premiseCard: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  premiseText: {
    color: '#fffef8',
    fontSize: 18,
    lineHeight: 27,
    fontWeight: '600',
    marginTop: 8,
  },
  readingBlock: { marginBottom: 20 },
  blockTitle: {
    color: Colors.text,
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '700',
    marginBottom: 5,
  },
  readingText: {
    color: Colors.textSecondary,
    fontSize: 15,
    lineHeight: 24,
  },
  timelineRow: {
    flexDirection: 'row',
    gap: 13,
    borderLeftWidth: 2,
    borderLeftColor: Colors.sage,
    paddingLeft: 12,
    paddingBottom: 17,
  },
  timelinePeriod: {
    width: 82,
    color: Colors.accent,
    fontSize: 11,
    fontWeight: '800',
  },
  nextStep: {
    flexDirection: 'row',
    gap: 7,
    alignItems: 'flex-start',
    marginTop: 10,
  },
  nextStepText: {
    flex: 1,
    color: Colors.accent,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
  },
  integration: {
    minHeight: 92,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 15,
    padding: 15,
    marginBottom: 9,
  },
  templateCard: {
    backgroundColor: '#f4faf6',
    borderWidth: 1,
    borderColor: '#cfe2d5',
    borderRadius: 17,
    padding: 17,
    marginBottom: 11,
  },
  templateTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  templateSource: {
    color: Colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 13,
  },
  templateAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
    paddingTop: 13,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  templateActionText: { color: Colors.primary, fontSize: 13, fontWeight: '700' },
  promptRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  promptNumber: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: Colors.primaryLight,
    color: Colors.primary,
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
    paddingTop: 5,
  },
  promptText: {
    flex: 1,
    color: Colors.text,
    fontSize: 14,
    lineHeight: 21,
  },
  caveat: { backgroundColor: '#fff8e7', borderColor: '#e7cf9a' },
  sourceLink: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingVertical: 11,
  },
  sourceText: { flex: 1, color: Colors.primary, fontSize: 13, fontWeight: '600' },
  resourceCard: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 17,
    padding: 17,
    marginBottom: 11,
  },
  resourceTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  mediaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.primaryLight,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  mediaBadgeText: { color: Colors.primary, fontSize: 10, fontWeight: '800' },
  duration: { color: Colors.textSecondary, fontSize: 10 },
  resourceTitle: {
    color: Colors.text,
    fontSize: 20,
    lineHeight: 25,
    fontWeight: '700',
    marginTop: 13,
  },
  creator: { color: Colors.accent, fontSize: 12, marginTop: 3 },
  summary: {
    color: Colors.textSecondary,
    fontSize: 13,
    lineHeight: 20,
    marginTop: 10,
  },
  resourceFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginTop: 14,
  },
  topic: { flex: 1, color: Colors.textSecondary, fontSize: 10 },
  statuses: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  pressed: { opacity: 0.76 },
});
