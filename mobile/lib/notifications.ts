import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// NOTE: expo-notifications and expo-device are loaded LAZILY (see getNotifications
// and getDevice below). In the old architecture (newArchEnabled: false), a static
// import can trigger native-module init at app launch. Production build 16 was
// rejected by App Review because that path crashed on iPad Air / iPadOS 26.4 with
// SIGABRT from an ObjC exception on a dispatch worker queue. All access is now
// routed through the lazy getters, which short-circuit on iPad entirely.

type ExpoNotifications = typeof import('expo-notifications');
type ExpoDevice = typeof import('expo-device');

const NOTIFICATIONS_KEY = 'mood_reminders_enabled';
const REMINDER_TIMES_KEY = 'reminder_times';
const MOOD_REMINDER_IDS_KEY = 'mood_reminder_notification_ids';

// Default reminder times (hour of day)
const DEFAULT_REMINDERS = [9, 14, 20]; // 9am, 2pm, 8pm

const MOOD_PROMPTS = [
  { title: 'How are you feeling?', body: 'Take a moment to check in with yourself.' },
  { title: 'Mood check-in time', body: 'A quick mood log can help you spot patterns.' },
  { title: 'Time for a check-in', body: "How's your day going? Log your mood." },
  { title: 'Pause and reflect', body: 'Your emotional awareness matters. How are you?' },
  { title: "Hey, how are you?", body: '30 seconds to log your mood can make a difference.' },
];

let _Notifications: ExpoNotifications | null = null;
let _handlerConfigured = false;
let _Device: ExpoDevice | null = null;

function isIPad(): boolean {
  return Platform.OS === 'ios' && Platform.isPad;
}

/**
 * Lazily loads expo-notifications. Returns null on iPad (hard skip, see notes
 * above) or if the native module fails to load. First successful load also
 * configures the foreground notification handler once.
 */
function getNotifications(): ExpoNotifications | null {
  if (isIPad()) return null;

  if (!_Notifications) {
    try {
      _Notifications = require('expo-notifications') as ExpoNotifications;
    } catch (e) {
      console.warn('Failed to load expo-notifications:', e);
      return null;
    }
  }

  // Retry handler configuration until it succeeds. Previously this was gated
  // by a check that short-circuited via the cached _Notifications return, so
  // if the first setNotificationHandler() call threw, subsequent calls would
  // never retry and the foreground handler would be silently missing.
  if (!_handlerConfigured) {
    try {
      _Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldShowBanner: true,
          shouldShowList: true,
          shouldPlaySound: false,
          shouldSetBadge: false,
        }),
      });
      _handlerConfigured = true;
    } catch (e) {
      console.warn('Failed to set notification handler:', e);
    }
  }

  return _Notifications;
}

function getDevice(): ExpoDevice | null {
  if (isIPad()) return null;
  if (_Device) return _Device;
  try {
    _Device = require('expo-device') as ExpoDevice;
  } catch (e) {
    console.warn('Failed to load expo-device:', e);
    return null;
  }
  return _Device;
}

export async function requestPermissions(): Promise<boolean> {
  const Notifications = getNotifications();
  if (!Notifications) return false;

  const Device = getDevice();
  if (Device && !Device.isDevice) {
    return false; // Notifications don't work on simulator
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('mood-reminders', {
      name: 'Mood Reminders',
      importance: Notifications.AndroidImportance.DEFAULT,
      sound: 'default',
    });
  }

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;

  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  return finalStatus === 'granted';
}

async function cancelMoodReminders(): Promise<void> {
  const Notifications = getNotifications();
  if (!Notifications) return;

  const idsStr = await AsyncStorage.getItem(MOOD_REMINDER_IDS_KEY);
  if (idsStr) {
    const ids: string[] = JSON.parse(idsStr);
    for (const id of ids) {
      await Notifications.cancelScheduledNotificationAsync(id);
    }
    await AsyncStorage.removeItem(MOOD_REMINDER_IDS_KEY);
  }
}

export async function scheduleMoodReminders(): Promise<void> {
  const Notifications = getNotifications();
  if (!Notifications) return;

  // Cancel only mood reminder notifications, not all scheduled notifications
  await cancelMoodReminders();

  const enabled = await AsyncStorage.getItem(NOTIFICATIONS_KEY);
  if (enabled === 'false') return;

  const timesStr = await AsyncStorage.getItem(REMINDER_TIMES_KEY);
  const times: number[] = timesStr ? JSON.parse(timesStr) : DEFAULT_REMINDERS;

  const scheduledIds: string[] = [];

  for (const hour of times) {
    const prompt = MOOD_PROMPTS[Math.floor(Math.random() * MOOD_PROMPTS.length)];

    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: prompt.title,
        body: prompt.body,
        data: { screen: '/(tabs)/tracker' },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour,
        minute: 0,
      },
    });
    scheduledIds.push(id);
  }

  await AsyncStorage.setItem(MOOD_REMINDER_IDS_KEY, JSON.stringify(scheduledIds));
}

export async function setRemindersEnabled(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(NOTIFICATIONS_KEY, String(enabled));
  if (enabled) {
    const granted = await requestPermissions();
    if (granted) {
      await scheduleMoodReminders();
    }
  } else {
    await cancelMoodReminders();
  }
}

export async function areRemindersEnabled(): Promise<boolean> {
  const val = await AsyncStorage.getItem(NOTIFICATIONS_KEY);
  return val !== 'false'; // Default to true
}

export async function setReminderTimes(times: number[]): Promise<void> {
  await AsyncStorage.setItem(REMINDER_TIMES_KEY, JSON.stringify(times));
  await scheduleMoodReminders();
}

export async function getReminderTimes(): Promise<number[]> {
  const val = await AsyncStorage.getItem(REMINDER_TIMES_KEY);
  return val ? JSON.parse(val) : DEFAULT_REMINDERS;
}
