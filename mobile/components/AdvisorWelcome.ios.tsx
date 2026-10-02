import { useEffect, useRef, useState, type ComponentProps } from 'react';
import { AccessibilityInfo, findNodeHandle, Keyboard, KeyboardAvoidingView, Linking, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useHeaderHeight } from '@react-navigation/elements';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { AppButton, AppInput, SupportAction } from './AppUI';
import { useWelcomeReducedMotion, WelcomeReveal } from './WelcomeMotion';
import { WelcomeArtwork } from './WelcomeArtwork';
import { Colors, LARGE_TEXT_SCALE, Radius, Typography } from '@/lib/constants';
import { advisorWelcomeOption, STARTING_FOCUS_OPTIONS, type StartingFocus } from '@/lib/advisor-onboarding';
import { ONBOARDING_EVIDENCE } from '@/lib/onboarding-evidence';
import { COMMITMENT_ACTIONS, COMMITMENT_CUES, JOURNEY_STEPS, MOTIVATIONS, OBSTACLES,
  nextJourneyStep, normalizePersonalPlan, obstacleResponse, previousJourneyStep,
  type AdvisorPersonalPlan, type JourneyStep } from '@/lib/onboarding-journey';

const TITLES: Record<JourneyStep, string> = {
  focus: 'What would make today easier?', motivation: 'What would that make room for?',
  obstacle: 'What tends to get in the way?', evidence: 'Small steps can make a difference.',
  commitment: 'What is one small step you could take?', review: 'A starting point that is yours.',
};
const LABELS = ['Your focus', 'Your why', 'Your obstacle', 'The evidence', 'Your first step', 'Your plan'];

export function AdvisorWelcome({ name, initialPlan, busy, ready, onFinish, onSkip, onSupport }: {
  name: string; initialPlan?: AdvisorPersonalPlan; busy: boolean; ready: boolean;
  onFinish: (focus: StartingFocus, name: string, plan?: AdvisorPersonalPlan) => void;
  onSkip: () => void; onSupport: () => void;
}) {
  const [focus, setFocus] = useState<StartingFocus | null>(null);
  const [step, setStep] = useState<JourneyStep>('focus');
  const [plan, setPlan] = useState(() => normalizePersonalPlan(initialPlan));
  const [customMotivation, setCustomMotivation] = useState(Boolean(initialPlan?.motivation && !MOTIVATIONS.includes(initialPlan.motivation)));
  const [customAction, setCustomAction] = useState(Boolean(initialPlan?.action &&
    !Object.values(COMMITMENT_ACTIONS).flat().includes(initialPlan.action)));
  const [preferredName, setPreferredName] = useState(name);
  const [nameExpanded, setNameExpanded] = useState(false);
  const [evidenceExpanded, setEvidenceExpanded] = useState(false);
  const [cueExpanded, setCueExpanded] = useState(false);
  const [linkError, setLinkError] = useState('');
  const [keyboardVisible, setKeyboardVisible] = useState(Keyboard.isVisible());
  const scroll = useRef<ScrollView>(null);
  const heading = useRef<Text>(null);
  const focusHeading = useRef(false);
  const linkRequest = useRef(0);
  const { fontScale, height, width } = useWindowDimensions();
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();
  const reduceMotion = useWelcomeReducedMotion();
  const selected = focus ? advisorWelcomeOption(focus) : null;
  const evidence = focus ? ONBOARDING_EVIDENCE[focus] : null;
  const disabled = busy || !ready;
  const index = JOURNEY_STEPS.indexOf(step);
  const inlineActions = fontScale >= LARGE_TEXT_SCALE || height < 650 || keyboardVisible;
  const cleanPlan = normalizePersonalPlan(plan);
  const customActionSelected = customAction || Boolean(focus && plan.action && !COMMITMENT_ACTIONS[focus].includes(plan.action));
  const needsAnswer = step === 'focus' ? !focus
    : step === 'motivation' ? customMotivation && !cleanPlan.motivation
    : step === 'obstacle' ? plan.obstacle === 'custom' && !cleanPlan.obstacleDetail
    : step === 'commitment' ? !cleanPlan.action : false;

  useEffect(() => {
    const show = Keyboard.addListener('keyboardWillShow', () => setKeyboardVisible(true));
    const hide = Keyboard.addListener('keyboardWillHide', () => setKeyboardVisible(false));
    return () => { show.remove(); hide.remove(); linkRequest.current += 1; };
  }, []);
  const focusNewHeading = () => {
    if (!focusHeading.current) return;
    const target = findNodeHandle(heading.current);
    if (target) { focusHeading.current = false; AccessibilityInfo.setAccessibilityFocus(target); }
  };
  const changeStep = (next: JourneyStep) => {
    Keyboard.dismiss(); setKeyboardVisible(false); linkRequest.current += 1; focusHeading.current = true;
    setEvidenceExpanded(false); setLinkError(''); setStep(next);
    scroll.current?.scrollTo({ y: 0, animated: false });
    AccessibilityInfo.announceForAccessibility(`Step ${JOURNEY_STEPS.indexOf(next) + 1} of 6. ${TITLES[next]}`);
  };
  const chooseFocus = (next: StartingFocus) => {
    if (focus && next !== focus && COMMITMENT_ACTIONS[focus].includes(plan.action)) {
      setPlan((value) => ({ ...value, action: '', cue: '' }));
    }
    setFocus(next);
  };
  const choice = (label: string, checked: boolean, onPress: () => void, icon?: ComponentProps<typeof Feather>['name']) =>
    <Pressable key={label} accessibilityRole="radio" accessibilityLabel={label}
      accessibilityState={{ checked, disabled }} disabled={disabled} onPress={onPress}
      style={({ pressed }) => [styles.option, styles.divider, checked && styles.selected, pressed && styles.pressed]}>
      {icon ? <Feather accessible={false} name={icon} color={Colors.primary} size={21} /> : null}
      <View style={styles.copy}><Text style={styles.label}>{label}</Text></View>
      <View accessible={false} style={[styles.radio, checked && styles.radioSelected]}>
        {checked ? <Feather accessible={false} name="check" size={14} color={Colors.card} /> : null}
      </View>
    </Pressable>;

  const optionalStep = step === 'motivation' || step === 'obstacle' || step === 'commitment';
  const actions = <View style={[styles.actions, !inlineActions && styles.dockedActions]}>
    <AppButton label={step === 'review' ? 'Save my plan' : step === 'focus' ? 'Find my starting point' : step === 'evidence' ? 'Make it personal' : 'Continue'}
      disabled={needsAnswer || disabled} loading={busy} style={styles.primary} labelStyle={styles.buttonLabel}
      onPress={() => {
        if (disabled || needsAnswer || !focus) return;
        if (step !== 'review') changeStep(nextJourneyStep(step));
        else { Keyboard.dismiss(); onFinish(focus, preferredName, cleanPlan); }
      }} />
    {optionalStep ? <AppButton label="Skip this question" variant="text" labelStyle={styles.buttonLabel} disabled={disabled}
      onPress={() => {
        setPlan((value) => step === 'motivation' ? { ...value, motivation: '' }
          : step === 'obstacle' ? { ...value, obstacle: null, obstacleDetail: '' } : { ...value, action: '', cue: '' });
        if (step === 'motivation') setCustomMotivation(false);
        changeStep(nextJourneyStep(step));
      }} /> : <AppButton label={busy ? 'Return without waiting' : 'Explore without saving'} variant="text" labelStyle={styles.buttonLabel}
      onPress={() => { Keyboard.dismiss(); onSkip(); }} />}
  </View>;

  return <KeyboardAvoidingView style={[styles.page, { paddingTop: headerHeight === 0 ? insets.top : 0 }]} behavior="padding" keyboardVerticalOffset={headerHeight}>
    <ScrollView ref={scroll} style={styles.scroll} contentContainerStyle={styles.scrollContent}
      keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator
      onContentSizeChange={() => { if (keyboardVisible) scroll.current?.scrollToEnd({ animated: false }); }}>
      <View style={[styles.brandRow, fontScale >= LARGE_TEXT_SCALE && styles.stackedBrandRow]}>
        <Text maxFontSizeMultiplier={1.6} style={styles.brand}>MHtoolkit</Text><SupportAction onPress={onSupport} />
      </View>
      {fontScale < LARGE_TEXT_SCALE && !keyboardVisible ? <WelcomeArtwork focus={focus} step={step} reduceMotion={reduceMotion}
        height={step === 'focus' ? Math.min(260, width * 0.72, height * 0.28)
          : step === 'evidence' ? Math.min(110, height * 0.12) : Math.min(180, width * 0.5, height * 0.17)} /> : null}
      <View accessible accessibilityLabel={`Step ${index + 1} of 6. ${LABELS[index]}.`} style={styles.progressRow}>
        {JOURNEY_STEPS.map((value, position) => <View key={value} style={[styles.progressSegment, position <= index && styles.progressActive]} />)}
      </View>
      {index > 0 ? <Pressable accessibilityRole="button" accessibilityLabel="Back a step" disabled={disabled}
        onPress={() => changeStep(previousJourneyStep(step))} style={[styles.changeFocus, fontScale >= LARGE_TEXT_SCALE && styles.stackedChangeFocus]}>
        <Feather accessible={false} name="arrow-left" size={17} color={Colors.primary} />
        <Text style={[styles.changeLabel, fontScale >= LARGE_TEXT_SCALE && styles.stackedChangeLabel]}>Back</Text><Text style={styles.changeHint}>{LABELS[index]}</Text>
      </Pressable> : null}
      <WelcomeReveal scene={step} reduceMotion={reduceMotion}>
        <Text key={step} ref={heading} onLayout={focusNewHeading} accessibilityRole="header"
          style={[styles.title, fontScale >= LARGE_TEXT_SCALE && styles.largeTextTitle]}>
          {step === 'evidence' && evidence ? evidence.title : step === 'review' && preferredName.trim()
            ? `${preferredName.trim()}, this is your starting point.` : TITLES[step]}
        </Text>
        {step === 'focus' ? <>
          <Text style={styles.intro}>Let&apos;s find a starting point that fits you.</Text>
          <View style={styles.options} accessibilityRole="radiogroup" accessibilityLabel="Your starting point">
            {STARTING_FOCUS_OPTIONS.map((option) => choice(option.label, focus === option.id, () => chooseFocus(option.id), option.icon))}
          </View>
        </> : null}
        {step === 'motivation' ? <>
          <Text style={styles.intro}>Start with what matters to you, not what you think you should do.</Text>
          <View style={styles.options} accessibilityRole="radiogroup" accessibilityLabel="Your motivation">
            {MOTIVATIONS.map((label) => choice(label, !customMotivation && plan.motivation === label, () => {
              setCustomMotivation(false); setPlan((value) => ({ ...value, motivation: label }));
            }))}
            {choice('Something personal', customMotivation, () => {
              setCustomMotivation(true); if (!customMotivation) setPlan((value) => ({ ...value, motivation: '' }));
            }, 'edit-3')}
          </View>
          {customMotivation ? <AppInput accessibilityLabel="Your personal motivation" placeholder="This matters to me because..."
            multiline maxLength={180} editable={!disabled} value={plan.motivation}
            onChangeText={(motivation) => setPlan((value) => ({ ...value, motivation }))} /> : null}
        </> : null}
        {step === 'obstacle' ? <>
          <Text style={styles.intro}>We can work around it, instead of asking you to push harder.</Text>
          <View style={styles.options} accessibilityRole="radiogroup" accessibilityLabel="Your main obstacle">
            {OBSTACLES.map((option) => choice(option.label, plan.obstacle === option.id,
              () => setPlan((value) => ({ ...value, obstacle: option.id, obstacleDetail: '' }))))}
            {choice('Something else', plan.obstacle === 'custom', () => setPlan((value) => ({ ...value, obstacle: 'custom' })), 'edit-3')}
          </View>
          {plan.obstacle === 'custom' ? <AppInput accessibilityLabel="Your own obstacle" placeholder="What gets in the way?"
            multiline maxLength={180} editable={!disabled} value={plan.obstacleDetail}
            onChangeText={(obstacleDetail) => setPlan((value) => ({ ...value, obstacleDetail }))} /> : null}
          {plan.obstacle && plan.obstacle !== 'custom' ? <Text style={styles.response}>{obstacleResponse(plan)}</Text> : null}
        </> : null}
        {step === 'evidence' && evidence ? <>
          <Text style={styles.intro}>{evidence.introduction}</Text>
          <View style={styles.evidence} testID="onboarding-evidence">
            <Text style={styles.eyebrow}>{evidence.eyebrow}</Text>
            {evidence.comparison ? <View testID="onboarding-evidence-comparison">
              <Text style={styles.metricLabel}>{evidence.metricLabel}</Text>
              {evidence.comparison.map(({ percent, label }, position) => <View key={label}
                accessible accessibilityLabel={`${percent} percent. ${label}.`} style={styles.comparisonRow}>
                <View style={[styles.comparisonHeading, fontScale >= LARGE_TEXT_SCALE && styles.stackedComparison]}>
                  <Text style={styles.comparisonMetric}>{percent}%</Text><Text style={styles.comparisonLabel}>{label}</Text>
                </View>
                <View accessible={false} style={styles.comparisonTrack}>
                  <View style={[styles.comparisonFill, position > 0 && styles.comparisonControl, { width: `${percent}%` }]} />
                </View>
              </View>)}
            </View> : <>
              <Text testID="onboarding-evidence-metric" style={styles.metric}>{evidence.metric}</Text>
              <Text style={styles.metricLabel}>{evidence.metricLabel}</Text>
            </>}
            <Text testID="onboarding-evidence-scope" style={styles.finding}>{evidence.finding}</Text>
            <Text testID="onboarding-evidence-qualifier" style={styles.qualifier}>{evidence.qualifier}</Text>
            <Text style={styles.citation}>{evidence.citation}</Text>
            <Pressable accessibilityRole="button" accessibilityState={{ expanded: evidenceExpanded }}
              accessibilityLabel="Evidence details and source" onPress={() => setEvidenceExpanded((value) => !value)} style={styles.sourceButton}>
              <Text style={styles.sourceLabel}>Evidence details</Text>
              <Feather accessible={false} name={evidenceExpanded ? 'chevron-up' : 'chevron-down'} size={16} color={Colors.primary} />
            </Pressable>
            {evidenceExpanded ? <View style={styles.studyDetail}>
              <Text style={styles.detail}>{evidence.detail}</Text>
              <AppButton variant="text" label="Read the source" icon="external-link" labelStyle={styles.buttonLabel} onPress={() => {
                const request = ++linkRequest.current; setLinkError('');
                void Linking.openURL(evidence.url).catch(() => {
                  if (request === linkRequest.current) setLinkError('Could not open the source. Please try again.');
                });
              }} />
              {linkError ? <Text accessibilityRole="alert" style={styles.linkError}>{linkError}</Text> : null}
            </View> : null}
          </View>
          <Text testID="onboarding-evidence-application" style={styles.response}>{evidence.application}</Text>
        </> : null}
        {step === 'commitment' && focus ? <>
          <Text style={styles.intro}>{obstacleResponse(plan)}</Text>
          <View style={styles.options} accessibilityRole="radiogroup" accessibilityLabel="Your first small action">
            {COMMITMENT_ACTIONS[focus].map((label) => choice(label, !customAction && plan.action === label, () => {
              setCustomAction(false); setPlan((value) => ({ ...value, action: label }));
            }))}
            {choice('Choose my own step', customActionSelected, () => {
              setCustomAction(true); if (!customActionSelected) setPlan((value) => ({ ...value, action: '' }));
            }, 'edit-3')}
          </View>
          {customActionSelected ? <AppInput accessibilityLabel="Your small action"
            placeholder="One action I can actually do" maxLength={120} editable={!disabled} value={plan.action}
            onChangeText={(action) => { setCustomAction(true); setPlan((value) => ({ ...value, action })); }} /> : null}
          <Pressable accessibilityRole="button" accessibilityLabel="Choose when your step fits" accessibilityState={{ expanded: cueExpanded }}
            disabled={disabled} onPress={() => setCueExpanded((value) => !value)} style={styles.nameRow}>
            <Feather accessible={false} name="clock" size={18} color={Colors.primary} />
            <Text style={styles.nameLabel}>{plan.cue || 'Give it a place in your day'}</Text>
            <Feather accessible={false} name={cueExpanded ? 'chevron-up' : 'chevron-down'} size={16} color={Colors.primary} />
          </Pressable>
          {cueExpanded ? <>
            <View style={styles.options} accessibilityRole="radiogroup" accessibilityLabel="When your step fits">
              {COMMITMENT_CUES.map((cue) => choice(cue, plan.cue === cue, () => setPlan((value) => ({ ...value, cue }))))}
            </View>
            <AppInput accessibilityLabel="Your own timing cue" placeholder="Or a moment that works for you" maxLength={100}
              editable={!disabled} value={plan.cue} onChangeText={(cue) => setPlan((value) => ({ ...value, cue }))} />
          </> : null}
        </> : null}
        {step === 'review' && selected ? <>
          <Text style={styles.intro}>Built around what matters to you. You can change any of this later.</Text>
          <View style={styles.evidence}>
            <Text style={styles.eyebrow}>{selected.label.toUpperCase()}</Text>
            {cleanPlan.motivation ? <><Text style={styles.firstStepLabel}>YOUR WHY</Text><Text style={styles.stepTitle}>{cleanPlan.motivation}</Text></> : null}
            <Text style={styles.planLabel}>YOUR NEXT STEP</Text>
            <Text style={styles.stepTitle}>{cleanPlan.action || selected.preview}</Text>
            {cleanPlan.cue ? <Text style={styles.finding}>{cleanPlan.cue}</Text> : null}
            <Text style={styles.response}>{obstacleResponse(cleanPlan)}</Text>
            <AppButton variant="text" label="Edit my step" disabled={disabled} onPress={() => changeStep('commitment')} />
          </View>
          <Text style={styles.finding}>{selected.consequence} Your plan stays on this device; AI sharing stays unchanged.</Text>
          <Pressable accessibilityRole="button" accessibilityState={{ expanded: nameExpanded, disabled }}
            accessibilityLabel="Add your name, optional" disabled={disabled} onPress={() => setNameExpanded((value) => !value)} style={styles.nameRow}>
            <Feather accessible={false} name="user" size={18} color={Colors.primary} />
            <View style={[styles.nameCopy, fontScale >= LARGE_TEXT_SCALE && styles.stackedNameCopy]}>
              <Text style={[styles.nameLabel, fontScale >= LARGE_TEXT_SCALE && styles.stackedNameLabel]}>{preferredName.trim() || 'Add your name'}</Text>
              <Text style={styles.optional}>Optional</Text>
            </View>
            <Feather accessible={false} name={nameExpanded ? 'chevron-up' : 'chevron-down'} size={16} color={Colors.primary} />
          </Pressable>
          {nameExpanded ? <AppInput accessibilityLabel="Preferred name" placeholder="What should we call you?"
            value={preferredName} maxLength={24} editable={!disabled} onChangeText={setPreferredName}
            autoComplete="given-name" autoCorrect={false} returnKeyType="done" onSubmitEditing={Keyboard.dismiss} /> : null}
        </> : null}
      </WelcomeReveal>
      {inlineActions ? actions : null}
    </ScrollView>
    {!inlineActions ? actions : null}
  </KeyboardAvoidingView>;
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { paddingTop: 8, paddingBottom: 12 },
  brandRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 8 },
  stackedBrandRow: { flexDirection: 'column', alignItems: 'flex-start', gap: 4 },
  brand: { fontFamily: 'Georgia', fontWeight: '700', color: Colors.primary, fontSize: 22 },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 16, marginTop: 4 },
  progressSegment: { flex: 1, height: 3, borderRadius: 2, backgroundColor: Colors.borderTinted },
  progressActive: { backgroundColor: Colors.primary },
  hero: { paddingBottom: 20 },
  eyebrow: { ...Typography.eyebrow, color: Colors.accent, marginBottom: 10 },
  title: { ...Typography.display, fontSize: 32, lineHeight: 37, color: Colors.primary, marginBottom: 12 },
  largeTextTitle: { fontSize: 22, lineHeight: 28 },
  intro: { fontSize: 15, lineHeight: 22, color: Colors.textSecondary, marginBottom: 18 },
  response: { ...Typography.bodySmall, color: Colors.primary, marginTop: 12, marginBottom: 8 },
  planLabel: { ...Typography.eyebrow, color: Colors.accent, marginTop: 16, marginBottom: 6 },
  options: { marginBottom: 12, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.lg, overflow: 'hidden', backgroundColor: Colors.card },
  option: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 13, minHeight: 52 },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border },
  selected: { backgroundColor: Colors.primaryLight },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  radioSelected: { backgroundColor: Colors.primary },
  pressed: { opacity: 0.75 },
  copy: { flex: 1, minWidth: 0 },
  label: { ...Typography.cardTitle, fontSize: 16, lineHeight: 22, color: Colors.text },
  note: { ...Typography.bodySmall, color: Colors.textSecondary, flexShrink: 1 },
  changeFocus: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44, marginTop: -12, marginBottom: 10 },
  stackedChangeFocus: { flexDirection: 'column', alignItems: 'flex-start' },
  changeLabel: { ...Typography.label, color: Colors.primary, flex: 1 },
  stackedChangeLabel: { flex: 0 },
  changeHint: { ...Typography.bodySmall, color: Colors.textSecondary },
  reviewTitle: { ...Typography.display, color: Colors.primary, marginBottom: 10 },
  reviewIntro: { ...Typography.body, color: Colors.textSecondary, marginBottom: 20 },
  evidence: { padding: 20, backgroundColor: Colors.primaryLight, borderRadius: Radius.lg },
  metric: { ...Typography.display, fontSize: 52, lineHeight: 60, color: Colors.primary },
  metricLabel: { ...Typography.label, color: Colors.primary, marginTop: 4 },
  comparisonRow: { marginTop: 14 },
  comparisonHeading: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 6 },
  stackedComparison: { flexDirection: 'column', alignItems: 'flex-start', gap: 4 },
  comparisonMetric: { ...Typography.display, fontSize: 40, lineHeight: 48, color: Colors.primary },
  comparisonLabel: { ...Typography.bodySmall, color: Colors.primary, flexShrink: 1 },
  comparisonTrack: { height: 8, borderRadius: 4, backgroundColor: Colors.borderTinted, overflow: 'hidden' },
  comparisonFill: { height: 8, borderRadius: 4, backgroundColor: Colors.primary },
  comparisonControl: { backgroundColor: Colors.textSecondary },
  finding: { ...Typography.bodySmall, color: Colors.textSecondary, marginTop: 12 },
  qualifier: { ...Typography.bodySmall, color: Colors.textSecondary, marginTop: 10 },
  sourceButton: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, alignSelf: 'flex-start', marginTop: 4 },
  sourceLabel: { ...Typography.label, color: Colors.primary, flexShrink: 1 },
  studyDetail: { borderTopWidth: StyleSheet.hairlineWidth, borderColor: Colors.border, paddingTop: 12 },
  detail: { ...Typography.bodySmall, color: Colors.textSecondary },
  citation: { ...Typography.caption, color: Colors.textSecondary, marginTop: 12 },
  linkError: { ...Typography.bodySmall, color: Colors.danger },
  firstStep: { flexDirection: 'row', gap: 12, paddingVertical: 20 },
  firstStepLabel: { ...Typography.eyebrow, color: Colors.accent, marginBottom: 6 },
  stepTitle: { ...Typography.cardTitle, color: Colors.primary, marginBottom: 6 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 52, paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: Colors.border },
  nameLabel: { ...Typography.label, flex: 1, color: Colors.textSecondary },
  nameCopy: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  stackedNameCopy: { flexDirection: 'column', alignItems: 'flex-start', gap: 4 },
  stackedNameLabel: { flex: 0 },
  optional: { ...Typography.bodySmall, color: Colors.textSecondary },
  actions: { gap: 2, paddingTop: 12 },
  dockedActions: { paddingBottom: 4 },
  primary: { minHeight: 54, borderRadius: 30 },
  buttonLabel: { flexShrink: 1, textAlign: 'center' },
});
