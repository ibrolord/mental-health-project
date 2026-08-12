export type NotificationScreenData = {
  screen?: unknown;
};

export type NotificationScreen =
  | '/(tabs)/tracker'
  | '/goals'
  | '/affirmations'
  | '/library'
  | '/planner';

export type NotificationResponseLike = {
  notification: {
    request: {
      content: {
        data?: NotificationScreenData;
      };
      trigger?: {
        payload?: NotificationScreenData;
      };
    };
  };
};

export type NotificationSubscription = {
  remove: () => void;
};

export type NotificationsModuleLike = {
  getLastNotificationResponseAsync: () => Promise<NotificationResponseLike | null>;
  clearLastNotificationResponseAsync: () => Promise<void>;
  addNotificationResponseReceivedListener: (
    listener: (response: NotificationResponseLike) => void
  ) => NotificationSubscription;
};

export type NotificationsHelperLike = {
  scheduleMoodReminders: () => Promise<void>;
  scheduleDueDateReminders: () => Promise<void>;
};

export type NotificationsBundle = {
  Notifications: NotificationsModuleLike;
  notificationsHelper: NotificationsHelperLike;
};

const ALLOWED_NOTIFICATION_SCREENS = new Set<NotificationScreen>([
  '/(tabs)/tracker',
  '/goals',
  '/affirmations',
  '/library',
  '/planner',
]);

export function notificationScreenFromResponse(
  response: NotificationResponseLike | null
): NotificationScreen | null {
  const request = response?.notification.request;
  const candidates = [
    request?.content.data?.screen,
    request?.trigger?.payload?.screen,
  ];

  for (const screen of candidates) {
    if (
      typeof screen === 'string' &&
      ALLOWED_NOTIFICATION_SCREENS.has(screen as NotificationScreen)
    ) {
      return screen as NotificationScreen;
    }
  }
  return null;
}
