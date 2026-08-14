import { useEffect, useRef, useState } from 'react';
import Feather from '@expo/vector-icons/Feather';
import {
  ActivityIndicator,
  AccessibilityInfo,
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { appleHealthPreference } from '@/lib/apple-health-preference';
import {
  APPLE_HEALTH_DATA_LABELS,
  AppleHealthUnavailableError,
  requestAppleHealthReadAccess,
} from '@/lib/apple-health';
import { Colors } from '@/lib/constants';

export function AppleHealthSettingsCard({ ownerId }: { ownerId: string | null }) {
  const ownerIdRef = useRef(ownerId);
  ownerIdRef.current = ownerId;
  const lifecycleGenerationRef = useRef(0);
  const [enabled, setEnabled] = useState(false);
  const [resolvedOwnerId, setResolvedOwnerId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');

  useEffect(() => {
    const lifecycleGeneration = lifecycleGenerationRef.current + 1;
    lifecycleGenerationRef.current = lifecycleGeneration;
    let active = true;
    setLoading(true);
    setResolvedOwnerId(null);
    setStatus('');
    if (!ownerId || Platform.OS !== 'ios') {
      setEnabled(false);
      setLoading(false);
      return () => {
        active = false;
        lifecycleGenerationRef.current += 1;
      };
    }
    const unsubscribe = appleHealthPreference.subscribe(ownerId, (value) => {
      if (active) {
        setEnabled(value);
        setResolvedOwnerId(ownerId);
      }
    });
    void appleHealthPreference
      .read(ownerId)
      .then((value) => {
        if (active) {
          setEnabled(value);
          setResolvedOwnerId(ownerId);
        }
      })
      .catch((error) => {
        console.warn('Unable to load Apple Health preference:', error);
        if (active) setStatus('Apple Health settings could not be loaded.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      lifecycleGenerationRef.current += 1;
      unsubscribe();
    };
  }, [ownerId]);

  if (Platform.OS !== 'ios') return null;

  const announceStatus = (message: string) => {
    setStatus(message);
    AccessibilityInfo.announceForAccessibility(message);
  };

  const enable = async () => {
    if (!ownerId || busy) return;
    const expectedOwnerId = ownerId;
    const expectedGeneration = lifecycleGenerationRef.current;
    const isCurrentRequest = () =>
      ownerIdRef.current === expectedOwnerId &&
      lifecycleGenerationRef.current === expectedGeneration;
    setBusy(true);
    setStatus('');
    try {
      const result = await requestAppleHealthReadAccess();
      if (!result.requestCompleted) {
        throw new Error('Apple Health did not complete the permission request.');
      }
      if (!isCurrentRequest()) return;
      await appleHealthPreference.write(expectedOwnerId, true);
      if (!isCurrentRequest()) {
        await appleHealthPreference.clear(expectedOwnerId);
        return;
      }
      setEnabled(true);
      announceStatus('Apple Health insights are on. Only the categories you allow appear.');
    } catch (error) {
      if (!isCurrentRequest()) return;
      console.warn('Unable to enable Apple Health insights:', error);
      Alert.alert(
        'Apple Health Unavailable',
        error instanceof AppleHealthUnavailableError
          ? error.message
          : 'Apple Health access could not be completed. Please try again.'
      );
    } finally {
      if (isCurrentRequest()) setBusy(false);
    }
  };

  const disable = async () => {
    if (!ownerId || busy) return;
    const expectedOwnerId = ownerId;
    const expectedGeneration = lifecycleGenerationRef.current;
    const isCurrentRequest = () =>
      ownerIdRef.current === expectedOwnerId &&
      lifecycleGenerationRef.current === expectedGeneration;
    setBusy(true);
    setStatus('');
    try {
      await appleHealthPreference.write(expectedOwnerId, false);
      if (!isCurrentRequest()) return;
      setEnabled(false);
      announceStatus('Apple Health insights are hidden in MHtoolkit.');
    } catch (error) {
      if (!isCurrentRequest()) return;
      console.warn('Unable to disable Apple Health insights:', error);
      announceStatus('Apple Health settings could not be updated.');
    } finally {
      if (isCurrentRequest()) setBusy(false);
    }
  };

  return (
    <View style={s.card}>
      <View style={s.titleRow}>
        <View style={s.icon}>
          <Feather name="heart" size={18} color={Colors.primary} />
        </View>
        <View style={s.titleCopy}>
          <Text style={s.title}>Apple Health</Text>
          <Text style={s.body}>See health context beside your mood.</Text>
        </View>
        {loading || resolvedOwnerId !== ownerId ? (
          <ActivityIndicator color={Colors.primary} />
        ) : null}
      </View>

      <Text style={s.categories}>{APPLE_HEALTH_DATA_LABELS.join(' · ')}</Text>
      <View style={s.privateRow}>
        <Feather name="lock" size={14} color={Colors.textSecondary} />
        <Text style={s.privateText}>
          Raw data stays on-device. AI sharing needs approval each time. Never shared with partners.
        </Text>
      </View>

      {!loading && resolvedOwnerId === ownerId ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={enabled ? 'Turn off Apple Health insights' : 'Set up Apple Health insights'}
          accessibilityState={{ disabled: busy, busy }}
          disabled={busy || !ownerId}
          onPress={enabled ? disable : enable}
          style={({ pressed }) => [
            enabled ? s.secondaryButton : s.primaryButton,
            (busy || !ownerId) && s.disabled,
            pressed && !busy && s.pressed,
          ]}
        >
          {busy ? (
            <ActivityIndicator size="small" color={enabled ? Colors.primary : '#fffef8'} />
          ) : null}
          <Text style={enabled ? s.secondaryButtonText : s.primaryButtonText}>
            {enabled ? 'Turn off insights' : 'Set up Apple Health'}
          </Text>
        </Pressable>
      ) : null}
      {enabled && resolvedOwnerId === ownerId ? (
        <Text style={s.manageText}>Manage individual permissions in the Apple Health app.</Text>
      ) : null}
      {status ? (
        <Text accessibilityLiveRegion="polite" style={s.status}>
          {status}
        </Text>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 20,
    marginBottom: 14,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  icon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primaryLight,
  },
  titleCopy: { flex: 1 },
  title: { fontSize: 18, fontWeight: '600', color: Colors.text },
  body: { fontSize: 14, lineHeight: 20, color: Colors.textSecondary, marginTop: 2 },
  categories: { fontSize: 13, lineHeight: 19, color: Colors.text, marginTop: 14 },
  privateRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 10 },
  privateText: { flex: 1, fontSize: 12, lineHeight: 17, color: Colors.textSecondary },
  primaryButton: {
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
  },
  primaryButtonText: { color: '#fffef8', fontWeight: '600', fontSize: 15 },
  secondaryButton: {
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
  },
  secondaryButtonText: { color: Colors.primary, fontWeight: '600', fontSize: 15 },
  manageText: { fontSize: 12, lineHeight: 17, color: Colors.textSecondary, marginTop: 9 },
  status: { fontSize: 13, lineHeight: 18, color: Colors.primary, marginTop: 10 },
  disabled: { opacity: 0.55 },
  pressed: { opacity: 0.78 },
});
