import { Image, StyleSheet, View, useWindowDimensions, type StyleProp, type ViewStyle } from 'react-native';
import { LARGE_TEXT_SCALE } from '@/lib/constants';

export function BotanicalHero({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const { fontScale } = useWindowDimensions();
  const showsArtwork = fontScale < LARGE_TEXT_SCALE;

  return (
    <View style={[styles.hero, style]}>
      {showsArtwork ? (
        <Image
          accessible={false}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          source={require('../assets/today-botanical.png')}
          resizeMode="cover"
          style={styles.artwork}
        />
      ) : null}
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    position: 'relative',
    overflow: 'hidden',
  },
  artwork: {
    ...StyleSheet.absoluteFillObject,
    width: undefined,
    height: undefined,
    opacity: 0.62,
  },
  content: {
    position: 'relative',
    zIndex: 1,
  },
});
