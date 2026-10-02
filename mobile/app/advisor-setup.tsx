import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { AdvisorWelcome } from '@/components/AdvisorWelcome';
import { createWelcomeSaveGate, dismissAdvisorWelcomeForSession, finishAdvisorWelcome, saveAdvisorWelcomeAndOpen, type StartingFocus } from '@/lib/advisor-onboarding';
import {
  AppButton,
  AppInput,
  AppScreen,
  ChoiceChip,
  InlineStatus,
  PageHeader,
  SectionHeader,
  appUiStyles,
} from '@/components/AppUI';
import { useDataContext } from '@/lib/hooks/use-data-context';
import {
  ADVISOR_ESSENTIAL_OPTIONS,
  ADVISOR_FOCUS_OPTIONS,
  ADVISOR_PRIORITY_OPTIONS,
  ADVISOR_STYLE_OPTIONS,
  completeAdvisorProfile,
  prioritiesForAdvisorFocus,
  sanitizeAdvisorName,
  type AdvisorLowEnergyEssential,
  type AdvisorPriority,
  type AdvisorProfile,
} from '@/lib/advisor-profile';
import { useAdvisorProfile } from '@/lib/use-advisor-profile';
import { Spacing } from '@/lib/constants';
import { normalizePersonalPlan, OBSTACLES, type AdvisorPersonalPlan } from '@/lib/onboarding-journey';

export default function AdvisorSetupScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ mode?: string; returnTo?: string }>();
  const { query } = useDataContext();
  const ownerKey = query ? `${query.column}:${query.value}` : null;
  const { profile, ready, loading, error, save } = useAdvisorProfile(ownerKey);
  const [draft, setDraft] = useState<AdvisorProfile>(profile);
  const [draftOwner, setDraftOwner] = useState(ownerKey);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState('');
  const welcome = params.mode === 'welcome';
  const destination = params.returnTo === 'today' ? '/(tabs)' : '/advisor';
  const ownerRef = useRef(ownerKey);
  ownerRef.current = ownerKey;
  const screenActive = useRef(false);
  const visit = useRef(0);
  const saveGate = useRef(createWelcomeSaveGate());

  useFocusEffect(useCallback(() => {
    screenActive.current = true;
    visit.current += 1;
    setStatus('');
    setSaving(saveGate.current.has(ownerKey));
    return () => {
      screenActive.current = false;
      visit.current += 1;
    };
  }, [ownerKey]));

  useEffect(() => {
    if (ready) { setDraft(profile); setDraftOwner(ownerKey); }
  }, [profile, ready, ownerKey]);

  const togglePriority = (priority: AdvisorPriority) => {
    setDraft((current) => {
      if (current.priorities.includes(priority)) {
        if (current.priorities.length === 1) return current;
        return { ...current, priorities: current.priorities.filter((item) => item !== priority) };
      }
      if (current.priorities.length >= 3) return current;
      return { ...current, priorities: [...current.priorities, priority] };
    });
  };

  const toggleEssential = (essential: AdvisorLowEnergyEssential) => {
    setDraft((current) => {
      if (current.lowEnergyEssentials.includes(essential)) {
        if (current.lowEnergyEssentials.length === 1) return current;
        return {
          ...current,
          lowEnergyEssentials: current.lowEnergyEssentials.filter((item) => item !== essential),
        };
      }
      if (current.lowEnergyEssentials.length >= 3) return current;
      return { ...current, lowEnergyEssentials: [...current.lowEnergyEssentials, essential] };
    });
  };

  const finish = async (useDefaults = false) => {
    if (!ready || saving) return;
    const expectedOwner = ownerKey;
    const expectedVisit = visit.current;
    setSaving(true);
    setStatus('');
    const next = completeAdvisorProfile(useDefaults
      ? { ...profile, preferredName: sanitizeAdvisorName(draft.preferredName) }
      : { ...draft, preferredName: sanitizeAdvisorName(draft.preferredName) });
    const saved = await save(next);
    if (!screenActive.current || ownerRef.current !== expectedOwner || visit.current !== expectedVisit) return;
    setSaving(false);
    if (saved) router.dismissTo(destination);
    else setStatus('Your setup was not saved. Try again.');
  };

  const finishWelcome = async (focus: StartingFocus, name: string, personalPlan?: AdvisorPersonalPlan) => {
    if (!ready) return;
    const expectedOwner = ownerKey;
    const operation = saveGate.current.begin(expectedOwner);
    if (!operation) return;
    const expectedVisit = visit.current;
    const isCurrent = () => screenActive.current && ownerRef.current === expectedOwner && visit.current === expectedVisit;
    setSaving(true);
    setStatus('');
    try {
      const result = await saveAdvisorWelcomeAndOpen({ profile, focus, name, personalPlan, save, isCurrent,
        open: (route) => personalPlan ? router.dismissTo('/advisor') : router.replace(route) });
      if (result === 'failed') setStatus('Not saved. Try again, or continue without saving.');
    } finally {
      saveGate.current.finish(expectedOwner, operation);
      if (screenActive.current && ownerRef.current === expectedOwner) setSaving(saveGate.current.has(expectedOwner));
    }
  };

  const skipWelcome = () => {
    // Leaving must never depend on a successful storage write.
    screenActive.current = false;
    visit.current += 1;
    dismissAdvisorWelcomeForSession(ownerKey);
    if (ready && !saveGate.current.has(ownerKey)) void save(finishAdvisorWelcome(profile, null, ''));
    router.dismissTo(destination);
  };

  if (welcome) return (
    <AppScreen scroll={Platform.OS !== 'ios'} contentStyle={[styles.welcomeContent, Platform.OS === 'ios' && styles.iosWelcomeContent]}>
      <Stack.Screen options={{ headerShown: Platform.OS !== 'ios' }} />
      {error || status ? <InlineStatus tone="error" message={status || error} /> : null}
      {loading ? <InlineStatus tone="info" message="Loading your setup..." /> : null}
      <AdvisorWelcome key={`${ownerKey}:${ready}`} name={profile.preferredName} initialPlan={profile.personalPlan} busy={saving} ready={ready}
        onFinish={(focus, name, personalPlan) => void finishWelcome(focus, name, personalPlan)} onSkip={skipWelcome}
        onSupport={() => {
          screenActive.current = false;
          visit.current += 1;
          router.push('/resources');
        }} />
    </AppScreen>
  );

  if (!ready || draftOwner !== ownerKey) return <AppScreen><InlineStatus tone={error ? 'error' : 'info'} message={error || 'Loading your setup...'} /></AppScreen>;
  const personalPlan = draft.personalPlan ?? normalizePersonalPlan(null);
  const updatePlan = (patch: Partial<AdvisorPersonalPlan>) => setDraft((current) => ({
    ...current, personalPlan: { ...(current.personalPlan ?? normalizePersonalPlan(null)), ...patch },
  }));

  return (
    <AppScreen>
      <Stack.Screen options={{ headerShown: true }} />
      <PageHeader
        eyebrow="Set your direction"
        title="Tune Advisor"
        description="Tell Advisor what matters. You can change this anytime."
      />
      {loading ? <InlineStatus tone="info" message="Loading your setup…" /> : null}
      {error || status ? <InlineStatus tone="error" message={status || error} /> : null}
      {Platform.OS === 'ios' ? <AppButton label="Redo guided setup" variant="secondary"
        onPress={() => router.push({ pathname: '/advisor-setup', params: { mode: 'welcome', returnTo: params.returnTo } })} /> : null}

      <SectionHeader title="What should Advisor call you?" description="Optional" />
      <AppInput
        accessibilityLabel="Preferred name"
        placeholder="Your name"
        value={draft.preferredName}
        editable={ready && !saving}
        maxLength={24}
        onChangeText={(value) => setDraft((current) => ({ ...current, preferredName: value }))}
      />

      <SectionHeader title="What are you working toward?" />
      <View style={styles.options}>
        {ADVISOR_FOCUS_OPTIONS.map((option) => (
          <ChoiceChip
            key={option.id}
            label={option.label}
            accessibilityLabel={`${option.label}. ${option.description}`}
            selected={draft.focus === option.id}
            disabled={!ready || saving}
            onPress={() => setDraft((current) => ({
              ...current,
              focus: option.id,
              priorities: prioritiesForAdvisorFocus(option.id),
            }))}
          />
        ))}
      </View>

      {Platform.OS === 'ios' ? <>
        <SectionHeader title="Your personal plan" description="Stored on this device. These answers are not sent to AI." />
        <AppInput accessibilityLabel="Your motivation" label="What matters to you" value={personalPlan.motivation} maxLength={180}
          editable={!saving} onChangeText={(motivation) => updatePlan({ motivation })} />
        <Text style={appUiStyles.body}>What gets in the way?</Text>
        <View style={styles.options}>
          {OBSTACLES.map((option) => <ChoiceChip key={option.id} label={option.label} selected={personalPlan.obstacle === option.id}
            disabled={saving} onPress={() => updatePlan({ obstacle: personalPlan.obstacle === option.id ? null : option.id, obstacleDetail: '' })} />)}
          <ChoiceChip label="Something else" selected={personalPlan.obstacle === 'custom'} disabled={saving}
            onPress={() => updatePlan({ obstacle: personalPlan.obstacle === 'custom' ? null : 'custom' })} />
        </View>
        {personalPlan.obstacle === 'custom' ? <AppInput accessibilityLabel="Your own obstacle" value={personalPlan.obstacleDetail}
          maxLength={180} editable={!saving} onChangeText={(obstacleDetail) => updatePlan({ obstacleDetail })} /> : null}
        <AppInput accessibilityLabel="Your small action" label="One small step" value={personalPlan.action} maxLength={120}
          editable={!saving} onChangeText={(action) => updatePlan({ action })} />
        <AppInput accessibilityLabel="Your timing cue" label="When it fits" placeholder="For example, after breakfast" value={personalPlan.cue}
          maxLength={100} editable={!saving && Boolean(personalPlan.action)} onChangeText={(cue) => updatePlan({ cue })} />
      </> : null}

      <SectionHeader title="Your top priorities" description="Choose up to 3, in the order you tap them." />
      <View style={styles.options}>
        {ADVISOR_PRIORITY_OPTIONS.map((option) => (
          <ChoiceChip
            key={option.id}
            label={draft.priorities.includes(option.id)
              ? `${draft.priorities.indexOf(option.id) + 1}. ${option.label}`
              : option.label}
            selected={draft.priorities.includes(option.id)}
            disabled={!ready || saving}
            onPress={() => togglePriority(option.id)}
          />
        ))}
      </View>

      <SectionHeader title="How should advice feel?" />
      <View style={styles.options}>
        {ADVISOR_STYLE_OPTIONS.map((option) => (
          <ChoiceChip
            key={option.id}
            label={option.label}
            selected={draft.supportStyle === option.id}
            disabled={!ready || saving}
            onPress={() => setDraft((current) => ({ ...current, supportStyle: option.id }))}
          />
        ))}
      </View>

      <SectionHeader
        title="When energy is low"
        description="Choose up to 3 essentials. The first is Advisor's first choice; all stay on Today."
      />
      <View style={styles.options}>
        {ADVISOR_ESSENTIAL_OPTIONS.map((option) => (
          <ChoiceChip
            key={option.id}
            label={option.label}
            selected={draft.lowEnergyEssentials.includes(option.id)}
            disabled={!ready || saving}
            onPress={() => toggleEssential(option.id)}
          />
        ))}
      </View>

      <View style={styles.actions}>
        <AppButton
          label="Save my setup"
          icon="check"
          onPress={() => void finish(false)}
          disabled={!ready || saving}
          loading={saving}
        />
        {!profile.completedAt ? (
          <AppButton
            label="Use a balanced setup"
            variant="secondary"
            onPress={() => void finish(true)}
            disabled={!ready || saving}
          />
        ) : null}
      </View>
      <Text style={styles.footer}>Safety support is never hidden or deprioritized.</Text>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  welcomeContent: { paddingHorizontal: 24, paddingBottom: 16, width: '100%', maxWidth: 600, alignSelf: 'center' },
  iosWelcomeContent: { paddingTop: 0, paddingBottom: 0 },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.lg },
  actions: { gap: Spacing.sm, marginTop: Spacing.sm },
  footer: { ...appUiStyles.muted, textAlign: 'center', marginTop: Spacing.md },
});
