import { useMemo, useState } from 'react';
import { Feather } from '@expo/vector-icons';
import {
  Alert,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
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
  AFRICA_COUNTRY_LOOKUPS,
  AFRICA_SUPPORT,
  COMMUNITY_HELP,
  CRISIS_LINES,
  GLOBAL_DIRECTORIES,
  ONLINE_COMMUNITIES,
  RESOURCES_DISCLAIMER,
  SUPPORT_GROUPS,
  THERAPIST_DIRECTORIES,
  type CrisisLine,
  type ResourceLink,
} from '@/lib/resources';

type Category =
  | 'crisis'
  | 'country'
  | 'africa'
  | 'therapy'
  | 'groups'
  | 'communities'
  | 'practical';

const CATEGORIES: { id: Category; label: string }[] = [
  { id: 'crisis', label: 'Help now' },
  { id: 'country', label: 'By country' },
  { id: 'africa', label: 'Africa' },
  { id: 'therapy', label: 'Therapists' },
  { id: 'groups', label: 'Support groups' },
  { id: 'communities', label: 'Communities' },
  { id: 'practical', label: 'Practical help' },
];

const RESOURCES: Record<Category, ResourceLink[]> = {
  crisis: [],
  country: [...GLOBAL_DIRECTORIES, ...AFRICA_COUNTRY_LOOKUPS],
  africa: AFRICA_SUPPORT,
  therapy: THERAPIST_DIRECTORIES,
  groups: SUPPORT_GROUPS,
  communities: ONLINE_COMMUNITIES,
  practical: COMMUNITY_HELP,
};

function openUrl(url: string) {
  void Linking.openURL(url).catch(() =>
    Alert.alert('Unable to open link', 'Try again when you are online.')
  );
}

function ResourceCard({ resource }: { resource: ResourceLink }) {
  return (
    <Pressable
      accessibilityRole="link"
      onPress={() => openUrl(resource.url)}
      style={({ pressed }) => [
        styles.resourceCard,
        pressed && { opacity: 0.76 },
      ]}
    >
      <View style={styles.resourceHeader}>
        <Text style={styles.resourceTitle}>{resource.name}</Text>
        <Feather name="external-link" size={16} color={Colors.primary} />
      </View>
      <Text style={appUiStyles.muted}>{resource.description}</Text>
      {resource.caveat ? (
        <Text style={styles.caveat}>{resource.caveat}</Text>
      ) : null}
      <View style={styles.badges}>
        <Text style={styles.regionBadge}>{resource.region}</Text>
        {resource.note ? (
          <Text style={styles.noteBadge}>{resource.note}</Text>
        ) : null}
      </View>
    </Pressable>
  );
}

function CrisisCard({ line }: { line: CrisisLine }) {
  return (
    <AppCard style={styles.crisisCard}>
      <View style={styles.resourceHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.crisisTitle}>{line.name}</Text>
          <Text style={styles.crisisRegion}>{line.region}</Text>
        </View>
        <Feather name="phone-call" size={18} color="#fffef8" />
      </View>
      {line.phone ? <Text style={styles.phone}>{line.phone}</Text> : null}
      <Text style={styles.crisisHours}>{line.hours}</Text>
      <Text style={styles.crisisDescription}>{line.description}</Text>
      <View style={styles.crisisActions}>
        {line.phone ? (
          <AppButton
            label="Call"
            icon="phone"
            variant="secondary"
            onPress={() =>
              openUrl(`tel:${line.phone?.replace(/[^\d+]/g, '') ?? ''}`)
            }
          />
        ) : null}
        <AppButton
          label="Open service"
          icon="external-link"
          variant="secondary"
          onPress={() => openUrl(line.url)}
        />
      </View>
    </AppCard>
  );
}

export default function ResourcesScreen() {
  const [category, setCategory] = useState<Category>('crisis');
  const [search, setSearch] = useState('');
  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    const source =
      category === 'crisis'
        ? CRISIS_LINES
        : RESOURCES[category];
    if (!query) return source;
    return source.filter((item) =>
      [item.name, item.region, item.description]
        .join(' ')
        .toLowerCase()
        .includes(query)
    );
  }, [category, search]);

  return (
    <AppScreen>
      <PageHeader
        eyebrow="Finding help"
        title="Support beyond this app."
        description="Official directories, peer groups, moderated communities, and country-specific help."
        icon="life-buoy"
      />
      <AppCard>
        <AppInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search country, service, or need"
          accessibilityLabel="Search support resources"
        />
        <View style={styles.chips}>
          {CATEGORIES.map((item) => (
            <ChoiceChip
              key={item.id}
              label={item.label}
              selected={category === item.id}
              onPress={() => setCategory(item.id)}
            />
          ))}
        </View>
      </AppCard>

      <SectionHeader
        title={CATEGORIES.find(({ id }) => id === category)?.label ?? 'Support'}
        description={
          category === 'crisis'
            ? 'Hours differ by service. If someone is in immediate danger, contact local emergency services.'
            : category === 'communities'
              ? 'Check moderation, age limits, and privacy rules before posting.'
              : undefined
        }
      />

      {visible.length === 0 ? (
        <EmptyState
          icon="search"
          title="No matching resources"
          description="Try a country name or clear your search."
          action={<AppButton label="Clear search" onPress={() => setSearch('')} />}
        />
      ) : category === 'crisis' ? (
        (visible as CrisisLine[]).map((line) => (
          <CrisisCard key={line.url} line={line} />
        ))
      ) : (
        (visible as ResourceLink[]).map((resource) => (
          <ResourceCard key={resource.url} resource={resource} />
        ))
      )}

      <AppCard quiet style={{ marginTop: 14 }}>
        <Text style={appUiStyles.muted}>{RESOURCES_DISCLAIMER}</Text>
      </AppCard>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  resourceCard: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
  },
  resourceHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 8,
  },
  resourceTitle: {
    flex: 1,
    color: Colors.text,
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '700',
  },
  caveat: {
    color: Colors.textSecondary,
    fontSize: 11,
    lineHeight: 17,
    backgroundColor: Colors.primaryLight,
    borderRadius: 10,
    padding: 10,
    marginTop: 10,
  },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 },
  regionBadge: {
    color: Colors.primary,
    fontSize: 9,
    fontWeight: '800',
    textTransform: 'uppercase',
    backgroundColor: Colors.primaryLight,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    overflow: 'hidden',
  },
  noteBadge: {
    color: Colors.accent,
    fontSize: 9,
    fontWeight: '800',
    textTransform: 'uppercase',
    backgroundColor: Colors.accentLight,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    overflow: 'hidden',
  },
  crisisCard: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  crisisTitle: {
    color: '#fffef8',
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '700',
  },
  crisisRegion: {
    color: '#c9ddd5',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginTop: 3,
  },
  phone: {
    color: '#fffef8',
    fontSize: 24,
    lineHeight: 29,
    fontWeight: '700',
    marginTop: 4,
  },
  crisisHours: {
    color: '#c9ddd5',
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    marginTop: 4,
  },
  crisisDescription: {
    color: '#e1ece7',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 9,
  },
  crisisActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 14,
  },
});
