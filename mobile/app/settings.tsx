import { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, Switch, Platform, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth-context';
import { useDataContext } from '@/lib/hooks/use-data-context';
import { apiRequest } from '@/lib/api';
import { Colors } from '@/lib/constants';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import {
  areRemindersEnabled,
  setRemindersEnabled,
  getReminderTimes,
  setReminderTimes,
} from '@/lib/notifications';
import { hasAiDataSharingConsent, resetAiDataSharingConsent, PRIVACY_POLICY_URL } from '@/lib/ai-consent';
import { clearStoredAcquisitionAttribution } from '@/lib/acquisition';
import { SUPPORT_EMAIL, SUPPORT_EMAIL_URL, SUPPORT_URL } from '@/lib/support';

const HOUR_OPTIONS = [
  { label: '7 AM', value: 7 },
  { label: '8 AM', value: 8 },
  { label: '9 AM', value: 9 },
  { label: '10 AM', value: 10 },
  { label: '12 PM', value: 12 },
  { label: '2 PM', value: 14 },
  { label: '5 PM', value: 17 },
  { label: '8 PM', value: 20 },
  { label: '9 PM', value: 21 },
];

export default function SettingsScreen() {
  const router = useRouter();
  const {
    user,
    signOut,
    isAnonymous,
    accountUpgradePending,
    deleteAccount,
  } = useAuth();
  const { query } = useDataContext();
  const [loading, setLoading] = useState(false);
  const [remindersOn, setRemindersOn] = useState(false);
  const [selectedTimes, setSelectedTimes] = useState<number[]>([9, 14, 20]);
  const [aiConsentGranted, setAiConsentGranted] = useState(false);

  useEffect(() => {
    (async () => {
      setRemindersOn(await areRemindersEnabled());
      setSelectedTimes(await getReminderTimes());
      setAiConsentGranted(await hasAiDataSharingConsent());
    })();
  }, []);

  const toggleReminders = async (val: boolean) => {
    setRemindersOn(val);
    await setRemindersEnabled(val);
  };

  const toggleTime = async (hour: number) => {
    let next: number[];
    if (selectedTimes.includes(hour)) {
      next = selectedTimes.filter((h) => h !== hour);
    } else {
      next = [...selectedTimes, hour].sort((a, b) => a - b);
    }
    if (next.length === 0) return; // Must keep at least one
    setSelectedTimes(next);
    await setReminderTimes(next);
  };

  const handleExport = async () => {
    if (!query) return;
    setLoading(true);
    try {
      const exportData = await apiRequest('/api/data/export', {});
      const data = JSON.stringify(exportData, null, 2);

      const path = `${FileSystem.documentDirectory}mental-health-data.json`;
      await FileSystem.writeAsStringAsync(path, data);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(path);
      }
    } catch {
      Alert.alert('Error', 'Failed to export data');
    }
    setLoading(false);
  };

  const handleDeleteAll = async () => {
    if (!query) return;
    Alert.alert(
      'Delete All Data?',
      'This will permanently delete all your check-ins, assessments, goals, habits, chat history, favorites, AI reports, and acquisition attribution. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Everything',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              await clearStoredAcquisitionAttribution();
              const result = await apiRequest('/api/data/delete', {});
              if (!result?.deleted) throw new Error(result?.error || 'Deletion failed');
              Alert.alert('Done', 'All data deleted.');
            } catch {
              Alert.alert('Error', 'Data could not be fully deleted. Please try again or contact support.');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleDeleteAccount = async () => {
    if (isAnonymous || !user) return;

    Alert.alert(
      'Delete Account?',
      'This will permanently delete your account and all associated data. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Account',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              await deleteAccount();
              Alert.alert('Account Deleted', 'Your account and associated data have been deleted.');
            } catch (e) {
              Alert.alert(
                'Error',
                e instanceof Error ? e.message : 'Failed to delete account. Please try again or contact support.'
              );
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleRevokeAiConsent = () => {
    Alert.alert(
      'Revoke AI Consent?',
      'AI chat, voice support, and AI affirmations will ask for consent again before sending text, audio, or personal context to third-party AI providers.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Revoke Consent',
          style: 'destructive',
          onPress: async () => {
            await resetAiDataSharingConsent();
            setAiConsentGranted(false);
            Alert.alert('Done', 'AI data sharing consent was revoked.');
          },
        },
      ]
    );
  };

  const openSupportLink = (url: string, label: string) => {
    Linking.openURL(url).catch(() => {
      Alert.alert(`Unable to Open ${label}`, url);
    });
  };

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      {/* Account */}
      <View style={s.card}>
        <Text style={s.cardTitle}>Account</Text>
        {accountUpgradePending ? (
          <>
            <Text style={s.bodyText}>Your account setup is waiting to be finished.</Text>
            <Text style={[s.bodyText, { marginTop: 4 }]}>
              Use the confirmation email to create your password, then return here. Your saved data remains attached to this profile.
            </Text>
            <TouchableOpacity style={s.btn} onPress={() => router.push('/auth/signup')}>
              <Text style={s.btnText}>Finish Account Setup</Text>
            </TouchableOpacity>
          </>
        ) : isAnonymous ? (
          <>
            <Text style={s.bodyText}>You are using the app anonymously.</Text>
            <Text style={[s.bodyText, { marginTop: 4 }]}>
              Turn this profile into an account to sync across devices without losing saved data.
            </Text>
            <TouchableOpacity style={s.btn} onPress={() => router.push('/auth/signup')}>
              <Text style={s.btnText}>Create Account</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.btnOutline} onPress={() => router.push('/auth/login')}>
              <Text style={s.btnOutlineText}>Sign In to an Existing Account</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={s.bodyText}>Email: {user?.email}</Text>
            <Text style={[s.bodyText, { marginTop: 4 }]}>Your data is synced across devices.</Text>
            <TouchableOpacity style={s.btnOutline} onPress={signOut}>
              <Text style={s.btnOutlineText}>Sign Out</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* Notifications remain Android-only while the incompatible iOS native
          modules stay excluded from release builds. */}
      {Platform.OS !== 'ios' ? (
        <View style={s.card}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <Text style={s.cardTitle}>Local Reminders</Text>
            <Switch
              value={remindersOn}
              onValueChange={toggleReminders}
              trackColor={{ false: '#d1d5db', true: Colors.primary }}
              thumbColor="#fff"
            />
          </View>
          <Text style={s.bodyText}>Optional, private reminders for the steps you plan.</Text>

          {remindersOn && (
            <View style={{ marginTop: 14 }}>
              <Text style={[s.bodyText, { fontWeight: '500', marginBottom: 8 }]}>Reminder times:</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {HOUR_OPTIONS.map((opt) => {
                  const selected = selectedTimes.includes(opt.value);
                  return (
                    <TouchableOpacity
                      key={opt.value}
                      onPress={() => toggleTime(opt.value)}
                      style={[
                        s.timePill,
                        selected && { backgroundColor: Colors.primary, borderColor: Colors.primary },
                      ]}
                    >
                      <Text style={[s.timePillText, selected && { color: '#fff' }]}>{opt.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}
        </View>
      ) : (
        <View style={s.card}>
          <Text style={s.cardTitle}>Local Reminders</Text>
          <Text style={s.bodyText}>
            iPhone reminders are not available in this release. Your habits and plans still work without them.
          </Text>
        </View>
      )}

      {/* Export */}
      <View style={s.card}>
        <Text style={s.cardTitle}>Export Your Data</Text>
        <Text style={s.bodyText}>Download all your mental health data in JSON format.</Text>
        <TouchableOpacity style={s.btnOutline} onPress={handleExport} disabled={loading}>
          <Text style={s.btnOutlineText}>{loading ? 'Exporting...' : 'Export Data (JSON)'}</Text>
        </TouchableOpacity>
      </View>

      {/* Privacy */}
      <View style={s.card}>
        <Text style={s.cardTitle}>Privacy & Data Protection</Text>
        <Text style={s.privacyItem}>All data is encrypted at rest</Text>
        <Text style={s.privacyItem}>We never sell your data or share it for advertising</Text>
        <Text style={s.privacyItem}>AI features ask before sending chat text, voice audio/transcripts, or optional mood and goal context to Google Gemini, Anthropic Claude, or OpenAI through MHtoolkit</Text>
        <Text style={s.privacyItem}>Anonymous usage requires no personal info</Text>
        <Text style={s.privacyItem}>Export or delete your data anytime</Text>
        <Text style={[s.privacyItem, { marginTop: 6 }]}>
          AI data sharing consent: {aiConsentGranted ? 'Granted' : 'Not granted yet'}
        </Text>
        {aiConsentGranted && (
          <TouchableOpacity style={s.btnOutline} onPress={handleRevokeAiConsent}>
            <Text style={s.btnOutlineText}>Revoke AI Consent</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={s.btnOutline}
          onPress={() => Linking.openURL(PRIVACY_POLICY_URL).catch(() => {
            Alert.alert('Unable to Open Privacy Policy', PRIVACY_POLICY_URL);
          })}
        >
          <Text style={s.btnOutlineText}>View Privacy Policy</Text>
        </TouchableOpacity>
      </View>

      {/* Support */}
      <View style={s.card}>
        <Text style={s.cardTitle}>Support & Feedback</Text>
        <Text style={s.bodyText}>
          Questions, feedback, or an app issue? Contact the MHtoolkit developer directly.
        </Text>
        <Text style={s.supportEmail}>{SUPPORT_EMAIL}</Text>
        <TouchableOpacity
          style={s.btnOutline}
          onPress={() => openSupportLink(SUPPORT_EMAIL_URL, 'Email')}
          accessibilityRole="button"
          accessibilityLabel={`Email MHtoolkit support at ${SUPPORT_EMAIL}`}
        >
          <Text style={s.btnOutlineText}>Email Support & Feedback</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={s.btnOutline}
          onPress={() => openSupportLink(SUPPORT_URL, 'Support Page')}
          accessibilityRole="button"
          accessibilityLabel="Open MHtoolkit support and crisis resources"
        >
          <Text style={s.btnOutlineText}>View Support & Crisis Resources</Text>
        </TouchableOpacity>
      </View>

      {/* Danger Zone */}
      <View style={[s.card, { backgroundColor: Colors.dangerLight, borderWidth: 1, borderColor: '#fecaca' }]}>
        <Text style={[s.cardTitle, { color: Colors.danger }]}>Danger Zone</Text>
        <Text style={[s.bodyText, { color: '#991b1b' }]}>Permanently delete all your data. This cannot be undone.</Text>
        <TouchableOpacity style={s.dangerBtn} onPress={handleDeleteAll} disabled={loading}>
          <Text style={s.dangerBtnText}>Delete All Data</Text>
        </TouchableOpacity>
        {!isAnonymous && (
          <>
            <Text style={[s.bodyText, { color: '#991b1b', marginTop: 16 }]}>
              Permanently delete your account and all associated data.
            </Text>
            <TouchableOpacity style={s.dangerBtnOutline} onPress={handleDeleteAccount} disabled={loading}>
              <Text style={s.dangerBtnOutlineText}>Delete Account</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* Disclaimer */}
      <View style={[s.card, { backgroundColor: '#eff6ff' }]}>
        <Text style={{ fontSize: 13, color: Colors.textSecondary, lineHeight: 20, textAlign: 'center' }}>
          This app is a self-help tool, not a replacement for professional therapy. If you are in immediate danger, contact local emergency services. Crisis resources are available on the MHtoolkit support page.
        </Text>
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 16, paddingBottom: 40 },
  card: { backgroundColor: Colors.card, borderRadius: 16, padding: 20, marginBottom: 14, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  cardTitle: { fontSize: 18, fontWeight: '600', color: Colors.text, marginBottom: 10 },
  bodyText: { fontSize: 14, color: Colors.textSecondary, lineHeight: 20 },
  supportEmail: { fontSize: 14, color: Colors.primary, fontWeight: '600', marginTop: 10 },
  privacyItem: { fontSize: 14, color: Colors.textSecondary, marginBottom: 8, lineHeight: 20 },
  btn: { backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 14 },
  btnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  btnOutline: { borderWidth: 1, borderColor: Colors.border, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 14 },
  btnOutlineText: { color: Colors.text, fontWeight: '500', fontSize: 15 },
  dangerBtn: { backgroundColor: Colors.danger, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 14 },
  dangerBtnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  dangerBtnOutline: { borderWidth: 1, borderColor: Colors.danger, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 14 },
  dangerBtnOutlineText: { color: Colors.danger, fontWeight: '600', fontSize: 15 },
  timePill: { borderWidth: 1, borderColor: Colors.border, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 },
  timePillText: { fontSize: 13, fontWeight: '500', color: Colors.text },
});
