import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Animated, Easing } from 'react-native';
import { welcomeMotionSpec } from '@/lib/onboarding-evidence';

export function useWelcomeReducedMotion() {
  const [reduceMotion, setReduceMotion] = useState<boolean | null>(null);
  useEffect(() => {
    let active = true;
    let changed = false;
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', (enabled) => {
      changed = true;
      if (active) setReduceMotion(enabled);
    });
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (active && !changed) setReduceMotion(enabled);
    }).catch(() => {
      if (active && !changed) setReduceMotion(true);
    });
    return () => { active = false; subscription.remove(); };
  }, []);
  return reduceMotion;
}

export function WelcomeReveal({ children, reduceMotion, scene }: {
  children: ReactNode; reduceMotion: boolean | null; scene: string;
}) {
  const progress = useRef(new Animated.Value(1)).current;
  const motion = welcomeMotionSpec(reduceMotion);
  useEffect(() => {
    progress.stopAnimation();
    if (!motion.duration) { progress.setValue(1); return; }
    progress.setValue(0);
    const animation = Animated.timing(progress, {
      toValue: 1, duration: motion.duration, easing: Easing.out(Easing.cubic),
      useNativeDriver: true, isInteraction: false,
    });
    animation.start();
    return () => { animation.stop(); progress.setValue(1); };
  }, [motion.duration, progress, scene]);
  return <Animated.View style={{
    opacity: progress.interpolate({ inputRange: [0, 1], outputRange: [motion.initialOpacity, 1] }),
    transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [motion.translateY, 0] }) }],
  }}>{children}</Animated.View>;
}
