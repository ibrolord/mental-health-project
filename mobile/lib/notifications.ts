pyenv: cannot rehash: /Users/ibrobaba/.pyenv/shims isn't writable
pyenv: cannot rehash: /Users/ibrobaba/.pyenv/shims isn't writable
/* eslint-disable @typescript-eslint/no-require-imports -- Keep native module access lazy until the first notification operation. */
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createNotificationService,
  type NotificationService,
  type NotificationsModule,
} from './notifications-core';
import { loadSmartReminderPlan } from './notification-content';

let service: NotificationService | null = null;

function getService(): NotificationService {
  if (!service) {
    const Notifications = require('expo-notifications') as NotificationsModule;
    service = createNotificationService(
      Notifications,
      AsyncStorage,
      Platform.OS === 'android' ? 'android' : 'ios',
      loadSmartReminderPlan
    );
  }
  return service;
}

export const requestPermissions = () => getService().requestPermissions();
export const scheduleMoodReminders = () => getService().scheduleMoodReminders();
export const setRemindersEnabled = (enabled: boolean) =>
  getService().setRemindersEnabled(enabled);
export const areRemindersEnabled = () => getService().areRemindersEnabled();
export const setReminderTimes = (times: number[]) =>
  getService().setReminderTimes(times);
export const getReminderTimes = () => getService().getReminderTimes();
export const sendTestNotification = () => getService().sendTestNotification();

// Rebuild local reminders after a user changes a goal, plan, or library state.
// It is a no-op until the user has enabled reminders on this device.
export const refreshReminders = () => getService().scheduleMoodReminders();
