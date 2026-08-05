'use client';

import { useEffect, useRef, useState } from 'react';
import { format } from 'date-fns';
import { Moon, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase/client';
import {
  deviceTimezoneName,
  formatStoredSleepClock,
  nullableBoundedInteger,
  parseSleepLocalDateTime,
  validSleepSequence,
} from '@/lib/wellbeing/sleep-entry';

type SleepEntry = {
  id: string;
  entry_date: string;
  went_to_bed_at: string | null;
  tried_to_sleep_at: string | null;
  fell_asleep_at: string | null;
  woke_up_at: string | null;
  got_out_of_bed_at: string | null;
  awakenings: number | null;
  awake_minutes: number | null;
  nap_minutes: number | null;
  timezone_offset_minutes: number | null;
  timezone_name: string | null;
  notes: string;
};

const initialDraft = () => ({
  entryDate: format(new Date(), 'yyyy-MM-dd'),
  wentToBedAt: '',
  triedToSleepAt: '',
  fellAsleepAt: '',
  wokeUpAt: '',
  gotOutOfBedAt: '',
  awakenings: '',
  awakeMinutes: '',
  napMinutes: '',
  notes: '',
});

export function SleepDiary() {
  const { user, loading: authLoading } = useAuth();
  const [entries, setEntries] = useState<SleepEntry[]>([]);
  const [draft, setDraft] = useState(initialDraft);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const ownerRef = useRef<string | null>(user?.id ?? null);

  const load = async (ownerId: string) => {
    const result = await supabase
      .from('sleep_diary_entries')
      .select('id, entry_date, went_to_bed_at, tried_to_sleep_at, fell_asleep_at, woke_up_at, got_out_of_bed_at, awakenings, awake_minutes, nap_minutes, timezone_offset_minutes, timezone_name, notes')
      .eq('user_id', ownerId)
      .order('entry_date', { ascending: false })
      .limit(14);
    if (ownerRef.current !== ownerId) return;
    if (result.error) setError('Sleep entries could not be loaded.');
    else setEntries((result.data ?? []) as SleepEntry[]);
  };

  useEffect(() => {
    const ownerId = user?.id ?? null;
    ownerRef.current = ownerId;
    setEntries([]);
    setDraft(initialDraft());
    setOpen(false);
    setSaving(false);
    setError('');
    setStatus('');
    if (!authLoading && ownerId) void load(ownerId);
  }, [authLoading, user?.id]);

  const save = async () => {
    if (!user || saving) return;
    const ownerId = user.id;
    const enteredTimes = [
      draft.wentToBedAt,
      draft.triedToSleepAt,
      draft.fellAsleepAt,
      draft.wokeUpAt,
      draft.gotOutOfBedAt,
    ];
    const parsedTimes = enteredTimes.map((value) =>
      value.trim() ? parseSleepLocalDateTime(value) : null
    );
    if (enteredTimes.some((value, index) => value.trim() && !parsedTimes[index])) {
      return setError(
        'Check each date and time. Times skipped or repeated by daylight saving cannot be saved.'
      );
    }
    const [bedtime, triedToSleep, fellAsleep, wake, gotOutOfBed] = parsedTimes.map(
      (value) => value?.iso ?? null
    );
    if (!validSleepSequence([bedtime, triedToSleep, fellAsleep, wake, gotOutOfBed])) {
      return setError('Sleep times must be in order.');
    }
    setSaving(true);
    setError('');
    setStatus('');
    const awakenings = nullableBoundedInteger(draft.awakenings, 50);
    const awakeMinutes = nullableBoundedInteger(draft.awakeMinutes, 1440);
    const napMinutes = nullableBoundedInteger(draft.napMinutes, 1440);
    if (awakenings === undefined || awakeMinutes === undefined || napMinutes === undefined) {
      setSaving(false);
      return setError('Counts and minutes must be whole numbers within the shown range.');
    }
    const result = await supabase.from('sleep_diary_entries').upsert(
      {
        user_id: ownerId,
        entry_date: draft.entryDate,
        went_to_bed_at: bedtime,
        tried_to_sleep_at: triedToSleep,
        fell_asleep_at: fellAsleep,
        woke_up_at: wake,
        got_out_of_bed_at: gotOutOfBed,
        awakenings,
        awake_minutes: awakeMinutes,
        nap_minutes: napMinutes,
        timezone_offset_minutes:
          parsedTimes.find((value) => value !== null)?.timezoneOffsetMinutes ?? null,
        timezone_name: parsedTimes.some((value) => value !== null)
          ? deviceTimezoneName()
          : null,
        notes: draft.notes.trim().slice(0, 2000),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,entry_date' }
    );
    if (ownerRef.current !== ownerId) return;
    if (result.error) setError('This sleep entry was not saved.');
    else {
      setDraft(initialDraft());
      setOpen(false);
      setStatus('Sleep entry saved.');
      await load(ownerId);
    }
    setSaving(false);
  };

  const remove = async (id: string) => {
    const ownerId = user?.id;
    if (!ownerId) return;
    const result = await supabase
      .from('sleep_diary_entries')
      .delete()
      .eq('id', id)
      .eq('user_id', ownerId);
    if (ownerRef.current !== ownerId) return;
    if (result.error) setError('This entry could not be deleted.');
    else setEntries((current) => current.filter((entry) => entry.id !== id));
  };

  return (
    <section className="app-panel p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            <Moon className="h-4 w-4" aria-hidden="true" /> Sleep diary
          </p>
          <h2 className="mt-2 font-display text-2xl font-medium">Record what happened.</h2>
          <p className="mt-1 text-sm text-muted-foreground">A factual log to review yourself or bring to an appointment.</p>
        </div>
        <Button type="button" variant="outline" onClick={() => setOpen((value) => !value)}>
          {open ? 'Close' : 'Add sleep entry'}
        </Button>
      </div>

      {open && (
        <div className="mt-5 grid gap-4 rounded-2xl border border-border bg-background p-4 sm:grid-cols-2">
          <Field label="Entry date"><Input type="date" value={draft.entryDate} onChange={(event) => setDraft({ ...draft, entryDate: event.target.value })} /></Field>
          <div />
          <Field label="Went to bed"><Input type="datetime-local" value={draft.wentToBedAt} onChange={(event) => setDraft({ ...draft, wentToBedAt: event.target.value })} /></Field>
          <Field label="Tried to sleep"><Input type="datetime-local" value={draft.triedToSleepAt} onChange={(event) => setDraft({ ...draft, triedToSleepAt: event.target.value })} /></Field>
          <Field label="Fell asleep (best estimate)"><Input type="datetime-local" value={draft.fellAsleepAt} onChange={(event) => setDraft({ ...draft, fellAsleepAt: event.target.value })} /></Field>
          <Field label="Woke up"><Input type="datetime-local" value={draft.wokeUpAt} onChange={(event) => setDraft({ ...draft, wokeUpAt: event.target.value })} /></Field>
          <Field label="Got out of bed"><Input type="datetime-local" value={draft.gotOutOfBedAt} onChange={(event) => setDraft({ ...draft, gotOutOfBedAt: event.target.value })} /></Field>
          <Field label="Number of awakenings"><Input inputMode="numeric" value={draft.awakenings} onChange={(event) => setDraft({ ...draft, awakenings: event.target.value })} /></Field>
          <Field label="Minutes awake overnight"><Input inputMode="numeric" value={draft.awakeMinutes} onChange={(event) => setDraft({ ...draft, awakeMinutes: event.target.value })} /></Field>
          <Field label="Nap minutes"><Input inputMode="numeric" value={draft.napMinutes} onChange={(event) => setDraft({ ...draft, napMinutes: event.target.value })} /></Field>
          <div className="sm:col-span-2"><Label htmlFor="sleep-notes">Notes (optional)</Label><Textarea id="sleep-notes" className="mt-1" maxLength={2000} value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} /></div>
          <div className="sm:col-span-2"><Button type="button" onClick={save} disabled={saving || !draft.entryDate}>{saving ? 'Saving…' : 'Save entry'}</Button></div>
        </div>
      )}

      {error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
      {status && <p role="status" className="mt-3 text-sm text-primary">{status}</p>}
      <div className="mt-5 space-y-2">
        {entries.length === 0 ? <p className="text-sm text-muted-foreground">No sleep entries yet.</p> : entries.map((entry) => (
          <div key={entry.id} className="flex items-start justify-between gap-3 rounded-xl border border-border bg-background p-3">
            <div>
              <p className="font-medium">{entry.entry_date}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {entry.went_to_bed_at ? formatStoredSleepClock(entry.went_to_bed_at, entry.timezone_name, entry.timezone_offset_minutes) ?? 'Bedtime unavailable' : 'Bedtime not entered'} · {entry.woke_up_at ? formatStoredSleepClock(entry.woke_up_at, entry.timezone_name, entry.timezone_offset_minutes) ?? 'Wake time unavailable' : 'Wake time not entered'} · {entry.awakenings === null ? 'Awakenings not entered' : `${entry.awakenings} awakenings`}
              </p>
            </div>
            <Button type="button" size="icon" variant="ghost" aria-label={`Delete sleep entry for ${entry.entry_date}`} onClick={() => void remove(entry.id)}><Trash2 className="h-4 w-4" /></Button>
          </div>
        ))}
      </div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="grid gap-1 text-sm font-medium">{label}{children}</label>;
}
