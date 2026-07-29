import { useState } from 'react';
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
  AppCard,
  AppScreen,
  PageHeader,
  SectionHeader,
  appUiStyles,
} from '@/components/AppUI';
import { Colors } from '@/lib/constants';
import {
  EVIDENCE_SOURCES,
  EVIDENCE_STRENGTH_LABELS,
  type EvidenceSource,
} from '@/lib/wellbeing/evidence';

const SECTIONS = [
  {
    id: 'habits',
    title: 'Habits and routines',
    summary:
      'Clear cues, small actions, stable context, and a compassionate return after missed days.',
    evidenceIds: [
      'habit-repetition',
      'implementation-intentions',
      'behavioral-activation',
      'cbti',
    ],
  },
  {
    id: 'focus',
    title: 'Focus and breaks',
    summary:
      'A bounded work period and a real break, without claims about a perfect timer or sound.',
    evidenceIds: ['microbreaks', 'nature-sound'],
  },
  {
    id: 'games',
    title: 'Mind games',
    summary:
      'Brief attention practice, not cognitive assessment, rehabilitation, or broad brain improvement.',
    evidenceIds: ['working-memory-training'],
  },
  {
    id: 'calm',
    title: 'Breathing, meditation, and grounding',
    summary:
      'Optional short-term regulation tools that should stop if distress increases.',
    evidenceIds: ['slow-breathing', 'nature-sound'],
  },
  {
    id: 'reminders',
    title: 'Reminders',
    summary:
      'Sparse, generic prompts can support a near-term action but cannot guarantee adherence.',
    evidenceIds: ['notifications'],
  },
] as const;

const sourceById = new Map(EVIDENCE_SOURCES.map((source) => [source.id, source]));

function EvidenceCard({ source }: { source: EvidenceSource }) {
  return (
    <Pressable
      accessibilityRole="link"
      onPress={() =>
        void Linking.openURL(source.url).catch(() =>
          Alert.alert('Unable to open source', 'Try again when you are online.')
        )
      }
      style={styles.sourceCard}
    >
      <View style={styles.sourceTop}>
        <Text style={styles.strength}>
          {EVIDENCE_STRENGTH_LABELS[source.strength]}
        </Text>
        <Feather name="external-link" size={15} color={Colors.primary} />
      </View>
      <Text style={styles.sourceTitle}>{source.title}</Text>
      <Text style={appUiStyles.muted}>{source.summary}</Text>
      <Text style={styles.citation}>{source.citation}</Text>
    </Pressable>
  );
}

export default function ResearchScreen() {
  const [openSection, setOpenSection] = useState<string>('habits');
  return (
    <AppScreen>
      <PageHeader
        eyebrow="Evidence guide"
        title="What the research supports."
        description="Evidence labels describe the cited research, not a promise that a feature will help everyone."
        icon="book-open"
      />
      <AppCard style={styles.boundary}>
        <View style={styles.boundaryRow}>
          <Feather name="shield" size={20} color={Colors.accent} />
          <View style={{ flex: 1 }}>
            <Text style={styles.boundaryTitle}>Clinical boundary</Text>
            <Text style={appUiStyles.muted}>
              MHtoolkit is not a diagnostic, treatment, or emergency service.
            </Text>
          </View>
        </View>
      </AppCard>

      {SECTIONS.map((section) => {
        const open = openSection === section.id;
        return (
          <View key={section.id}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded: open }}
              onPress={() => setOpenSection(open ? '' : section.id)}
              style={styles.sectionButton}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.sectionTitle}>{section.title}</Text>
                <Text style={appUiStyles.muted}>{section.summary}</Text>
              </View>
              <Feather
                name={open ? 'chevron-up' : 'chevron-down'}
                size={18}
                color={Colors.primary}
              />
            </Pressable>
            {open ? (
              <View style={{ marginBottom: 8 }}>
                {section.evidenceIds.flatMap((id) => {
                  const source = sourceById.get(id);
                  return source ? [<EvidenceCard key={id} source={source} />] : [];
                })}
              </View>
            ) : null}
          </View>
        );
      })}
      <SectionHeader
        title="Questions about a source?"
        description="Open Support to contact the developer."
      />
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  boundary: { backgroundColor: Colors.accentLight, borderColor: '#e9c5b8' },
  boundaryRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 11 },
  boundaryTitle: { color: Colors.text, fontSize: 15, fontWeight: '700' },
  sectionButton: {
    minHeight: 85,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingVertical: 15,
  },
  sectionTitle: {
    color: Colors.text,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '700',
    marginBottom: 4,
  },
  sourceCard: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    backgroundColor: Colors.card,
    padding: 15,
    marginTop: 9,
  },
  sourceTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  strength: {
    color: Colors.accent,
    fontSize: 9,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  sourceTitle: {
    color: Colors.text,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '700',
    marginTop: 10,
    marginBottom: 5,
  },
  citation: {
    color: Colors.textSecondary,
    fontSize: 10,
    lineHeight: 15,
    marginTop: 11,
  },
});
