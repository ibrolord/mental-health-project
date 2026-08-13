import type {
  NotificationPermissionsStatus,
  NotificationRequestInput,
} from 'expo-notifications';
import type { NotificationScreen } from './notifications-types';

export type NotificationsModule = typeof import('expo-notifications');

export type NotificationStorage = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
};

export type NotificationPlatform = 'android' | 'ios';

export const NOTIFICATIONS_KEY = 'mood_reminders_enabled';
export const REMINDER_TIMES_KEY = 'reminder_times';
export const MOOD_REMINDER_IDS_KEY = 'mood_reminder_notification_ids';
export const DUE_DATE_REMINDER_IDS_KEY = 'due_date_reminder_notification_ids';
export const ADVISOR_REMINDER_IDS_KEY = 'advisor_reminder_notification_ids';
export const DEFAULT_REMINDER_TIMES = [9, 14, 20] as const;
export const MOOD_TRACKER_NOTIFICATION_ROUTE = '/(tabs)/tracker';
export const ADVISOR_NOTIFICATION_ROUTE = '/advisor';

export type ReminderContent = {
  title: string;
  body: string;
  screen: NotificationScreen;
};

export type DueDateReminder = ReminderContent & {
  date: Date;
};

export type ReminderSchedulePlan = {
  daily: ReminderContent[];
  dueDates: DueDateReminder[];
};

export type ReminderContentProvider = (
  reminderTimes: readonly number[]
) => Promise<ReminderSchedulePlan>;

export const DEFAULT_REMINDER_CONTENT: ReminderContent = {
  title: 'MHtoolkit reminder',
  body: 'Take a moment for the step you planned.',
  screen: MOOD_TRACKER_NOTIFICATION_ROUTE,
};

const TEST_REMINDER_CONTENT = {
  title: 'MHtoolkit reminder',
  body: 'Your test reminder is working. Daily reminders can include plans, affirmations, and library picks.',
};

export function normalizeReminderTimes(
  value: unknown,
  fallback: readonly number[] = DEFAULT_REMINDER_TIMES
): number[] {
  if (!Array.isArray(value)) return [...fallback];

  const times = Array.from(
    new Set(value.filter((hour): hour is number => Number.isInteger(hour) && hour >= 0 && hour <= 23))
  ).sort((a, b) => a - b);

  return times.length > 0 ? times : [...fallback];
}

export function parseStoredReminderTimes(value: string | null): number[] {
  if (!value) return [...DEFAULT_REMINDER_TIMES];
  try {
    return normalizeReminderTimes(JSON.parse(value));
  } catch {
    return [...DEFAULT_REMINDER_TIMES];
  }
}

export function parseStoredNotificationIds(value: string | null): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return Array.from(
      new Set(parsed.filter((id): id is string => typeof id === 'string' && id.length > 0))
    );
  } catch {
    return [];
  }
}

export function notificationPermissionAllowsDelivery(
  permission: NotificationPermissionsStatus,
  Notifications: Pick<NotificationsModule, 'IosAuthorizationStatus'>
): boolean {
  if (permission.granted) return true;

  const iosStatus = permission.ios?.status;
  return iosStatus === Notifications.IosAuthorizationStatus.AUTHORIZED ||
    iosStatus === Notifications.IosAuthorizationStatus.PROVISIONAL ||
    iosStatus === Notifications.IosAuthorizationStatus.EPHEMERAL;
}

export function reminderContentForTimes(
  times: readonly number[],
  contents: readonly ReminderContent[]
): ReminderContent[] {
  const available = contents.length > 0 ? contents : [DEFAULT_REMINDER_CONTENT];
  return times.map((_, index) => available[index % available.length]);
}

function validDueDateReminders(
  reminders: readonly DueDateReminder[],
  now: number = Date.now()
): DueDateReminder[] {
  return reminders.filter(({ date }) =>
    date instanceof Date &&
    Number.isFinite(date.getTime()) &&
    date.getTime() > now
  );
}

export function createNotificationService(
  Notifications: NotificationsModule,
  storage: NotificationStorage,
  platform: NotificationPlatform,
  contentProvider: ReminderContentProvider = async () => ({
    daily: [DEFAULT_REMINDER_CONTENT],
    dueDates: [],
  })
) {
  let handlerConfigured = false;
  let reminderSyncInFlight: Promise<string[]> | null = null;
  let dueDateSyncInFlight: Promise<string[]> | null = null;
  let reminderMutationTail: Promise<void> = Promise.resolve();

  function enqueueReminderMutation<T>(operation: () => Promise<T>): Promise<T> {
    const run = reminderMutationTail.then(operation, operation);
    reminderMutationTail = run.then(
      () => undefined,
      () => undefined
    );
    return run;
  }

  function configureHandler(): void {
    if (handlerConfigured) return;
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
      }),
    });
    handlerConfigured = true;
  }

  async function ensureAndroidChannel(): Promise<void> {
    if (platform !== 'android') return;
    await Notifications.setNotificationChannelAsync('mood-reminders', {
      name: 'Wellbeing reminders',
      importance: Notifications.AndroidImportance.DEFAULT,
      sound: 'default',
    });
  }

  async function hasPermission(): Promise<boolean> {
    configureHandler();
    const permission = await Notifications.getPermissionsAsync();
    return notificationPermissionAllowsDelivery(permission, Notifications);
  }

  async function requestPermissions(): Promise<boolean> {
    configureHandler();
    await ensureAndroidChannel();

    let permission = await Notifications.getPermissionsAsync();
    if (!notificationPermissionAllowsDelivery(permission, Notifications)) {
      permission = await Notifications.requestPermissionsAsync();
    }

    return notificationPermissionAllowsDelivery(permission, Notifications);
  }

  async function cancelStoredReminders(
    storageKey: string,
    failureMessage: string
  ): Promise<void> {
    configureHandler();
    const ids = parseStoredNotificationIds(
      await storage.getItem(storageKey)
    );

    if (ids.length === 0) {
      await storage.removeItem(storageKey);
      return;
    }

    const results = await Promise.allSettled(
      ids.map((id) => Notifications.cancelScheduledNotificationAsync(id))
    );
    const failedIds = ids.filter((_, index) => results[index].status === 'rejected');

    if (failedIds.length > 0) {
      await storage.setItem(storageKey, JSON.stringify(failedIds));
      throw new Error(failureMessage);
    }

    await storage.removeItem(storageKey);
  }

  async function cancelMoodReminders(): Promise<void> {
    return cancelStoredReminders(
      MOOD_REMINDER_IDS_KEY,
      'One or more daily reminders could not be removed.'
    );
  }

  async function cancelDueDateReminders(): Promise<void> {
    return cancelStoredReminders(
      DUE_DATE_REMINDER_IDS_KEY,
      'One or more due-date reminders could not be removed.'
    );
  }

  async function cancelAdvisorReminderInternal(): Promise<void> {
    return cancelStoredReminders(
      ADVISOR_REMINDER_IDS_KEY,
      'The Advisor reminder could not be removed.'
    );
  }

  async function reconcileAdvisorReminder(): Promise<boolean> {
    const storedIds = parseStoredNotificationIds(
      await storage.getItem(ADVISOR_REMINDER_IDS_KEY)
    );
    if (storedIds.length === 0) {
      await storage.removeItem(ADVISOR_REMINDER_IDS_KEY);
      return false;
    }

    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    const activeIds = new Set(scheduled.map((request) => request.identifier));
    const retainedIds = storedIds.filter((id) => activeIds.has(id));
    if (retainedIds.length === 0) {
      await storage.removeItem(ADVISOR_REMINDER_IDS_KEY);
      return false;
    }
    if (retainedIds.length !== storedIds.length) {
      await storage.setItem(ADVISOR_REMINDER_IDS_KEY, JSON.stringify(retainedIds));
    }
    return true;
  }

  async function scheduleMoodRemindersInternal(): Promise<string[]> {
    configureHandler();
    if ((await storage.getItem(NOTIFICATIONS_KEY)) !== 'true') return [];
    if (!(await hasPermission())) {
      await cancelMoodReminders();
      return [];
    }

    const times = parseStoredReminderTimes(
      await storage.getItem(REMINDER_TIMES_KEY)
    );
    let reminderPlan: ReminderSchedulePlan;
    try {
      reminderPlan = await contentProvider(times);
    } catch (error) {
      console.warn('Could not load personalized reminder content:', error);
      reminderPlan = { daily: [DEFAULT_REMINDER_CONTENT], dueDates: [] };
    }

    await cancelMoodReminders();

    await ensureAndroidChannel();
    const scheduledIds: string[] = [];
    const dailyContent = reminderContentForTimes(times, reminderPlan.daily);

    try {
      for (const [index, hour] of times.entries()) {
        const content = dailyContent[index];
        const request: NotificationRequestInput = {
          content: {
            title: content.title,
            body: content.body,
            data: { screen: content.screen },
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DAILY,
            ...(platform === 'android' ? { channelId: 'mood-reminders' } : {}),
            hour,
            minute: 0,
          },
        };
        scheduledIds.push(await Notifications.scheduleNotificationAsync(request));
      }

    } catch (error) {
      const cleanup = await Promise.allSettled(
        scheduledIds.map((id) => Notifications.cancelScheduledNotificationAsync(id))
      );
      const unclearedIds = scheduledIds.filter(
        (_, index) => cleanup[index].status === 'rejected'
      );
      if (unclearedIds.length > 0) {
        await storage.setItem(MOOD_REMINDER_IDS_KEY, JSON.stringify(unclearedIds));
      }
      throw error;
    }

    await storage.setItem(MOOD_REMINDER_IDS_KEY, JSON.stringify(scheduledIds));
    return scheduledIds;
  }

  async function scheduleDueDateRemindersInternal(): Promise<string[]> {
    configureHandler();
    await cancelDueDateReminders();
    if (!(await hasPermission())) return [];

    const times = parseStoredReminderTimes(
      await storage.getItem(REMINDER_TIMES_KEY)
    );
    let reminderPlan: ReminderSchedulePlan;
    try {
      reminderPlan = await contentProvider(times);
    } catch (error) {
      console.warn('Could not load due-date reminder content:', error);
      reminderPlan = { daily: [], dueDates: [] };
    }

    await ensureAndroidChannel();
    const scheduledIds: string[] = [];
    const dueDates = validDueDateReminders(reminderPlan.dueDates);

    try {
      for (const dueDate of dueDates) {
        const request: NotificationRequestInput = {
          content: {
            title: dueDate.title,
            body: dueDate.body,
            data: { screen: dueDate.screen },
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            ...(platform === 'android' ? { channelId: 'mood-reminders' } : {}),
            date: dueDate.date,
          },
        };
        scheduledIds.push(await Notifications.scheduleNotificationAsync(request));
      }
    } catch (error) {
      const cleanup = await Promise.allSettled(
        scheduledIds.map((id) => Notifications.cancelScheduledNotificationAsync(id))
      );
      const unclearedIds = scheduledIds.filter(
        (_, index) => cleanup[index].status === 'rejected'
      );
      if (unclearedIds.length > 0) {
        await storage.setItem(DUE_DATE_REMINDER_IDS_KEY, JSON.stringify(unclearedIds));
      }
      throw error;
    }

    if (scheduledIds.length > 0) {
      await storage.setItem(DUE_DATE_REMINDER_IDS_KEY, JSON.stringify(scheduledIds));
    } else {
      await storage.removeItem(DUE_DATE_REMINDER_IDS_KEY);
    }
    return scheduledIds;
  }

  async function scheduleMoodReminders(): Promise<string[]> {
    if (reminderSyncInFlight) return reminderSyncInFlight;

    const sync = enqueueReminderMutation(scheduleMoodRemindersInternal);
    reminderSyncInFlight = sync;
    try {
      return await sync;
    } finally {
      if (reminderSyncInFlight === sync) reminderSyncInFlight = null;
    }
  }

  async function scheduleDueDateReminders(): Promise<string[]> {
    if (dueDateSyncInFlight) return dueDateSyncInFlight;

    const sync = enqueueReminderMutation(scheduleDueDateRemindersInternal);
    dueDateSyncInFlight = sync;
    try {
      return await sync;
    } finally {
      if (dueDateSyncInFlight === sync) dueDateSyncInFlight = null;
    }
  }

  async function setRemindersEnabled(enabled: boolean): Promise<boolean> {
    if (!enabled) {
      return enqueueReminderMutation(async () => {
        await cancelMoodReminders();
        await storage.setItem(NOTIFICATIONS_KEY, 'false');
        return false;
      });
    }

    if (!(await requestPermissions())) {
      return enqueueReminderMutation(async () => {
        await cancelMoodReminders();
        await storage.setItem(NOTIFICATIONS_KEY, 'false');
        return false;
      });
    }

    return enqueueReminderMutation(async () => {
      await storage.setItem(NOTIFICATIONS_KEY, 'true');
      try {
        await scheduleMoodRemindersInternal();
        return true;
      } catch (error) {
        await storage.setItem(NOTIFICATIONS_KEY, 'false');
        throw error;
      }
    });
  }

  async function clearAllReminders(): Promise<void> {
    return enqueueReminderMutation(async () => {
      const [dailyResult, dueDateResult, advisorResult] = await Promise.allSettled([
        cancelMoodReminders(),
        cancelDueDateReminders(),
        cancelAdvisorReminderInternal(),
      ]);
      if (dailyResult.status === 'rejected') throw dailyResult.reason;
      if (dueDateResult.status === 'rejected') throw dueDateResult.reason;
      if (advisorResult.status === 'rejected') throw advisorResult.reason;
      await storage.setItem(NOTIFICATIONS_KEY, 'false');
    });
  }

  async function areRemindersEnabled(): Promise<boolean> {
    if ((await storage.getItem(NOTIFICATIONS_KEY)) !== 'true') return false;
    return hasPermission();
  }

  async function setReminderTimes(times: number[]): Promise<number[]> {
    const normalized = normalizeReminderTimes(times, []);
    if (normalized.length === 0) {
      throw new Error('Choose at least one reminder time.');
    }

    return enqueueReminderMutation(async () => {
      await storage.setItem(REMINDER_TIMES_KEY, JSON.stringify(normalized));
      if ((await storage.getItem(NOTIFICATIONS_KEY)) === 'true') {
        await scheduleMoodRemindersInternal();
      }
      return normalized;
    });
  }

  async function getReminderTimes(): Promise<number[]> {
    return parseStoredReminderTimes(await storage.getItem(REMINDER_TIMES_KEY));
  }

  async function sendTestNotification(): Promise<boolean> {
    if (!(await requestPermissions())) return false;

    await Notifications.scheduleNotificationAsync({
      content: {
        ...TEST_REMINDER_CONTENT,
        data: { screen: MOOD_TRACKER_NOTIFICATION_ROUTE },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        ...(platform === 'android' ? { channelId: 'mood-reminders' } : {}),
        seconds: 2,
      },
    });
    return true;
  }

  async function scheduleAdvisorReminder(date: Date): Promise<boolean> {
    if (!(date instanceof Date) || !Number.isFinite(date.getTime()) || date.getTime() <= Date.now()) {
      throw new Error('Choose a reminder time in the future.');
    }
    return enqueueReminderMutation(async () => {
      if (!(await requestPermissions())) return false;
      await cancelAdvisorReminderInternal();
      await ensureAndroidChannel();
      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title: 'A gentle check-in',
          body: 'Open MHtoolkit when you are ready to choose one small next step.',
          data: { screen: ADVISOR_NOTIFICATION_ROUTE },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          ...(platform === 'android' ? { channelId: 'mood-reminders' } : {}),
          date,
        },
      });
      try {
        await storage.setItem(ADVISOR_REMINDER_IDS_KEY, JSON.stringify([id]));
      } catch (persistenceError) {
        try {
          await Notifications.cancelScheduledNotificationAsync(id);
        } catch {
          try {
            await storage.setItem(ADVISOR_REMINDER_IDS_KEY, JSON.stringify([id]));
          } catch {
            // The caller receives a cleanup error; no false success is reported.
          }
          throw new Error('The Advisor reminder could not be saved or removed. Check notification settings before trying again.');
        }
        throw persistenceError;
      }
      return true;
    });
  }

  async function cancelAdvisorReminder(): Promise<void> {
    return enqueueReminderMutation(cancelAdvisorReminderInternal);
  }

  async function hasAdvisorReminder(): Promise<boolean> {
    return enqueueReminderMutation(reconcileAdvisorReminder);
  }

  return {
    requestPermissions,
    scheduleMoodReminders,
    scheduleDueDateReminders,
    setRemindersEnabled,
    clearAllReminders,
    areRemindersEnabled,
    setReminderTimes,
    getReminderTimes,
    sendTestNotification,
    scheduleAdvisorReminder,
    cancelAdvisorReminder,
    hasAdvisorReminder,
  };
}

export type NotificationService = ReturnType<typeof createNotificationService>;
