import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const NOTIFICATIONS_KEY = 'mood_reminders_enabled';
const REMINDER_TIMES_KEY = 'reminder_times';

// Default reminder times (hour of day)
const DEFAULT_REMINDERS = [9, 14, 20]; // 9am, 2pm, 8pm

// Configure how notifications appear when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

const MOOD_PROMPTS = [
  { title: 'How are you feeling?', body: 'Take a moment to check in with yourself.' },
  { title: 'Mood check-in time', body: 'A quick mood log can help you spot patterns.' },
  { title: 'Time for a check-in', body: "How's your day going? Log your mood." },
  { title: 'Pause and reflect', body: 'Your emotional awareness matters. How are you?' },
  { title: "Hey, how are you?", body: '30 seconds to log your mood can make a difference.' },
];

export async function requestPermissions(): Promise<boolean> {
  if (!Device.isDevice) {
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

export async function scheduleMoodReminders(): Promise<void> {
  // Cancel existing reminders first
  await Notifications.cancelAllScheduledNotificationsAsync();

  const enabled = await AsyncStorage.getItem(NOTIFICATIONS_KEY);
  if (enabled === 'false') return;

  const timesStr = await AsyncStorage.getItem(REMINDER_TIMES_KEY);
  const times: number[] = timesStr ? JSON.parse(timesStr) : DEFAULT_REMINDERS;

  for (const hour of times) {
    const prompt = MOOD_PROMPTS[Math.floor(Math.random() * MOOD_PROMPTS.length)];

    await Notifications.scheduleNotificationAsync({
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
  }
}

export async function setRemindersEnabled(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(NOTIFICATIONS_KEY, String(enabled));
  if (enabled) {
    const granted = await requestPermissions();
    if (granted) {
      await scheduleMoodReminders();
    }
  } else {
    await Notifications.cancelAllScheduledNotificationsAsync();
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
