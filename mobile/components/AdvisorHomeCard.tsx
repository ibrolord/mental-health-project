import { Image, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Colors, LARGE_TEXT_SCALE, Radius, Spacing, Typography } from '@/lib/constants';

type AdvisorHomeCardProps = {
  lowEnergy: boolean;
  onOpen: () => void;
};

export function AdvisorHomeCard({ lowEnergy, onOpen }: AdvisorHomeCardProps) {
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
          {lowEnergy ? 'Start with less.' : 'Your next step is ready.'}
        </Text>
        <Text style={styles.description}>
          Open Advisor to see what fits today.
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open Advisor"
          accessibilityHint="Review your current suggestion"
          onPress={onOpen}
          style={({ pressed }) => [styles.openButton, pressed && styles.pressed]}
        >
          <Text style={styles.openButtonText}>Open Advisor</Text>
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
