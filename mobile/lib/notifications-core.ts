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
export const NOTIFICATION_PREFERENCES_KEY = 'notification_preferences_v1';
export const MOOD_REMINDER_IDS_KEY = 'mood_reminder_notification_ids';
export const DUE_DATE_REMINDER_IDS_KEY = 'due_date_reminder_notification_ids';
export const ADVISOR_REMINDER_IDS_KEY = 'advisor_reminder_notification_ids';
export const DEFAULT_REMINDER_TIMES = [9, 14, 20] as const;
export const MOOD_TRACKER_NOTIFICATION_ROUTE = '/(tabs)/tracker';
export const ADVISOR_NOTIFICATION_ROUTE = '/advisor';
export const ADVISOR_DAILY_BRIEF_KIND = 'advisorDailyBrief';
export const ADVISOR_ACTION_REMINDER_KIND = 'advisorActionReminder';
export const AUTOMATIC_ADVISOR_REMINDER_KIND = 'automaticAdvisorReminder';
export const AUTOMATIC_ADVISOR_REMINDER_ID = 'advisor-automatic-follow-up';
export const AUTOMATIC_ADVISOR_REMINDERS_KEY = 'advisor_automatic_reminders_v1';

export type AutomaticAdvisorReminderInput = {
  ownerKey: string;
  actionId: string;
  followUpAt: string;
  quietStartHour: number;
  quietEndHour: number;
};

export type AutomaticAdvisorReminderResult = 'scheduled' | 'unchanged' | 'disabled' | 'elapsed';

type AutomaticAdvisorReminderRecord = Pick<
  AutomaticAdvisorReminderInput, 'ownerKey' | 'actionId' | 'followUpAt'
> & {
  scheduledFor: string;
  attemptId: string | null;
  state: 'pending' | 'cancelled' | 'consumed' | 'ambiguous';
};

const MAX_AUTOMATIC_ADVISOR_RECORDS = 64;

function parseAutomaticAdvisorRecords(raw: string | null): AutomaticAdvisorReminderRecord[] {
  if (raw === null) return [];
  const value: unknown = JSON.parse(raw);
  if (!Array.isArray(value) || value.length > MAX_AUTOMATIC_ADVISOR_RECORDS || value.some((row) =>
    !row || typeof row !== 'object' ||
    typeof row.ownerKey !== 'string' || !row.ownerKey.trim() ||
    typeof row.actionId !== 'string' || !row.actionId.trim() ||
    typeof row.followUpAt !== 'string' || !Number.isFinite(Date.parse(row.followUpAt)) ||
    typeof row.scheduledFor !== 'string' || !Number.isFinite(Date.parse(row.scheduledFor)) ||
    (row.state !== undefined && !['pending', 'cancelled', 'consumed', 'ambiguous'].includes(row.state)) ||
    (row.attemptId !== undefined && row.attemptId !== null &&
      (typeof row.attemptId !== 'string' || !row.attemptId)) ||
    ((row.state === 'pending' || row.state === 'cancelled') && !row.attemptId)
  )) {
    throw new Error('Invalid automatic Advisor reminder state.');
  }
  // Legacy journal entries have no native correlation proof and must never be replayed.
  return value.map((row) => ({ ...row, state: row.state ?? 'ambiguous', attemptId: row.attemptId ?? null }));
}

function automaticAdvisorDate(input: AutomaticAdvisorReminderInput): Date | null {
  const { quietStartHour: start, quietEndHour: end } = input;
  if (!Number.isInteger(start) || start < 0 || start > 23 ||
      !Number.isInteger(end) || end < 0 || end > 23 || start === end) return null;
  const date = new Date(input.followUpAt);
  if (!Number.isFinite(date.getTime())) return null;
  const isQuiet = (hour: number) =>
    start < end ? hour >= start && hour < end : hour >= start || hour < end;
  if (isQuiet(date.getHours())) {
    // Calendar construction crosses midnight and DST without adding a fixed 24 hours.
    const day = date.getDate() + (start > end && date.getHours() >= start ? 1 : 0);
    for (let offset = 0; offset < 2; offset += 1) {
      const candidate = new Date(date.getFullYear(), date.getMonth(), day + offset, end, 0, 0, 0);
      // A spring-forward gap can erase the entire allowed hour; skip that day safely.
      if (candidate.getTime() >= date.getTime() && !isQuiet(candidate.getHours())) return candidate;
    }
    return null;
  }
  return date;
}

export type NotificationCategory =
  | 'dailyPlanning'
  | 'goalReminders'
  | 'planReminders'
  | 'routineReminders'
  | 'affirmations'
  | 'libraryPicks'
  | 'advisorNudges';

export type NotificationPreferences = Record<NotificationCategory, boolean>;

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  dailyPlanning: true,
  goalReminders: true,
  planReminders: true,
  routineReminders: true,
  affirmations: true,
  libraryPicks: true,
  advisorNudges: true,
};

export type ReminderContent = {
  title: string;
  body: string;
  screen: NotificationScreen;
  category: NotificationCategory;
  deliveryKind?: typeof ADVISOR_DAILY_BRIEF_KIND;
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
  category: 'dailyPlanning',
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

export function normalizeNotificationPreferences(
  value: unknown
): NotificationPreferences {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { ...DEFAULT_NOTIFICATION_PREFERENCES };
  }
  const stored = value as Partial<Record<NotificationCategory, unknown>>;
  return {
    dailyPlanning: typeof stored.dailyPlanning === 'boolean'
      ? stored.dailyPlanning
      : DEFAULT_NOTIFICATION_PREFERENCES.dailyPlanning,
    goalReminders: typeof stored.goalReminders === 'boolean'
      ? stored.goalReminders
      : DEFAULT_NOTIFICATION_PREFERENCES.goalReminders,
    planReminders: typeof stored.planReminders === 'boolean'
      ? stored.planReminders
      : DEFAULT_NOTIFICATION_PREFERENCES.planReminders,
    routineReminders: typeof stored.routineReminders === 'boolean'
      ? stored.routineReminders
      : DEFAULT_NOTIFICATION_PREFERENCES.routineReminders,
    affirmations: typeof stored.affirmations === 'boolean'
      ? stored.affirmations
      : DEFAULT_NOTIFICATION_PREFERENCES.affirmations,
    libraryPicks: typeof stored.libraryPicks === 'boolean'
      ? stored.libraryPicks
      : DEFAULT_NOTIFICATION_PREFERENCES.libraryPicks,
    advisorNudges: typeof stored.advisorNudges === 'boolean'
      ? stored.advisorNudges
      : DEFAULT_NOTIFICATION_PREFERENCES.advisorNudges,
  };
}

export function parseStoredNotificationPreferences(
  value: string | null
): NotificationPreferences {
  if (!value) return { ...DEFAULT_NOTIFICATION_PREFERENCES };
  try {
    return normalizeNotificationPreferences(JSON.parse(value));
  } catch {
    return { ...DEFAULT_NOTIFICATION_PREFERENCES };
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

function dailyCategoryFor(content: ReminderContent): NotificationCategory {
  if (content.category && content.category in DEFAULT_NOTIFICATION_PREFERENCES) {
    return content.category;
  }
  if (content.screen === '/affirmations') return 'affirmations';
  if (content.screen === '/library') return 'libraryPicks';
  return 'dailyPlanning';
}

function dueDateCategoryFor(reminder: DueDateReminder): NotificationCategory {
  if (reminder.category && reminder.category in DEFAULT_NOTIFICATION_PREFERENCES) {
    return reminder.category;
  }
  return reminder.screen === '/planner' ? 'planReminders' : 'goalReminders';
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
  }),
  currentOwner: () => Promise<string | null> = async () => null
) {
  let handlerConfigured = false;
  type ReminderKind = 'daily' | 'dueDates';
  type ReminderSync = { generation: number; owner: string | null; dirty: boolean; promise: Promise<string[]> };
  const reminderSyncs: Partial<Record<ReminderKind, ReminderSync>> = {};
  // Settings changes and owner-boundary cleanup invalidate even an off/on ABA cycle.
  let reminderGeneration = 0;
  let minimumRebuildGeneration = 0;
  let reminderMutationTail: Promise<void> = Promise.resolve();

  function enqueueReminderMutation<T>(operation: () => Promise<T>): Promise<T> {
    const run = reminderMutationTail.then(operation, operation);
    reminderMutationTail = run.then(
      () => undefined,
      () => undefined
    );
    return run;
  }

  function advanceReminderGeneration(preservePreparedContent = false): number {
    ++reminderGeneration;
    if (!preservePreparedContent) minimumRebuildGeneration = reminderGeneration;
    return reminderGeneration;
  }

  const canRebuild = (generation: number) => generation >= minimumRebuildGeneration && generation <= reminderGeneration;

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

  function isAutomaticAdvisorReminder(
    request: Awaited<ReturnType<NotificationsModule['getAllScheduledNotificationsAsync']>>[number]
  ): boolean {
    return request.identifier === AUTOMATIC_ADVISOR_REMINDER_ID ||
      request.content.data?.deliveryKind === AUTOMATIC_ADVISOR_REMINDER_KIND;
  }

  function isAdvisorActionReminder(
    request: Awaited<ReturnType<NotificationsModule['getAllScheduledNotificationsAsync']>>[number]
  ): boolean {
    const data = request.content.data;
    const values = data && typeof data === 'object'
      ? (data as Record<string, unknown>)
      : {};
    const trigger = request.trigger && typeof request.trigger === 'object'
      ? request.trigger as Record<string, unknown>
      : {};
    const oneShot = trigger.type === Notifications.SchedulableTriggerInputTypes.DATE ||
      ((trigger.type === 'calendar' || trigger.type === 'timeInterval') && trigger.repeats === false);
    return isAutomaticAdvisorReminder(request) ||
      values.deliveryKind === ADVISOR_ACTION_REMINDER_KIND ||
      ((values.category === 'advisorNudges' || values.screen === ADVISOR_NOTIFICATION_ROUTE) &&
        values.deliveryKind !== ADVISOR_DAILY_BRIEF_KIND && oneShot);
  }

  async function cancelStoredReminders(
    storageKey: string,
    failureMessage: string
  ): Promise<void> {
    configureHandler();
    const storedIds = parseStoredNotificationIds(
      await storage.getItem(storageKey)
    );
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    const discoveredIds = scheduled
      .filter((request) => {
        const data = request.content.data;
        const category = data && typeof data === 'object'
          ? (data as Record<string, unknown>).category
          : null;
        const screen = data && typeof data === 'object'
          ? (data as Record<string, unknown>).screen
          : null;
        const triggerType = request.trigger && typeof request.trigger === 'object'
          ? (request.trigger as Record<string, unknown>).type
          : null;
        if (storageKey === ADVISOR_REMINDER_IDS_KEY) {
          return isAdvisorActionReminder(request);
        }
        if (storageKey === DUE_DATE_REMINDER_IDS_KEY) {
          return category === 'goalReminders' ||
            category === 'planReminders' ||
            (triggerType === Notifications.SchedulableTriggerInputTypes.DATE &&
              (screen === '/goals' || screen === '/planner'));
        }
        return category === 'dailyPlanning' ||
          category === 'routineReminders' ||
          category === 'affirmations' ||
          category === 'libraryPicks' ||
          triggerType === Notifications.SchedulableTriggerInputTypes.DAILY;
      })
      .map((request) => request.identifier);
    const ids = Array.from(new Set([
      ...storedIds,
      ...discoveredIds,
      ...(storageKey === ADVISOR_REMINDER_IDS_KEY ? [AUTOMATIC_ADVISOR_REMINDER_ID] : []),
    ]));

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

  async function cancelAdvisorReminderInternal(forgetHistory = false): Promise<void> {
    if (!forgetHistory && await storage.getItem(AUTOMATIC_ADVISOR_REMINDERS_KEY) !== null) {
      await cancelAutomaticAdvisorReminderInternal(false);
    }
    return cancelStoredReminders(
      ADVISOR_REMINDER_IDS_KEY,
      'The Advisor reminder could not be removed.'
    );
  }

  function categoryForScheduledRequest(
    request: Awaited<ReturnType<NotificationsModule['getAllScheduledNotificationsAsync']>>[number]
  ): NotificationCategory | null {
    if (isAutomaticAdvisorReminder(request)) return 'advisorNudges';
    const data = request.content.data;
    const category = data && typeof data === 'object'
      ? (data as Record<string, unknown>).category
      : null;
    if (
      typeof category === 'string' &&
      category in DEFAULT_NOTIFICATION_PREFERENCES
    ) {
      return category as NotificationCategory;
    }
    const screen = data && typeof data === 'object'
      ? (data as Record<string, unknown>).screen
      : null;
    const triggerType = request.trigger && typeof request.trigger === 'object'
      ? (request.trigger as Record<string, unknown>).type
      : null;
    if (screen === ADVISOR_NOTIFICATION_ROUTE) return 'advisorNudges';
    if (screen === '/habits') return 'routineReminders';
    if (screen === '/affirmations') return 'affirmations';
    if (screen === '/library') return 'libraryPicks';
    if (triggerType === Notifications.SchedulableTriggerInputTypes.DAILY) {
      return 'dailyPlanning';
    }
    if (triggerType === Notifications.SchedulableTriggerInputTypes.DATE) {
      if (screen === '/planner') return 'planReminders';
      if (screen === '/goals') return 'goalReminders';
    }
    return null;
  }

  function storageKeyForCategory(category: NotificationCategory): string {
    if (category === 'advisorNudges') return ADVISOR_REMINDER_IDS_KEY;
    if (category === 'goalReminders' || category === 'planReminders') {
      return DUE_DATE_REMINDER_IDS_KEY;
    }
    return MOOD_REMINDER_IDS_KEY;
  }

  async function cancelNotificationCategories(
    categories: readonly NotificationCategory[]
  ): Promise<void> {
    const categorySet = new Set(categories);
    if (categorySet.has('advisorNudges')) await cancelAdvisorReminderInternal();
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    const targets = scheduled.filter((request) => {
      const category = categoryForScheduledRequest(request);
      return category !== null && categorySet.has(category);
    });
    const results = await Promise.allSettled(
      targets.map((request) =>
        Notifications.cancelScheduledNotificationAsync(request.identifier)
      )
    );
    const successfulIds = new Set(
      targets
        .filter((_, index) => results[index].status === 'fulfilled')
        .map((request) => request.identifier)
    );
    const failedByStorageKey = new Map<string, string[]>();
    targets.forEach((request, index) => {
      if (results[index].status !== 'rejected') return;
      const category = categoryForScheduledRequest(request);
      if (!category) return;
      const key = storageKeyForCategory(category);
      failedByStorageKey.set(key, [
        ...(failedByStorageKey.get(key) ?? []),
        request.identifier,
      ]);
    });

    for (const key of [
      MOOD_REMINDER_IDS_KEY,
      DUE_DATE_REMINDER_IDS_KEY,
      ADVISOR_REMINDER_IDS_KEY,
    ]) {
      const retained = parseStoredNotificationIds(await storage.getItem(key))
        .filter((id) => !successfulIds.has(id));
      const next = Array.from(new Set([
        ...retained,
        ...(failedByStorageKey.get(key) ?? []),
      ]));
      if (next.length > 0) {
        await storage.setItem(key, JSON.stringify(next));
      } else {
        await storage.removeItem(key);
      }
    }

    if (results.some((result) => result.status === 'rejected')) {
      throw new Error('One or more notifications could not be removed. Try again.');
    }
  }

  async function reconcileAdvisorReminder(): Promise<boolean> {
    const storedIds = parseStoredNotificationIds(
      await storage.getItem(ADVISOR_REMINDER_IDS_KEY)
    );
    const scheduled = (await Notifications.getAllScheduledNotificationsAsync())
      .filter((request) => !isAutomaticAdvisorReminder(request));
    const activeIds = new Set(scheduled.map((request) => request.identifier));
    const discoveredIds = scheduled
      .filter(isAdvisorActionReminder)
      .map((request) => request.identifier);
    const retainedIds = Array.from(new Set([
      ...storedIds.filter((id) => activeIds.has(id)),
      ...discoveredIds,
    ]));
    if (retainedIds.length === 0) {
      await storage.removeItem(ADVISOR_REMINDER_IDS_KEY);
      return false;
    }
    if (
      retainedIds.length !== storedIds.length ||
      retainedIds.some((id, index) => id !== storedIds[index])
    ) {
      await storage.setItem(ADVISOR_REMINDER_IDS_KEY, JSON.stringify(retainedIds));
    }
    return true;
  }

  type ReminderSnapshot = {
    generation: number;
    owner: string | null;
    enabledRaw: string | null;
    timesRaw: string | null;
    preferencesRaw: string | null;
    times: number[];
    preferences: NotificationPreferences;
    permitted: boolean;
  };
  type PreparedReminders = { snapshot: ReminderSnapshot; plan: ReminderSchedulePlan | null };

  async function prepareReminders(generation: number, owner: string | null): Promise<PreparedReminders | null> {
    const snapshot = await enqueueReminderMutation(async (): Promise<ReminderSnapshot | null> => {
      if (!canRebuild(generation) || await currentOwner() !== owner) return null;
      const enabledRaw = await storage.getItem(NOTIFICATIONS_KEY);
      const timesRaw = await storage.getItem(REMINDER_TIMES_KEY);
      const preferencesRaw = await storage.getItem(NOTIFICATION_PREFERENCES_KEY);
      return {
        generation, owner, enabledRaw, timesRaw, preferencesRaw,
        times: parseStoredReminderTimes(timesRaw),
        preferences: parseStoredNotificationPreferences(preferencesRaw),
        permitted: enabledRaw === 'true' && await hasPermission(),
      };
    });
    if (!snapshot) return null;
    // Never await remote content while holding the shared native mutation queue.
    const plan = snapshot.permitted ? await contentProvider(snapshot.times) : null;
    return { snapshot, plan };
  }

  async function reminderSnapshotIsCurrent(snapshot: ReminderSnapshot): Promise<boolean> {
    if (!canRebuild(snapshot.generation) ||
        snapshot.enabledRaw !== await storage.getItem(NOTIFICATIONS_KEY) ||
        snapshot.timesRaw !== await storage.getItem(REMINDER_TIMES_KEY)) return false;
    const preferencesRaw = await storage.getItem(NOTIFICATION_PREFERENCES_KEY);
    if (snapshot.preferencesRaw !== preferencesRaw) {
      const preferences = parseStoredNotificationPreferences(preferencesRaw);
      // Category-only cancellation may filter prepared content, but cannot discard
      // an in-flight time rebuild or permit a previously disabled category.
      if (snapshot.generation === reminderGeneration ||
          (Object.keys(preferences) as NotificationCategory[]).some((key) => preferences[key] && !snapshot.preferences[key])) return false;
      snapshot.preferencesRaw = preferencesRaw;
      snapshot.preferences = preferences;
    }
    return canRebuild(snapshot.generation) && snapshot.owner === await currentOwner();
  }

  const obsoleteReminderSnapshot = Symbol('obsoleteReminderSnapshot');

  async function requireCurrentReminderSnapshot(snapshot: ReminderSnapshot): Promise<void> {
    if (!await reminderSnapshotIsCurrent(snapshot)) throw obsoleteReminderSnapshot;
  }

  async function compensatePreparedReminderIds(storageKey: string, ids: string[]): Promise<void> {
    if (!ids.length) return;
    const results = await Promise.allSettled(ids.map((id) => Notifications.cancelScheduledNotificationAsync(id)));
    const failedIds = ids.filter((_, index) => results[index].status === 'rejected');
    const retained = parseStoredNotificationIds(await storage.getItem(storageKey)).filter((id) => !ids.includes(id));
    const next = Array.from(new Set([...retained, ...failedIds]));
    if (next.length) await storage.setItem(storageKey, JSON.stringify(next));
    else await storage.removeItem(storageKey);
    if (failedIds.length) throw new Error('Some notifications could not be removed after the profile changed. Try clearing reminders again.');
  }

  async function scheduleMoodRemindersInternal({ snapshot, plan }: PreparedReminders): Promise<string[]> {
    configureHandler();
    if (snapshot.enabledRaw !== 'true') {
      const [dailyResult, advisorResult] = await Promise.allSettled([
        cancelMoodReminders(),
        cancelAdvisorReminderInternal(),
      ]);
      if (dailyResult.status === 'rejected') throw dailyResult.reason;
      if (advisorResult.status === 'rejected') throw advisorResult.reason;
      return [];
    }
    const permitted = snapshot.permitted && await hasPermission();
    if (!await reminderSnapshotIsCurrent(snapshot)) return [];
    if (!permitted) {
      await cancelMoodReminders();
      return [];
    }

    if (!plan) return [];
    await ensureAndroidChannel();
    if (!await reminderSnapshotIsCurrent(snapshot)) return [];
    const { times, preferences } = snapshot;
    await cancelMoodReminders();
    const scheduledIds: string[] = [];
    const enabledContent = plan.daily.filter(
      (content) => preferences[dailyCategoryFor(content)]
    );
    if (enabledContent.length === 0) return [];
    const dailyContent = reminderContentForTimes(times, enabledContent);

    try {
      for (const [index, hour] of times.entries()) {
        await requireCurrentReminderSnapshot(snapshot);
        const content = dailyContent[index];
        const request: NotificationRequestInput = {
          content: {
            title: content.title,
            body: content.body,
            data: {
              screen: content.screen,
              category: dailyCategoryFor(content),
              ...(content.deliveryKind ? { deliveryKind: content.deliveryKind } : {}),
            },
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
      await requireCurrentReminderSnapshot(snapshot);
      await storage.setItem(MOOD_REMINDER_IDS_KEY, JSON.stringify(scheduledIds));
      await requireCurrentReminderSnapshot(snapshot);
    } catch (error) {
      await compensatePreparedReminderIds(MOOD_REMINDER_IDS_KEY, scheduledIds);
      if (error === obsoleteReminderSnapshot) return [];
      throw error;
    }
    return scheduledIds;
  }

  async function scheduleDueDateRemindersInternal({ snapshot, plan }: PreparedReminders): Promise<string[]> {
    configureHandler();
    if (snapshot.enabledRaw !== 'true') {
      await cancelDueDateReminders();
      return [];
    }
    const permitted = snapshot.permitted && await hasPermission();
    if (!await reminderSnapshotIsCurrent(snapshot)) return [];
    if (!permitted) {
      await cancelDueDateReminders();
      return [];
    }

    if (!plan) return [];
    await ensureAndroidChannel();
    if (!await reminderSnapshotIsCurrent(snapshot)) return [];
    const { preferences } = snapshot;
    const scheduledIds: string[] = [];
    const dueDates = validDueDateReminders(plan.dueDates)
      .filter((reminder) => preferences[dueDateCategoryFor(reminder)])
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .slice(0, 24);

    // Keep the previous schedule intact until replacement content is ready.
    await cancelDueDateReminders();

    try {
      for (const dueDate of dueDates) {
        await requireCurrentReminderSnapshot(snapshot);
        const request: NotificationRequestInput = {
          content: {
            title: dueDate.title,
            body: dueDate.body,
            data: { screen: dueDate.screen, category: dueDateCategoryFor(dueDate) },
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            ...(platform === 'android' ? { channelId: 'mood-reminders' } : {}),
            date: dueDate.date,
          },
        };
        scheduledIds.push(await Notifications.scheduleNotificationAsync(request));
      }
      await requireCurrentReminderSnapshot(snapshot);
      if (scheduledIds.length) await storage.setItem(DUE_DATE_REMINDER_IDS_KEY, JSON.stringify(scheduledIds));
      else await storage.removeItem(DUE_DATE_REMINDER_IDS_KEY);
      await requireCurrentReminderSnapshot(snapshot);
    } catch (error) {
      await compensatePreparedReminderIds(DUE_DATE_REMINDER_IDS_KEY, scheduledIds);
      if (error === obsoleteReminderSnapshot) return [];
      throw error;
    }
    return scheduledIds;
  }

  async function refreshReminderKind(kind: ReminderKind, generation: number, owner: string | null): Promise<string[]> {
    const prepared = await prepareReminders(generation, owner);
    if (!prepared) return [];
    return enqueueReminderMutation(async () => {
      if (!await reminderSnapshotIsCurrent(prepared.snapshot)) return [];
      return kind === 'daily' ? scheduleMoodRemindersInternal(prepared) : scheduleDueDateRemindersInternal(prepared);
    });
  }

  async function scheduleReminders(kind: ReminderKind): Promise<string[]> {
    const generation = reminderGeneration;
    const owner = await currentOwner();
    const existing = reminderSyncs[kind];
    if (existing && canRebuild(existing.generation) && existing.owner === owner) {
      existing.dirty = true;
      return existing.promise;
    }
    const sync: ReminderSync = { generation, owner, dirty: false, promise: Promise.resolve([]) };
    sync.promise = (async () => {
      let result: string[] = [];
      do {
        sync.dirty = false;
        result = await refreshReminderKind(kind, generation, owner);
      } while (sync.dirty && canRebuild(generation));
      return result;
    })();
    reminderSyncs[kind] = sync;
    try { return await sync.promise; }
    finally { if (reminderSyncs[kind] === sync) delete reminderSyncs[kind]; }
  }

  const scheduleMoodReminders = () => scheduleReminders('daily');
  const scheduleDueDateReminders = () => scheduleReminders('dueDates');

  async function refreshBothReminderKinds(generation: number, owner: string | null): Promise<void> {
    await refreshReminderKind('daily', generation, owner);
    await refreshReminderKind('dueDates', generation, owner);
  }

  async function cancelAllReminderKinds(forgetHistory = false): Promise<void> {
    const results = await Promise.allSettled([
      cancelMoodReminders(), cancelDueDateReminders(), cancelAdvisorReminderInternal(forgetHistory),
    ]);
    for (const result of results) if (result.status === 'rejected') throw result.reason;
  }

  async function setRemindersEnabled(enabled: boolean): Promise<boolean> {
    const owner = enabled ? await currentOwner() : null;
    const generation = await enqueueReminderMutation(async () => {
      if (enabled && await currentOwner() !== owner) return null;
      const nextGeneration = advanceReminderGeneration();
      if (!enabled || !(await requestPermissions())) {
        await cancelAllReminderKinds();
        await storage.setItem(NOTIFICATIONS_KEY, 'false');
        return null;
      }
      await storage.setItem(NOTIFICATIONS_KEY, 'true');
      return nextGeneration;
    });
    if (generation === null) return false;
    try {
      await refreshBothReminderKinds(generation, owner);
      return enqueueReminderMutation(async () =>
        canRebuild(generation) && await currentOwner() === owner &&
        (await storage.getItem(NOTIFICATIONS_KEY)) === 'true'
      );
    } catch (error) {
      await enqueueReminderMutation(async () => {
        if (generation !== reminderGeneration || await currentOwner() !== owner) return;
        advanceReminderGeneration();
        try { await cancelAllReminderKinds(); }
        catch {
          throw new Error('Some notifications are still active. Try turning notifications off again.');
        }
        await storage.setItem(NOTIFICATIONS_KEY, 'false');
      });
      throw error;
    }
  }

  async function clearAllReminders(isCurrent?: () => Promise<boolean>): Promise<void> {
    return enqueueReminderMutation(async () => {
      if (isCurrent && !await isCurrent()) return;
      advanceReminderGeneration();
      await cancelAllReminderKinds(true);
      if ((await Notifications.getAllScheduledNotificationsAsync()).some(isAutomaticAdvisorReminder)) {
        throw new Error('The automatic Advisor reminder could not be removed.');
      }
      await storage.setItem(NOTIFICATIONS_KEY, 'false');
      await storage.removeItem(AUTOMATIC_ADVISOR_REMINDERS_KEY);
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

    await updateReminderSetting(REMINDER_TIMES_KEY, JSON.stringify(normalized), 'Notification times');
    return normalized;
  }

  async function getReminderTimes(): Promise<number[]> {
    return parseStoredReminderTimes(await storage.getItem(REMINDER_TIMES_KEY));
  }

  async function getNotificationPreferences(): Promise<NotificationPreferences> {
    return parseStoredNotificationPreferences(
      await storage.getItem(NOTIFICATION_PREFERENCES_KEY)
    );
  }

  async function setNotificationPreferences(
    preferences: NotificationPreferences
  ): Promise<NotificationPreferences> {
    const normalized = normalizeNotificationPreferences(preferences);
    await updateReminderSetting(NOTIFICATION_PREFERENCES_KEY, JSON.stringify(normalized), 'Notification choices', async (previousRaw) => {
      const previous = parseStoredNotificationPreferences(previousRaw);
      const categories = Object.keys(
        DEFAULT_NOTIFICATION_PREFERENCES
      ) as NotificationCategory[];
      const disabledCategories = categories.filter(
        (category) => previous[category] && !normalized[category]
      );
      const enabledCategories = categories.filter(
        (category) => !previous[category] && normalized[category]
      );
      if ((await storage.getItem(NOTIFICATIONS_KEY)) === 'true' && disabledCategories.length > 0) {
        await cancelNotificationCategories(disabledCategories);
        if (enabledCategories.length === 0) return false;
      }
      if (!normalized.advisorNudges) await cancelAdvisorReminderInternal();
      return true;
    });
    return normalized;
  }

  async function updateReminderSetting(
    key: string,
    value: string,
    label: string,
    beforeWrite: (previousRaw: string | null) => Promise<boolean> = async () => true
  ): Promise<void> {
    const owner = await currentOwner();
    const attempt: { generation?: number; previousRaw?: string | null } = {};
    try {
      const change = await enqueueReminderMutation(async () => {
        if (await currentOwner() !== owner) throw new Error('The profile changed before notification settings could be saved.');
        attempt.generation = reminderGeneration;
        attempt.previousRaw = await storage.getItem(key);
        const needsRefresh = await beforeWrite(attempt.previousRaw);
        attempt.generation = advanceReminderGeneration(!needsRefresh);
        await storage.setItem(key, value);
        return { generation: attempt.generation, refresh: needsRefresh &&
          (await storage.getItem(NOTIFICATIONS_KEY)) === 'true' };
      });
      if (change.refresh) await refreshBothReminderKinds(change.generation, owner);
    } catch (error) {
      const restoredGeneration = await enqueueReminderMutation(async () => {
        if (attempt.generation !== reminderGeneration || attempt.previousRaw === undefined ||
            await currentOwner() !== owner) return null;
        const generation = advanceReminderGeneration();
        if (attempt.previousRaw === null) await storage.removeItem(key);
        else await storage.setItem(key, attempt.previousRaw);
        if (key === NOTIFICATION_PREFERENCES_KEY &&
            !parseStoredNotificationPreferences(attempt.previousRaw).advisorNudges) {
          await cancelAdvisorReminderInternal();
        }
        return (await storage.getItem(NOTIFICATIONS_KEY)) === 'true' ? generation : null;
      });
      if (restoredGeneration !== null) {
        try { await refreshBothReminderKinds(restoredGeneration, owner); }
        catch {
          await enqueueReminderMutation(async () => {
            if (restoredGeneration !== reminderGeneration || await currentOwner() !== owner) return;
            advanceReminderGeneration();
            await cancelAllReminderKinds();
            await storage.setItem(NOTIFICATIONS_KEY, 'false');
            throw new Error(`${label} could not be restored. Automatic notifications were turned off.`);
          });
        }
      }
      throw error;
    }
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
      if ((await storage.getItem(NOTIFICATIONS_KEY)) !== 'true') return false;
      const preferences = parseStoredNotificationPreferences(
        await storage.getItem(NOTIFICATION_PREFERENCES_KEY)
      );
      if (!preferences.advisorNudges) return false;
      if (!(await requestPermissions())) return false;
      await ensureAndroidChannel();
      if (await storage.getItem(AUTOMATIC_ADVISOR_REMINDERS_KEY) !== null) {
        await cancelAutomaticAdvisorReminderInternal(false);
      }
      const storedIds = parseStoredNotificationIds(
        await storage.getItem(ADVISOR_REMINDER_IDS_KEY)
      );
      const scheduledBefore = await Notifications.getAllScheduledNotificationsAsync();
      const discoveredIds = scheduledBefore
        .filter(isAdvisorActionReminder)
        .map((request) => request.identifier);
      const previousIds = Array.from(new Set([...storedIds, ...discoveredIds]));
      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title: 'How did your step go?',
          body: 'Mark it done, make it smaller, or choose a better time.',
          data: {
            screen: ADVISOR_NOTIFICATION_ROUTE,
            category: 'advisorNudges',
            deliveryKind: ADVISOR_ACTION_REMINDER_KIND,
          },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          ...(platform === 'android' ? { channelId: 'mood-reminders' } : {}),
          date,
        },
      });
      const cancellableIds = previousIds.filter((previousId) => previousId !== id);
      const cancellation = await Promise.allSettled(
        cancellableIds.map((previousId) =>
          Notifications.cancelScheduledNotificationAsync(previousId)
        )
      );
      if (cancellation.some((result) => result.status === 'rejected')) {
        let newReminderNeedsRecovery = false;
        try {
          await Notifications.cancelScheduledNotificationAsync(id);
        } catch {
          newReminderNeedsRecovery = true;
        }
        const retained = cancellableIds.filter(
          (_previousId, index) => cancellation[index]?.status === 'rejected'
        );
        if (newReminderNeedsRecovery) retained.push(id);
        if (retained.length > 0) {
          await storage.setItem(ADVISOR_REMINDER_IDS_KEY, JSON.stringify(retained));
        } else {
          await storage.removeItem(ADVISOR_REMINDER_IDS_KEY);
        }
        throw new Error('The previous Advisor reminder could not be replaced.');
      }
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

  type ScheduledRequest = Awaited<ReturnType<NotificationsModule['getAllScheduledNotificationsAsync']>>[number];

  function matchesAutomaticAttempt(request: ScheduledRequest, record: AutomaticAdvisorReminderRecord): boolean {
    return isAutomaticAdvisorReminder(request) && record.attemptId !== null &&
      request.content.data?.automaticAdvisorAttemptId === record.attemptId;
  }

  async function readAutomaticRecords(): Promise<AutomaticAdvisorReminderRecord[]> {
    return parseAutomaticAdvisorRecords(await storage.getItem(AUTOMATIC_ADVISOR_REMINDERS_KEY));
  }

  async function writeAutomaticRecords(records: AutomaticAdvisorReminderRecord[]): Promise<void> {
    await storage.setItem(AUTOMATIC_ADVISOR_REMINDERS_KEY, JSON.stringify(records));
  }

  async function cancelAutomaticAdvisorReminderInternal(resumable = false, ownerKey?: string): Promise<void> {
    let records: AutomaticAdvisorReminderRecord[] | null = null;
    let persistenceError: unknown;
    try {
      const raw = await storage.getItem(AUTOMATIC_ADVISOR_REMINDERS_KEY);
      try { records = parseAutomaticAdvisorRecords(raw); } catch { /* Keep corrupt history fail-closed. */ }
    } catch (error) { persistenceError = error; }
    let discoveryFailed = false;
    const scheduled = await Notifications.getAllScheduledNotificationsAsync().catch(() => {
      discoveryFailed = true;
      return [];
    });
    if (ownerKey !== undefined) {
      if (persistenceError) throw persistenceError;
      if (discoveryFailed) throw new Error('The automatic Advisor reminder could not be removed.');
      if (!records || scheduled.some((request) => isAutomaticAdvisorReminder(request) &&
          !records.some((record) => matchesAutomaticAttempt(request, record)))) {
        // Unknown ownership is not evidence that this owner's reminder was removed.
        throw new Error('An automatic Advisor reminder has unknown ownership. Clear all reminders before retrying.');
      }
    }
    const ownsRecord = (record: AutomaticAdvisorReminderRecord) => ownerKey === undefined || record.ownerKey === ownerKey;
    const ids = Array.from(new Set([
      ...(ownerKey === undefined ? [AUTOMATIC_ADVISOR_REMINDER_ID] : []),
      ...scheduled.filter((request) => isAutomaticAdvisorReminder(request) &&
        (ownerKey === undefined || records?.some((record) => ownsRecord(record) && matchesAutomaticAttempt(request, record))))
        .map((request) => request.identifier),
    ]));
    const recoverable = new Set(records?.filter((record) => ownsRecord(record) && resumable && record.state === 'pending' &&
      Date.parse(record.followUpAt) > Date.now() && Date.parse(record.scheduledFor) > Date.now() &&
      scheduled.some((request) => request.identifier === AUTOMATIC_ADVISOR_REMINDER_ID &&
        matchesAutomaticAttempt(request, record))).map((record) => record.attemptId));
    const prepared = records?.map((record): AutomaticAdvisorReminderRecord => ({
      ...record,
      state: !ownsRecord(record) ? record.state : record.state === 'pending' ? 'ambiguous' :
        !resumable && record.state === 'cancelled' ? 'consumed' : record.state,
    }));
    if (prepared?.length) {
      try { await writeAutomaticRecords(prepared); } catch (error) { persistenceError = error; }
    }
    const results = await Promise.allSettled(
      ids.map((id) => Notifications.cancelScheduledNotificationAsync(id))
    );
    const remaining = await Notifications.getAllScheduledNotificationsAsync().catch(() => {
      discoveryFailed = true;
      return [];
    });
    if (discoveryFailed || results.some((result) => result.status === 'rejected') ||
        remaining.some((request) => ids.includes(request.identifier))) {
      throw new Error('The automatic Advisor reminder could not be removed.');
    }
    if (persistenceError) throw persistenceError;
    if (prepared?.length) {
      await writeAutomaticRecords(prepared.map((record): AutomaticAdvisorReminderRecord => ({
        ...record,
        state: recoverable.has(record.attemptId) && Date.parse(record.followUpAt) > Date.now() &&
          Date.parse(record.scheduledFor) > Date.now() ? 'cancelled' : record.state,
      })));
    }
  }

  async function clearAutomaticAdvisorHistory(ownerKey: string): Promise<void> {
    if (!ownerKey.trim()) throw new Error('An owner is required to clear automatic Advisor history.');
    return enqueueReminderMutation(async () => {
      const records = await readAutomaticRecords();
      const owned = records.filter((record) => record.ownerKey === ownerKey);
      if (!owned.length) return;
      const scheduled = (await Notifications.getAllScheduledNotificationsAsync()).filter(isAutomaticAdvisorReminder);
      if (scheduled.some((request) => !records.some((record) => matchesAutomaticAttempt(request, record)))) {
        throw new Error('An automatic Advisor reminder has unknown ownership. Clear all reminders before retrying.');
      }
      const ids = scheduled.filter((request) => owned.some((record) => matchesAutomaticAttempt(request, record)))
        .map((request) => request.identifier);
      // Erasure cannot make a concurrent or failed cancellation resumable.
      await writeAutomaticRecords(records.map((record) => record.ownerKey === ownerKey
        ? { ...record, state: 'ambiguous' } : record));
      const results = await Promise.allSettled(ids.map((id) => Notifications.cancelScheduledNotificationAsync(id)));
      const remaining = await Notifications.getAllScheduledNotificationsAsync();
      if (results.some((result) => result.status === 'rejected') || remaining.some((request) => ids.includes(request.identifier))) {
        throw new Error('The automatic Advisor reminder could not be removed.');
      }
      const retained = records.filter((record) => record.ownerKey !== ownerKey);
      if (retained.length) await writeAutomaticRecords(retained);
      else await storage.removeItem(AUTOMATIC_ADVISOR_REMINDERS_KEY);
    });
  }

  async function reconcileAutomaticAdvisorReminder(
    input: AutomaticAdvisorReminderInput,
    isCurrent: () => Promise<boolean>
  ): Promise<AutomaticAdvisorReminderResult> {
    return enqueueReminderMutation(async () => {
      // A stale queued caller must not cancel a newer owner's notification.
      if (!(await isCurrent())) return 'disabled';
      const stop = async (result: AutomaticAdvisorReminderResult) => {
        await cancelAutomaticAdvisorReminderInternal();
        return result;
      };
      const date = automaticAdvisorDate(input);
      if (platform !== 'ios' || !date ||
          typeof input.ownerKey !== 'string' || !input.ownerKey.trim() ||
          typeof input.actionId !== 'string' || !input.actionId.trim() ||
          typeof input.followUpAt !== 'string' ||
          (await storage.getItem(NOTIFICATIONS_KEY)) !== 'true') return stop('disabled');

      let records: AutomaticAdvisorReminderRecord[];
      try {
        const raw = await storage.getItem(NOTIFICATION_PREFERENCES_KEY);
        const preferences: unknown = raw === null ? {} : JSON.parse(raw);
        if (!preferences || typeof preferences !== 'object' || Array.isArray(preferences) ||
            ('advisorNudges' in preferences && preferences.advisorNudges !== true)) {
          return stop('disabled');
        }
        records = await readAutomaticRecords();
      } catch {
        return stop('disabled');
      }
      if (!(await hasPermission())) return stop('disabled');
      if (await reconcileAdvisorReminder()) return stop('unchanged');

      const followUpAt = new Date(input.followUpAt).toISOString();
      const matches = (record: AutomaticAdvisorReminderRecord) =>
        record.ownerKey === input.ownerKey && record.actionId === input.actionId &&
        record.followUpAt === followUpAt;
      const previous = records.find(matches);
      if (previous) {
        const last = records[records.length - 1];
        if (previous !== last || previous.state === 'ambiguous' || previous.state === 'consumed' ||
            Date.parse(previous.scheduledFor) <= Date.now() || date.getTime() <= Date.now()) return stop('unchanged');
        const scheduled = await Notifications.getAllScheduledNotificationsAsync();
        if (previous.state === 'pending') {
          const pending = scheduled.find((request) => request.identifier === AUTOMATIC_ADVISOR_REMINDER_ID &&
            matchesAutomaticAttempt(request, previous));
          if (!pending) return stop('unchanged');
          if (previous.scheduledFor === date.toISOString()) {
            for (const orphan of scheduled.filter((request) => isAutomaticAdvisorReminder(request) && request !== pending)) {
              await Notifications.cancelScheduledNotificationAsync(orphan.identifier);
            }
            if (!(await isCurrent())) return stop('disabled');
            return 'unchanged';
          }
          if (Date.parse(followUpAt) <= Date.now()) return stop('elapsed');
          // Cancellation must finish and be verified before the old delivery deadline.
          await cancelAutomaticAdvisorReminderInternal(true);
          records = await readAutomaticRecords();
          if (records.find(matches)?.state !== 'cancelled') return 'unchanged';
        } else {
          if (scheduled.some(isAutomaticAdvisorReminder)) return stop('unchanged');
        }
      }
      // Do not shift a missed follow-up to now or to the next quiet-hours boundary.
      if (Date.parse(followUpAt) <= Date.now() || date.getTime() <= Date.now()) return stop('elapsed');

      if (!previous) {
        await cancelAutomaticAdvisorReminderInternal(false);
        records = await readAutomaticRecords();
      }
      // Expired entries cannot be replayed because of the future-only check above.
      const retained = records.filter((record) => !matches(record) && Date.parse(record.followUpAt) > Date.now());
      if (retained.length >= MAX_AUTOMATIC_ADVISOR_RECORDS) return 'disabled';
      // Correlation only, not an authorization token; no owner/action text enters native data.
      const attemptId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
      const record: AutomaticAdvisorReminderRecord = { ownerKey: input.ownerKey, actionId: input.actionId,
        followUpAt, scheduledFor: date.toISOString(), attemptId, state: 'ambiguous' };
      if (!(await isCurrent())) return 'disabled';
      // Reserve durably before the native call, including its ambiguous failure/crash window.
      await writeAutomaticRecords([...retained, record]);
      if (!(await isCurrent())) return 'disabled';
      if (Date.parse(followUpAt) <= Date.now() || date.getTime() <= Date.now()) return 'elapsed';
      try {
        await Notifications.scheduleNotificationAsync({
          identifier: AUTOMATIC_ADVISOR_REMINDER_ID,
          content: {
            title: 'MHtoolkit reminder',
            body: 'Open MHtoolkit when you have a moment.',
            data: { screen: ADVISOR_NOTIFICATION_ROUTE, category: 'advisorNudges',
              deliveryKind: AUTOMATIC_ADVISOR_REMINDER_KIND, automaticAdvisorAttemptId: attemptId },
          },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date },
        });
        if (!(await isCurrent())) return await stop('disabled');
        await writeAutomaticRecords([...retained, { ...record, state: 'pending' }]);
        if (!(await isCurrent())) return await stop('disabled');
      } catch (error) {
        await cancelAutomaticAdvisorReminderInternal();
        throw error;
      }
      return 'scheduled';
    });
  }

  async function cancelAutomaticAdvisorReminder(ownerKey?: string): Promise<void> {
    return enqueueReminderMutation(() => cancelAutomaticAdvisorReminderInternal(true, ownerKey));
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
    setNotificationPreferences,
    getNotificationPreferences,
    sendTestNotification,
    scheduleAdvisorReminder,
    cancelAdvisorReminder,
    hasAdvisorReminder,
    reconcileAutomaticAdvisorReminder,
    cancelAutomaticAdvisorReminder,
    clearAutomaticAdvisorHistory,
  };
}

export type NotificationService = ReturnType<typeof createNotificationService>;
