import { Image, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Colors, LARGE_TEXT_SCALE, Radius, Spacing, Typography } from '@/lib/constants';
import type { AdvisorActionStatus } from '@/lib/advisor-action-storage';

type AdvisorHomeCardProps = {
  lowEnergy: boolean;
  currentAction?: string | null;
  actionStatus?: AdvisorActionStatus | null;
  loading?: boolean;
  onStart?: () => void;
  offerSetup?: boolean;
  onSetup?: () => void;
  onSkip?: () => void;
  completed?: boolean;
  onOpen: () => void;
};

export function AdvisorHomeCard({
  lowEnergy,
  currentAction = null,
  actionStatus = null,
  loading = false,
  onStart,
  offerSetup = false,
  onSetup,
  onSkip,
  completed = false,
  onOpen,
}: AdvisorHomeCardProps) {
  const { fontScale, width } = useWindowDimensions();
  const showsArtwork = !offerSetup && fontScale < LARGE_TEXT_SCALE && width >= 390;

  return (
    <View style={styles.card}>
      {showsArtwork ? (
        <Image
          accessible={false}
          source={require('../assets/today-botanical.png')}
          resizeMode="cover"
          style={styles.artwork}
        />
      ) : null}
      <View style={[styles.content, showsArtwork && styles.contentWithArtwork]}>
        <Text style={styles.eyebrow}>YOUR ADVISOR</Text>
        <Text accessibilityRole="header" style={styles.heading}>
          {offerSetup ? 'Make this space yours.' : completed ? 'One step forward.' : currentAction
            ? actionStatus === 'accepted'
              ? 'Your planned step.'
              : actionStatus === 'needs_recovery'
                ? 'Ready to pick back up.'
                : 'Your current step.'
            : lowEnergy
              ? 'Start with less.'
              : 'One step at a time.'}
        </Text>
        <Text style={styles.description}>
          {offerSetup ? 'What would you like support with? Choose a starting point, or explore at your own pace.'
            : currentAction ?? (loading ? 'Finding a next step...' : 'Open Advisor when you want help choosing what comes next.')}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={offerSetup ? 'Choose my focus' : onStart ? (actionStatus === 'in_progress' ? 'Continue my step' : 'Start my step') : 'Open Advisor'}
          accessibilityHint={offerSetup ? 'Optional setup with your focus and preferred name' : onStart ? 'Open the tool for this step' : 'Review your current suggestion'}
          disabled={loading}
          accessibilityState={{ disabled: loading, busy: loading }}
          onPress={offerSetup ? onSetup : onStart ?? onOpen}
          style={({ pressed }) => [styles.openButton, (pressed || loading) && styles.pressed]}
        >
          <Text style={styles.openButtonText}>
            {offerSetup ? 'Choose my focus' : completed ? 'Reflect with Advisor' : onStart ? (actionStatus === 'in_progress' ? 'Continue' : 'Start') : currentAction
              ? actionStatus === 'accepted'
                ? 'Review'
                : actionStatus === 'needs_recovery'
                  ? 'Reset'
                  : 'Continue'
              : 'Open Advisor'}
          </Text>
          <Feather accessible={false} name="arrow-right" size={17} color={Colors.onPrimary} />
        </Pressable>
        <Pressable accessibilityRole="button" disabled={loading}
          accessibilityLabel={offerSetup ? 'Explore for now' : 'Open Advisor for more support'}
          onPress={offerSetup ? onSkip : onOpen} style={styles.secondaryButton}>
          <Text style={styles.secondaryText}>{offerSetup ? 'Explore for now' : 'More with Advisor'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 164,
    overflow: 'hidden',
    borderRadius: Radius.lg,
    backgroundColor: Colors.surfaceParchment,
    marginBottom: Spacing.lg,
  },
  artwork: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    width: 100,
    opacity: 0.48,
  },
  content: { minHeight: 164, padding: Spacing.md, justifyContent: 'center' },
  contentWithArtwork: { paddingRight: 104 },
  eyebrow: { color: Colors.accent, ...Typography.eyebrow, marginBottom: Spacing.xs },
  heading: { color: Colors.text, ...Typography.displaySmall },
  description: { color: Colors.textSecondary, ...Typography.bodySmall, marginTop: Spacing.xs },
  openButton: {
    minHeight: 44,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    borderRadius: Radius.md,
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    marginTop: Spacing.sm,
  },
  openButtonText: { color: Colors.onPrimary, ...Typography.label },
  secondaryButton: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  secondaryText: { color: Colors.primary, ...Typography.label },
  pressed: { opacity: 0.72 },
});
