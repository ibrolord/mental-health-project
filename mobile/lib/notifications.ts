/* eslint-disable @typescript-eslint/no-require-imports -- Keep native module access lazy until the first notification operation. */
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createNotificationService,
  type NotificationService,
  type NotificationsModule,
} from './notifications-core';
import { loadSmartReminderPlan } from './notification-content';
import { recordOperationalEvent } from './observability';

let service: NotificationService | null = null;

export type NotificationNavigationQueue<Route extends string> = {
  enqueue: (route: Route) => void;
  retry: () => void;
  setReady: (ready: boolean) => void;
  dispose: () => void;
};

type NotificationNavigationQueueOptions<Route extends string> = {
  navigate: (route: Route) => void;
  clearResponse: () => Promise<void>;
  onError?: (error: unknown) => void;
  delayMs?: number;
  maxAutomaticRetries?: number;
  schedule?: (
    callback: () => void,
    delayMs: number
  ) => ReturnType<typeof setTimeout>;
  cancel?: (timer: ReturnType<typeof setTimeout>) => void;
};

export function createNotificationNavigationQueue<Route extends string>({
  navigate,
  clearResponse,
  onError = () => undefined,
  delayMs = 250,
  maxAutomaticRetries = 3,
  schedule = setTimeout,
  cancel = clearTimeout,
}: NotificationNavigationQueueOptions<Route>): NotificationNavigationQueue<Route> {
  let ready = false;
  let disposed = false;
  let inFlight = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pending: { route: Route; navigated: boolean; failures: number } | null = null;

  const attempt = () => {
    if (disposed || !ready || !pending || inFlight || timer) return;

    const run = async () => {
      timer = null;
      if (disposed || !ready || !pending || inFlight) return;

      const current = pending;
      inFlight = true;
      try {
        if (!current.navigated) {
          navigate(current.route);
          current.navigated = true;
        }
        await clearResponse();
        if (pending === current) pending = null;
      } catch (error) {
        onError(error);
        current.failures += 1;
        if (
          pending === current &&
          current.failures <= maxAutomaticRetries &&
          !disposed
        ) {
          timer = schedule(() => {
            timer = null;
            attempt();
          }, delayMs);
        }
      } finally {
        inFlight = false;
      }
    };

    if (pending.navigated || delayMs === 0) {
      void run();
      return;
    }
    timer = schedule(() => void run(), delayMs);
  };

  return {
    enqueue(route) {
      if (disposed) return;
      if (!pending || pending.route !== route) {
        pending = { route, navigated: false, failures: 0 };
      }
      attempt();
    },
    retry: attempt,
    setReady(nextReady) {
      ready = nextReady;
      attempt();
    },
    dispose() {
      disposed = true;
      pending = null;
      if (timer) cancel(timer);
      timer = null;
    },
  };
}

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

export const requestPermissions = async () => {
  const granted = await getService().requestPermissions();
  void recordOperationalEvent(
    granted
      ? 'notification_permission_granted'
      : 'notification_permission_denied'
  );
  return granted;
};
export const scheduleMoodReminders = async () => {
  try {
    const scheduled = await getService().scheduleMoodReminders();
    if (scheduled.length > 0) {
      void recordOperationalEvent('notification_scheduling_succeeded');
    }
    return scheduled;
  } catch (error) {
    void recordOperationalEvent('notification_scheduling_failed');
    throw error;
  }
};
export const setRemindersEnabled = async (enabled: boolean) => {
  try {
    const result = await getService().setRemindersEnabled(enabled);
    if (enabled) {
      void recordOperationalEvent(
        result
          ? 'notification_permission_granted'
          : 'notification_permission_denied'
      );
      if (result) {
        void recordOperationalEvent('notification_scheduling_succeeded');
      }
    }
    return result;
  } catch (error) {
    if (enabled) void recordOperationalEvent('notification_scheduling_failed');
    throw error;
  }
};
export const areRemindersEnabled = () => getService().areRemindersEnabled();
export const setReminderTimes = (times: number[]) =>
  getService().setReminderTimes(times);
export const getReminderTimes = () => getService().getReminderTimes();
export const sendTestNotification = async () => {
  try {
    const scheduled = await getService().sendTestNotification();
    void recordOperationalEvent(
      scheduled
        ? 'notification_scheduling_succeeded'
        : 'notification_permission_denied'
    );
    return scheduled;
  } catch (error) {
    void recordOperationalEvent('notification_scheduling_failed');
    throw error;
  }
};

// Rebuild local reminders after a user changes a goal, plan, or library state.
// It is a no-op until the user has enabled reminders on this device.
export const refreshReminders = scheduleMoodReminders;
