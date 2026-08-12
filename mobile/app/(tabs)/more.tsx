import { useEffect, useRef, useState } from 'react';
import { Pressable, Share, StyleSheet, Switch, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { AppScreen, InlineStatus, ListRow, PageHeader, SectionHeader } from '@/components/AppUI';
import { useAuth } from '@/lib/auth-context';
import {
  createDashboardPreferenceWriter,
  dashboardPreferences,
} from '@/lib/dashboard-preferences';
import { Colors, Radius, Spacing, Typography } from '@/lib/constants';

const MEMBER_REFERRAL_URL = 'https://mhtoolkit.vercel.app/?utm_source=referral&utm_medium=referral&utm_campaign=seven_day_check_in&utm_content=member_share';

export default function YouScreen() {
  const router = useRouter();
  const { isAuthenticated, isAnonymous, sessionId, user } = useAuth();
  const ownerValue = isAuthenticated ? user?.id : sessionId;
  const ownerKey = ownerValue
    ? `${isAuthenticated ? 'user_id' : 'session_id'}:${ownerValue}`
    : null;
  const ownerKeyRef = useRef(ownerKey);
  ownerKeyRef.current = ownerKey;
  const [lowEnergyMode, setLowEnergyMode] = useState(false);
  const [preferenceOwnerKey, setPreferenceOwnerKey] = useState<string | null>(null);
  const [preferenceError, setPreferenceError] = useState('');
  const [shareStatus, setShareStatus] = useState('');
  const preferenceWriterRef = useRef(
    createDashboardPreferenceWriter(dashboardPreferences)
  );

  useEffect(() => {
    let active = true;
    setLowEnergyMode(false);
    setPreferenceOwnerKey(null);
    setPreferenceError('');
    preferenceWriterRef.current.invalidate();
    if (!ownerKey) return () => { active = false; };
    void dashboardPreferences.readLowEnergyMode(ownerKey)
      .then((enabled) => {
        if (!active) return;
        preferenceWriterRef.current.hydrate(ownerKey, enabled);
        setLowEnergyMode(enabled);
        setPreferenceOwnerKey(ownerKey);
      })
      .catch(() => {
        if (!active) return;
        setPreferenceOwnerKey(ownerKey);
        setPreferenceError('Could not load this preference.');
      });
    return () => { active = false; };
  }, [ownerKey]);

  const updateLowEnergyMode = async (enabled: boolean) => {
    if (!ownerKey || preferenceOwnerKey !== ownerKey) return;
    const expectedOwnerKey = ownerKey;
    setLowEnergyMode(enabled);
    setPreferenceError('');
    const result = await preferenceWriterRef.current.writeLatest(expectedOwnerKey, enabled);
    if (!result.current || ownerKeyRef.current !== expectedOwnerKey) return;
    setLowEnergyMode(result.persisted);
    if (result.error) {
      setPreferenceError('Could not save this preference.');
    }
  };

  const shareToolkit = async () => {
    setShareStatus('');
    try {
      await Share.share({
        message: `A private toolkit for check-ins, grounding, goals, and reflection. ${MEMBER_REFERRAL_URL}`,
      });
    } catch {
      setShareStatus('Sharing is unavailable right now.');
    }
  };

  return (
    <AppScreen>
      <PageHeader
        eyebrow="Your space"
        title="You"
        description="Account, people, and preferences."
      />

      {isAnonymous ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Sign in or create an account"
          onPress={() => router.push('/auth/login')}
          style={({ pressed }) => [styles.accountCard, pressed && styles.pressed]}
        >
          <View style={styles.accountIcon}>
            <Feather name="user" size={21} color={Colors.primary} />
          </View>
          <View style={styles.accountCopy}>
            <Text style={styles.accountTitle}>Keep your progress with you</Text>
            <Text style={styles.accountDescription}>Sign in or create an account.</Text>
          </View>
          <Feather name="arrow-right" size={20} color={Colors.primary} />
        </Pressable>
      ) : null}

      <SectionHeader title="Account" />
      <View style={styles.list}>
        <ListRow title="Settings and privacy" description="Account, reminders, export, and deletion" icon="settings" onPress={() => router.push('/settings')} />
        <ListRow title="Together & sharing" description="Commitments, check-ins, and partner privacy" icon="heart" onPress={() => router.push('/accountability')} />
        <ListRow title="Support and FAQ" description="Contact us, report a bug, or find an answer" icon="help-circle" onPress={() => router.push('/support')} />
      </View>

      <SectionHeader title="Preferences" />
      <View style={styles.preferenceRow}>
        <View style={styles.preferenceCopy}>
          <Text style={styles.preferenceTitle}>Low-energy Today view</Text>
          <Text style={styles.preferenceDescription}>Keep the home screen focused on one gentle step.</Text>
        </View>
        <Switch
          accessibilityLabel="Low-energy Today view"
          value={lowEnergyMode}
          disabled={!ownerKey || preferenceOwnerKey !== ownerKey}
          onValueChange={(enabled) => void updateLowEnergyMode(enabled)}
          trackColor={{ false: Colors.border, true: Colors.primaryLight }}
          thumbColor={lowEnergyMode ? Colors.primary : Colors.card}
        />
      </View>
      {preferenceError ? <InlineStatus tone="error" message={preferenceError} /> : null}

      <SectionHeader title="Help and evidence" />
      <View style={styles.list}>
        <ListRow title="Find support" description="Country directories and trusted communities" icon="life-buoy" onPress={() => router.push('/resources')} />
        <ListRow title="Research" description="Evidence, sources, and limitations" icon="file-text" onPress={() => router.push('/research')} />
        <ListRow title="Share MHtoolkit" description="Send the public app link without personal data" icon="share-2" onPress={() => void shareToolkit()} />
      </View>
      {shareStatus ? <InlineStatus tone="error" message={shareStatus} /> : null}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open urgent support"
        onPress={() => router.push('/resources')}
        style={({ pressed }) => [styles.supportRow, pressed && styles.pressed]}
      >
        <Feather name="life-buoy" size={19} color={Colors.accent} />
        <Text style={styles.supportText}>Need help now? Open support options.</Text>
        <Feather name="chevron-right" size={19} color={Colors.accent} />
      </Pressable>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  accountCard: {
    minHeight: 92,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderRadius: Radius.lg,
    backgroundColor: Colors.primaryLight,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
  },
  accountIcon: {
    width: 46,
    height: 46,
    borderRadius: Radius.pill,
    backgroundColor: Colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accountCopy: { flex: 1, minWidth: 0 },
  accountTitle: { color: Colors.text, ...Typography.cardTitle },
  accountDescription: { color: Colors.textSecondary, ...Typography.bodySmall, marginTop: Spacing.xxs },
  list: { marginBottom: Spacing.xl },
  preferenceRow: {
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  preferenceCopy: { flex: 1, minWidth: 0 },
  preferenceTitle: { color: Colors.text, ...Typography.cardTitle },
  preferenceDescription: { color: Colors.textSecondary, ...Typography.bodySmall, marginTop: Spacing.xxs },
  supportRow: {
    minHeight: 60,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    paddingVertical: Spacing.sm,
  },
  supportText: { flex: 1, color: Colors.text, ...Typography.bodySmall, fontWeight: '700' },
  pressed: { opacity: 0.78 },
});
