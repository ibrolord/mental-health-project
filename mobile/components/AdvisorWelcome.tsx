import { useState } from 'react';
import { AccessibilityInfo, Image, Keyboard, Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { AppButton, AppInput, SupportAction } from './AppUI';
import { Colors, LARGE_TEXT_SCALE, Radius, Typography } from '@/lib/constants';
import { advisorWelcomeOption, STARTING_FOCUS_OPTIONS, type StartingFocus } from '@/lib/advisor-onboarding';
import type { AdvisorPersonalPlan } from '@/lib/onboarding-journey';

export function AdvisorWelcome({ name, busy, ready, onFinish, onSkip, onSupport }: {
  name: string;
  initialPlan?: AdvisorPersonalPlan;
  busy: boolean;
  ready: boolean;
  onFinish: (focus: StartingFocus, name: string, plan?: AdvisorPersonalPlan) => void;
  onSkip: () => void;
  onSupport: () => void;
}) {
  const [focus, setFocus] = useState<StartingFocus | null>(null);
  const [preferredName, setPreferredName] = useState(name);
  const [nameExpanded, setNameExpanded] = useState(false);
  const { fontScale } = useWindowDimensions();
  const selected = focus ? advisorWelcomeOption(focus) : null;
  const disabled = busy || !ready;

  return (
    <View style={styles.page}>
      {fontScale < LARGE_TEXT_SCALE ? <View pointerEvents="none" style={styles.botanicalFrame}>
        <Image accessible={false} source={require('../assets/today-botanical.png')} style={styles.botanical} />
      </View> : null}
      <View style={[styles.brandRow, fontScale >= LARGE_TEXT_SCALE && styles.stackedBrandRow]}>
        <Text style={styles.brand}>MHtoolkit</Text>
        <SupportAction onPress={onSupport} />
      </View>
      <Text accessibilityRole="header" style={styles.title}>What would make today easier?</Text>
      <Text style={styles.intro}>Choose a starting point. You can change it anytime.</Text>

      <View style={styles.options} accessibilityRole="radiogroup" accessibilityLabel="Your starting point">
        {STARTING_FOCUS_OPTIONS.map((option, index) => (
          <Pressable key={option.id} accessibilityRole="radio" disabled={disabled}
            accessibilityState={{ checked: focus === option.id, disabled }}
            accessibilityLabel={`${option.label}. ${option.description}`}
            accessibilityHint={`Option ${index + 1} of 3. Select to preview your first step.`}
            onPress={() => {
              setFocus(option.id);
              if (Platform.OS === 'ios' && focus !== option.id) {
                AccessibilityInfo.announceForAccessibility(`${option.preview} ${option.consequence}`);
              }
            }}
            style={({ pressed }) => [styles.option, index > 0 && styles.divider,
              focus === option.id && styles.selected, pressed && styles.pressed]}>
            <Feather accessible={false} name={option.icon} color={Colors.primary} size={21} />
            <View style={styles.copy}>
              <Text style={styles.label}>{option.label}</Text>
              <Text style={styles.description}>{option.description}</Text>
            </View>
            <View accessible={false} style={[styles.radio, focus === option.id && styles.radioSelected]}>
              {focus === option.id ? <Feather accessible={false} name="check" size={15} color={Colors.card} /> : null}
            </View>
          </Pressable>
        ))}
      </View>

      <View style={styles.preview} accessibilityLiveRegion="polite">
        <Text style={styles.eyebrow}>YOUR FIRST STEP</Text>
        <Text style={styles.previewTitle}>{selected?.preview ?? 'Choose what feels useful right now.'}</Text>
        <Text style={styles.previewBody}>{selected?.consequence ?? 'Or explore the tools without setting a focus.'}</Text>
      </View>

      <Pressable accessibilityRole="button" accessibilityState={{ expanded: nameExpanded, disabled }}
        accessibilityLabel={preferredName.trim() ? 'Your name, optional' : 'Add your name, optional'}
        disabled={disabled} onPress={() => setNameExpanded((value) => !value)} style={styles.nameRow}>
        <Feather accessible={false} name="user" size={18} color={Colors.textSecondary} />
        <View style={[styles.nameCopy, fontScale >= LARGE_TEXT_SCALE && styles.stackedNameCopy]}>
          <Text style={[styles.nameLabel, fontScale >= LARGE_TEXT_SCALE && styles.stackedNameLabel]}>
            {preferredName.trim() ? 'Your name' : 'Add your name'}
          </Text>
          <Text style={styles.optional}>Optional</Text>
        </View>
        <Feather accessible={false} name={nameExpanded ? 'chevron-up' : 'chevron-down'} size={18} color={Colors.textSecondary} />
      </Pressable>
      {nameExpanded ? <AppInput accessibilityLabel="Preferred name" placeholder="What should we call you?"
        value={preferredName} maxLength={24} editable={!disabled} onChangeText={setPreferredName}
        autoComplete="given-name" autoCorrect={false} returnKeyType="done" onSubmitEditing={Keyboard.dismiss}
        helper="Saved with your starting point. Up to 24 characters." /> : null}
      <View style={styles.actions}>
        <AppButton label={selected?.action ?? 'Choose a starting point'} disabled={!focus || disabled}
          loading={busy} style={styles.primary}
          onPress={() => { if (focus) { Keyboard.dismiss(); onFinish(focus, preferredName); } }} />
        <AppButton label={busy ? 'Return without waiting' : preferredName !== name
          ? 'Continue without saving' : 'Explore without setup'} variant="text"
          onPress={() => { Keyboard.dismiss(); onSkip(); }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { position: 'relative' },
  botanicalFrame: { position: 'absolute', left: -24, right: -24, top: -20, height: 220 },
  botanical: { width: '100%', height: '100%', opacity: 0.28, resizeMode: 'cover' },
  brandRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12 },
  stackedBrandRow: { flexDirection: 'column', alignItems: 'flex-start', gap: 4 },
  brand: { fontFamily: 'Georgia', fontWeight: '700', color: Colors.primary, fontSize: 22 },
  title: { ...Typography.display, fontSize: 30, lineHeight: 36, color: Colors.primary, marginBottom: 10 },
  intro: { fontSize: 16, lineHeight: 23, color: Colors.textSecondary, marginBottom: 16 },
  options: { borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.lg, overflow: 'hidden', backgroundColor: Colors.card },
  option: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12, minHeight: 72 },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border },
  selected: { backgroundColor: Colors.primaryLight },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center' },
  radioSelected: { backgroundColor: Colors.primary },
  pressed: { opacity: 0.75 },
  copy: { flex: 1 },
  label: { ...Typography.label, fontSize: 16, lineHeight: 21, color: Colors.text },
  description: { fontSize: 14, lineHeight: 20, color: Colors.textSecondary, marginTop: 4 },
  preview: { marginTop: 16, marginBottom: 10, paddingHorizontal: 4 },
  eyebrow: { ...Typography.eyebrow, color: Colors.accent, marginBottom: 8 },
  previewTitle: { ...Typography.displaySmall, color: Colors.primary },
  previewBody: { fontSize: 14, lineHeight: 20, color: Colors.textSecondary, marginTop: 8 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 52, paddingVertical: 12, paddingHorizontal: 4,
    borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: Colors.border },
  nameLabel: { ...Typography.label, flex: 1, color: Colors.textSecondary },
  nameCopy: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  stackedNameCopy: { flexDirection: 'column', alignItems: 'flex-start', gap: 4 },
  stackedNameLabel: { flex: 0 },
  optional: { ...Typography.bodySmall, color: Colors.textSecondary },
  actions: { gap: 4, marginTop: 8 },
  primary: { minHeight: 52, borderRadius: 30 },
});
