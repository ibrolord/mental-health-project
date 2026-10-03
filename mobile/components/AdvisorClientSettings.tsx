import { useEffect, useRef, useState } from 'react';
import DateTimePicker from '@react-native-community/datetimepicker';
import { ActivityIndicator, Platform, StyleSheet, Switch, Text, View } from 'react-native';
import type { AdvisorClientPreferences } from '@/lib/advisor-client-core';
import {
  readAdvisorClientPreferences,
  updateAdvisorClientPreferences,
} from '@/lib/advisor-client-runtime';
import { Colors, Spacing, Typography } from '@/lib/constants';
import { AppButton, AppCard, InlineStatus } from './AppUI';

const DEFAULTS: AdvisorClientPreferences = {
  enabled: false,
  quietStartHour: 21,
  quietEndHour: 8,
  pausedUntil: null,
};
type QuietField = 'quietStartHour' | 'quietEndHour';
type SaveRecovery = {
  previous: AdvisorClientPreferences;
  syncPending: boolean;
  retryingSync: boolean;
};
const SAVE_ERROR = 'Could not save follow-up settings. Please try again.';
const LOAD_ERROR = 'Could not load follow-up settings. Please retry.';
const SYNC_ERROR = 'Your choice is saved, but device reminders could not update. Retry.';

function persistedChanged(value: AdvisorClientPreferences, recovery: SaveRecovery) {
  return (
    value.enabled !== recovery.previous.enabled ||
    value.quietStartHour !== recovery.previous.quietStartHour ||
    value.quietEndHour !== recovery.previous.quietEndHour ||
    value.pausedUntil !== recovery.previous.pausedUntil
  );
}

function needsNativeSync(value: AdvisorClientPreferences, recovery: SaveRecovery | null) {
  return Boolean(recovery && (recovery.syncPending || persistedChanged(value, recovery)));
}

function recoveryMessage(value: AdvisorClientPreferences, recovery: SaveRecovery) {
  return recovery.retryingSync || persistedChanged(value, recovery) ? SYNC_ERROR : SAVE_ERROR;
}

function hourDate(hour: number) {
  // A fixed date avoids today's daylight-saving transition changing an hour.
  return new Date(2000, 0, 15, hour, 0, 0, 0);
}

function hourLabel(hour: number) {
  return hourDate(hour).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export function AdvisorClientSettings({ ownerKey }: { ownerKey: string }) {
  if (Platform.OS !== 'ios' || !ownerKey.trim()) return null;
  // A new owner gets a fresh form, including picker drafts and in-flight guards.
  return <OwnerSettings key={ownerKey} ownerKey={ownerKey} />;
}

function OwnerSettings({ ownerKey }: { ownerKey: string }) {
  const [preferences, setPreferences] = useState<AdvisorClientPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  const [syncPending, setSyncPending] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [picker, setPicker] = useState<{ field: QuietField; hour: number } | null>(null);
  const sessionRef = useRef<{ active: boolean; saving: boolean; ready: boolean } | null>(null);
  const recoveryRef = useRef<SaveRecovery | null>(null);

  useEffect(() => {
    const session = { active: true, saving: false, ready: false };
    sessionRef.current = session;
    setLoading(true);
    setError('');
    void (async () => {
      try {
        const value = await readAdvisorClientPreferences(ownerKey);
        if (!session.active) return;
        const pending = needsNativeSync(value, recoveryRef.current);
        setPreferences(value);
        setSyncPending(pending);
        setError(recoveryRef.current ? recoveryMessage(value, recoveryRef.current) : '');
        recoveryRef.current = null;
        setUnavailable(false);
        session.ready = true;
      } catch {
        if (session.active) {
          setPreferences(null);
          setUnavailable(true);
          setError(LOAD_ERROR);
        }
      } finally {
        if (session.active) setLoading(false);
      }
    })();
    return () => { session.active = false; };
  }, [ownerKey, reload]);

  const save = async (patch: Partial<AdvisorClientPreferences>, retryingSync = false) => {
    const session = sessionRef.current;
    if (!session?.active || !session.ready || session.saving || loading || !preferences) return;
    // Lock synchronously as native callbacks can repeat before React rerenders.
    session.saving = true;
    setBusy(true);
    setError('');
    try {
      await updateAdvisorClientPreferences(ownerKey, patch);
      if (!session.active) return;
      setPreferences((current) => current ? { ...current, ...patch } : current);
      setPicker(null);
      setSyncPending(false);
      recoveryRef.current = null;
    } catch {
      if (!session.active) return;
      const recovery = { previous: preferences, syncPending, retryingSync };
      recoveryRef.current = recovery;
      try {
        // The runtime may persist the choice before a native operation rejects.
        const persisted = await readAdvisorClientPreferences(ownerKey);
        if (!session.active) return;
        const pending = needsNativeSync(persisted, recovery);
        setPreferences(persisted);
        setSyncPending(pending);
        setError(recoveryMessage(persisted, recovery));
        if (pending) setPicker(null);
        recoveryRef.current = null;
      } catch {
        if (!session.active) return;
        session.ready = false;
        setPreferences(null);
        setPicker(null);
        setUnavailable(true);
        setError(LOAD_ERROR);
      }
    } finally {
      if (session.active) {
        session.saving = false;
        setBusy(false);
      }
    }
  };

  const value = preferences ?? DEFAULTS;
  const disabled = loading || busy || !preferences;
  const paused = Boolean(value.pausedUntil && Date.parse(value.pausedUntil) > Date.now());
  const pauseUntilTomorrow = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(value.quietEndHour, 0, 0, 0);
    void save({ pausedUntil: tomorrow.toISOString() });
  };

  return (
    <AppCard>
      <View style={styles.toggleRow}>
        <View style={styles.copy}>
          <Text style={styles.title}>Follow up on my steps</Text>
          <Text style={styles.body}>A gentle reminder after you start a step.</Text>
        </View>
        {unavailable ? (
          <Text accessibilityLabel="Follow-up settings unavailable" style={styles.note}>Status unavailable</Text>
        ) : <Switch
          accessibilityLabel="Follow up on my steps"
          accessibilityHint="Requires device reminders and Advisor notifications."
          accessibilityState={{ disabled: disabled || Boolean(picker), busy: loading || busy }}
          value={value.enabled}
          disabled={disabled || Boolean(picker)}
          onValueChange={(enabled) => { void save({ enabled }); }}
          trackColor={{ false: Colors.border, true: Colors.primary }}
          thumbColor={Colors.onPrimary}
        />}
      </View>
      <Text style={styles.note}>Requires device reminders and Advisor notifications.</Text>
      <Text style={styles.note}>Background updates depend on iOS and may be delayed.</Text>
      {loading || busy ? (
        <ActivityIndicator
          accessibilityLabel={loading ? 'Loading follow-up settings' : 'Saving follow-up settings'}
          color={Colors.primary}
          style={styles.progress}
        />
      ) : null}
      {preferences?.enabled ? (
        <View style={styles.details}>
          <Text accessibilityRole="header" style={styles.label}>Quiet hours</Text>
          {(['quietStartHour', 'quietEndHour'] as const).map((field) => (
            <AppButton
              key={field}
              label={`${field === 'quietStartHour' ? 'Quiet start' : 'Quiet end'}: ${hourLabel(value[field])}`}
              variant="secondary"
              disabled={disabled || Boolean(picker)}
              onPress={() => {
                if (sessionRef.current?.active && !sessionRef.current.saving) {
                  setError(syncPending ? SYNC_ERROR : '');
                  setPicker({ field, hour: value[field] });
                }
              }}
            />
          ))}
          {picker ? (
            <View style={styles.details}>
              <DateTimePicker
                accessibilityLabel={picker.field === 'quietStartHour' ? 'Quiet start hour' : 'Quiet end hour'}
                value={hourDate(picker.hour)}
                mode="time"
                display="spinner"
                themeVariant="light"
                textColor={Colors.text}
                disabled={disabled}
                onChange={(event, date) => {
                  if (!sessionRef.current?.active || sessionRef.current.saving) return;
                  if (event.type === 'dismissed') setPicker(null);
                  else if (date && !Number.isNaN(date.getTime())) {
                    setPicker({ ...picker, hour: date.getHours() });
                  }
                }}
              />
              <Text style={styles.note}>Quiet hours use whole hours; minutes are ignored.</Text>
              <AppButton
                label="Save time"
                variant="secondary"
                disabled={disabled}
                loading={busy}
                onPress={() => {
                  const other = picker.field === 'quietStartHour' ? value.quietEndHour : value.quietStartHour;
                  if (picker.hour === other) {
                    setError('Choose different quiet start and end hours.');
                    return;
                  }
                  void save({ [picker.field]: picker.hour });
                }}
              />
              <AppButton label="Cancel" variant="text" disabled={busy} onPress={() => {
                setPicker(null);
                setError(syncPending ? SYNC_ERROR : '');
              }} />
            </View>
          ) : null}
          {paused ? (
            <Text style={styles.note}>
              Paused until {new Date(value.pausedUntil!).toLocaleString([], {
                month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
              })}.
            </Text>
          ) : null}
          <AppButton
            label={paused ? 'Resume' : 'Pause until tomorrow'}
            variant="text"
            disabled={disabled || Boolean(picker)}
            onPress={paused ? () => { void save({ pausedUntil: null }); } : pauseUntilTomorrow}
          />
        </View>
      ) : null}
      {error ? <InlineStatus message={error} tone="error" /> : null}
      {unavailable || syncPending ? (
        <AppButton label="Retry" variant="text" disabled={loading || busy || Boolean(picker)} onPress={() => {
          const session = sessionRef.current;
          if (!session?.active || session.saving || loading) return;
          if (preferences && syncPending) void save({ ...preferences }, true);
          else {
            setLoading(true);
            setReload((current) => current + 1);
          }
        }} />
      ) : null}
    </AppCard>
  );
}

const styles = StyleSheet.create({
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  copy: { flex: 1 },
  title: { ...Typography.cardTitle, color: Colors.text },
  body: { ...Typography.bodySmall, color: Colors.textSecondary, marginTop: Spacing.xxs },
  note: { ...Typography.bodySmall, color: Colors.textSecondary, marginTop: Spacing.xs },
  label: { ...Typography.label, color: Colors.text },
  details: { marginTop: Spacing.sm, gap: Spacing.xs },
  progress: { marginTop: Spacing.xs },
});
