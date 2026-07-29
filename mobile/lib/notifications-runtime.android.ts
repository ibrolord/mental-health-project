/* eslint-disable @typescript-eslint/no-require-imports -- Lazy loading keeps notification native modules Android-only. */
import type { NotificationsBundle } from './notifications-types';

export function loadNotificationsBundle(): NotificationsBundle | null {
  try {
    const Notifications =
      require('expo-notifications') as NotificationsBundle['Notifications'];
    const notificationsHelper =
      require('./notifications') as NotificationsBundle['notificationsHelper'];

    return { Notifications, notificationsHelper };
  } catch (e) {
    console.warn('Failed to load notifications modules:', e);
    return null;
  }
}
