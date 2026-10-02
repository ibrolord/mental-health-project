import { useEffect, useRef } from 'react';
import { Animated, Easing, Image, StyleSheet, View, type ImageSourcePropType } from 'react-native';
import type { StartingFocus } from '@/lib/advisor-onboarding';
import type { JourneyStep } from '@/lib/onboarding-journey';

const scenes: { focus: StartingFocus | JourneyStep; source: ImageSourcePropType }[] = [
  { focus: 'steady', source: require('../assets/welcome-steady.png') },
  { focus: 'routine', source: require('../assets/welcome-routine.png') },
  { focus: 'follow-through', source: require('../assets/welcome-goals.png') },
  { focus: 'motivation', source: require('../assets/welcome-motivation.png') },
  { focus: 'obstacle', source: require('../assets/welcome-obstacle.png') },
  { focus: 'evidence', source: require('../assets/welcome-evidence.png') },
  { focus: 'commitment', source: require('../assets/welcome-routine.png') },
  { focus: 'review', source: require('../assets/welcome-ready.png') },
];

function ArtworkLayer({ active, source }: {
  active: boolean; source: ImageSourcePropType;
}) {
  const opacity = useRef(new Animated.Value(active ? 1 : 0)).current;
  const arrival = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    opacity.stopAnimation();
    arrival.stopAnimation();
    if (active) arrival.setValue(0);
    const transition = Animated.parallel([
      Animated.timing(opacity, { toValue: active ? 1 : 0, duration: 360,
        easing: Easing.out(Easing.cubic), useNativeDriver: true, isInteraction: false }),
      Animated.timing(arrival, { toValue: 1, duration: 900,
        easing: Easing.out(Easing.cubic), useNativeDriver: true, isInteraction: false }),
    ]);
    transition.start();
    return () => transition.stop();
  }, [active, arrival, opacity]);

  return <Animated.Image accessible={false} source={source} resizeMode="contain" style={[
    styles.layer,
    { opacity,
      transform: [{ scale: arrival.interpolate({ inputRange: [0, 1], outputRange: [1.025, 1] }) },
        { translateY: arrival.interpolate({ inputRange: [0, 1], outputRange: [5, 0] }) }] },
  ]} />;
}

export function WelcomeArtwork({ focus, step = 'focus', reduceMotion, height }: {
  focus: StartingFocus | null; step?: JourneyStep; reduceMotion: boolean | null; height: number;
}) {
  const selected = scenes.find((scene) => scene.focus === (step === 'focus' ? focus ?? 'steady' : step))!;
  // Unmount native animated layers when motion is off: detaching an animated
  // opacity prop in place can restore its default and expose hidden layers on iOS.
  return <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
    style={[styles.frame, { height }]}>
    {reduceMotion !== false
      ? <Image key="static" accessible={false} source={selected.source} resizeMode="contain" style={styles.layer} />
      : scenes.map((scene) => <ArtworkLayer key={scene.focus} source={scene.source} active={scene === selected} />)}
  </View>;
}

const styles = StyleSheet.create({
  frame: { marginHorizontal: -24, marginTop: -4, marginBottom: 14, overflow: 'hidden' },
  layer: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
});
