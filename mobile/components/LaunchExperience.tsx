import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Platform,
  StyleSheet,
  View,
} from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { Colors } from '@/lib/constants';
import { isLaunchReady } from '@/lib/launch-readiness';

const MOTION_DURATION_MS = 900;
const SPLASH_MARK_SIZE = 112;
const READINESS_FALLBACK_MS = 3000;

const settledProgress = new Animated.Value(1);
const LaunchMotionContext = createContext(settledProgress);

let hasPlayedLaunchExperience = false;

if (Platform.OS !== 'web') {
  void SplashScreen.preventAutoHideAsync().catch(() => {
    // A development reload can reach this after the native splash is gone.
  });
}

export function LaunchExperience({
  children,
  contentReady,
  ready,
}: {
  children: ReactNode;
  contentReady: boolean;
  ready: boolean;
}) {
  const shouldAnimate = useRef(!hasPlayedLaunchExperience);
  const progress = useRef(new Animated.Value(shouldAnimate.current ? 0 : 1)).current;
  const [overlayVisible, setOverlayVisible] = useState(shouldAnimate.current);
  const [layoutReady, setLayoutReady] = useState(false);
  const [markReady, setMarkReady] = useState(!shouldAnimate.current);
  const [fallbackReady, setFallbackReady] = useState(false);
  const activeRef = useRef(true);
  const startedRef = useRef(false);
  const frameRef = useRef<number | null>(null);
  const animationRef = useRef<Animated.CompositeAnimation | null>(null);

  const finishImmediately = useCallback(() => {
    animationRef.current?.stop();
    progress.setValue(1);
    setOverlayVisible(false);
    hasPlayedLaunchExperience = true;
  }, [progress]);

  const start = useCallback(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    void (async () => {
      const [reduceMotion, screenReaderEnabled] = await Promise.all([
        AccessibilityInfo.isReduceMotionEnabled().catch(() => false),
        AccessibilityInfo.isScreenReaderEnabled().catch(() => false),
      ]);
      await SplashScreen.hideAsync().catch(() => {
        // The splash may already be hidden during fast refresh.
      });

      if (!activeRef.current) return;
      if (!shouldAnimate.current || reduceMotion || screenReaderEnabled) {
        finishImmediately();
        return;
      }

      hasPlayedLaunchExperience = true;
      frameRef.current = requestAnimationFrame(() => {
        if (!activeRef.current) return;
        animationRef.current = Animated.timing(progress, {
          toValue: 1,
          duration: MOTION_DURATION_MS,
          easing: Easing.out(Easing.cubic),
          isInteraction: false,
          useNativeDriver: true,
        });
        animationRef.current.start(({ finished }) => {
          if (finished && activeRef.current) setOverlayVisible(false);
        });
      });
    })();
  }, [finishImmediately, progress]);

  useEffect(() => {
    activeRef.current = true;
    const fallbackTimer = setTimeout(() => {
      setFallbackReady(true);
    }, READINESS_FALLBACK_MS);
    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      (reduceMotion) => {
        if (reduceMotion) finishImmediately();
      }
    );

    return () => {
      activeRef.current = false;
      clearTimeout(fallbackTimer);
      animationRef.current?.stop();
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      subscription.remove();
    };
  }, [finishImmediately]);

  useEffect(() => {
    if (isLaunchReady({
      contentReady,
      fallbackReady,
      layoutReady,
      markReady,
      routeReady: ready,
    })) start();
  }, [contentReady, fallbackReady, layoutReady, markReady, ready, start]);

  const markStyle = useMemo(() => ({
    opacity: progress.interpolate({
      inputRange: [0, 0.13, 0.47, 0.69, 1],
      outputRange: [1, 1, 0.9, 0, 0],
    }),
    transform: [
      {
        scale: progress.interpolate({
          inputRange: [0, 0.13, 0.47, 1],
          outputRange: [1, 1, 0.92, 0.92],
        }),
      },
      {
        translateY: progress.interpolate({
          inputRange: [0, 0.13, 0.47, 1],
          outputRange: [0, 0, -6, -6],
        }),
      },
    ],
  }), [progress]);

  const overlayBackgroundStyle = useMemo(() => ({
    opacity: progress.interpolate({
      inputRange: [0, 0.29, 0.69, 1],
      outputRange: [1, 1, 0, 0],
    }),
  }), [progress]);

  return (
    <LaunchMotionContext.Provider value={progress}>
      <View onLayout={() => setLayoutReady(true)} style={styles.root}>
        <View
          accessibilityElementsHidden={overlayVisible}
          importantForAccessibility={overlayVisible ? 'no-hide-descendants' : 'auto'}
          pointerEvents={overlayVisible ? 'none' : 'auto'}
          style={styles.content}
        >
          {children}
        </View>
        {overlayVisible ? (
          <View
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            pointerEvents="auto"
            style={styles.overlay}
          >
            <Animated.View style={[styles.overlayBackground, overlayBackgroundStyle]} />
            <Animated.Image
              accessible={false}
              onError={() => setMarkReady(true)}
              onLoadEnd={() => setMarkReady(true)}
              source={require('../assets/splash-icon.png')}
              style={[styles.mark, markStyle]}
            />
          </View>
        ) : null}
      </View>
    </LaunchMotionContext.Provider>
  );
}

function revealStyle(
  progress: Animated.Value,
  start: number,
  end: number,
  translateY = 10
) {
  return {
    opacity: progress.interpolate({
      inputRange: [0, start, end, 1],
      outputRange: [0, 0, 1, 1],
    }),
    transform: [
      {
        translateY: progress.interpolate({
          inputRange: [0, start, end, 1],
          outputRange: [translateY, translateY, 0, 0],
        }),
      },
    ],
  };
}

export function useLaunchMotion() {
  const progress = useContext(LaunchMotionContext);

  return useMemo(() => ({
    heroArtwork: {
      opacity: progress.interpolate({
        inputRange: [0, 0.29, 0.69, 1],
        outputRange: [0, 0, 0.62, 0.62],
      }),
      transform: [
        {
          scale: progress.interpolate({
            inputRange: [0, 0.29, 0.69, 1],
            outputRange: [1.04, 1.04, 1, 1],
          }),
        },
        {
          translateY: progress.interpolate({
            inputRange: [0, 0.29, 0.69, 1],
            outputRange: [8, 8, 0, 0],
          }),
        },
      ],
    },
    heroContent: revealStyle(progress, 0.42, 0.73),
    mood: revealStyle(progress, 0.51, 0.82),
    advisor: revealStyle(progress, 0.6, 0.91),
    day: revealStyle(progress, 0.69, 1),
  }), [progress]);
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlayBackground: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.background,
  },
  mark: {
    width: SPLASH_MARK_SIZE,
    height: SPLASH_MARK_SIZE,
  },
});
