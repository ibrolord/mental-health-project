import { useMemo, useState } from 'react';
import {
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
    description: 'Use AI chat for reflection, not care.',
    route: '/chat',
    color: '#fff1f2',
  },
] as const;

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
      return [book.title, book.author, book.summary, book.topic, ...book.displayTags].some(
        (value) => value.toLowerCase().includes(query)
      );
    });
  }, [search, selectedTopic]);

  if (selected) {
    return (
      <ScrollView style={s.container} contentContainerStyle={s.content}>
        <TouchableOpacity onPress={() => setSelected(null)} style={s.backLink}>
          <Text style={s.backLinkText}>Back to library</Text>
        </TouchableOpacity>

        <View style={s.detailHeader}>
          <Text style={s.kicker}>REVIEWED BOOK NOTE</Text>
          <Text style={s.detailTitle}>{selected.title}</Text>
          <Text style={s.detailAuthor}>by {selected.author}</Text>
          <View style={s.tagsRow}>
            {selected.displayTags.map((tag) => (
              <View key={tag} style={s.headerTag}>
                <Text style={s.headerTagText}>{tag}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={s.detailBody}>
          <Text style={s.sectionKicker}>WHAT THE BOOK ARGUES</Text>
          <Text style={s.leadText}>{selected.summary}</Text>

          <Text style={s.sectionTitle}>Ideas to consider</Text>
          {selected.takeaways.map((takeaway, index) => (
            <View key={takeaway} style={s.takeaway}>
              <View style={s.takeawayNumber}>
                <Text style={s.takeawayNumberText}>{index + 1}</Text>
              </View>
              <Text style={s.takeawayText}>{takeaway}</Text>
            </View>
          ))}

          {selected.action_step && (
            <View style={s.experimentBox}>
              <Text style={s.experimentTitle}>A small experiment</Text>
              <Text style={s.experimentText}>{selected.action_step}</Text>
            </View>
          )}

          <View style={s.editorialBox}>
            <Text style={s.editorialTitle}>How to use this note</Text>
            <Text style={s.editorialText}>
              {selected.editorialNote} A summary cannot capture the full book or assess whether its
              ideas are appropriate for you.
            </Text>
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
          Go directly to a tool, or browse reviewed notes that separate an author&apos;s ideas from
          clinical guidance.
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

      <Text style={[s.sectionKicker, { marginTop: 28 }]}>REVIEWED READING NOTES</Text>
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
          <Text style={s.readAction}>Read reviewed note</Text>
        </TouchableOpacity>
      ))}

      <View style={s.libraryNote}>
        <Text style={s.libraryNoteText}>
          Book notes summarize authors&apos; ideas and flag important limitations. They are not
          diagnoses, treatment recommendations, or substitutes for professional care.
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
  leadText: { color: Colors.textSecondary, fontSize: 16, lineHeight: 25, marginTop: 10 },
  sectionTitle: { color: Colors.text, fontSize: 23, fontWeight: '700', marginTop: 28, marginBottom: 14 },
  takeaway: { flexDirection: 'row', gap: 12, backgroundColor: '#f8fafc', borderRadius: 12, padding: 14, marginBottom: 10 },
  takeawayNumber: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#173f38', alignItems: 'center', justifyContent: 'center' },
  takeawayNumberText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  takeawayText: { flex: 1, color: Colors.textSecondary, fontSize: 14, lineHeight: 21 },
  experimentBox: { backgroundColor: '#fffbeb', borderRadius: 14, padding: 16, marginTop: 18 },
  experimentTitle: { color: '#78350f', fontSize: 15, fontWeight: '700' },
  experimentText: { color: '#92400e', fontSize: 14, lineHeight: 21, marginTop: 7 },
  editorialBox: { borderWidth: 1, borderColor: Colors.border, borderRadius: 14, padding: 16, marginTop: 18 },
  editorialTitle: { color: Colors.text, fontSize: 15, fontWeight: '700' },
  editorialText: { color: Colors.textSecondary, fontSize: 13, lineHeight: 19, marginTop: 7 },
});
