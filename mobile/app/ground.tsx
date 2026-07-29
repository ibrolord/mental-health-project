import { useState } from 'react';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  AppButton,
  AppCard,
  AppScreen,
  PageHeader,
  SectionHeader,
  appUiStyles,
} from '@/components/AppUI';
import { GuidedPractice } from '@/components/GuidedPractice';
import { OptionalSoundscape } from '@/components/OptionalSoundscape';
import {
  GROUNDING_NEEDS,
  groundingPathFor,
  type GroundingNeed,
} from '@/lib/grounding';
import { Colors } from '@/lib/constants';

export default function GroundScreen() {
  const router = useRouter();
  const [selectedNeed, setSelectedNeed] = useState<GroundingNeed | null>(null);
  const [showWhy, setShowWhy] = useState(false);
  const path = selectedNeed ? groundingPathFor(selectedNeed) : null;

  return (
    <AppScreen>
      <PageHeader
        eyebrow="Immediate grounding"
        title="Stay with this moment."
        description="Choose the closest match. You can stop, switch, or contact someone at any time."
        icon="compass"
      />

      {!path ? (
        <>
          <SectionHeader
            title="What is happening right now?"
            description="No explanation is required."
          />
          {GROUNDING_NEEDS.map((need) => (
            <Pressable
              key={need.id}
              accessibilityRole="button"
              onPress={() => {
                setSelectedNeed(need.id);
                setShowWhy(false);
              }}
              style={({ pressed }) => [
                styles.needCard,
                pressed && styles.pressed,
              ]}
            >
              <View style={styles.needIcon}>
                <Feather
                  name={
                    need.id === 'panic'
                      ? 'activity'
                      : need.id === 'detached'
                        ? 'anchor'
                        : need.id === 'flashback'
                          ? 'clock'
                          : need.id === 'overwhelmed'
                            ? 'layers'
                            : need.id === 'spiraling'
                              ? 'refresh-cw'
                              : 'circle'
                  }
                  size={19}
                  color={Colors.primary}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.needTitle}>{need.label}</Text>
                <Text style={styles.needPrompt}>{need.prompt}</Text>
              </View>
              <Feather name="chevron-right" size={20} color={Colors.textSecondary} />
            </Pressable>
          ))}
        </>
      ) : (
        <>
          <AppButton
            label="Choose a different path"
            icon="arrow-left"
            variant="quiet"
            onPress={() => setSelectedNeed(null)}
            style={styles.backButton}
          />

          <AppCard quiet>
            <Text style={appUiStyles.label}>{path.label}</Text>
            <Text style={styles.technique}>{path.technique}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded: showWhy }}
              onPress={() => setShowWhy((current) => !current)}
              style={styles.whyToggle}
            >
              <Text style={styles.whyToggleText}>
                {showWhy ? 'Hide why this may help' : 'Why this may help'}
              </Text>
              <Feather
                name={showWhy ? 'chevron-up' : 'chevron-down'}
                size={17}
                color={Colors.primary}
              />
            </Pressable>
            {showWhy ? <Text style={appUiStyles.muted}>{path.why}</Text> : null}
          </AppCard>

          <GuidedPractice steps={path.steps} startLabel="Start grounding" />
          <OptionalSoundscape title="Background sound" compact />
        </>
      )}

      <AppCard style={styles.supportCard}>
        <View style={styles.supportHeader}>
          <Feather name="phone-call" size={18} color={Colors.danger} />
          <Text style={styles.supportTitle}>Need another person now?</Text>
        </View>
        <Text style={appUiStyles.muted}>
          If you may act on thoughts of harming yourself or someone else, contact
          local emergency services now.
        </Text>
        <AppButton
          label="Find crisis and community support"
          icon="external-link"
          variant="secondary"
          onPress={() => router.push('/resources')}
          style={{ marginTop: 14 }}
        />
      </AppCard>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  needCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    minHeight: 86,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 16,
    padding: 15,
    marginBottom: 10,
  },
  pressed: { opacity: 0.76 },
  needIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  needTitle: { color: Colors.text, fontSize: 15, fontWeight: '700' },
  needPrompt: {
    color: Colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
  },
  backButton: { alignSelf: 'flex-start', marginBottom: 12 },
  technique: {
    color: Colors.text,
    fontSize: 22,
    lineHeight: 27,
    fontWeight: '700',
    marginTop: 7,
  },
  whyToggle: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  whyToggleText: { color: Colors.primary, fontSize: 13, fontWeight: '700' },
  supportCard: { marginTop: 12, borderColor: '#e4b9b1' },
  supportHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    marginBottom: 8,
  },
  supportTitle: { color: Colors.text, fontSize: 16, fontWeight: '700' },
});
