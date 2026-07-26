import { useMemo, useState } from 'react';
import {
  Alert,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  CURATED_LIBRARY,
  type CuratedBook,
  type LibraryIntegration,
  LIBRARY_TOPICS,
  type LibraryTopic,
} from '@/lib/library/editorial';
import { Colors } from '@/lib/constants';

const pathways = [
  {
    title: 'Check symptoms',
    description: 'Use a published self-report tool.',
    route: '/assessments',
    color: '#eff6ff',
  },
  {
    title: 'Notice patterns',
    description: 'Record a quick mood check-in.',
    route: '/tracker',
    color: '#ecfdf5',
  },
  {
    title: 'Build a routine',
    description: 'Choose one repeatable step.',
    route: '/habits',
    color: '#fffbeb',
  },
  {
    title: 'Reflect in writing',
    description: 'Write private notes that are not sent to AI.',
    route: '/journal',
    color: '#fff1f2',
  },
] as const;

function integrationRoute(book: CuratedBook, integration: LibraryIntegration) {
  const baseParams = {
    source: 'library',
    book: book.id,
    bookTitle: book.title,
  };

  if (integration.actionType === 'journal') {
    return {
      pathname: '/journal' as const,
      params: { ...baseParams, prompt: integration.prompt ?? '' },
    };
  }
  if (integration.actionType === 'goal') {
    return {
      pathname: '/goals' as const,
      params: { ...baseParams, content: integration.goalContent ?? '' },
    };
  }
  return {
    pathname: '/habits' as const,
    params: {
      ...baseParams,
      name: integration.habitName ?? '',
      description: integration.habitDescription ?? '',
    },
  };
}

export default function LibraryScreen() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [selectedTopic, setSelectedTopic] = useState<LibraryTopic>('All');
  const [selected, setSelected] = useState<CuratedBook | null>(null);

  const filteredBooks = useMemo(() => {
    const query = search.trim().toLowerCase();
    return CURATED_LIBRARY.filter((book) => {
      if (selectedTopic !== 'All' && book.topic !== selectedTopic) return false;
      if (!query) return true;
      return [
        book.title,
        book.author,
        book.summary,
        book.centralPremise,
        book.topic,
        ...book.displayTags,
        ...book.corePremises.flatMap(({ title, premise }) => [title, premise]),
        ...book.practicalTakeaways.flatMap(({ title, description }) => [title, description]),
      ].some((value) => value.toLowerCase().includes(query));
    });
  }, [search, selectedTopic]);

  if (selected) {
    return (
      <ScrollView style={s.container} contentContainerStyle={s.content}>
        <TouchableOpacity onPress={() => setSelected(null)} style={s.backLink}>
          <Text style={s.backLinkText}>Back to library</Text>
        </TouchableOpacity>

        <View style={s.detailHeader}>
          <Text style={s.kicker}>SOURCE-BACKED READING GUIDE</Text>
          <Text style={s.detailTitle}>{selected.title}</Text>
          <Text style={s.detailAuthor}>
            by {selected.author} · {selected.read_time_minutes} min guide
          </Text>
          <View style={s.tagsRow}>
            {selected.displayTags.map((tag) => (
              <View key={tag} style={s.headerTag}>
                <Text style={s.headerTagText}>{tag}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={s.detailBody}>
          <View style={s.sourceNotice}>
            <Text style={s.sourceNoticeText}>
              Premises are paraphrased and linked to author, publisher, research, or
              clinical-context sources. They are not quotations.
            </Text>
          </View>

          <Text style={s.sectionTitle}>A useful orientation</Text>
          <Text style={s.leadText}>{selected.summary}</Text>

          <View style={s.centralPremiseBox}>
            <Text style={s.centralPremiseLabel}>CENTRAL PREMISE</Text>
            <Text style={s.centralPremiseText}>{selected.centralPremise}</Text>
          </View>

          <Text style={s.sectionTitle}>Core premises, unpacked</Text>
          {selected.corePremises.map((idea, index) => (
            <View key={idea.title} style={s.ideaCard}>
              <View style={s.ideaHeader}>
                <View style={s.takeawayNumber}>
                  <Text style={s.takeawayNumberText}>{index + 1}</Text>
                </View>
                <Text style={s.ideaTitle}>{idea.title}</Text>
              </View>
              <Text style={s.ideaPremise}>{idea.premise}</Text>
              <View style={s.ideaDivider} />
              <Text style={s.ideaLabel}>WHY IT MATTERS</Text>
              <Text style={s.ideaDetail}>{idea.whyItMatters}</Text>
              <Text style={[s.ideaLabel, { marginTop: 12 }]}>TRY IT</Text>
              <Text style={s.ideaDetail}>{idea.practice}</Text>
            </View>
          ))}

          <Text style={s.sectionTitle}>Takeaways you can use</Text>
          {selected.practicalTakeaways.map((takeaway) => (
            <View key={takeaway.title} style={s.takeawayCard}>
              <Text style={s.takeawayTitle}>{takeaway.title}</Text>
              <Text style={s.takeawayDescription}>{takeaway.description}</Text>
              <Text style={s.takeawayNext}>{takeaway.nextStep}</Text>
            </View>
          ))}

          <Text style={s.sectionTitle}>Use it in MHtoolkit</Text>
          <Text style={s.integrationIntro}>
            Each action opens a prefilled draft. Nothing is saved until you choose to save it.
          </Text>
          {selected.integrations.map((integration) => (
            <TouchableOpacity
              key={integration.title}
              style={[
                s.integrationCard,
                integration.actionType === 'journal'
                  ? s.integrationJournal
                  : integration.actionType === 'goal'
                    ? s.integrationGoal
                    : s.integrationHabit,
              ]}
              onPress={() => router.push(integrationRoute(selected, integration))}
            >
              <Text style={s.integrationType}>{integration.actionType.toUpperCase()}</Text>
              <Text style={s.integrationTitle}>{integration.title}</Text>
              <Text style={s.integrationText}>{integration.description}</Text>
              <Text style={s.integrationAction}>{integration.actionLabel} →</Text>
            </TouchableOpacity>
          ))}

          <View style={s.reflectionBox}>
            <Text style={s.reflectionTitle}>Questions to carry forward</Text>
            {selected.reflectionPrompts.map((prompt, index) => (
              <View key={prompt} style={s.reflectionRow}>
                <Text style={s.reflectionNumber}>{index + 1}.</Text>
                <Text style={s.reflectionText}>{prompt}</Text>
              </View>
            ))}
          </View>

          {selected.medicalCaveat ? (
            <View style={s.caveatBox}>
              <Text style={s.caveatTitle}>Important clinical boundary</Text>
              <Text style={s.caveatText}>{selected.medicalCaveat}</Text>
            </View>
          ) : null}

          <Text style={s.sectionTitle}>Sources and further reading</Text>
          {selected.sources.map((source) => (
            <TouchableOpacity
              key={source.url}
              style={s.sourceLink}
              onPress={() =>
                void Linking.openURL(source.url).catch(() => {
                  Alert.alert('Unable to open link', 'Please try again when you are online.');
                })
              }
            >
              <View style={{ flex: 1 }}>
                <Text style={s.sourceTitle}>{source.label}</Text>
                <Text style={s.sourceType}>{source.sourceType.replace('-', ' ')}</Text>
              </View>
              <Text style={s.sourceArrow}>↗</Text>
            </TouchableOpacity>
          ))}

          <View style={s.editorialBox}>
            <Text style={s.editorialTitle}>Editorial scope</Text>
            <Text style={s.editorialText}>{selected.editorialNote}</Text>
          </View>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      <View style={s.hero}>
        <Text style={s.kicker}>RESOURCE LIBRARY</Text>
        <Text style={s.heroTitle}>Start with what you need.</Text>
        <Text style={s.heroText}>
          Go directly to a tool, or use source-backed guides to understand a book&apos;s premises,
          apply useful ideas, and keep claims within appropriate limits.
        </Text>
      </View>

      <Text style={s.sectionKicker}>FIND A NEXT STEP</Text>
      <Text style={s.listTitle}>What would help right now?</Text>
      <View style={s.pathwayGrid}>
        {pathways.map((pathway) => (
          <TouchableOpacity
            key={pathway.route}
            style={[s.pathwayCard, { backgroundColor: pathway.color }]}
            onPress={() => router.push(pathway.route)}
          >
            <Text style={s.pathwayTitle}>{pathway.title}</Text>
            <Text style={s.pathwayText}>{pathway.description}</Text>
            <Text style={s.pathwayAction}>Open tool</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={[s.sectionKicker, { marginTop: 28 }]}>SOURCE-BACKED READING GUIDES</Text>
      <Text style={s.listTitle}>Browse by need, not raw tags.</Text>

      <View style={s.searchBox}>
        <TextInput
          style={s.searchInput}
          placeholder="Search title, author, or topic"
          value={search}
          onChangeText={setSearch}
          placeholderTextColor={Colors.textSecondary}
        />
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {LIBRARY_TOPICS.map((topic) => (
            <TouchableOpacity
              key={topic}
              style={[s.filterBtn, selectedTopic === topic && s.filterBtnActive]}
              onPress={() => setSelectedTopic(topic)}
            >
              <Text style={[s.filterText, selectedTopic === topic && s.filterTextActive]}>
                {topic}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {filteredBooks.length === 0 && (
        <View style={s.emptyBox}>
          <Text style={s.emptyTitle}>No reviewed notes match that search.</Text>
          <TouchableOpacity
            onPress={() => {
              setSearch('');
              setSelectedTopic('All');
            }}
          >
            <Text style={s.clearText}>Clear filters</Text>
          </TouchableOpacity>
        </View>
      )}

      {filteredBooks.map((book) => (
        <TouchableOpacity key={book.id} style={s.bookCard} onPress={() => setSelected(book)}>
          <View style={s.bookMeta}>
            <Text style={s.topicBadge}>{book.topic}</Text>
            <Text style={s.readTime}>{book.read_time_minutes} min note</Text>
          </View>
          <Text style={s.bookTitle}>{book.title}</Text>
          <Text style={s.bookAuthor}>by {book.author}</Text>
          <Text style={s.summaryPreview} numberOfLines={3}>
            {book.summary}
          </Text>
          <Text style={s.readAction}>Open the full guide</Text>
        </TouchableOpacity>
      ))}

      <View style={s.libraryNote}>
        <Text style={s.libraryNoteText}>
          Guides paraphrase authors&apos; premises, link their sources, and flag important
          limitations. They are not diagnoses, treatment recommendations, or substitutes for the
          complete books or professional care.
        </Text>
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f4f1e8' },
  content: { padding: 16, paddingBottom: 40 },
  hero: { backgroundColor: '#173f38', borderRadius: 24, padding: 22, marginBottom: 28 },
  kicker: { color: '#a7f3d0', fontSize: 11, fontWeight: '700', letterSpacing: 1.1 },
  heroTitle: { color: '#fff', fontSize: 31, lineHeight: 37, fontWeight: '700', marginTop: 8 },
  heroText: { color: '#d1fae5', fontSize: 14, lineHeight: 21, marginTop: 10 },
  sectionKicker: { color: '#287264', fontSize: 11, fontWeight: '700', letterSpacing: 1.1 },
  listTitle: { color: Colors.text, fontSize: 24, lineHeight: 30, fontWeight: '700', marginTop: 5 },
  pathwayGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 16 },
  pathwayCard: { width: '48%', minHeight: 150, borderRadius: 16, padding: 16 },
  pathwayTitle: { color: Colors.text, fontSize: 16, fontWeight: '700' },
  pathwayText: { color: Colors.textSecondary, fontSize: 13, lineHeight: 19, marginTop: 7 },
  pathwayAction: { color: '#287264', fontSize: 13, fontWeight: '700', marginTop: 'auto' },
  searchBox: { backgroundColor: '#fff', borderRadius: 16, padding: 12, marginTop: 16 },
  searchInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    padding: 13,
    fontSize: 14,
    marginBottom: 12,
    color: Colors.text,
  },
  filterBtn: {
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 14,
    marginRight: 7,
    backgroundColor: '#f1f5f9',
  },
  filterBtnActive: { backgroundColor: '#173f38' },
  filterText: { fontSize: 12, color: Colors.text },
  filterTextActive: { color: '#fff', fontWeight: '600' },
  bookCard: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 19,
    marginTop: 13,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  bookMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  topicBadge: {
    color: '#166534',
    backgroundColor: '#ecfdf5',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
    overflow: 'hidden',
    fontSize: 11,
    fontWeight: '600',
  },
  readTime: { color: Colors.textSecondary, fontSize: 11 },
  bookTitle: { color: Colors.text, fontSize: 23, lineHeight: 28, fontWeight: '700', marginTop: 16 },
  bookAuthor: { color: Colors.textSecondary, fontSize: 13, marginTop: 3 },
  summaryPreview: { color: Colors.textSecondary, fontSize: 14, lineHeight: 21, marginTop: 12 },
  readAction: { color: '#287264', fontSize: 13, fontWeight: '700', marginTop: 14 },
  emptyBox: { backgroundColor: '#fff', borderRadius: 14, padding: 24, marginTop: 18, alignItems: 'center' },
  emptyTitle: { color: Colors.text, fontWeight: '600', textAlign: 'center' },
  clearText: { color: '#287264', fontWeight: '700', marginTop: 10 },
  libraryNote: { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginTop: 18 },
  libraryNoteText: { color: Colors.textSecondary, fontSize: 12, lineHeight: 18 },
  backLink: { marginBottom: 16 },
  backLinkText: { color: '#173f38', fontSize: 15, fontWeight: '600' },
  detailHeader: { backgroundColor: '#173f38', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 22 },
  detailTitle: { color: '#fff', fontSize: 31, lineHeight: 37, fontWeight: '700', marginTop: 8 },
  detailAuthor: { color: '#d1fae5', fontSize: 14, marginTop: 7 },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 16 },
  headerTag: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5 },
  headerTagText: { color: '#fff', fontSize: 11 },
  detailBody: { backgroundColor: '#fff', borderBottomLeftRadius: 24, borderBottomRightRadius: 24, padding: 22 },
  sourceNotice: { backgroundColor: '#eff6ff', borderWidth: 1, borderColor: '#bae6fd', borderRadius: 13, padding: 14 },
  sourceNoticeText: { color: '#0c4a6e', fontSize: 12, lineHeight: 19 },
  leadText: { color: Colors.textSecondary, fontSize: 16, lineHeight: 25, marginTop: 10 },
  sectionTitle: { color: Colors.text, fontSize: 23, fontWeight: '700', marginTop: 28, marginBottom: 14 },
  centralPremiseBox: { backgroundColor: '#173f38', borderRadius: 14, padding: 17, marginTop: 22 },
  centralPremiseLabel: { color: '#a7f3d0', fontSize: 10, fontWeight: '700', letterSpacing: 0.9 },
  centralPremiseText: { color: '#ecfdf5', fontSize: 15, lineHeight: 24, marginTop: 8 },
  ideaCard: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: Colors.border, borderRadius: 14, padding: 15, marginBottom: 11 },
  ideaHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  ideaTitle: { flex: 1, color: Colors.text, fontSize: 16, fontWeight: '700' },
  ideaPremise: { color: Colors.textSecondary, fontSize: 13, lineHeight: 21, marginTop: 11 },
  ideaDivider: { height: 1, backgroundColor: Colors.border, marginVertical: 13 },
  ideaLabel: { color: Colors.textSecondary, fontSize: 9, fontWeight: '700', letterSpacing: 0.8 },
  ideaDetail: { color: Colors.textSecondary, fontSize: 12, lineHeight: 19, marginTop: 4 },
  takeawayNumber: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#173f38', alignItems: 'center', justifyContent: 'center' },
  takeawayNumberText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  takeawayCard: { backgroundColor: '#fffbeb', borderWidth: 1, borderColor: '#fde68a', borderRadius: 14, padding: 15, marginBottom: 10 },
  takeawayTitle: { color: '#78350f', fontSize: 15, fontWeight: '700' },
  takeawayDescription: { color: '#92400e', fontSize: 13, lineHeight: 20, marginTop: 6 },
  takeawayNext: { color: '#78350f', fontSize: 13, lineHeight: 20, fontWeight: '600', borderTopWidth: 1, borderTopColor: '#fde68a', paddingTop: 10, marginTop: 10 },
  integrationIntro: { color: Colors.textSecondary, fontSize: 12, lineHeight: 19, marginTop: -7, marginBottom: 11 },
  integrationCard: { borderWidth: 1, borderRadius: 14, padding: 15, marginBottom: 10 },
  integrationJournal: { backgroundColor: '#fff1f2', borderColor: '#fecdd3' },
  integrationGoal: { backgroundColor: '#f0f9ff', borderColor: '#bae6fd' },
  integrationHabit: { backgroundColor: '#fffbeb', borderColor: '#fde68a' },
  integrationType: { color: Colors.textSecondary, fontSize: 9, fontWeight: '700', letterSpacing: 0.8 },
  integrationTitle: { color: Colors.text, fontSize: 15, fontWeight: '700', marginTop: 7 },
  integrationText: { color: Colors.textSecondary, fontSize: 12, lineHeight: 19, marginTop: 5 },
  integrationAction: { color: '#287264', fontSize: 12, fontWeight: '700', marginTop: 11 },
  reflectionBox: { borderWidth: 1, borderColor: Colors.border, borderRadius: 14, padding: 16, marginTop: 20 },
  reflectionTitle: { color: Colors.text, fontSize: 18, fontWeight: '700', marginBottom: 10 },
  reflectionRow: { flexDirection: 'row', gap: 8, marginTop: 7 },
  reflectionNumber: { color: '#287264', fontSize: 12, fontWeight: '700' },
  reflectionText: { flex: 1, color: Colors.textSecondary, fontSize: 12, lineHeight: 19 },
  caveatBox: { backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fecaca', borderRadius: 14, padding: 16, marginTop: 18 },
  caveatTitle: { color: '#7f1d1d', fontSize: 14, fontWeight: '700' },
  caveatText: { color: '#991b1b', fontSize: 12, lineHeight: 19, marginTop: 6 },
  sourceLink: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: Colors.border, borderRadius: 12, padding: 13, marginBottom: 8 },
  sourceTitle: { color: '#166534', fontSize: 12, lineHeight: 18, fontWeight: '700' },
  sourceType: { color: Colors.textSecondary, fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.7, marginTop: 3 },
  sourceArrow: { color: '#287264', fontSize: 18 },
  editorialBox: { borderWidth: 1, borderColor: Colors.border, borderRadius: 14, padding: 16, marginTop: 18 },
  editorialTitle: { color: Colors.text, fontSize: 15, fontWeight: '700' },
  editorialText: { color: Colors.textSecondary, fontSize: 13, lineHeight: 19, marginTop: 7 },
});
