import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, AppState, Easing, StyleSheet, Text, View } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { AppButton, AppCard, ChoiceChip } from './AppUI';
import { Colors, Typography } from '@/lib/constants';
import { VISUAL_FOCUS_SECONDS, visualFocusTravel } from '@/lib/body-practices';

export function VisualFocus() {
  const focused = useIsFocused();
  const [reducedMotion, setReducedMotion] = useState(true);
  const [accessibilityReady, setAccessibilityReady] = useState(false);
  const [still, setStill] = useState(false);
  const [slow, setSlow] = useState(true);
  const [narrow, setNarrow] = useState(true);
  const [width, setWidth] = useState(0);
  const [running, setRunning] = useState(false);
  const [remaining, setRemaining] = useState(VISUAL_FOCUS_SECONDS);
  const [notice, setNotice] = useState('Ready when you are.');
  const position = useRef(new Animated.Value(0)).current;
  const session = useRef<{ startedAt: number; seconds: number } | null>(null);
  const motion = useRef<Animated.CompositeAnimation | null>(null);
  const staticMode = reducedMotion || still;

  const stop = (message: string) => {
    motion.current?.stop();
    position.stopAnimation();
    session.current = null;
    setRunning(false);
    setNotice(message);
  };
  const stopRef = useRef(stop);
  stopRef.current = stop;

  useEffect(() => {
    let active = true;
    let preferenceChanged = false;
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (active) {
        if (!preferenceChanged) setReducedMotion(value);
        setAccessibilityReady(true);
      }
    }).catch(() => { if (active) setAccessibilityReady(true); });
    const reduce = AccessibilityInfo.addEventListener('reduceMotionChanged', (value) => {
      preferenceChanged = true;
      setAccessibilityReady(true);
      setReducedMotion(value);
      stopRef.current('Motion preference changed. Start again when you are ready.');
    });
    const background = AppState.addEventListener('change', (state) => {
      if (state !== 'active') stopRef.current('Paused while you were away.');
    });
    return () => {
      active = false;
      reduce.remove();
      background.remove();
      session.current = null;
      motion.current?.stop();
      position.stopAnimation();
    };
  }, [position]);

  useEffect(() => { if (!focused) stopRef.current('Paused while you were away.'); }, [focused]);

  useEffect(() => {
    if (!running || !focused || staticMode) return;
    const travel = visualFocusTravel(width, narrow);
    const duration = slow ? 2500 : 1500;
    position.setValue(0);
    const move = (toValue: number, time: number) => Animated.timing(position, { toValue, duration: time, easing: Easing.inOut(Easing.sin), useNativeDriver: true });
    const animation = Animated.sequence([
      move(travel, duration),
      Animated.loop(Animated.sequence([move(-travel, duration * 2), move(travel, duration * 2)]), { resetBeforeIteration: false }),
    ]);
    motion.current = animation;
    animation.start();
    return () => { animation.stop(); position.stopAnimation(); };
  }, [focused, narrow, position, running, slow, staticMode, width]);

  useEffect(() => {
    if (!running || !focused) return;
    const timer = setInterval(() => {
      const current = session.current;
      if (!current) return;
      const seconds = Math.max(0, Math.min(current.seconds, current.seconds - Math.floor((Date.now() - current.startedAt) / 1000)));
      setRemaining(seconds);
      if (seconds === 0) {
        stopRef.current('Finished. Look around and notice how you feel. No change is okay.');
        AccessibilityInfo.announceForAccessibility('Visual focus finished.');
      }
    }, 200);
    return () => clearInterval(timer);
  }, [focused, running]);

  return <AppCard>
    <Text style={styles.title}>Visual focus</Text>
    <Text style={styles.body}>If comfortable, let your eyes follow the dot. Keep attention in the present; do not bring up distressing memories.</Text>
    <Text style={styles.body}>This is not EMDR or trauma treatment. Stop for eye strain, headache, dizziness, nausea, or increasing distress.</Text>
    <View style={styles.choices}>
      <ChoiceChip label="Still focus" selected={staticMode} disabled={running || reducedMotion} onPress={() => { setStill(!still); position.setValue(0); }} />
      <ChoiceChip label="Slower" selected={slow} disabled={running || staticMode} onPress={() => setSlow(true)} />
      <ChoiceChip label="Steady" selected={!slow} disabled={running || staticMode} onPress={() => setSlow(false)} />
      <ChoiceChip label="Small movement" selected={narrow} disabled={running || staticMode} onPress={() => setNarrow(!narrow)} />
    </View>
    {reducedMotion ? <Text style={styles.body}>Reduce Motion is on. The dot stays still; you can also notice a fixed object in the room.</Text> : null}
    <View style={styles.stage} onLayout={(event) => setWidth(event.nativeEvent.layout.width)} accessibilityLabel={staticMode ? 'Stationary focus dot' : 'Visual focus area'}>
      <Animated.View accessible={false} style={[styles.dot, { transform: [{ translateX: staticMode ? 0 : position }] }]} />
    </View>
    <Text style={styles.time}>{remaining} seconds</Text>
    <Text accessibilityLiveRegion="polite" style={styles.body}>{notice}</Text>
    {running ? <AppButton label="Stop" icon="square" onPress={() => stop('Stopped. Continue only if you want to.')} /> : <AppButton label={remaining < VISUAL_FOCUS_SECONDS && remaining > 0 ? 'Continue' : 'Start 30 seconds'} icon="play" disabled={!focused || !accessibilityReady || width === 0} onPress={() => {
      if (!focused || !accessibilityReady || width === 0) return;
      const seconds = remaining > 0 ? remaining : VISUAL_FOCUS_SECONDS;
      setRemaining(seconds);
      session.current = { startedAt: Date.now(), seconds };
      setNotice(staticMode ? 'Notice the still dot or a nearby object.' : 'Follow only as far as feels comfortable.');
      setRunning(true);
    }} />}
    <AppButton label="Reset" variant="quiet" onPress={() => { stop('Ready when you are.'); position.setValue(0); setRemaining(VISUAL_FOCUS_SECONDS); }} />
  </AppCard>;
}

const styles = StyleSheet.create({
  title: { ...Typography.displaySmall, color: Colors.text },
  body: { ...Typography.body, color: Colors.textSecondary, marginVertical: 10 },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 12 },
  stage: { height: 160, borderRadius: 24, backgroundColor: Colors.primaryLight, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  dot: { height: 24, width: 24, borderRadius: 12, backgroundColor: Colors.primary },
  time: { ...Typography.label, color: Colors.textSecondary, marginTop: 12, textAlign: 'center' },
});
