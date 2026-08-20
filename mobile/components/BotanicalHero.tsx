import {
  Animated,
  StyleSheet,
  useWindowDimensions,
  type ImageStyle,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { LARGE_TEXT_SCALE } from '@/lib/constants';

export function BotanicalHero({
  children,
  style,
  artworkStyle,
  contentStyle,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  artworkStyle?: Animated.WithAnimatedObject<ImageStyle>;
  contentStyle?: Animated.WithAnimatedObject<ViewStyle>;
}) {
  const { fontScale } = useWindowDimensions();
  const showsArtwork = fontScale < LARGE_TEXT_SCALE;

  return (
    <Animated.View style={[styles.hero, style]}>
      {showsArtwork ? (
        <Animated.Image
          accessible={false}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          source={require('../assets/today-botanical.png')}
          resizeMode="cover"
          style={[styles.artwork, artworkStyle]}
        />
      ) : null}
      <Animated.View style={[styles.content, contentStyle]}>{children}</Animated.View>
    </Animated.View>
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
