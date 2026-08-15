import { useState, useEffect } from 'react';
import { View, Text, Pressable, StyleSheet, Alert, Switch, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth-context';
import { useDataContext } from '@/lib/hooks/use-data-context';
import { apiRequest } from '@/lib/api';
import { Colors, Radius, Spacing, Typography } from '@/lib/constants';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import {
  areRemindersEnabled,
  setRemindersEnabled,
  getReminderTimes,
  setReminderTimes,
  getNotificationPreferences,
  setNotificationPreferences,
  sendTestNotification,
  clearAllReminders,
  type NotificationCategory,
  type NotificationPreferences,
} from '@/lib/notifications';
import { DEFAULT_NOTIFICATION_PREFERENCES } from '@/lib/notifications-core';
import { hasAiDataSharingConsent, resetAiDataSharingConsent, PRIVACY_POLICY_URL } from '@/lib/ai-consent';
import { clearStoredAcquisitionAttribution } from '@/lib/acquisition';
import {
  FEEDBACK_EMAIL_URL,
  SUPPORT_EMAIL,
  SUPPORT_EMAIL_URL,
  SUPPORT_URL,
} from '@/lib/support';
import { PrivacyActivity } from '@/components/PrivacyActivity';
import { VisitBriefBuilder } from '@/components/VisitBriefBuilder';
import { offlineSafetyPlanCache } from '@/lib/offline-safety-plan-cache';
import { clearFullContextPreference } from '@/lib/full-context-preference';
import { clearContextSelections } from '@/lib/chat-context-preference';
import { clearGoToActions } from '@/lib/go-to-actions-storage';
import { clearAdvisorAction } from '@/lib/advisor-action-storage';
import { advisorBriefStorage } from '@/lib/advisor-brief-storage';
import { clearAdvisorOutcomes } from '@/lib/advisor-outcome-storage';
import { clearAdvisorObservationLedger } from '@/lib/advisor-observation-ledger';
import { clearAdvisorLifecycleJournal } from '@/lib/advisor-lifecycle-runtime';
import { clearReflectionDraft } from '@/lib/reflection-draft-storage';
import { supabase } from '@/lib/supabase';
import { AppleHealthSettingsCard } from '@/components/AppleHealthSettingsCard';
import { appleHealthPreference } from '@/lib/apple-health-preference';
import {
  AppScreen,
  InlineStatus,
  ListRow,
  PageHeader,
  RowGroup,
  SectionHeader,
} from '@/components/AppUI';

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

const NOTIFICATION_OPTIONS: {
  key: NotificationCategory;
  title: string;
  description: string;
}[] = [
  {
    key: 'dailyPlanning',
    title: 'Daily planning',
    description: 'A prompt to choose one realistic priority.',
  },
  {
    key: 'goalReminders',
    title: 'Goal reminders',
    description: 'Alerts you set for your goals.',
  },
  {
    key: 'planReminders',
    title: 'Planner due dates',
    description: 'Target dates from your Life Planner.',
  },
  {
    key: 'routineReminders',
    title: 'Routine reminders',
    description: 'Nudges for routines that are still open.',
  },
  {
    key: 'affirmations',
    title: 'Affirmations',
    description: 'Sourced affirmations or quotes at your selected times.',
  },
  {
    key: 'libraryPicks',
    title: 'Library picks',
    description: 'A recommendation from the MHtoolkit library.',
  },
  {
    key: 'advisorNudges',
    title: 'Advisor check-ins',
    description: 'Daily briefs and follow-ups you explicitly schedule.',
  },
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
  const consentSubjectId = query ? `${query.column}:${query.value}` : '';
  const [loading, setLoading] = useState(false);
  const [remindersOn, setRemindersOn] = useState(false);
  const [selectedTimes, setSelectedTimes] = useState<number[]>([9, 14, 20]);
  const [notificationPreferences, setLocalNotificationPreferences] =
    useState<NotificationPreferences>({ ...DEFAULT_NOTIFICATION_PREFERENCES });
  const [reminderHydrated, setReminderHydrated] = useState(false);
  const [reminderBusy, setReminderBusy] = useState(false);
  const [reminderStatus, setReminderStatus] = useState('');
  const [aiConsentGranted, setAiConsentGranted] = useState(false);
  const [dataGeneration, setDataGeneration] = useState(0);

  const captureOwnerSession = async (expectedOwnerId: string) => {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    if (!data.session || data.session.user.id !== expectedOwnerId) {
      throw new Error('The profile changed. Try again from the current profile.');
    }
    return data.session.access_token;
  };

  useEffect(() => {
    let active = true;
    let reminderSettingsLoaded = false;
    setReminderHydrated(false);
    (async () => {
      try {
        const [enabled, times, preferences] = await Promise.all([
          areRemindersEnabled(),
          getReminderTimes(),
          getNotificationPreferences(),
        ]);
        if (active) {
          setRemindersOn(enabled);
          setSelectedTimes(times);
          setLocalNotificationPreferences(preferences);
          reminderSettingsLoaded = true;
        }
      } catch (error) {
        console.warn('Unable to load local reminder settings:', error);
        if (active) setReminderStatus('Reminder settings could not be loaded.');
      }
      if (active && reminderSettingsLoaded) setReminderHydrated(true);
      const consent = await hasAiDataSharingConsent(consentSubjectId);
      if (active) setAiConsentGranted(consent);
    })();
    return () => {
      active = false;
    };
  }, [consentSubjectId]);

  const toggleReminders = async (val: boolean) => {
    if (reminderBusy) return;
    setReminderBusy(true);
    setReminderStatus('');
    try {
      const enabled = await setRemindersEnabled(val);
      setRemindersOn(enabled);
      if (val && !enabled) {
        Alert.alert(
          'Notifications are off',
          'Allow notifications in device settings to receive reminders.',
          [
            { text: 'Not Now', style: 'cancel' },
            {
              text: 'Open Settings',
              onPress: openNotificationSettings,
            },
          ]
        );
      } else {
        setReminderStatus(
          enabled
            ? 'Notifications are on. You can choose each type below.'
            : 'Notifications are off.'
        );
      }
    } catch (error) {
      console.warn('Unable to update local reminders:', error);
      setRemindersOn(await areRemindersEnabled().catch(() => false));
      Alert.alert('Reminder Error', 'Your reminder settings could not be updated. Please try again.');
    } finally {
      setReminderBusy(false);
    }
  };

  const toggleNotificationCategory = async (
    category: NotificationCategory,
    enabled: boolean
  ) => {
    if (reminderBusy) return;
    const next = { ...notificationPreferences, [category]: enabled };
    setReminderBusy(true);
    setReminderStatus('');
    try {
      const saved = await setNotificationPreferences(next);
      setLocalNotificationPreferences(saved);
      setReminderStatus('Notification choices updated.');
    } catch (error) {
      console.warn('Unable to update notification choices:', error);
      const [preferences, enabled] = await Promise.all([
        getNotificationPreferences().catch(() => notificationPreferences),
        areRemindersEnabled().catch(() => false),
      ]);
      setLocalNotificationPreferences(preferences);
      setRemindersOn(enabled);
      Alert.alert(
        'Notification Error',
        'Your notification choices could not be updated. Please try again.'
      );
    } finally {
      setReminderBusy(false);
    }
  };

  const toggleTime = async (hour: number) => {
    if (reminderBusy) return;
    let next: number[];
    if (selectedTimes.includes(hour)) {
      next = selectedTimes.filter((h) => h !== hour);
    } else {
      next = [...selectedTimes, hour].sort((a, b) => a - b);
    }
    if (next.length === 0) return; // Must keep at least one
    setReminderBusy(true);
    setReminderStatus('');
    try {
      const saved = await setReminderTimes(next);
      setSelectedTimes(saved);
      setReminderStatus('Reminder times updated.');
    } catch (error) {
      console.warn('Unable to update reminder times:', error);
      const [times, enabled] = await Promise.all([
        getReminderTimes().catch(() => selectedTimes),
        areRemindersEnabled().catch(() => false),
      ]);
      setSelectedTimes(times);
      setRemindersOn(enabled);
      Alert.alert('Reminder Error', 'The new reminder times could not be scheduled.');
    } finally {
      setReminderBusy(false);
    }
  };

  const handleTestReminder = async () => {
    if (reminderBusy) return;
    setReminderBusy(true);
    setReminderStatus('');
    try {
      const scheduled = await sendTestNotification();
      if (!scheduled) {
        Alert.alert(
          'Notifications are off',
          'Allow notifications in device settings, then try again.',
          [
            { text: 'Not Now', style: 'cancel' },
            {
              text: 'Open Settings',
              onPress: openNotificationSettings,
            },
          ]
        );
        return;
      }
      setReminderStatus('Test reminder scheduled. It should arrive in a few seconds.');
    } catch (error) {
      console.warn('Unable to send a test reminder:', error);
      Alert.alert('Reminder Error', 'The test reminder could not be scheduled.');
    } finally {
      setReminderBusy(false);
    }
  };

  const handleExport = async () => {
    const expectedOwnerId = user?.id;
    if (!query || !expectedOwnerId) return;
    setLoading(true);
    let exportPath: string | null = null;
    try {
      const accessToken = await captureOwnerSession(expectedOwnerId);
      const exportData = await apiRequest(
        '/api/data/export',
        { expectedUserId: expectedOwnerId },
        { accessToken }
      );
      const data = JSON.stringify(exportData, null, 2);
      if (!FileSystem.cacheDirectory) {
        throw new Error('A private export location is unavailable.');
      }
      exportPath = `${FileSystem.cacheDirectory}mhtoolkit-data-export-${Date.now()}.json`;
      await FileSystem.writeAsStringAsync(exportPath, data);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(exportPath);
      }
    } catch {
      Alert.alert('Error', 'Failed to export data');
    } finally {
      if (exportPath) {
        await FileSystem.deleteAsync(exportPath, { idempotent: true }).catch(
          (error) => console.warn('Unable to remove temporary export:', error)
        );
      }
      setLoading(false);
    }
  };

  const handleDeleteAll = async () => {
    const expectedOwnerId = user?.id;
    if (!query || !expectedOwnerId) return;
    Alert.alert(
      'Delete profile data?',
      'This permanently deletes check-ins, assessments, goals, habits, chat history, files, Together activity, and other data saved in this profile. It does not delete a sign-in account. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete profile data',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              const accessToken = await captureOwnerSession(expectedOwnerId);
              const result = await apiRequest(
                '/api/data/delete',
                { expectedUserId: expectedOwnerId },
                { accessToken }
              );
              if (!result?.deleted) throw new Error(result?.error || 'Deletion failed');
              // Drain the recovery journal before clearing stores it could recreate.
              await clearAdvisorLifecycleJournal(consentSubjectId);
              const cleanup = await Promise.allSettled([
                clearStoredAcquisitionAttribution(),
                resetAiDataSharingConsent(consentSubjectId),
                clearFullContextPreference(consentSubjectId),
                clearContextSelections(consentSubjectId),
                clearGoToActions(consentSubjectId),
                clearAdvisorAction(consentSubjectId),
                advisorBriefStorage.clear(consentSubjectId),
                clearAdvisorOutcomes(consentSubjectId),
                clearAdvisorObservationLedger(consentSubjectId),
                clearAllReminders(),
                offlineSafetyPlanCache.clear(expectedOwnerId),
                clearReflectionDraft(expectedOwnerId),
                appleHealthPreference.clear(expectedOwnerId),
              ]);
              setDataGeneration((current) => current + 1);
              const cleanupFailed = cleanup.some((item) => item.status === 'rejected');
              Alert.alert(
                cleanupFailed ? 'Online data deleted' : 'Done',
                cleanupFailed
                  ? 'Online data was deleted, but local cleanup was incomplete. Sign out before continuing.'
                  : 'All data deleted.'
              );
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
            await resetAiDataSharingConsent(consentSubjectId);
            setAiConsentGranted(false);
            Alert.alert('Done', 'AI data sharing consent was revoked.');
          },
        },
      ]
    );
  };

  const openSupportLink = (url: string, label: string, fallback = url) => {
    Linking.openURL(url).catch(() => {
      Alert.alert(`Unable to Open ${label}`, fallback);
    });
  };

  function openNotificationSettings() {
    Linking.openSettings().catch(() => {
      Alert.alert('Unable to Open Settings', 'Open your device settings and allow notifications for MHtoolkit.');
    });
  }

  return (
    <AppScreen>
      <PageHeader
        eyebrow="Your app"
        title="Settings"
        description="Manage your account, reminders, privacy and support."
      />

      <SectionHeader title="Account" />
      <View style={s.sectionBlock}>
        <RowGroup>
        {accountUpgradePending ? (
          <ListRow
            title="Finish account setup"
            description="Confirm your email, then create your password. Your saved data stays with this profile."
            icon="user-check"
            onPress={() => router.push('/auth/signup')}
          />
        ) : isAnonymous ? (
          <>
            <ListRow
              title="Anonymous profile"
              description="Your data stays with this profile unless you create an account."
              icon="user"
            />
            <ListRow
              title="Create Account"
              description="Sync this profile across devices without losing saved data."
              onPress={() => router.push('/auth/signup')}
            />
            <ListRow
              title="Sign In to an Existing Account"
              onPress={() => router.push('/auth/login')}
            />
          </>
        ) : (
          <>
            <ListRow
              title={user?.email ?? 'Connected account'}
              description="Your data is synced across devices."
              icon="user-check"
            />
            <ListRow title="Sign Out" onPress={() => void signOut()} />
          </>
        )}
        </RowGroup>
      </View>

      <SectionHeader title="Connections" />
      <View style={s.sectionBlock}>
        <RowGroup>
        <ListRow
          title="Together"
          description="Share commitments with one person you trust. You control what they can see."
          icon="heart"
          onPress={() => router.push(isAnonymous ? '/auth/signup?returnTo=/accountability' : '/accountability')}
        />
        </RowGroup>
      </View>

      <SectionHeader
        title="Notifications"
        description="Choose what MHtoolkit can send."
      />
      <View style={s.sectionBlock}>
        <RowGroup>
          <View style={s.notificationParent}>
            <View style={s.notificationCopy}>
              <Text style={s.notificationTitle}>Allow notifications</Text>
              <Text style={s.notificationDescription}>
                Master control for every notification type below.
              </Text>
            </View>
            <Switch
              accessibilityLabel="MHtoolkit notifications"
              value={remindersOn}
              onValueChange={toggleReminders}
              disabled={reminderBusy || !reminderHydrated}
              trackColor={{ false: Colors.border, true: Colors.primaryLight }}
              thumbColor={remindersOn ? Colors.primary : Colors.card}
            />
          </View>

          {!remindersOn ? (
            <Text style={s.pausedText}>Turn on notifications to change types and delivery times.</Text>
          ) : null}
          <View
            accessibilityElementsHidden={!remindersOn}
            importantForAccessibility={remindersOn ? 'auto' : 'no-hide-descendants'}
            style={[s.notificationChildren, !remindersOn && s.notificationChildrenDisabled]}
          >
            <View style={s.notificationList}>
              {NOTIFICATION_OPTIONS.map((option, index) => (
                <View
                  key={option.key}
                  style={[
                    s.notificationRow,
                    index < NOTIFICATION_OPTIONS.length - 1 && s.notificationRowBorder,
                  ]}
                >
                  <View style={s.notificationCopy}>
                    <Text style={s.notificationTitle}>{option.title}</Text>
                    <Text style={s.notificationDescription}>{option.description}</Text>
                  </View>
                  <Switch
                    accessibilityLabel={option.title}
                    accessibilityHint={option.description}
                    value={notificationPreferences[option.key]}
                    onValueChange={(value) =>
                      toggleNotificationCategory(option.key, value)
                    }
                    disabled={reminderBusy || !reminderHydrated || !remindersOn}
                    trackColor={{ false: Colors.border, true: Colors.primaryLight }}
                    thumbColor={notificationPreferences[option.key] ? Colors.primary : Colors.card}
                  />
                </View>
              ))}
            </View>

            {(notificationPreferences.dailyPlanning ||
              notificationPreferences.planReminders ||
              notificationPreferences.routineReminders ||
              notificationPreferences.affirmations ||
              notificationPreferences.libraryPicks ||
              notificationPreferences.advisorNudges) && (
              <View style={s.reminderTimes}>
                <Text style={s.reminderTimesTitle}>Delivery times</Text>
                <Text style={s.notificationDescription}>
                  Used for daily briefs, routines, and planner due dates.
                </Text>
                <View style={s.timePillRow}>
                  {HOUR_OPTIONS.map((opt) => {
                    const selected = selectedTimes.includes(opt.value);
                    return (
                      <Pressable
                        key={opt.value}
                        accessibilityRole="button"
                        accessibilityState={{
                          selected,
                          disabled: reminderBusy || !reminderHydrated || !remindersOn,
                        }}
                        accessibilityLabel={`Reminder time ${opt.label}`}
                        onPress={() => void toggleTime(opt.value)}
                        disabled={reminderBusy || !reminderHydrated || !remindersOn}
                        style={({ pressed }) => [
                          s.timePill,
                          selected && s.timePillSelected,
                          (reminderBusy || !remindersOn) && s.disabled,
                          pressed && s.pressed,
                        ]}
                      >
                        <Text style={[s.timePillText, selected && s.timePillTextSelected]}>{opt.label}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            )}
          </View>
          <ListRow
            title="Send Test Notification"
            description={
              remindersOn
                ? 'Schedule a test that should arrive in a few seconds.'
                : 'Turn on notifications before sending a test.'
            }
            icon="bell"
            onPress={
              reminderBusy || !reminderHydrated || !remindersOn
                ? undefined
                : () => void handleTestReminder()
            }
          />
        </RowGroup>
        {reminderStatus ? (
          <InlineStatus tone="info" message={reminderStatus} />
        ) : null}
      </View>

      <SectionHeader title="Advisor context" description="Optional signals Advisor may use on this device." />
      <AppleHealthSettingsCard ownerId={user?.id ?? null} />

      <SectionHeader title="Privacy and data" />
      <View style={s.sectionBlock}>
        <RowGroup>
          <ListRow
            title={loading ? 'Exporting...' : 'Export Data (JSON)'}
            description="Download your MHtoolkit data, including Together activity."
            icon="download"
            onPress={loading ? undefined : () => void handleExport()}
          />
          <ListRow
            title={`AI data sharing consent: ${aiConsentGranted ? 'Granted' : 'Not granted yet'}`}
            description="Chat, voice, and AI affirmations ask before sharing with Google Gemini, Anthropic Claude, or OpenAI."
            icon="shield"
          />
          {aiConsentGranted ? (
            <ListRow title="Revoke AI Consent" onPress={handleRevokeAiConsent} />
          ) : null}
          <ListRow
            title="View Privacy Policy"
            icon="file-text"
            onPress={() => Linking.openURL(PRIVACY_POLICY_URL).catch(() => {
              Alert.alert('Unable to Open Privacy Policy', PRIVACY_POLICY_URL);
            })}
          />
        </RowGroup>
      </View>

      <SectionHeader title="Professional sharing" />
      <VisitBriefBuilder key={`visit-brief-${user?.id ?? 'signed-out'}-${dataGeneration}`} ownerId={user?.id ?? null} />

      <SectionHeader title="Privacy activity" />
      <PrivacyActivity key={`privacy-activity-${user?.id ?? 'signed-out'}-${dataGeneration}`} ownerId={user?.id ?? null} />

      <SectionHeader title="Support and feedback" />
      <View style={s.sectionBlock}>
        <RowGroup>
        <ListRow
          title="Send feedback"
          description="Share an idea or tell us what could be better."
          icon="message-square"
          onPress={() =>
            openSupportLink(
              FEEDBACK_EMAIL_URL,
              'Feedback',
              `Send feedback to ${SUPPORT_EMAIL}`
            )
          }
        />
        <ListRow
          title="Get app help"
          description={SUPPORT_EMAIL}
          icon="mail"
          onPress={() =>
            openSupportLink(
              SUPPORT_EMAIL_URL,
              'Email',
              `Contact ${SUPPORT_EMAIL}`
            )
          }
        />
        <ListRow
          title="View Support & Crisis Resources"
          description="Urgent support, trusted directories, and app help."
          icon="life-buoy"
          onPress={() => openSupportLink(SUPPORT_URL, 'Support Page')}
        />
        </RowGroup>
      </View>

      <SectionHeader title="Data deletion" description="These actions cannot be undone." />
      <View style={s.sectionBlock}>
        <RowGroup>
          <ListRow
            title="Delete saved data"
            description="Delete check-ins, plans, Together activity, and other data in this profile."
            icon="trash-2"
            destructive
            onPress={loading ? undefined : () => void handleDeleteAll()}
          />
          {!isAnonymous ? (
            <ListRow
              title="Delete Account"
              description="Permanently delete your account and all associated data."
              destructive
              onPress={loading ? undefined : () => void handleDeleteAccount()}
            />
          ) : null}
        </RowGroup>
      </View>

    </AppScreen>
  );
}

const s = StyleSheet.create({
  sectionBlock: { marginBottom: Spacing.xl },
  notificationParent: {
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
    paddingVertical: Spacing.sm,
  },
  notificationChildren: { paddingLeft: Spacing.md },
  notificationChildrenDisabled: { opacity: 0.56 },
  pausedText: { color: Colors.textSecondary, ...Typography.caption, paddingVertical: Spacing.sm },
  notificationList: { borderBottomWidth: StyleSheet.hairlineWidth, borderColor: Colors.border },
  notificationRow: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.sm },
  notificationRowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border },
  notificationCopy: { flex: 1 },
  notificationTitle: { color: Colors.text, ...Typography.cardTitle },
  notificationDescription: { color: Colors.textSecondary, ...Typography.bodySmall, marginTop: Spacing.xxs },
  reminderTimes: { paddingVertical: Spacing.md },
  reminderTimesTitle: { color: Colors.text, ...Typography.label },
  timePillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs, marginTop: Spacing.sm },
  timePill: {
    minHeight: 44,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.borderStrong,
    borderRadius: Radius.pill,
    backgroundColor: Colors.card,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  timePillSelected: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  timePillText: { color: Colors.text, ...Typography.caption },
  timePillTextSelected: { color: Colors.onPrimary },
  disabled: { opacity: 0.48 },
  pressed: { opacity: 0.72 },
});
