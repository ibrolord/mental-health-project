import { useEffect, useRef, useState } from 'react';
import { Share, StyleSheet, Switch, Text, View } from 'react-native';
import { AppButton, AppCard, ChoiceChip, SectionHeader, appUiStyles } from '@/components/AppUI';
import { useAuth } from '@/lib/auth-context';
import { Colors } from '@/lib/constants';
import { supabase } from '@/lib/supabase';

type Style = 'not_set' | 'encouragement' | 'listening' | 'accountability' | 'practical_help' | 'mixed';
type Frequency = 'never' | 'daily' | 'few_times_week' | 'weekly' | 'as_needed';
type Advice = 'ask_first' | 'when_requested' | 'welcome';
type Draft = { support_style: Style; check_in_frequency: Frequency; advice_mode: Advice; celebrate_progress: boolean; gentle_reminders: boolean; acknowledge_setbacks: boolean };

const DEFAULTS: Draft = { support_style: 'not_set', check_in_frequency: 'never', advice_mode: 'when_requested', celebrate_progress: false, gentle_reminders: false, acknowledge_setbacks: false };
const STYLES: [Style, string][] = [['not_set', 'Choose a style'], ['encouragement', 'Encouragement'], ['listening', 'Listen first'], ['accountability', 'Accountability'], ['practical_help', 'Practical help'], ['mixed', 'A mix']];
const FREQUENCIES: [Frequency, string][] = [['never', 'Only when I ask'], ['daily', 'Daily'], ['few_times_week', 'A few times a week'], ['weekly', 'Weekly'], ['as_needed', 'As needed']];
const ADVICE: [Advice, string][] = [['ask_first', 'Ask first'], ['when_requested', 'Only when requested'], ['welcome', 'Welcome']];

export function PartnerSupportPreferences() {
  const { user } = useAuth();
  const ownerId = user?.id ?? null;
  const [draft, setDraft] = useState<Draft>(DEFAULTS);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState('');
  const [savedDraft, setSavedDraft] = useState<Draft | null>(null);
  const [loadingPreferences, setLoadingPreferences] = useState(false);
  const ownerRef = useRef(ownerId);

  useEffect(() => {
    let active = true;
    ownerRef.current = ownerId;
    setDraft({ ...DEFAULTS });
    setSaving(false);
    setStatus('');
    setSavedDraft(null);
    setLoadingPreferences(Boolean(ownerId));
    if (!ownerId) return () => { active = false; };
    void supabase.from('partner_support_preferences').select('*').eq('user_id', ownerId).maybeSingle().then(({ data, error }) => {
      if (!active) return;
      if (error) {
        setStatus('Support preferences could not be loaded.');
        setLoadingPreferences(false);
        return;
      }
      const loaded = data ? (data as Draft) : { ...DEFAULTS };
      setDraft(loaded);
      setSavedDraft(data ? { ...loaded } : null);
      setLoadingPreferences(false);
    });
    return () => { active = false; };
  }, [ownerId]);

  const save = async () => {
    if (!ownerId || saving || loadingPreferences) return;
    const requestedOwner = ownerId;
    const draftToSave = { ...draft };
    setSaving(true);
    const result = await supabase.from('partner_support_preferences').upsert({ user_id: requestedOwner, ...draftToSave, updated_at: new Date().toISOString() });
    if (ownerRef.current === requestedOwner) {
      setStatus(result.error ? 'Preferences were not saved.' : 'Support preferences saved.');
      if (!result.error) setSavedDraft(draftToSave);
      setSaving(false);
    }
  };

  const label = <T extends string>(options: [T, string][], value: T) => options.find(([key]) => key === value)?.[1] ?? value;
  const updateDraft = (next: Draft) => {
    if (saving || loadingPreferences) return;
    setDraft(next);
    setSavedDraft(null);
    setStatus('Save these changes before sharing.');
  };
  const share = async () => {
    if (!savedDraft || saving || loadingPreferences) return;
    try {
      await Share.share({ message: `How I prefer support\n- Style: ${label(STYLES, savedDraft.support_style)}\n- Check-ins: ${label(FREQUENCIES, savedDraft.check_in_frequency)}\n- Advice: ${label(ADVICE, savedDraft.advice_mode)}\n- Celebrate progress: ${savedDraft.celebrate_progress ? 'yes' : 'no'}\n- Gentle reminders: ${savedDraft.gentle_reminders ? 'yes' : 'no'}\n- Acknowledge setbacks: ${savedDraft.acknowledge_setbacks ? 'yes' : 'no'}` });
    } catch {
      setStatus('Sharing is unavailable right now.');
    }
  };

  return <View>
    <SectionHeader title="How I prefer support" description="Private until you choose Share." />
    <AppCard>
      <Text style={styles.label}>Support style</Text><View style={appUiStyles.wrap}>{STYLES.map(([key, copy]) => <ChoiceChip key={key} label={copy} selected={draft.support_style === key} onPress={() => updateDraft({ ...draft, support_style: key })} />)}</View>
      <Text style={styles.label}>Check-ins</Text><View style={appUiStyles.wrap}>{FREQUENCIES.map(([key, copy]) => <ChoiceChip key={key} label={copy} selected={draft.check_in_frequency === key} onPress={() => updateDraft({ ...draft, check_in_frequency: key })} />)}</View>
      <Text style={styles.label}>Advice</Text><View style={appUiStyles.wrap}>{ADVICE.map(([key, copy]) => <ChoiceChip key={key} label={copy} selected={draft.advice_mode === key} onPress={() => updateDraft({ ...draft, advice_mode: key })} />)}</View>
      <Preference label="Celebrate progress" value={draft.celebrate_progress} disabled={loadingPreferences || saving} onChange={(celebrate_progress) => updateDraft({ ...draft, celebrate_progress })} />
      <Preference label="Gentle reminders" value={draft.gentle_reminders} disabled={loadingPreferences || saving} onChange={(gentle_reminders) => updateDraft({ ...draft, gentle_reminders })} />
      <Preference label="Acknowledge setbacks" value={draft.acknowledge_setbacks} disabled={loadingPreferences || saving} onChange={(acknowledge_setbacks) => updateDraft({ ...draft, acknowledge_setbacks })} />
      <View style={styles.actions}><AppButton label={loadingPreferences ? 'Loading…' : 'Save'} loading={saving} disabled={loadingPreferences || saving} onPress={() => void save()} /><AppButton label="Share saved choices" variant="secondary" disabled={!savedDraft || loadingPreferences || saving} onPress={() => void share()} /></View>
      {status ? <Text style={[appUiStyles.muted, styles.status]}>{status}</Text> : null}
    </AppCard>
  </View>;
}

function Preference({ label, value, disabled, onChange }: { label: string; value: boolean; disabled: boolean; onChange: (value: boolean) => void }) {
  return <View style={styles.preference}><Text style={styles.preferenceText}>{label}</Text><Switch value={value} disabled={disabled} onValueChange={onChange} trackColor={{ false: Colors.border, true: Colors.sage }} /></View>;
}

const styles = StyleSheet.create({
  label: { color: Colors.textSecondary, fontSize: 12, fontWeight: '700', marginTop: 12, marginBottom: 8 },
  preference: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border, paddingVertical: 10, marginTop: 8 },
  preferenceText: { color: Colors.text, fontSize: 14, flex: 1 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  status: { marginTop: 10 },
});
