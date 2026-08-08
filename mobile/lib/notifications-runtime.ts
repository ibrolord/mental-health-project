pyenv: cannot rehash: /Users/ibrobaba/.pyenv/shims isn't writable
pyenv: cannot rehash: /Users/ibrobaba/.pyenv/shims isn't writable
/* eslint-disable @typescript-eslint/no-require-imports -- Defer JS notification setup until after the root view mounts. */
import type { NotificationsBundle } from './notifications-types';

export function loadNotificationsBundle(): NotificationsBundle | null {
  try {
    const Notifications =
      require('expo-notifications') as NotificationsBundle['Notifications'];
    const notificationsHelper =
      require('./notifications') as NotificationsBundle['notificationsHelper'];

    return { Notifications, notificationsHelper };
  } catch (error) {
    console.warn('Failed to load notification modules:', error);
    return null;
  }
}
