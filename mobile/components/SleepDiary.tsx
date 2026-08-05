import { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { format } from 'date-fns';
import { Feather } from '@expo/vector-icons';
import { AppButton, AppCard, AppInput, SectionHeader, appUiStyles } from '@/components/AppUI';
import { useAuth } from '@/lib/auth-context';
import { Colors } from '@/lib/constants';
import {
  deviceTimezoneName,
  nullableBoundedInteger,
  sleepLocalDateTimeToIso,
  timezoneOffsetForLocalDateTime,
  validSleepSequence,
} from '@/lib/sleep-entry';
import { supabase } from '@/lib/supabase';

type Entry = {
  id: string;
  entry_date: string;
  went_to_bed_at: string | null;
  woke_up_at: string | null;
  awakenings: number | null;
};

const newDraft = () => ({
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
  const { user } = useAuth();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [draft, setDraft] = useState(newDraft);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const ownerRef = useRef<string | null>(user?.id ?? null);

  const load = async (ownerId: string) => {
    const result = await supabase
      .from('sleep_diary_entries')
      .select('id, entry_date, went_to_bed_at, woke_up_at, awakenings')
      .eq('user_id', ownerId)
      .order('entry_date', { ascending: false })
      .limit(7);
    if (ownerRef.current !== ownerId) return;
    if (result.error) setError('Sleep entries could not be loaded.');
    else setEntries((result.data ?? []) as Entry[]);
  };

  useEffect(() => {
    const ownerId = user?.id ?? null;
    ownerRef.current = ownerId;
    setEntries([]);
    setDraft(newDraft());
    setOpen(false);
    setSaving(false);
    setError('');
    if (ownerId) void load(ownerId);
  }, [user?.id]);

  const save = async () => {
    if (!user || saving) return;
    const ownerId = user.id;
    const bedtime = sleepLocalDateTimeToIso(draft.wentToBedAt);
    const triedToSleep = sleepLocalDateTimeToIso(draft.triedToSleepAt);
    const fellAsleep = sleepLocalDateTimeToIso(draft.fellAsleepAt);
    const wakeTime = sleepLocalDateTimeToIso(draft.wokeUpAt);
    const gotOutOfBed = sleepLocalDateTimeToIso(draft.gotOutOfBedAt);
    const sequence = [bedtime, triedToSleep, fellAsleep, wakeTime, gotOutOfBed];
    const enteredValues = [
      [draft.wentToBedAt, bedtime],
      [draft.triedToSleepAt, triedToSleep],
      [draft.fellAsleepAt, fellAsleep],
      [draft.wokeUpAt, wakeTime],
      [draft.gotOutOfBedAt, gotOutOfBed],
    ] as const;
    if (enteredValues.some(([entered, parsed]) => entered.trim() && !parsed)) {
      setError('Use YYYY-MM-DD HH:mm for each time you enter.');
      return;
    }
    if (!validSleepSequence(sequence)) {
      setError('Entered sleep times must be in order.');
      return;
    }
    const awakenings = nullableBoundedInteger(draft.awakenings, 50);
    const awakeMinutes = nullableBoundedInteger(draft.awakeMinutes, 1440);
    const napMinutes = nullableBoundedInteger(draft.napMinutes, 1440);
    if (
      (draft.awakenings.trim() && awakenings === null) ||
      (draft.awakeMinutes.trim() && awakeMinutes === null) ||
      (draft.napMinutes.trim() && napMinutes === null)
    ) {
      setError('Counts and minutes must be whole numbers within the shown range.');
      return;
    }
    setSaving(true);
    setError('');
    const result = await supabase.from('sleep_diary_entries').upsert({
      user_id: ownerId,
      entry_date: draft.entryDate,
      went_to_bed_at: bedtime,
      tried_to_sleep_at: triedToSleep,
      fell_asleep_at: fellAsleep,
      woke_up_at: wakeTime,
      got_out_of_bed_at: gotOutOfBed,
      awakenings,
      awake_minutes: awakeMinutes,
      nap_minutes: napMinutes,
      timezone_offset_minutes:
        enteredValues
          .map(([entered]) => timezoneOffsetForLocalDateTime(entered))
          .find((offset): offset is number => offset !== null) ?? null,
      timezone_name: enteredValues.some(([entered]) => entered.trim())
        ? deviceTimezoneName()
        : null,
      notes: draft.notes.trim().slice(0, 2000),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,entry_date' });
    if (ownerRef.current !== ownerId) return;
    if (result.error) setError('This sleep entry was not saved.');
    else {
      setDraft(newDraft());
      setOpen(false);
      await load(ownerId);
    }
    setSaving(false);
  };

  const remove = (entry: Entry) => Alert.alert('Delete sleep entry?', entry.entry_date, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: async () => {
      const ownerId = user?.id;
      if (!ownerId) return;
      const result = await supabase
        .from('sleep_diary_entries')
        .delete()
        .eq('id', entry.id)
        .eq('user_id', ownerId);
      if (ownerRef.current !== ownerId) return;
      if (result.error) setError('This entry could not be deleted.');
      else setEntries((current) => current.filter((value) => value.id !== entry.id));
    } },
  ]);

  return (
    <View>
      <SectionHeader title="Sleep diary" description="Record what happened. No score or diagnosis." action={<AppButton label={open ? 'Close' : 'Add'} variant="quiet" onPress={() => setOpen((value) => !value)} />} />
      {open ? <AppCard>
        <AppInput label="Wake date" helper="YYYY-MM-DD" value={draft.entryDate} onChangeText={(entryDate) => setDraft({ ...draft, entryDate })} />
        <AppInput label="Went to bed" helper="YYYY-MM-DD HH:mm (optional)" value={draft.wentToBedAt} onChangeText={(wentToBedAt) => setDraft({ ...draft, wentToBedAt })} />
        <AppInput label="Tried to sleep" helper="YYYY-MM-DD HH:mm (optional)" value={draft.triedToSleepAt} onChangeText={(triedToSleepAt) => setDraft({ ...draft, triedToSleepAt })} />
        <AppInput label="Fell asleep" helper="Best estimate, YYYY-MM-DD HH:mm (optional)" value={draft.fellAsleepAt} onChangeText={(fellAsleepAt) => setDraft({ ...draft, fellAsleepAt })} />
        <AppInput label="Woke up" helper="YYYY-MM-DD HH:mm (optional)" value={draft.wokeUpAt} onChangeText={(wokeUpAt) => setDraft({ ...draft, wokeUpAt })} />
        <AppInput label="Got out of bed" helper="YYYY-MM-DD HH:mm (optional)" value={draft.gotOutOfBedAt} onChangeText={(gotOutOfBedAt) => setDraft({ ...draft, gotOutOfBedAt })} />
        <View style={styles.row}>
          <AppInput style={styles.flex} label="Awakenings" keyboardType="number-pad" value={draft.awakenings} onChangeText={(awakenings) => setDraft({ ...draft, awakenings })} />
          <AppInput style={styles.flex} label="Minutes awake" keyboardType="number-pad" value={draft.awakeMinutes} onChangeText={(awakeMinutes) => setDraft({ ...draft, awakeMinutes })} />
        </View>
        <AppInput label="Nap minutes" keyboardType="number-pad" value={draft.napMinutes} onChangeText={(napMinutes) => setDraft({ ...draft, napMinutes })} />
        <AppInput label="Notes (optional)" multiline maxLength={2000} value={draft.notes} onChangeText={(notes) => setDraft({ ...draft, notes })} />
        <AppButton label="Save entry" loading={saving} onPress={() => void save()} />
      </AppCard> : null}
      {error ? <Text style={appUiStyles.error}>{error}</Text> : null}
      {entries.length === 0 ? <AppCard quiet><Text style={appUiStyles.muted}>No sleep entries yet.</Text></AppCard> : entries.map((entry) => (
        <AppCard key={entry.id} quiet>
          <View style={styles.entryRow}>
            <View style={styles.flex}>
              <Text style={styles.entryTitle}>{entry.entry_date}</Text>
              <Text style={appUiStyles.muted}>{entry.awakenings === null ? 'Awakenings not entered' : `${entry.awakenings} awakenings`}</Text>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel={`Delete sleep entry for ${entry.entry_date}`} onPress={() => remove(entry)} style={styles.deleteButton}>
              <Feather name="trash-2" size={17} color={Colors.danger} />
            </Pressable>
          </View>
        </AppCard>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 10 },
  flex: { flex: 1 },
  entryRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  entryTitle: { color: Colors.text, fontSize: 15, fontWeight: '700', marginBottom: 3 },
  deleteButton: { padding: 10 },
});
