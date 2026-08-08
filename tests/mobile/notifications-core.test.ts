pyenv: cannot rehash: /Users/ibrobaba/.pyenv/shims isn't writable
pyenv: cannot rehash: /Users/ibrobaba/.pyenv/shims isn't writable
import { describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_REMINDER_TIMES,
  MOOD_REMINDER_IDS_KEY,
  MOOD_TRACKER_NOTIFICATION_ROUTE,
  NOTIFICATIONS_KEY,
  REMINDER_TIMES_KEY,
  createNotificationService,
  normalizeReminderTimes,
  notificationPermissionAllowsDelivery,
  parseStoredNotificationIds,
  parseStoredReminderTimes,
  reminderContentForTimes,
  type NotificationStorage,
  type NotificationsModule,
} from '../../mobile/lib/notifications-core';
import {
  notificationScreenFromResponse,
  type NotificationResponseLike,
} from '../../mobile/lib/notifications-types';

type NotificationPermissionsStatus = Parameters<
  typeof notificationPermissionAllowsDelivery
>[0];

const IOS_AUTHORIZATION = {
  NOT_DETERMINED: 0,
  DENIED: 1,
  AUTHORIZED: 2,
  PROVISIONAL: 3,
  EPHEMERAL: 4,
};

function permission(
  status: 'denied' | 'granted' | 'undetermined',
  iosStatus = IOS_AUTHORIZATION.NOT_DETERMINED
): NotificationPermissionsStatus {
  return {
    status,
    granted: status === 'granted',
    canAskAgain: status !== 'denied',
    expires: 'never',
    ios: {
      status: iosStatus,
      allowsAlert: null,
      allowsBadge: null,
      allowsSound: null,
      allowsDisplayInCarPlay: null,
      allowsCriticalAlerts: null,
      alertStyle: 0,
      allowsDisplayInNotificationCenter: null,
      allowsDisplayOnLockScreen: null,
      providesAppNotificationSettings: false,
      allowsAnnouncements: null,
    },
  } as NotificationPermissionsStatus;
}

function createStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  const storage: NotificationStorage = {
    getItem: vi.fn(async (key) => values.get(key) ?? null),
    setItem: vi.fn(async (key, value) => {
      values.set(key, value);
    }),
    removeItem: vi.fn(async (key) => {
      values.delete(key);
    }),
  };
  return { storage, values };
}

function createNotifications(initialPermission = permission('granted')) {
  let nextId = 0;
  const notificationsModule = {
    AndroidImportance: { DEFAULT: 3 },
    IosAuthorizationStatus: IOS_AUTHORIZATION,
    SchedulableTriggerInputTypes: {
      DAILY: 'daily',
      DATE: 'date',
      TIME_INTERVAL: 'timeInterval',
    },
    setNotificationHandler: vi.fn(),
    setNotificationChannelAsync: vi.fn(async () => null),
    getPermissionsAsync: vi.fn(async () => initialPermission),
    requestPermissionsAsync: vi.fn(async () => initialPermission),
    scheduleNotificationAsync: vi.fn(async () => `notification-${++nextId}`),
    cancelScheduledNotificationAsync: vi.fn(async () => undefined),
  };
  return notificationsModule as unknown as NotificationsModule;
}

describe('native local notifications', () => {
  it('normalizes persisted reminder times and notification IDs', () => {
    expect(normalizeReminderTimes([20, 9, 9, -1, 24, 14.5, 14])).toEqual([9, 14, 20]);
    expect(parseStoredReminderTimes('not-json')).toEqual([...DEFAULT_REMINDER_TIMES]);
    expect(parseStoredReminderTimes('[8,18,8]')).toEqual([8, 18]);
    expect(parseStoredNotificationIds('["a","b","a",3,null]')).toEqual(['a', 'b']);
    expect(parseStoredNotificationIds('{"id":"a"}')).toEqual([]);
  });

  it('accepts authorized and provisional iOS delivery states', () => {
    const Notifications = createNotifications();
    expect(
      notificationPermissionAllowsDelivery(
        permission('denied', IOS_AUTHORIZATION.AUTHORIZED),
        Notifications
      )
    ).toBe(true);
    expect(
      notificationPermissionAllowsDelivery(
        permission('denied', IOS_AUTHORIZATION.PROVISIONAL),
        Notifications
      )
    ).toBe(true);
    expect(
      notificationPermissionAllowsDelivery(
        permission('denied', IOS_AUTHORIZATION.DENIED),
        Notifications
      )
    ).toBe(false);
  });

  it('enables and schedules only owned daily reminders on iOS', async () => {
    const Notifications = createNotifications();
    const { storage, values } = createStorage({
      [REMINDER_TIMES_KEY]: '[20,9,9]',
      [MOOD_REMINDER_IDS_KEY]: '["old-reminder"]',
    });
    const service = createNotificationService(Notifications, storage, 'ios');

    await expect(service.setRemindersEnabled(true)).resolves.toBe(true);

    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('old-reminder');
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(2);
    expect(Notifications.scheduleNotificationAsync).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        content: expect.objectContaining({
          title: 'MHtoolkit reminder',
          data: { screen: MOOD_TRACKER_NOTIFICATION_ROUTE },
        }),
        trigger: expect.objectContaining({ type: 'daily', hour: 9, minute: 0 }),
      })
    );
    const firstRequest = vi.mocked(Notifications.scheduleNotificationAsync).mock.calls[0][0];
    expect(firstRequest.trigger).not.toHaveProperty('channelId');
    expect(values.get(NOTIFICATIONS_KEY)).toBe('true');
    expect(JSON.parse(values.get(MOOD_REMINDER_IDS_KEY)!)).toEqual([
      'notification-1',
      'notification-2',
    ]);
  });

  it('cycles daily content and keeps target-date reminders one-time', async () => {
    const Notifications = createNotifications();
    const { storage } = createStorage({
      [REMINDER_TIMES_KEY]: '[9,14]',
    });
    const dueDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const contentProvider = vi.fn(async () => ({
      daily: [
        { title: 'Plan', body: 'Choose one next step.', screen: '/goals' as const },
        { title: 'Affirmation', body: 'Keep going.', screen: '/affirmations' as const },
      ],
      dueDates: [
        { title: 'Due tomorrow', body: 'Complete your plan.', screen: '/planner' as const, date: dueDate },
      ],
    }));
    const service = createNotificationService(
      Notifications,
      storage,
      'ios',
      contentProvider
    );

    await expect(service.setRemindersEnabled(true)).resolves.toBe(true);

    expect(contentProvider).toHaveBeenCalledWith([9, 14]);
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(3);
    expect(Notifications.scheduleNotificationAsync).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        content: expect.objectContaining({ data: { screen: '/goals' } }),
        trigger: expect.objectContaining({ type: 'daily', hour: 9 }),
      })
    );
    expect(Notifications.scheduleNotificationAsync).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        content: expect.objectContaining({ data: { screen: '/affirmations' } }),
        trigger: expect.objectContaining({ type: 'daily', hour: 14 }),
      })
    );
    expect(Notifications.scheduleNotificationAsync).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        content: expect.objectContaining({ data: { screen: '/planner' } }),
        trigger: expect.objectContaining({ type: 'date', date: dueDate }),
      })
    );
  });

  it('uses a safe fallback when no personalized daily content is available', () => {
    expect(reminderContentForTimes([9, 14], [])).toHaveLength(2);
    expect(reminderContentForTimes([9], [
      { title: 'Plan', body: 'Open goals.', screen: '/goals' },
    ])).toEqual([
      { title: 'Plan', body: 'Open goals.', screen: '/goals' },
    ]);
  });

  it('coalesces overlapping content refreshes to prevent duplicate schedules', async () => {
    const Notifications = createNotifications();
    const { storage } = createStorage({
      [NOTIFICATIONS_KEY]: 'true',
      [REMINDER_TIMES_KEY]: '[9]',
    });
    let releaseContent!: () => void;
    const contentReady = new Promise<void>((resolve) => {
      releaseContent = resolve;
    });
    const contentProvider = vi.fn(async () => {
      await contentReady;
      return {
        daily: [{ title: 'Plan', body: 'Open goals.', screen: '/goals' as const }],
        dueDates: [],
      };
    });
    const service = createNotificationService(
      Notifications,
      storage,
      'ios',
      contentProvider
    );

    const first = service.scheduleMoodReminders();
    const second = service.scheduleMoodReminders();
    releaseContent();
    await expect(Promise.all([first, second])).resolves.toEqual([
      ['notification-1'],
      ['notification-1'],
    ]);
    expect(contentProvider).toHaveBeenCalledTimes(1);
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
  });

  it('reschedules with new times when settings change during a refresh', async () => {
    const Notifications = createNotifications();
    const { storage, values } = createStorage({
      [NOTIFICATIONS_KEY]: 'true',
      [REMINDER_TIMES_KEY]: '[9]',
    });
    let releaseContent!: () => void;
    const contentReady = new Promise<void>((resolve) => {
      releaseContent = resolve;
    });
    const contentProvider = vi.fn(async () => {
      if (contentProvider.mock.calls.length === 1) await contentReady;
      return {
        daily: [{ title: 'Plan', body: 'Open goals.', screen: '/goals' as const }],
        dueDates: [],
      };
    });
    const service = createNotificationService(
      Notifications,
      storage,
      'ios',
      contentProvider
    );

    const refresh = service.scheduleMoodReminders();
    await vi.waitFor(() => expect(contentProvider).toHaveBeenCalledTimes(1));
    const update = service.setReminderTimes([20]);
    releaseContent();
    await Promise.all([refresh, update]);

    expect(contentProvider).toHaveBeenCalledTimes(2);
    expect(Notifications.scheduleNotificationAsync).toHaveBeenLastCalledWith(
      expect.objectContaining({
        trigger: expect.objectContaining({ hour: 20 }),
      })
    );
    expect(values.get(REMINDER_TIMES_KEY)).toBe('[20]');
    expect(JSON.parse(values.get(MOOD_REMINDER_IDS_KEY)!)).toEqual([
      'notification-2',
    ]);
  });

  it('finishes disabling after an active refresh completes', async () => {
    const Notifications = createNotifications();
    const { storage, values } = createStorage({
      [NOTIFICATIONS_KEY]: 'true',
      [REMINDER_TIMES_KEY]: '[9]',
    });
    let releaseContent!: () => void;
    const contentReady = new Promise<void>((resolve) => {
      releaseContent = resolve;
    });
    const contentProvider = vi.fn(async () => {
      await contentReady;
      return {
        daily: [{ title: 'Plan', body: 'Open goals.', screen: '/goals' as const }],
        dueDates: [],
      };
    });
    const service = createNotificationService(
      Notifications,
      storage,
      'ios',
      contentProvider
    );

    const refresh = service.scheduleMoodReminders();
    await vi.waitFor(() => expect(contentProvider).toHaveBeenCalledTimes(1));
    const disable = service.setRemindersEnabled(false);
    releaseContent();
    await expect(Promise.all([refresh, disable])).resolves.toEqual([
      ['notification-1'],
      false,
    ]);

    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith(
      'notification-1'
    );
    expect(values.get(NOTIFICATIONS_KEY)).toBe('false');
    expect(values.has(MOOD_REMINDER_IDS_KEY)).toBe(false);
  });

  it('does not claim reminders are enabled when permission is denied', async () => {
    const denied = permission('denied', IOS_AUTHORIZATION.DENIED);
    const Notifications = createNotifications(denied);
    const { storage, values } = createStorage();
    const service = createNotificationService(Notifications, storage, 'ios');

    await expect(service.setRemindersEnabled(true)).resolves.toBe(false);

    expect(values.get(NOTIFICATIONS_KEY)).toBe('false');
    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('cleans up an active refresh when an enable request is denied', async () => {
    const granted = permission('granted');
    const denied = permission('denied', IOS_AUTHORIZATION.DENIED);
    const Notifications = createNotifications(granted);
    vi.mocked(Notifications.getPermissionsAsync)
      .mockResolvedValueOnce(granted)
      .mockResolvedValueOnce(denied);
    vi.mocked(Notifications.requestPermissionsAsync).mockResolvedValue(denied);
    const { storage, values } = createStorage({
      [NOTIFICATIONS_KEY]: 'true',
      [REMINDER_TIMES_KEY]: '[9]',
    });
    let releaseContent!: () => void;
    const contentReady = new Promise<void>((resolve) => {
      releaseContent = resolve;
    });
    const contentProvider = vi.fn(async () => {
      await contentReady;
      return {
        daily: [{ title: 'Plan', body: 'Open goals.', screen: '/goals' as const }],
        dueDates: [],
      };
    });
    const service = createNotificationService(
      Notifications,
      storage,
      'ios',
      contentProvider
    );

    const refresh = service.scheduleMoodReminders();
    await vi.waitFor(() => expect(contentProvider).toHaveBeenCalledTimes(1));
    const enable = service.setRemindersEnabled(true);
    releaseContent();
    await expect(Promise.all([refresh, enable])).resolves.toEqual([
      ['notification-1'],
      false,
    ]);

    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith(
      'notification-1'
    );
    expect(values.get(NOTIFICATIONS_KEY)).toBe('false');
    expect(values.has(MOOD_REMINDER_IDS_KEY)).toBe(false);
  });

  it('keeps failed cancellation IDs so privacy cleanup can be retried', async () => {
    const Notifications = createNotifications();
    vi.mocked(Notifications.cancelScheduledNotificationAsync)
      .mockResolvedValueOnce()
      .mockRejectedValueOnce(new Error('native cancellation failed'));
    const { storage, values } = createStorage({
      [NOTIFICATIONS_KEY]: 'true',
      [MOOD_REMINDER_IDS_KEY]: '["removed","retry-me"]',
    });
    const service = createNotificationService(Notifications, storage, 'ios');

    await expect(service.setRemindersEnabled(false)).rejects.toThrow(
      'local reminders could not be removed'
    );

    expect(values.get(NOTIFICATIONS_KEY)).toBe('true');
    expect(JSON.parse(values.get(MOOD_REMINDER_IDS_KEY)!)).toEqual(['retry-me']);
  });

  it('creates a short test notification that opens the mood tracker', async () => {
    const Notifications = createNotifications();
    const { storage } = createStorage();
    const service = createNotificationService(Notifications, storage, 'android');

    await expect(service.sendTestNotification()).resolves.toBe(true);

    expect(Notifications.setNotificationChannelAsync).toHaveBeenCalledWith(
      'mood-reminders',
      expect.objectContaining({ name: 'Wellbeing reminders' })
    );
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.objectContaining({
          body: 'Your test reminder is working. Daily reminders can include plans, affirmations, and library picks.',
          data: { screen: MOOD_TRACKER_NOTIFICATION_ROUTE },
        }),
        trigger: expect.objectContaining({
          type: 'timeInterval',
          channelId: 'mood-reminders',
          seconds: 2,
        }),
      })
    );
  });

  it('rejects notification routes that were not scheduled by the app', () => {
    const response = (screen: unknown): NotificationResponseLike => ({
      notification: {
        request: { content: { data: { screen } } },
      },
    });

    expect(notificationScreenFromResponse(response(MOOD_TRACKER_NOTIFICATION_ROUTE))).toBe(
      MOOD_TRACKER_NOTIFICATION_ROUTE
    );
    expect(notificationScreenFromResponse(response('/planner'))).toBe('/planner');
    expect(notificationScreenFromResponse(response('/settings'))).toBeNull();
    expect(notificationScreenFromResponse(response({ route: '/(tabs)/tracker' }))).toBeNull();
  });

  it('reads allowlisted routes from an iOS push trigger payload', () => {
    const response: NotificationResponseLike = {
      notification: {
        request: {
          content: { data: undefined },
          trigger: { payload: { screen: MOOD_TRACKER_NOTIFICATION_ROUTE } },
        },
      },
    };

    expect(notificationScreenFromResponse(response)).toBe(
      MOOD_TRACKER_NOTIFICATION_ROUTE
    );
    response.notification.request.trigger = {
      payload: { screen: '/settings' },
    };
    expect(notificationScreenFromResponse(response)).toBeNull();
  });

  it('uses a valid iOS trigger route when content data is malformed', () => {
    const response: NotificationResponseLike = {
      notification: {
        request: {
          content: { data: { screen: '/settings' } },
          trigger: { payload: { screen: MOOD_TRACKER_NOTIFICATION_ROUTE } },
        },
      },
    };

    expect(notificationScreenFromResponse(response)).toBe(
      MOOD_TRACKER_NOTIFICATION_ROUTE
    );
  });
});
