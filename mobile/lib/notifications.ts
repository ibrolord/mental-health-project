import { Platform } from 'react-native';

type NotificationsApiModule = {
  requestPermissions: () => Promise<boolean>;
  scheduleMoodReminders: () => Promise<void>;
  setRemindersEnabled: (enabled: boolean) => Promise<void>;
  areRemindersEnabled: () => Promise<boolean>;
  setReminderTimes: (times: number[]) => Promise<void>;
  getReminderTimes: () => Promise<number[]>;
};

const notificationsModule: NotificationsApiModule =
  Platform.OS === 'android'
    ? require('./notifications.android')
    : require('./notifications.ios');

export const requestPermissions = notificationsModule.requestPermissions;
export const scheduleMoodReminders = notificationsModule.scheduleMoodReminders;
export const setRemindersEnabled = notificationsModule.setRemindersEnabled;
export const areRemindersEnabled = notificationsModule.areRemindersEnabled;
export const setReminderTimes = notificationsModule.setReminderTimes;
export const getReminderTimes = notificationsModule.getReminderTimes;
