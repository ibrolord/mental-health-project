/* eslint-disable @typescript-eslint/no-require-imports -- Notification modules are intentionally loaded only after Android opt-in. */
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// NOTE: expo-notifications and expo-device are loaded lazily. Android is the
// only platform that should ever resolve this file.

type ExpoNotifications = typeof import('expo-notifications');
type ExpoDevice = typeof import('expo-device');

const NOTIFICATIONS_KEY = 'mood_reminders_enabled';
const REMINDER_TIMES_KEY = 'reminder_times';
const MOOD_REMINDER_IDS_KEY = 'mood_reminder_notification_ids';

// Default reminder times (hour of day)
const DEFAULT_REMINDERS = [9, 14, 20]; // 9am, 2pm, 8pm

const REMINDER_CONTENT = {
  title: 'MHtoolkit reminder',
  body: 'Take a moment for the step you planned.',
};

let _Notifications: ExpoNotifications | null = null;
let _handlerConfigured = false;
let _Device: ExpoDevice | null = null;

function getNotifications(): ExpoNotifications | null {
  if (!_Notifications) {
    try {
      _Notifications = require('expo-notifications') as ExpoNotifications;
    } catch (e) {
      console.warn('Failed to load expo-notifications:', e);
      return null;
    }
  }

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
    return false;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('mood-reminders', {
      name: 'Wellbeing reminders',
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

  await cancelMoodReminders();

  const enabled = await AsyncStorage.getItem(NOTIFICATIONS_KEY);
  if (enabled !== 'true') return;

  const timesStr = await AsyncStorage.getItem(REMINDER_TIMES_KEY);
  const times: number[] = timesStr ? JSON.parse(timesStr) : DEFAULT_REMINDERS;

  const scheduledIds: string[] = [];

  for (const hour of times) {
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: REMINDER_CONTENT.title,
        body: REMINDER_CONTENT.body,
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
  return val === 'true';
}

export async function setReminderTimes(times: number[]): Promise<void> {
  await AsyncStorage.setItem(REMINDER_TIMES_KEY, JSON.stringify(times));
  await scheduleMoodReminders();
}

export async function getReminderTimes(): Promise<number[]> {
  const val = await AsyncStorage.getItem(REMINDER_TIMES_KEY);
  return val ? JSON.parse(val) : DEFAULT_REMINDERS;
}
