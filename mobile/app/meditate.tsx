import { useMemo, useState } from 'react';
import { Feather } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  AppButton,
  AppCard,
  AppScreen,
  ChoiceChip,
  PageHeader,
  SectionHeader,
  appUiStyles,
} from '@/components/AppUI';
import { GuidedPractice } from '@/components/GuidedPractice';
import { OptionalSoundscape } from '@/components/OptionalSoundscape';
import {
  MEDITATION_ISSUES,
  MEDITATION_PRACTICES,
  type MeditationIssue,
  type MeditationPractice,
} from '@/lib/meditation';
import { Colors } from '@/lib/constants';

export default function MeditateScreen() {
  const [issue, setIssue] = useState<MeditationIssue | 'all'>('all');
  const [selected, setSelected] = useState<MeditationPractice | null>(null);
  const practices = useMemo(
    () =>
      issue === 'all'
        ? MEDITATION_PRACTICES
        : MEDITATION_PRACTICES.filter((practice) =>
            practice.issues.includes(issue)
          ),
    [issue]
  );

  return (
    <AppScreen>
      <PageHeader
        eyebrow="Meditation"
        title="A practice for this moment."
        description="Choose a short guided exercise. Eyes-open and movement options are included."
        icon="sunrise"
      />

      {selected ? (
        <>
          <AppButton
            label="Choose another practice"
            icon="arrow-left"
            variant="quiet"
            onPress={() => setSelected(null)}
            style={styles.backButton}
          />
          <AppCard quiet>
            <Text style={appUiStyles.label}>Guided practice</Text>
            <Text style={styles.selectedTitle}>{selected.title}</Text>
            <Text style={[appUiStyles.muted, { marginTop: 8 }]}>
              {selected.summary}
            </Text>
            {selected.safetyNote ? (
              <View style={styles.safety}>
                <Feather name="info" size={16} color={Colors.accent} />
                <Text style={styles.safetyText}>{selected.safetyNote}</Text>
              </View>
            ) : null}
          </AppCard>
          <GuidedPractice steps={selected.steps} startLabel="Begin practice" />
          <OptionalSoundscape title="Background sound" compact />
        </>
      ) : (
        <>
          <SectionHeader
            title="What would help?"
            description="Filter by the kind of support you want."
          />
          <View style={styles.chips}>
            <ChoiceChip
              label="All"
              selected={issue === 'all'}
              onPress={() => setIssue('all')}
            />
            {MEDITATION_ISSUES.map((item) => (
              <ChoiceChip
                key={item.id}
                label={item.label}
                selected={issue === item.id}
                onPress={() => setIssue(item.id)}
              />
            ))}
          </View>

          <View style={styles.list}>
            {practices.map((practice) => {
              const seconds = practice.steps.reduce(
                (total, step) => total + step.seconds,
                0
              );
              return (
                <Pressable
                  key={practice.id}
                  accessibilityRole="button"
                  onPress={() => setSelected(practice)}
                  style={({ pressed }) => [
                    styles.practiceCard,
                    pressed && styles.pressed,
                  ]}
                >
                  <View style={styles.practiceIcon}>
                    <Feather
                      name={
                        practice.issues.includes('sleep')
                          ? 'moon'
                          : practice.issues.includes('restlessness')
                            ? 'navigation'
                            : practice.issues.includes('focus')
                              ? 'target'
                              : 'wind'
                      }
                      size={19}
                      color={Colors.primary}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.practiceTitle}>{practice.title}</Text>
                    <Text style={styles.practiceSummary}>{practice.summary}</Text>
                    <Text style={styles.duration}>
                      {Math.max(1, Math.round(seconds / 60))} min
                    </Text>
                  </View>
                  <Feather
                    name="chevron-right"
                    size={20}
                    color={Colors.textSecondary}
                  />
                </Pressable>
              );
            })}
          </View>

          <AppCard quiet style={{ marginTop: 10 }}>
            <View style={styles.noteHeader}>
              <Feather name="shield" size={17} color={Colors.primary} />
              <Text style={styles.noteTitle}>Use what feels steady</Text>
            </View>
            <Text style={appUiStyles.muted}>
              Stop or switch exercises if a practice increases distress. Meditation
              is a skill option, not a treatment requirement.
            </Text>
          </AppCard>
        </>
      )}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  backButton: { alignSelf: 'flex-start', marginBottom: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  list: { marginTop: 18 },
  practiceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 16,
    padding: 15,
    marginBottom: 10,
  },
  pressed: { opacity: 0.76 },
  practiceIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  practiceTitle: { color: Colors.text, fontSize: 15, fontWeight: '700' },
  practiceSummary: {
    color: Colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
  },
  duration: {
    color: Colors.accent,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 6,
  },
  selectedTitle: {
    color: Colors.text,
    fontSize: 24,
    lineHeight: 29,
    fontWeight: '700',
    marginTop: 7,
  },
  safety: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    marginTop: 14,
    paddingTop: 13,
  },
  safetyText: {
    flex: 1,
    color: Colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
  },
  noteHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 7,
  },
  noteTitle: { color: Colors.text, fontSize: 15, fontWeight: '700' },
});
