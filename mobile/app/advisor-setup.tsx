import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
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

export default function AdvisorSetupScreen() {
  const router = useRouter();
  const { query } = useDataContext();
  const ownerKey = query ? `${query.column}:${query.value}` : null;
  const { profile, ready, loading, error, save } = useAdvisorProfile(ownerKey);
  const [draft, setDraft] = useState<AdvisorProfile>(profile);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState('');

  useEffect(() => {
    if (ready) setDraft(profile);
  }, [profile, ready]);

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
    setSaving(true);
    setStatus('');
    const next = completeAdvisorProfile(useDefaults
      ? { ...profile, preferredName: sanitizeAdvisorName(draft.preferredName) }
      : { ...draft, preferredName: sanitizeAdvisorName(draft.preferredName) });
    const saved = await save(next);
    setSaving(false);
    if (saved) router.dismissTo('/advisor');
    else setStatus('Your setup was not saved. Try again.');
  };

  return (
    <AppScreen>
      <PageHeader
        eyebrow="Set your direction"
        title="Tune Advisor"
        description="Tell Advisor what matters. You can change this anytime."
      />
      {loading ? <InlineStatus tone="info" message="Loading your setup…" /> : null}
      {error || status ? <InlineStatus tone="error" message={status || error} /> : null}

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
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.lg },
  actions: { gap: Spacing.sm, marginTop: Spacing.sm },
  footer: { ...appUiStyles.muted, textAlign: 'center', marginTop: Spacing.md },
});
