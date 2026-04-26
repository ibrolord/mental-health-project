import { Platform } from 'react-native';
import type { NotificationsBundle } from './notifications-types';

type NotificationsRuntimeModule = {
  loadNotificationsBundle: () => NotificationsBundle | null;
};

const runtimeModule: NotificationsRuntimeModule =
  Platform.OS === 'android'
    ? require('./notifications-runtime.android')
    : require('./notifications-runtime.ios');

export const loadNotificationsBundle = runtimeModule.loadNotificationsBundle;
