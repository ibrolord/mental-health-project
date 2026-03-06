import { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet, ActivityIndicator } from 'react-native';
import { supabase } from '@/lib/supabase';
import { Colors } from '@/lib/constants';

interface Book {
  id: string;
  title: string;
  author: string;
  summary: string;
  takeaways: string[];
  quote: string | null;
  action_step: string | null;
  tags: string[];
  read_time_minutes: number;
}

export default function LibraryScreen() {
  const [books, setBooks] = useState<Book[]>([]);
  const [search, setSearch] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [selected, setSelected] = useState<Book | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('books').select('*').order('title', { ascending: true });
      if (data) setBooks(data);
      setLoading(false);
    })();
  }, []);

  const allTags = [...new Set(books.flatMap((b) => b.tags))].sort();

  const filtered = books.filter((b) => {
    const matchSearch = !search || b.title.toLowerCase().includes(search.toLowerCase()) || b.author.toLowerCase().includes(search.toLowerCase()) || b.summary.toLowerCase().includes(search.toLowerCase());
    const matchTag = !selectedTag || b.tags.includes(selectedTag);
    return matchSearch && matchTag;
  });

  if (loading) return <View style={s.centered}><ActivityIndicator size="large" color={Colors.primary} /></View>;

  if (selected) {
    return (
      <ScrollView style={s.container} contentContainerStyle={s.content}>
        <TouchableOpacity onPress={() => setSelected(null)} style={{ marginBottom: 16 }}>
          <Text style={{ color: Colors.primary, fontSize: 16, fontWeight: '500' }}>← Back to Library</Text>
        </TouchableOpacity>

        <View style={s.card}>
          <Text style={s.bookTitle}>{selected.title}</Text>
          <Text style={s.bookAuthor}>by {selected.author}</Text>
          <Text style={s.readTime}>{selected.read_time_minutes} min read</Text>

          <View style={s.tagsRow}>
            {selected.tags.map((tag) => (
              <View key={tag} style={s.tagBadge}>
                <Text style={s.tagBadgeText}>{tag}</Text>
              </View>
            ))}
          </View>

          <Text style={s.sectionTitle}>Summary</Text>
          <Text style={s.bodyText}>{selected.summary}</Text>

          <Text style={s.sectionTitle}>Key Takeaways</Text>
          {selected.takeaways.map((t, i) => (
            <View key={i} style={{ flexDirection: 'row', gap: 10, marginBottom: 8 }}>
              <Text style={{ color: Colors.primary, fontWeight: '700' }}>{i + 1}.</Text>
              <Text style={[s.bodyText, { flex: 1 }]}>{t}</Text>
            </View>
          ))}

          {selected.quote && (
            <View style={s.quoteBox}>
              <Text style={s.quoteText}>"{selected.quote}"</Text>
            </View>
          )}

          {selected.action_step && (
            <View style={[s.quoteBox, { backgroundColor: '#eff6ff', borderLeftColor: Colors.primary }]}>
              <Text style={s.sectionTitle}>Action Step</Text>
              <Text style={s.bodyText}>{selected.action_step}</Text>
            </View>
          )}
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      <TextInput
        style={s.searchInput}
        placeholder="Search books by title, author, or topic..."
        value={search}
        onChangeText={setSearch}
        placeholderTextColor={Colors.textSecondary}
      />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
        <TouchableOpacity style={[s.filterBtn, !selectedTag && s.filterBtnActive]} onPress={() => setSelectedTag(null)}>
          <Text style={[s.filterText, !selectedTag && s.filterTextActive]}>All</Text>
        </TouchableOpacity>
        {allTags.map((tag) => (
          <TouchableOpacity key={tag} style={[s.filterBtn, selectedTag === tag && s.filterBtnActive]} onPress={() => setSelectedTag(tag)}>
            <Text style={[s.filterText, selectedTag === tag && s.filterTextActive]}>{tag}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {filtered.length === 0 ? (
        <Text style={s.empty}>No books found matching your search.</Text>
      ) : (
        filtered.map((book) => (
          <TouchableOpacity key={book.id} style={s.card} onPress={() => setSelected(book)}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
              <View style={{ flex: 1 }}>
                <Text style={s.cardBookTitle}>{book.title}</Text>
                <Text style={s.bookAuthor}>by {book.author}</Text>
              </View>
              <Text style={s.readTime}>{book.read_time_minutes} min</Text>
            </View>
            <View style={s.tagsRow}>
              {book.tags.map((tag) => (
                <View key={tag} style={s.tagSmall}>
                  <Text style={s.tagSmallText}>{tag}</Text>
                </View>
              ))}
            </View>
            <Text style={s.summaryPreview} numberOfLines={3}>{book.summary}</Text>
            <Text style={{ color: Colors.primary, fontWeight: '500', marginTop: 8 }}>Read Summary →</Text>
          </TouchableOpacity>
        ))
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 16, paddingBottom: 40 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  searchInput: { backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border, borderRadius: 12, padding: 14, fontSize: 15, marginBottom: 12, color: Colors.text },
  filterBtn: { borderWidth: 1, borderColor: Colors.border, borderRadius: 8, paddingVertical: 6, paddingHorizontal: 14, marginRight: 8 },
  filterBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  filterText: { fontSize: 13, color: Colors.text },
  filterTextActive: { color: '#fff' },
  card: { backgroundColor: Colors.card, borderRadius: 16, padding: 20, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  bookTitle: { fontSize: 24, fontWeight: '700', color: Colors.text, marginBottom: 4 },
  cardBookTitle: { fontSize: 18, fontWeight: '600', color: Colors.text },
  bookAuthor: { fontSize: 14, color: Colors.textSecondary },
  readTime: { fontSize: 13, color: Colors.textSecondary },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginVertical: 10 },
  tagBadge: { backgroundColor: '#eff6ff', borderRadius: 20, paddingVertical: 4, paddingHorizontal: 12 },
  tagBadgeText: { fontSize: 13, color: Colors.primary },
  tagSmall: { backgroundColor: Colors.background, borderRadius: 6, paddingVertical: 3, paddingHorizontal: 8 },
  tagSmallText: { fontSize: 11, color: Colors.textSecondary },
  sectionTitle: { fontSize: 17, fontWeight: '600', color: Colors.text, marginTop: 20, marginBottom: 10 },
  bodyText: { fontSize: 15, color: Colors.textSecondary, lineHeight: 22 },
  quoteBox: { backgroundColor: Colors.background, borderLeftWidth: 4, borderLeftColor: Colors.textSecondary, padding: 16, borderRadius: 8, marginTop: 16 },
  quoteText: { fontStyle: 'italic', fontSize: 15, color: Colors.text, lineHeight: 22 },
  summaryPreview: { fontSize: 14, color: Colors.textSecondary, lineHeight: 20, marginTop: 8 },
  empty: { textAlign: 'center', color: Colors.textSecondary, paddingVertical: 40 },
});
