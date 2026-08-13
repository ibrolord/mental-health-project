import { describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_REMINDER_TIMES,
  ADVISOR_NOTIFICATION_ROUTE,
  ADVISOR_REMINDER_IDS_KEY,
  DUE_DATE_REMINDER_IDS_KEY,
  MOOD_REMINDER_IDS_KEY,
  MOOD_TRACKER_NOTIFICATION_ROUTE,
  NOTIFICATIONS_KEY,
  NOTIFICATION_PREFERENCES_KEY,
  REMINDER_TIMES_KEY,
  DEFAULT_NOTIFICATION_PREFERENCES,
  createNotificationService,
  normalizeReminderTimes,
  notificationPermissionAllowsDelivery,
  parseStoredNotificationIds,
  parseStoredNotificationPreferences,
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
  const scheduled = new Map<string, unknown>();
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
    scheduleNotificationAsync: vi.fn(async (request) => {
      const id = `notification-${++nextId}`;
      scheduled.set(id, request);
      return id;
    }),
    cancelScheduledNotificationAsync: vi.fn(async (id: string) => {
      scheduled.delete(id);
    }),
    getAllScheduledNotificationsAsync: vi.fn(async () =>
      Array.from(scheduled, ([identifier, request]) => ({
        identifier,
        ...(request as object),
      }))
    ),
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
    expect(parseStoredNotificationPreferences(null)).toEqual(
      DEFAULT_NOTIFICATION_PREFERENCES
    );
    expect(parseStoredNotificationPreferences('{"affirmations":false}')).toEqual({
      ...DEFAULT_NOTIFICATION_PREFERENCES,
      affirmations: false,
    });
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
          data: expect.objectContaining({ screen: MOOD_TRACKER_NOTIFICATION_ROUTE }),
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

  it('enables daily and due-date reminders together', async () => {
    const Notifications = createNotifications();
    const { storage, values } = createStorage({
      [REMINDER_TIMES_KEY]: '[9,14]',
    });
    const dueDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const contentProvider = vi.fn(async () => ({
      daily: [
        { title: 'Plan', body: 'Choose one next step.', screen: '/goals' as const, category: 'dailyPlanning' as const },
        { title: 'Affirmation', body: 'Keep going.', screen: '/affirmations' as const, category: 'affirmations' as const },
      ],
      dueDates: [
        { title: 'Due tomorrow', body: 'Complete your plan.', screen: '/planner' as const, date: dueDate, category: 'planReminders' as const },
      ],
    }));
    const service = createNotificationService(
      Notifications,
      storage,
      'ios',
      contentProvider
    );

    await expect(service.setRemindersEnabled(true)).resolves.toBe(true);

    expect(contentProvider).toHaveBeenCalledTimes(2);
    expect(contentProvider).toHaveBeenCalledWith([9, 14]);
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(3);
    expect(Notifications.scheduleNotificationAsync).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        content: expect.objectContaining({ data: expect.objectContaining({ screen: '/goals' }) }),
        trigger: expect.objectContaining({ type: 'daily', hour: 9 }),
      })
    );
    expect(Notifications.scheduleNotificationAsync).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        content: expect.objectContaining({ data: expect.objectContaining({ screen: '/affirmations' }) }),
        trigger: expect.objectContaining({ type: 'daily', hour: 14 }),
      })
    );
    expect(Notifications.scheduleNotificationAsync).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        content: expect.objectContaining({ data: expect.objectContaining({ screen: '/planner' }) }),
        trigger: expect.objectContaining({ type: 'date', date: dueDate }),
      })
    );
    expect(JSON.parse(values.get(DUE_DATE_REMINDER_IDS_KEY)!)).toEqual([
      'notification-3',
    ]);
  });

  it('does not schedule due-date reminders while notifications are off', async () => {
    const Notifications = createNotifications();
    const { storage, values } = createStorage();
    const dueDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const service = createNotificationService(
      Notifications,
      storage,
      'ios',
      async () => ({
        daily: [],
        dueDates: [
          { title: 'Goal due', body: 'Open your goal.', screen: '/goals', date: dueDate, category: 'goalReminders' },
        ],
      })
    );

    await expect(service.scheduleDueDateReminders()).resolves.toEqual([]);

    expect(values.has(NOTIFICATIONS_KEY)).toBe(false);
    expect(values.has(MOOD_REMINDER_IDS_KEY)).toBe(false);
    expect(values.has(DUE_DATE_REMINDER_IDS_KEY)).toBe(false);
    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('turns off selected categories without querying or replacing enabled ones', async () => {
    const Notifications = createNotifications();
    const future = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const scheduledIds: string[] = [];
    for (const [category, screen, type] of [
      ['dailyPlanning', '/goals', 'daily'],
      ['affirmations', '/affirmations', 'daily'],
      ['libraryPicks', '/library', 'daily'],
      ['goalReminders', '/goals', 'date'],
      ['planReminders', '/planner', 'date'],
    ] as const) {
      scheduledIds.push(await Notifications.scheduleNotificationAsync({
        content: { title: category, body: 'Reminder', data: { category, screen } },
        trigger: type === 'daily'
          ? { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: 9, minute: 0 }
          : { type: Notifications.SchedulableTriggerInputTypes.DATE, date: future },
      }));
    }
    vi.mocked(Notifications.scheduleNotificationAsync).mockClear();
    const contentProvider = vi.fn(async () => {
      throw new Error('offline');
    });
    const { storage, values } = createStorage({
      [NOTIFICATIONS_KEY]: 'true',
      [REMINDER_TIMES_KEY]: '[9,14]',
      [MOOD_REMINDER_IDS_KEY]: JSON.stringify(scheduledIds.slice(0, 3)),
      [DUE_DATE_REMINDER_IDS_KEY]: JSON.stringify(scheduledIds.slice(3)),
    });
    const service = createNotificationService(
      Notifications,
      storage,
      'ios',
      contentProvider
    );

    const saved = await service.setNotificationPreferences({
      dailyPlanning: false,
      goalReminders: true,
      planReminders: false,
      affirmations: true,
      libraryPicks: false,
      advisorNudges: true,
    });

    expect(saved).toEqual({
      dailyPlanning: false,
      goalReminders: true,
      planReminders: false,
      affirmations: true,
      libraryPicks: false,
      advisorNudges: true,
    });
    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith(scheduledIds[0]);
    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith(scheduledIds[2]);
    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith(scheduledIds[4]);
    expect(Notifications.cancelScheduledNotificationAsync).not.toHaveBeenCalledWith(scheduledIds[1]);
    expect(Notifications.cancelScheduledNotificationAsync).not.toHaveBeenCalledWith(scheduledIds[3]);
    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
    expect(contentProvider).not.toHaveBeenCalled();
    expect(JSON.parse(values.get(NOTIFICATION_PREFERENCES_KEY)!)).toEqual(saved);
  });

  it('uses a safe fallback when no personalized daily content is available', () => {
    expect(reminderContentForTimes([9, 14], [])).toHaveLength(2);
    expect(reminderContentForTimes([9], [
      { title: 'Plan', body: 'Open goals.', screen: '/goals', category: 'dailyPlanning' },
    ])).toEqual([
      { title: 'Plan', body: 'Open goals.', screen: '/goals', category: 'dailyPlanning' },
    ]);
  });

  it('does not replace deliberately disabled daily categories with a fallback', async () => {
    const Notifications = createNotifications();
    const { storage } = createStorage({
      [NOTIFICATIONS_KEY]: 'true',
      [REMINDER_TIMES_KEY]: '[9,14]',
      [NOTIFICATION_PREFERENCES_KEY]: JSON.stringify({
        dailyPlanning: false,
        goalReminders: true,
        planReminders: true,
        affirmations: false,
        libraryPicks: false,
      }),
    });
    const service = createNotificationService(
      Notifications,
      storage,
      'ios',
      async () => ({
        daily: [
          { title: 'Plan', body: 'Choose one step.', screen: '/goals', category: 'dailyPlanning' },
          { title: 'Affirmation', body: 'Keep going.', screen: '/affirmations', category: 'affirmations' },
        ],
        dueDates: [],
      })
    );

    await expect(service.scheduleMoodReminders()).resolves.toEqual([]);
    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('coalesces overlapping refreshes and runs one follow-up sync', async () => {
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
        daily: [{ title: 'Plan', body: 'Open goals.', screen: '/goals' as const, category: 'dailyPlanning' as const }],
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
    await vi.waitFor(() => expect(contentProvider).toHaveBeenCalledTimes(1));
    const second = service.scheduleMoodReminders();
    releaseContent();
    await expect(Promise.all([first, second])).resolves.toEqual([
      ['notification-2'],
      ['notification-2'],
    ]);
    expect(contentProvider).toHaveBeenCalledTimes(2);
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(2);
    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith(
      'notification-1'
    );
  });

  it('keeps the prior due-date schedule when replacement content cannot load', async () => {
    const Notifications = createNotifications();
    const { storage, values } = createStorage({
      [NOTIFICATIONS_KEY]: 'true',
      [DUE_DATE_REMINDER_IDS_KEY]: '["existing-due"]',
    });
    const service = createNotificationService(
      Notifications,
      storage,
      'ios',
      async () => {
        throw new Error('network unavailable');
      }
    );

    await expect(service.scheduleDueDateReminders()).rejects.toThrow(
      'network unavailable'
    );
    expect(Notifications.cancelScheduledNotificationAsync).not.toHaveBeenCalledWith(
      'existing-due'
    );
    expect(values.get(DUE_DATE_REMINDER_IDS_KEY)).toBe('["existing-due"]');
  });

  it('keeps the prior daily schedule when replacement content cannot load', async () => {
    const Notifications = createNotifications();
    const { storage, values } = createStorage({
      [NOTIFICATIONS_KEY]: 'true',
      [MOOD_REMINDER_IDS_KEY]: '["existing-daily"]',
    });
    const service = createNotificationService(
      Notifications,
      storage,
      'ios',
      async () => {
        throw new Error('network unavailable');
      }
    );

    await expect(service.scheduleMoodReminders()).rejects.toThrow('network unavailable');
    expect(Notifications.cancelScheduledNotificationAsync).not.toHaveBeenCalledWith(
      'existing-daily'
    );
    expect(values.get(MOOD_REMINDER_IDS_KEY)).toBe('["existing-daily"]');
  });

  it('cancels newly scheduled daily notifications when ID persistence fails', async () => {
    const Notifications = createNotifications();
    const { storage, values } = createStorage({
      [NOTIFICATIONS_KEY]: 'true',
      [REMINDER_TIMES_KEY]: '[9]',
    });
    vi.mocked(storage.setItem).mockRejectedValueOnce(new Error('storage failed'));
    const service = createNotificationService(Notifications, storage, 'ios');

    await expect(service.scheduleMoodReminders()).rejects.toThrow('storage failed');
    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith(
      'notification-1'
    );
    expect(values.has(MOOD_REMINDER_IDS_KEY)).toBe(false);
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
        daily: [{ title: 'Plan', body: 'Open goals.', screen: '/goals' as const, category: 'dailyPlanning' as const }],
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

    expect(contentProvider).toHaveBeenCalledTimes(3);
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

  it('rolls back delivery times when the new schedule cannot be built', async () => {
    const Notifications = createNotifications();
    const { storage, values } = createStorage({
      [NOTIFICATIONS_KEY]: 'true',
      [REMINDER_TIMES_KEY]: '[9]',
    });
    let calls = 0;
    const service = createNotificationService(
      Notifications,
      storage,
      'ios',
      async () => {
        calls += 1;
        if (calls === 1) throw new Error('new schedule failed');
        return {
          daily: [{
            title: 'Plan',
            body: 'Open goals.',
            screen: '/goals',
            category: 'dailyPlanning',
          }],
          dueDates: [],
        };
      }
    );

    await expect(service.setReminderTimes([20])).rejects.toThrow('new schedule failed');
    expect(values.get(REMINDER_TIMES_KEY)).toBe('[9]');
    expect(values.get(NOTIFICATIONS_KEY)).toBe('true');
    expect(calls).toBeGreaterThanOrEqual(3);
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
        daily: [{ title: 'Plan', body: 'Open goals.', screen: '/goals' as const, category: 'dailyPlanning' as const }],
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

  it('serializes a later disable behind permission-gated enablement', async () => {
    let releasePermission!: () => void;
    const permissionPending = new Promise<void>((resolve) => {
      releasePermission = resolve;
    });
    const Notifications = createNotifications();
    vi.mocked(Notifications.getPermissionsAsync).mockImplementationOnce(async () => {
      await permissionPending;
      return permission('granted');
    });
    const { storage, values } = createStorage({ [REMINDER_TIMES_KEY]: '[9]' });
    const service = createNotificationService(Notifications, storage, 'ios');

    const enable = service.setRemindersEnabled(true);
    await vi.waitFor(() => expect(Notifications.getPermissionsAsync).toHaveBeenCalled());
    const disable = service.setRemindersEnabled(false);
    releasePermission();

    await expect(Promise.all([enable, disable])).resolves.toEqual([true, false]);
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

  it('does not report master-off when failed enablement cleanup leaves an alert active', async () => {
    const Notifications = createNotifications();
    const originalSchedule = vi.mocked(
      Notifications.scheduleNotificationAsync
    ).getMockImplementation()!;
    vi.mocked(Notifications.scheduleNotificationAsync)
      .mockImplementationOnce(originalSchedule)
      .mockRejectedValueOnce(new Error('second schedule failed'));
    vi.mocked(Notifications.cancelScheduledNotificationAsync).mockRejectedValue(
      new Error('cancel failed')
    );
    const { storage, values } = createStorage({ [REMINDER_TIMES_KEY]: '[9,14]' });
    const service = createNotificationService(Notifications, storage, 'ios');

    await expect(service.setRemindersEnabled(true)).rejects.toThrow(
      'Some notifications are still active'
    );
    expect(values.get(NOTIFICATIONS_KEY)).toBe('true');
    expect(JSON.parse(values.get(MOOD_REMINDER_IDS_KEY)!)).toEqual([
      'notification-1',
    ]);
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
        daily: [{ title: 'Plan', body: 'Open goals.', screen: '/goals' as const, category: 'dailyPlanning' as const }],
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
      'daily reminders could not be removed'
    );

    expect(values.get(NOTIFICATIONS_KEY)).toBe('true');
    expect(JSON.parse(values.get(MOOD_REMINDER_IDS_KEY)!)).toEqual(['retry-me']);
  });

  it('master-off cancels Advisor notifications too', async () => {
    const Notifications = createNotifications();
    const { storage, values } = createStorage({
      [NOTIFICATIONS_KEY]: 'true',
      [ADVISOR_REMINDER_IDS_KEY]: '["advisor"]',
    });
    const service = createNotificationService(Notifications, storage, 'ios');

    await expect(service.setRemindersEnabled(false)).resolves.toBe(false);
    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('advisor');
    expect(values.has(ADVISOR_REMINDER_IDS_KEY)).toBe(false);
    expect(values.get(NOTIFICATIONS_KEY)).toBe('false');
  });

  it('discovers and cancels a legacy Advisor reminder without a stored ID', async () => {
    const Notifications = createNotifications();
    const legacyId = await Notifications.scheduleNotificationAsync({
      content: {
        title: 'A gentle check-in',
        body: 'Open MHtoolkit.',
        data: { screen: ADVISOR_NOTIFICATION_ROUTE },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: new Date(Date.now() + 60_000),
      },
    });
    vi.mocked(Notifications.cancelScheduledNotificationAsync).mockClear();
    const { storage } = createStorage({ [NOTIFICATIONS_KEY]: 'false' });
    const service = createNotificationService(Notifications, storage, 'ios');

    await expect(service.scheduleMoodReminders()).resolves.toEqual([]);
    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith(legacyId);
  });

  it('clears daily and due-date notifications at an owner boundary', async () => {
    const Notifications = createNotifications();
    const { storage, values } = createStorage({
      [NOTIFICATIONS_KEY]: 'true',
      [MOOD_REMINDER_IDS_KEY]: '["daily"]',
      [DUE_DATE_REMINDER_IDS_KEY]: '["due-date"]',
    });
    const service = createNotificationService(Notifications, storage, 'ios');

    await expect(service.clearAllReminders()).resolves.toBeUndefined();

    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('daily');
    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('due-date');
    expect(values.has(MOOD_REMINDER_IDS_KEY)).toBe(false);
    expect(values.has(DUE_DATE_REMINDER_IDS_KEY)).toBe(false);
    expect(values.get(NOTIFICATIONS_KEY)).toBe('false');
  });

  it('retains an uncancelled due-date ID so owner cleanup can be retried', async () => {
    const Notifications = createNotifications();
    vi.mocked(Notifications.cancelScheduledNotificationAsync)
      .mockResolvedValueOnce()
      .mockRejectedValueOnce(new Error('native cancellation failed'));
    const { storage, values } = createStorage({
      [NOTIFICATIONS_KEY]: 'true',
      [MOOD_REMINDER_IDS_KEY]: '["daily"]',
      [DUE_DATE_REMINDER_IDS_KEY]: '["retry-due-date"]',
    });
    const service = createNotificationService(Notifications, storage, 'ios');

    await expect(service.clearAllReminders()).rejects.toThrow(
      'due-date reminders could not be removed'
    );

    expect(values.has(MOOD_REMINDER_IDS_KEY)).toBe(false);
    expect(JSON.parse(values.get(DUE_DATE_REMINDER_IDS_KEY)!)).toEqual([
      'retry-due-date',
    ]);
    expect(values.get(NOTIFICATIONS_KEY)).toBe('true');
  });

  it('still attempts due-date cleanup when daily cancellation fails', async () => {
    const Notifications = createNotifications();
    vi.mocked(Notifications.cancelScheduledNotificationAsync)
      .mockRejectedValueOnce(new Error('daily cancellation failed'))
      .mockResolvedValueOnce();
    const { storage, values } = createStorage({
      [NOTIFICATIONS_KEY]: 'true',
      [MOOD_REMINDER_IDS_KEY]: '["retry-daily"]',
      [DUE_DATE_REMINDER_IDS_KEY]: '["due-date"]',
    });
    const service = createNotificationService(Notifications, storage, 'ios');

    await expect(service.clearAllReminders()).rejects.toThrow(
      'daily reminders could not be removed'
    );

    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('due-date');
    expect(JSON.parse(values.get(MOOD_REMINDER_IDS_KEY)!)).toEqual(['retry-daily']);
    expect(values.has(DUE_DATE_REMINDER_IDS_KEY)).toBe(false);
    expect(values.get(NOTIFICATIONS_KEY)).toBe('true');
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

  it('schedules one private Advisor reminder and replaces the previous one', async () => {
    const Notifications = createNotifications();
    const { storage, values } = createStorage({
      [NOTIFICATIONS_KEY]: 'true',
      [ADVISOR_REMINDER_IDS_KEY]: '["old-advisor"]',
    });
    const service = createNotificationService(Notifications, storage, 'ios');
    const date = new Date(Date.now() + 60_000);

    await expect(service.scheduleAdvisorReminder(date)).resolves.toBe(true);

    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('old-advisor');
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        content: {
          title: 'A gentle check-in',
          body: 'Open MHtoolkit when you are ready to choose one small next step.',
          data: { screen: ADVISOR_NOTIFICATION_ROUTE, category: 'advisorNudges' },
        },
        trigger: expect.objectContaining({ type: 'date', date }),
      })
    );
    expect(JSON.parse(values.get(ADVISOR_REMINDER_IDS_KEY)!)).toEqual(['notification-1']);
    await expect(service.hasAdvisorReminder()).resolves.toBe(true);
    await expect(service.cancelAdvisorReminder()).resolves.toBeUndefined();
    await expect(service.hasAdvisorReminder()).resolves.toBe(false);
  });

  it('does not schedule Advisor nudges while their category is off', async () => {
    const Notifications = createNotifications();
    const { storage } = createStorage({
      [NOTIFICATIONS_KEY]: 'true',
      [NOTIFICATION_PREFERENCES_KEY]: JSON.stringify({
        ...DEFAULT_NOTIFICATION_PREFERENCES,
        advisorNudges: false,
      }),
    });
    const service = createNotificationService(Notifications, storage, 'ios');

    await expect(
      service.scheduleAdvisorReminder(new Date(Date.now() + 60_000))
    ).resolves.toBe(false);
    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('cancels a newly scheduled Advisor reminder when persistence fails', async () => {
    const Notifications = createNotifications();
    const { storage } = createStorage();
    await storage.setItem(NOTIFICATIONS_KEY, 'true');
    vi.mocked(storage.setItem).mockRejectedValueOnce(new Error('storage failed'));
    const service = createNotificationService(Notifications, storage, 'ios');

    await expect(
      service.scheduleAdvisorReminder(new Date(Date.now() + 60_000))
    ).rejects.toThrow('storage failed');

    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith(
      'notification-1'
    );
  });

  it('serializes Advisor cancellation behind a pending schedule', async () => {
    let releasePermission!: () => void;
    const permissionPending = new Promise<void>((resolve) => {
      releasePermission = resolve;
    });
    const Notifications = createNotifications();
    vi.mocked(Notifications.getPermissionsAsync).mockImplementationOnce(async () => {
      await permissionPending;
      return permission('granted');
    });
    const { storage, values } = createStorage({ [NOTIFICATIONS_KEY]: 'true' });
    const service = createNotificationService(Notifications, storage, 'ios');

    const scheduling = service.scheduleAdvisorReminder(new Date(Date.now() + 60_000));
    const cancelling = service.cancelAdvisorReminder();
    releasePermission();

    await expect(scheduling).resolves.toBe(true);
    await expect(cancelling).resolves.toBeUndefined();
    expect(values.has(ADVISOR_REMINDER_IDS_KEY)).toBe(false);
    await expect(service.hasAdvisorReminder()).resolves.toBe(false);
  });

  it('prunes an Advisor reminder delivered or removed by the OS', async () => {
    const Notifications = createNotifications();
    const { storage, values } = createStorage({
      [ADVISOR_REMINDER_IDS_KEY]: '["delivered-advisor"]',
    });
    const service = createNotificationService(Notifications, storage, 'ios');

    await expect(service.hasAdvisorReminder()).resolves.toBe(false);
    expect(values.has(ADVISOR_REMINDER_IDS_KEY)).toBe(false);
  });

  it('records an Advisor reminder for recovery when persistence and cleanup both fail', async () => {
    const Notifications = createNotifications();
    const { storage, values } = createStorage({ [NOTIFICATIONS_KEY]: 'true' });
    vi.mocked(storage.setItem).mockRejectedValueOnce(new Error('storage failed'));
    vi.mocked(Notifications.cancelScheduledNotificationAsync).mockRejectedValueOnce(
      new Error('cancel failed')
    );
    const service = createNotificationService(Notifications, storage, 'ios');

    await expect(
      service.scheduleAdvisorReminder(new Date(Date.now() + 60_000))
    ).rejects.toThrow('could not be saved or removed');
    expect(JSON.parse(values.get(ADVISOR_REMINDER_IDS_KEY)!)).toEqual(['notification-1']);
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
    expect(notificationScreenFromResponse(response('/advisor'))).toBe('/advisor');
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
