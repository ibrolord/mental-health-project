import { useState } from 'react';
import { Feather } from '@expo/vector-icons';
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ImageSourcePropType,
} from 'react-native';
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
import { Colors } from '@/lib/constants';
import {
  YOGA_POSES,
  YOGA_PRACTICES,
  yogaPracticeDurationSeconds,
  type YogaPoseId,
  type YogaPractice,
} from '@/lib/wellbeing/yoga';

const POSE_IMAGES: Record<YogaPoseId, ImageSourcePropType> = {
  'seated-arrival': require('@/assets/yoga/seated-arrival.jpg'),
  'seated-cat': require('@/assets/yoga/seated-cat.jpg'),
  'seated-cow': require('@/assets/yoga/seated-cow.jpg'),
  'seated-side-reach': require('@/assets/yoga/seated-side-reach.jpg'),
  'seated-twist': require('@/assets/yoga/seated-twist.jpg'),
  'tabletop-neutral': require('@/assets/yoga/tabletop-neutral.jpg'),
  'tabletop-round': require('@/assets/yoga/tabletop-round.jpg'),
  'tabletop-cow': require('@/assets/yoga/tabletop-cow.jpg'),
  'child-pose': require('@/assets/yoga/child-pose.jpg'),
  'supported-child': require('@/assets/yoga/supported-child.jpg'),
  'floor-rest': require('@/assets/yoga/floor-rest.jpg'),
  'supported-savasana': require('@/assets/yoga/supported-savasana.jpg'),
};

function minutesLabel(seconds: number): string {
  return `${Math.max(1, Math.ceil(seconds / 60))} min`;
}

function settingLabel(setting: YogaPractice['setting']): string {
  if (setting === 'chair') return 'Chair yoga';
  if (setting === 'restorative') return 'Restorative yoga';
  return 'Floor yoga';
}

export default function YogaScreen() {
  const [selected, setSelected] = useState<YogaPractice | null>(null);

  return (
    <AppScreen>
      <PageHeader
        eyebrow="Beginner yoga"
        title="Choose a practice that fits today."
        description="Named yoga poses, clear setup, and easy exits. Start seated, on the floor, or with restorative support."
        icon="activity"
      />

      {selected ? (
        <>
          <AppButton
            label="Choose another sequence"
            icon="arrow-left"
            variant="quiet"
            onPress={() => setSelected(null)}
            style={styles.backButton}
          />
          <AppCard quiet>
            <View style={styles.practiceMeta}>
              <Text style={appUiStyles.label}>
                {settingLabel(selected.setting)}
              </Text>
              <Text style={styles.duration}>
                {minutesLabel(yogaPracticeDurationSeconds(selected))}
              </Text>
            </View>
            <Text style={styles.selectedTitle}>{selected.title}</Text>
            <Text style={[appUiStyles.muted, styles.selectedSummary]}>
              {selected.summary}
            </Text>
            <View style={styles.equipment}>
              <Feather name="check-circle" size={16} color={Colors.primary} />
              <Text style={styles.equipmentText}>{selected.equipment}</Text>
            </View>
          </AppCard>

          <AppCard quiet style={styles.safetyCard}>
            <View style={styles.safetyHeader}>
              <Feather name="shield" size={17} color={Colors.accent} />
              <Text style={styles.safetyTitle}>Move within an easy range</Text>
            </View>
            <Text style={appUiStyles.muted}>
              Wellbeing support, not treatment. Stop for pain, dizziness, numbness, or breathing difficulty. {selected.safetyNote}
            </Text>
          </AppCard>

          <GuidedPractice
            steps={selected.steps}
            startLabel="Begin sequence"
            renderStepVisual={(step) => {
              const pose = YOGA_POSES[step.poseId];
              return (
                <View style={styles.visualCard}>
                  <Image
                    source={POSE_IMAGES[step.poseId]}
                    accessible
                    accessibilityLabel={step.imageAlt ?? pose.imageAlt}
                    style={[
                      styles.poseImage,
                      step.mirrorImage && styles.mirroredPose,
                    ]}
                    resizeMode="contain"
                  />
                  <View style={styles.poseLabel}>
                    <Text style={styles.poseLabelText}>{pose.name}</Text>
                  </View>
                </View>
              );
            }}
          />

          <OptionalSoundscape
            title="Background sound"
            options={['off', 'rain', 'ocean']}
            compact
          />
        </>
      ) : (
        <>
          <SectionHeader
            title="Choose a sequence"
            description="Start with the chair option if floor transitions are not comfortable."
          />
          <View style={styles.list}>
            {YOGA_PRACTICES.map((practice) => {
              const previewPose = YOGA_POSES[practice.steps[0].poseId];
              return (
                <Pressable
                  key={practice.id}
                  accessibilityRole="button"
                  accessibilityLabel={`${practice.title}, ${minutesLabel(yogaPracticeDurationSeconds(practice))}, ${settingLabel(practice.setting)}`}
                  onPress={() => setSelected(practice)}
                  style={({ pressed }) => [styles.practiceCard, pressed && styles.pressed]}
                >
                  <Image
                    source={POSE_IMAGES[previewPose.id]}
                    accessibilityIgnoresInvertColors
                    style={styles.practiceImage}
                    resizeMode="cover"
                  />
                  <View style={styles.practiceCopy}>
                    <Text style={styles.practiceLabel}>
                      {settingLabel(practice.setting)} | {minutesLabel(yogaPracticeDurationSeconds(practice))}
                    </Text>
                    <Text style={styles.practiceTitle}>{practice.title}</Text>
                    <Text style={styles.practiceSummary}>{practice.summary}</Text>
                  </View>
                  <Feather name="chevron-right" size={20} color={Colors.textSecondary} />
                </Pressable>
              );
            })}
          </View>

          <AppCard quiet style={styles.beforeCard}>
            <View style={styles.safetyHeader}>
              <Feather name="info" size={17} color={Colors.primary} />
              <Text style={styles.safetyTitle}>Before you begin</Text>
            </View>
            <Text style={appUiStyles.muted}>
              These are beginner self-guided yoga practices, not medical treatment. Ask a qualified health professional first if injury, pregnancy, surgery, or a health condition may affect safe movement.
            </Text>
          </AppCard>
        </>
      )}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  backButton: { alignSelf: 'flex-start', marginBottom: 12 },
  practiceMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  duration: { color: Colors.accent, fontSize: 12, fontWeight: '800' },
  selectedTitle: {
    color: Colors.text,
    fontSize: 26,
    lineHeight: 31,
    fontWeight: '700',
    marginTop: 8,
  },
  selectedSummary: { marginTop: 7 },
  equipment: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 13,
    paddingTop: 13,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  equipmentText: { flex: 1, color: Colors.text, fontSize: 13, fontWeight: '600' },
  visualCard: {
    height: 250,
    overflow: 'hidden',
    borderRadius: 15,
    backgroundColor: '#eadfcd',
    marginTop: 14,
    marginBottom: 18,
  },
  poseImage: { width: '100%', height: '100%' },
  mirroredPose: { transform: [{ scaleX: -1 }] },
  poseLabel: {
    position: 'absolute',
    left: 12,
    bottom: 12,
    borderRadius: 999,
    backgroundColor: 'rgba(22,58,50,0.9)',
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  poseLabelText: { color: '#fffef8', fontSize: 11, fontWeight: '800' },
  safetyCard: { borderColor: '#e9c5b8' },
  safetyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 7,
  },
  safetyTitle: { color: Colors.text, fontSize: 15, fontWeight: '700' },
  list: { gap: 10 },
  practiceCard: {
    minHeight: 112,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 16,
    backgroundColor: Colors.card,
    padding: 10,
  },
  pressed: { opacity: 0.76 },
  practiceImage: { width: 90, height: 90, borderRadius: 12, backgroundColor: '#eadfcd' },
  practiceCopy: { flex: 1 },
  practiceLabel: {
    color: Colors.accent,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  practiceTitle: { color: Colors.text, fontSize: 16, fontWeight: '700', marginTop: 4 },
  practiceSummary: {
    color: Colors.textSecondary,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 3,
  },
  beforeCard: { marginTop: 18 },
});
