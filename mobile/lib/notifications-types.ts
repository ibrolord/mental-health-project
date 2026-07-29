export type NotificationScreenData = {
  screen?: string;
};

export type NotificationResponseLike = {
  notification: {
    request: {
      content: {
        data?: NotificationScreenData;
      };
    };
  };
};

export type NotificationSubscription = {
  remove: () => void;
};

export type NotificationsModuleLike = {
  getLastNotificationResponseAsync: () => Promise<NotificationResponseLike | null>;
  addNotificationResponseReceivedListener: (
    listener: (response: NotificationResponseLike) => void
  ) => NotificationSubscription;
};

export type NotificationsHelperLike = {
  scheduleMoodReminders: () => Promise<void>;
};

export type NotificationsBundle = {
  Notifications: NotificationsModuleLike;
  notificationsHelper: NotificationsHelperLike;
};
