'use client';

import { useEffect, useRef, useState } from 'react';
import { HeartHandshake } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase/client';
import type { PartnerAdviceMode, PartnerCheckInFrequency, PartnerSupportStyle } from '@/lib/supabase/types';

type Draft = {
  support_style: PartnerSupportStyle;
  check_in_frequency: PartnerCheckInFrequency;
  advice_mode: PartnerAdviceMode;
  celebrate_progress: boolean;
  gentle_reminders: boolean;
  acknowledge_setbacks: boolean;
};

const DEFAULTS: Draft = {
  support_style: 'not_set',
  check_in_frequency: 'never',
  advice_mode: 'when_requested',
  celebrate_progress: false,
  gentle_reminders: false,
  acknowledge_setbacks: false,
};

const SUPPORT_STYLES: Array<[PartnerSupportStyle, string]> = [
  ['not_set', 'Choose a style'],
  ['encouragement', 'Encouragement'], ['listening', 'Listen first'],
  ['accountability', 'Accountability'], ['practical_help', 'Practical help'], ['mixed', 'A mix'],
];
const FREQUENCIES: Array<[PartnerCheckInFrequency, string]> = [
  ['never', 'Only when I ask'], ['daily', 'Daily'], ['few_times_week', 'A few times a week'],
  ['weekly', 'Weekly'], ['as_needed', 'As needed'],
];
const ADVICE: Array<[PartnerAdviceMode, string]> = [
  ['ask_first', 'Ask before advice'], ['when_requested', 'Only when requested'], ['welcome', 'Advice is welcome'],
];

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
    setStatus('');
    const result = await supabase.from('partner_support_preferences').upsert({
      user_id: requestedOwner,
      ...draftToSave,
      updated_at: new Date().toISOString(),
    });
    if (ownerRef.current === requestedOwner) {
      setStatus(result.error ? 'Preferences were not saved.' : 'Support preferences saved.');
      if (!result.error) setSavedDraft(draftToSave);
      setSaving(false);
    }
  };

  const updateDraft = (next: Draft) => {
    if (saving || loadingPreferences) return;
    setDraft(next);
    setSavedDraft(null);
    setStatus('Save these changes before sharing.');
  };

  const share = async () => {
    if (!savedDraft || saving || loadingPreferences) return;
    const summary = `How I prefer support\n- Style: ${labelFor(SUPPORT_STYLES, savedDraft.support_style)}\n- Check-ins: ${labelFor(FREQUENCIES, savedDraft.check_in_frequency)}\n- Advice: ${labelFor(ADVICE, savedDraft.advice_mode)}\n- Celebrate progress: ${savedDraft.celebrate_progress ? 'yes' : 'no'}\n- Gentle reminders: ${savedDraft.gentle_reminders ? 'yes' : 'no'}\n- Acknowledge setbacks without judgment: ${savedDraft.acknowledge_setbacks ? 'yes' : 'no'}`;
    try {
      if (navigator.share) await navigator.share({ title: 'How I prefer support', text: summary });
      else {
        await navigator.clipboard.writeText(summary);
        setStatus('Copied. You choose who receives it.');
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      setStatus('Sharing is unavailable right now.');
    }
  };

  return (
    <section className="app-panel mb-6 p-5">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-secondary"><HeartHandshake className="h-5 w-5" /></span>
        <div><h2 className="font-display text-2xl font-medium">How I prefer support</h2><p className="mt-1 text-sm text-muted-foreground">Private until you choose Share.</p></div>
      </div>
      <div className="mt-5 grid gap-4 md:grid-cols-3">
        <Choice label="Support style" value={draft.support_style} options={SUPPORT_STYLES} disabled={loadingPreferences || saving} onChange={(support_style) => updateDraft({ ...draft, support_style })} />
        <Choice label="Check-ins" value={draft.check_in_frequency} options={FREQUENCIES} disabled={loadingPreferences || saving} onChange={(check_in_frequency) => updateDraft({ ...draft, check_in_frequency })} />
        <Choice label="Advice" value={draft.advice_mode} options={ADVICE} disabled={loadingPreferences || saving} onChange={(advice_mode) => updateDraft({ ...draft, advice_mode })} />
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Toggle label="Celebrate progress" checked={draft.celebrate_progress} disabled={loadingPreferences || saving} onChange={(celebrate_progress) => updateDraft({ ...draft, celebrate_progress })} />
        <Toggle label="Gentle reminders" checked={draft.gentle_reminders} disabled={loadingPreferences || saving} onChange={(gentle_reminders) => updateDraft({ ...draft, gentle_reminders })} />
        <Toggle label="Acknowledge setbacks" checked={draft.acknowledge_setbacks} disabled={loadingPreferences || saving} onChange={(acknowledge_setbacks) => updateDraft({ ...draft, acknowledge_setbacks })} />
      </div>
      <div className="mt-5 flex flex-wrap gap-2"><Button onClick={save} disabled={saving || loadingPreferences}>{loadingPreferences ? 'Loading…' : saving ? 'Saving…' : 'Save preferences'}</Button><Button variant="outline" onClick={share} disabled={!savedDraft || saving || loadingPreferences}>Share saved choices</Button></div>
      {status && <p role="status" className="mt-3 text-sm text-muted-foreground">{status}</p>}
    </section>
  );
}

function labelFor<T extends string>(options: Array<[T, string]>, value: T) { return options.find(([key]) => key === value)?.[1] ?? value; }

function Choice<T extends string>({ label, value, options, disabled, onChange }: { label: string; value: T; options: Array<[T, string]>; disabled: boolean; onChange: (value: T) => void }) {
  return <div><Label>{label}</Label><select value={value} disabled={disabled} onChange={(event) => onChange(event.target.value as T)} className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm">{options.map(([key, copy]) => <option key={key} value={key}>{copy}</option>)}</select></div>;
}

function Toggle({ label, checked, disabled, onChange }: { label: string; checked: boolean; disabled: boolean; onChange: (value: boolean) => void }) {
  return <label className="flex items-center gap-2 rounded-full border border-border px-3 py-2 text-sm"><input type="checkbox" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} />{label}</label>;
}
