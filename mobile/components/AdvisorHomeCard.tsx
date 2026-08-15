import { Image, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Colors, LARGE_TEXT_SCALE, Radius, Spacing, Typography } from '@/lib/constants';
import type { AdvisorActionStatus } from '@/lib/advisor-action-storage';

type AdvisorHomeCardProps = {
  lowEnergy: boolean;
  currentAction?: string | null;
  actionStatus?: AdvisorActionStatus | null;
  onOpen: () => void;
};

export function AdvisorHomeCard({
  lowEnergy,
  currentAction = null,
  actionStatus = null,
  onOpen,
}: AdvisorHomeCardProps) {
  const { fontScale, width } = useWindowDimensions();
  const showsArtwork = fontScale < LARGE_TEXT_SCALE && width >= 390;

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
          {currentAction
            ? actionStatus === 'accepted'
              ? 'Your planned step.'
              : actionStatus === 'needs_recovery'
                ? 'Ready to pick back up.'
                : 'Your current step.'
            : lowEnergy
              ? 'Start with less.'
              : 'Your next step is ready.'}
        </Text>
        <Text style={styles.description}>
          {currentAction ?? 'Open Advisor to see what fits today.'}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={currentAction ? 'Open Advisor step' : 'Open Advisor'}
          accessibilityHint={currentAction ? 'Review or continue this step' : 'Review your current suggestion'}
          onPress={onOpen}
          style={({ pressed }) => [styles.openButton, pressed && styles.pressed]}
        >
          <Text style={styles.openButtonText}>
            {currentAction
              ? actionStatus === 'accepted'
                ? 'Review'
                : actionStatus === 'needs_recovery'
                  ? 'Reset'
                  : 'Continue'
              : 'Open Advisor'}
          </Text>
          <Feather accessible={false} name="arrow-right" size={17} color={Colors.onPrimary} />
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
  pressed: { opacity: 0.72 },
});
