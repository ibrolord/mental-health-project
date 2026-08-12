import { useEffect, useRef, useState } from 'react';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  AppButton,
  AppCard,
  AppScreen,
  EmptyState,
  PageHeader,
  SectionHeader,
  appUiStyles,
} from '@/components/AppUI';
import { Colors } from '@/lib/constants';
import { useDataContext } from '@/lib/hooks/use-data-context';
import { UNIFIED_LIBRARY } from '@/lib/library/content';
import {
  composeSavedCollection,
  type ImportantJournalStateRow,
  type SavedCollection,
  type SavedLibraryStateRow,
  type SavedLibraryViewItem,
} from '@/lib/product-state';
import { supabase } from '@/lib/supabase';

const EMPTY_COLLECTION: SavedCollection = {
  upNext: [],
  saved: [],
  importantJournal: [],
};

function dateLabel(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Saved recently';
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function LibraryRow({
  item,
  onPress,
}: {
  item: SavedLibraryViewItem;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ${item.title} in Library`}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View style={styles.rowIcon}>
        <Feather
          name={
            item.mediaType === 'book'
              ? 'book'
              : item.mediaType === 'story'
                ? 'user'
                : 'play'
          }
          size={18}
          color={Colors.primary}
        />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle}>{item.title}</Text>
        <Text style={styles.rowMeta}>{item.creator}</Text>
        <Text style={styles.rowAccent}>
          {item.topic} · {item.durationLabel}
        </Text>
      </View>
      <Feather name="arrow-right" size={18} color={Colors.textSecondary} />
    </Pressable>
  );
}

export default function SavedScreen() {
  const router = useRouter();
  const { context, authLoading } = useDataContext();
  const [collection, setCollection] = useState(EMPTY_COLLECTION);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const ownerRef = useRef(context.user_id);
  ownerRef.current = context.user_id;

  useEffect(() => {
    if (authLoading) return;
    const ownerId = context.user_id;
    setCollection(EMPTY_COLLECTION);
    setError('');
    if (!ownerId) {
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);
    void Promise.all([
      supabase
        .from('user_library_items')
        .select('content_id, media_type, is_saved, priority, updated_at')
        .eq('user_id', ownerId)
        .or('is_saved.eq.true,priority.eq.next'),
      supabase
        .from('journal_entries')
        .select('id, is_favorite, created_at, updated_at')
        .eq('user_id', ownerId)
        .eq('is_favorite', true),
    ]).then(([libraryResult, journalResult]) => {
      if (!active || ownerRef.current !== ownerId) return;
      setLoading(false);
      if (libraryResult.error || journalResult.error) {
        setError('Your saved items could not be loaded.');
        return;
      }
      setCollection(
        composeSavedCollection(
          UNIFIED_LIBRARY,
          (libraryResult.data ?? []) as SavedLibraryStateRow[],
          (journalResult.data ?? []) as ImportantJournalStateRow[]
        )
      );
    });

    return () => {
      active = false;
    };
  }, [authLoading, context.user_id]);

  const total =
    collection.upNext.length +
    collection.saved.length +
    collection.importantJournal.length;

  return (
    <AppScreen>
      <PageHeader
        eyebrow="Saved"
        title="Return to what mattered."
        description="Your library choices and important journal markers, together without duplicating private writing."
        icon="bookmark"
      />

      {error ? <Text style={appUiStyles.error}>{error}</Text> : null}
      {loading ? (
        <Text style={appUiStyles.muted}>Loading your saved space...</Text>
      ) : total === 0 ? (
        <EmptyState
          icon="bookmark"
          title="Nothing saved yet"
          description="Save a library resource, add it to Up next, or mark a journal entry important."
          action={
            <AppButton
              label="Browse the library"
              icon="arrow-right"
              onPress={() => router.push('/library')}
            />
          }
        />
      ) : (
        <>
          {collection.upNext.length > 0 ? (
            <View style={styles.section}>
              <SectionHeader
                title="Up next"
                description="Ready when you choose to return."
              />
              {collection.upNext.map((item) => (
                <LibraryRow
                  key={item.id}
                  item={item}
                  onPress={() => router.push(item.route)}
                />
              ))}
            </View>
          ) : null}

          {collection.saved.length > 0 ? (
            <View style={styles.section}>
              <SectionHeader title="Saved resources" />
              {collection.saved.map((item) => (
                <LibraryRow
                  key={item.id}
                  item={item}
                  onPress={() => router.push(item.route)}
                />
              ))}
            </View>
          ) : null}

          {collection.importantJournal.length > 0 ? (
            <View style={styles.section}>
              <SectionHeader
                title="Important in your journal"
                description="Saved shows the title, date, and important marker. Your writing stays in Journal."
              />
              {collection.importantJournal.map((item) => (
                <Pressable
                  key={item.id}
                  accessibilityRole="button"
                  accessibilityLabel="Open important journal entry"
                  onPress={() => router.push(item.route)}
                  style={({ pressed }) => [styles.row, pressed && styles.pressed]}
                >
                  <View style={styles.rowIcon}>
                    <Feather name="feather" size={18} color={Colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowTitle}>{item.label}</Text>
                    <Text style={styles.rowMeta}>
                      Marked important · {dateLabel(item.updatedAt)}
                    </Text>
                  </View>
                  <Feather name="arrow-right" size={18} color={Colors.textSecondary} />
                </Pressable>
              ))}
            </View>
          ) : null}

          <AppCard quiet style={styles.privacyCard}>
            <View style={styles.privacyTitleRow}>
              <Feather name="lock" size={16} color={Colors.primary} />
              <Text style={styles.privacyTitle}>Private records stay put</Text>
            </View>
            <Text style={appUiStyles.muted}>
              Saved links back to Library and Journal without copying your private writing.
            </Text>
          </AppCard>
        </>
      )}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: 16 },
  row: {
    minHeight: 92,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 16,
    padding: 15,
    marginBottom: 9,
  },
  pressed: { opacity: 0.76 },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primaryLight,
  },
  rowTitle: { color: Colors.text, fontSize: 15, fontWeight: '700' },
  rowMeta: { color: Colors.textSecondary, fontSize: 12, marginTop: 3 },
  rowAccent: { color: Colors.accent, fontSize: 11, fontWeight: '700', marginTop: 6 },
  privacyCard: { marginTop: 6 },
  privacyTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 7,
  },
  privacyTitle: { color: Colors.text, fontSize: 14, fontWeight: '700' },
});
