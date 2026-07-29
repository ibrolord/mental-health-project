/* eslint-disable @typescript-eslint/no-require-imports -- The platform branch must remain runtime-resolved so iOS never bundles Android notification modules. */
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
