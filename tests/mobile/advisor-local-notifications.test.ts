import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ADVISOR_ACTION_REMINDER_KIND,
  ADVISOR_DAILY_BRIEF_KIND,
  ADVISOR_REMINDER_IDS_KEY,
  AUTOMATIC_ADVISOR_REMINDER_ID,
  AUTOMATIC_ADVISOR_REMINDER_KIND,
  AUTOMATIC_ADVISOR_REMINDERS_KEY,
  DEFAULT_NOTIFICATION_PREFERENCES,
  DUE_DATE_REMINDER_IDS_KEY,
  MOOD_REMINDER_IDS_KEY,
  NOTIFICATION_PREFERENCES_KEY,
  NOTIFICATIONS_KEY,
  REMINDER_TIMES_KEY,
  createNotificationService,
  type AutomaticAdvisorReminderInput,
  type NotificationPlatform,
  type NotificationsModule,
  type NotificationStorage,
  type ReminderContentProvider,
  type ReminderSchedulePlan,
} from '../../mobile/lib/notifications-core';

type NotificationRequestInput = Parameters<NotificationsModule['scheduleNotificationAsync']>[0];

const current = async () => true;
const local = (day: number, hour: number, minute = 0) => new Date(2026, 9, day, hour, minute);
const input = (overrides: Partial<AutomaticAdvisorReminderInput> = {}): AutomaticAdvisorReminderInput => ({
  ownerKey: 'owner-private',
  actionId: 'action-private',
  followUpAt: local(2, 12).toISOString(),
  quietStartHour: 21,
  quietEndHour: 8,
  ...overrides,
});

function harness(
  platform: NotificationPlatform = 'ios',
  contentProvider?: ReminderContentProvider,
  currentOwner?: () => Promise<string | null>
) {
  const values = new Map<string, string>([[NOTIFICATIONS_KEY, 'true']]);
  const storage: NotificationStorage = {
    getItem: vi.fn(async (key) => values.get(key) ?? null),
    setItem: vi.fn(async (key, value) => { values.set(key, value); }),
    removeItem: vi.fn(async (key) => { values.delete(key); }),
  };
  let nextId = 0;
  const scheduled = new Map<string, NotificationRequestInput>();
  const native = {
    AndroidImportance: { DEFAULT: 3 },
    IosAuthorizationStatus: { AUTHORIZED: 2, PROVISIONAL: 3, EPHEMERAL: 4 },
    SchedulableTriggerInputTypes: { DAILY: 'daily', DATE: 'date', TIME_INTERVAL: 'timeInterval' },
    setNotificationHandler: vi.fn(),
    setNotificationChannelAsync: vi.fn(async () => null),
    getPermissionsAsync: vi.fn(async () => ({ granted: true, ios: { status: 2 } })),
    requestPermissionsAsync: vi.fn(async () => { throw new Error('Must not prompt'); }),
    scheduleNotificationAsync: vi.fn(async (request: NotificationRequestInput) => {
      const id = request.identifier ?? `notification-${++nextId}`;
      scheduled.set(id, request);
      return id;
    }),
    cancelScheduledNotificationAsync: vi.fn(async (id: string) => { scheduled.delete(id); }),
    getAllScheduledNotificationsAsync: vi.fn(async () =>
      Array.from(scheduled, ([identifier, request]) => ({ ...request, identifier }))
    ),
  };
  const provider = vi.fn<ReminderContentProvider>(contentProvider ?? (async () => ({ daily: [], dueDates: [] })));
  const restart = () => createNotificationService(native as unknown as NotificationsModule, storage, platform, provider, currentOwner);
  const service = restart();
  const reconcile = (value = input(), guard = current) => service.reconcileAutomaticAdvisorReminder(value, guard);
  const request = () => scheduled.get(AUTOMATIC_ADVISOR_REMINDER_ID)!;
  const fireAt = () => (request().trigger as { date: Date }).date;
  const orphan = (id = 'orphan-automatic', data = { deliveryKind: AUTOMATIC_ADVISOR_REMINDER_KIND }) => {
    scheduled.set(id, { content: { data }, trigger: null });
  };
  return { values, storage, native, scheduled, service, reconcile, restart, request, fireAt, provider, orphan };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(local(2, 10));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('automatic Advisor local notifications', () => {
  it('schedules one private iOS date notification without prompting or loading content', async () => {
    const h = harness();
    await expect(h.reconcile()).resolves.toBe('scheduled');
    expect(h.scheduled.size).toBe(1);
    expect(h.request()).toEqual({
      identifier: AUTOMATIC_ADVISOR_REMINDER_ID,
      content: {
        title: 'MHtoolkit reminder',
        body: 'Open MHtoolkit when you have a moment.',
        data: { screen: '/advisor', category: 'advisorNudges', deliveryKind: AUTOMATIC_ADVISOR_REMINDER_KIND,
          automaticAdvisorAttemptId: expect.any(String) },
      },
      trigger: { type: 'date', date: local(2, 12) },
    });
    expect(JSON.stringify(h.request())).not.toMatch(/owner-private|action-private|goal|mood|health/i);
    expect(h.native.requestPermissionsAsync).not.toHaveBeenCalled();
    expect(h.provider).not.toHaveBeenCalled();
    expect(h.native.setNotificationChannelAsync).not.toHaveBeenCalled();
    await expect(h.service.hasAdvisorReminder()).resolves.toBe(false);
  });

  it('dedupes concurrent calls and restarts, including an OS-delivered/removed request', async () => {
    const h = harness();
    await expect(Promise.all([h.reconcile(), h.reconcile()])).resolves.toEqual(['scheduled', 'unchanged']);
    h.scheduled.clear();
    await expect(h.restart().reconcileAutomaticAdvisorReminder(input(), current)).resolves.toBe('unchanged');
    vi.setSystemTime(local(2, 13));
    await expect(h.restart().reconcileAutomaticAdvisorReminder(input(), current)).resolves.toBe('unchanged');
    expect(h.native.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
  });

  it('replaces a changed owner/action/time with the same ID without replaying an earlier tuple', async () => {
    const h = harness();
    const variants = [input(), input({ ownerKey: 'owner-2' }), input({ actionId: 'action-2' }),
      input({ followUpAt: local(2, 13).toISOString() })];
    for (const value of variants) {
      await expect(h.reconcile(value)).resolves.toBe('scheduled');
      expect([...h.scheduled.keys()]).toEqual([AUTOMATIC_ADVISOR_REMINDER_ID]);
    }
    await expect(h.restart().reconcileAutomaticAdvisorReminder(input(), current)).resolves.toBe('unchanged');
    expect(h.scheduled.size).toBe(0);
    expect(h.native.scheduleNotificationAsync).toHaveBeenCalledTimes(4);
  });

  it.each(['master', 'category', 'permission', 'android'])('fails closed when %s is disabled', async (condition) => {
    const h = harness(condition === 'android' ? 'android' : 'ios');
    h.orphan();
    if (condition === 'master') h.values.set(NOTIFICATIONS_KEY, 'false');
    if (condition === 'category') h.values.set(NOTIFICATION_PREFERENCES_KEY, '{"advisorNudges":false}');
    if (condition === 'permission') h.native.getPermissionsAsync.mockResolvedValue({ granted: false, ios: { status: 0 } });
    await expect(h.reconcile()).resolves.toBe('disabled');
    expect(h.scheduled.size).toBe(0);
    expect(h.native.scheduleNotificationAsync).not.toHaveBeenCalled();
    expect(h.native.requestPermissionsAsync).not.toHaveBeenCalled();
  });

  it.each([2, 3, 4])('accepts an existing iOS delivery authorization %i without prompting', async (status) => {
    const h = harness();
    h.native.getPermissionsAsync.mockResolvedValue({ granted: false, ios: { status } });
    await expect(h.reconcile()).resolves.toBe('scheduled');
    expect(h.native.requestPermissionsAsync).not.toHaveBeenCalled();
  });

  it.each(['invalid-json', 'null', '[]', '{"advisorNudges":"true"}'])('fails closed on invalid category preferences %s', async (raw) => {
    const h = harness();
    h.values.set(NOTIFICATION_PREFERENCES_KEY, raw);
    await expect(h.reconcile()).resolves.toBe('disabled');
    expect(h.native.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it.each([
    { quietStartHour: -1 }, { quietStartHour: 24 }, { quietEndHour: 24 },
    { quietEndHour: 1.5 }, { quietStartHour: NaN }, { quietStartHour: 8, quietEndHour: 8 },
    { followUpAt: 'invalid' }, { ownerKey: '' }, { actionId: ' ' },
  ])('fails closed on invalid automatic input %j', async (overrides) => {
    const h = harness();
    h.orphan();
    await expect(h.reconcile(input(overrides))).resolves.toBe('disabled');
    expect(h.scheduled.size).toBe(0);
    expect(h.native.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('does not mistake a recurring Advisor brief for an explicit action reminder', async () => {
    const h = harness();
    h.orphan('daily-brief', { deliveryKind: ADVISOR_DAILY_BRIEF_KIND });
    await expect(h.reconcile()).resolves.toBe('scheduled');
    expect(h.scheduled.has('daily-brief')).toBe(true);
  });

  it.each(['kind', 'legacy', 'stored', 'timeInterval', 'calendar'])('gives a %s explicit Advisor reminder precedence', async (variant) => {
    const h = harness();
    h.orphan();
    h.scheduled.set('explicit', {
      content: { data: variant === 'kind' ? { deliveryKind: ADVISOR_ACTION_REMINDER_KIND } :
        variant === 'stored' ? {} : { screen: '/advisor' } },
      trigger: (variant === 'timeInterval' || variant === 'calendar'
        ? { type: variant, repeats: false }
        : { type: 'date', date: local(2, 14) }) as NotificationRequestInput['trigger'],
    });
    if (variant === 'stored') h.values.set(ADVISOR_REMINDER_IDS_KEY, '["explicit"]');
    await expect(h.reconcile()).resolves.toBe('unchanged');
    expect([...h.scheduled.keys()]).toEqual(['explicit']);
    expect(h.native.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('replaces the automatic request when an explicit reminder is scheduled', async () => {
    const h = harness();
    await h.reconcile();
    await expect(h.service.scheduleAdvisorReminder(local(2, 14))).resolves.toBe(true);
    expect(h.scheduled.has(AUTOMATIC_ADVISOR_REMINDER_ID)).toBe(false);
    await expect(h.reconcile()).resolves.toBe('unchanged');
    expect(h.scheduled.size).toBe(1);
    await h.service.cancelAdvisorReminder();
    await expect(h.reconcile()).resolves.toBe('unchanged');
    expect(h.scheduled.size).toBe(0);
  });

  it.each(['automatic', 'advisor', 'master', 'clear', 'category', 'category-master-off'])('cancels automatic and orphan native requests via %s', async (operation) => {
    const h = harness();
    await h.reconcile();
    h.orphan();
    h.orphan('unrelated', { deliveryKind: 'unrelated' });
    if (operation === 'automatic') await h.service.cancelAutomaticAdvisorReminder();
    if (operation === 'advisor') await h.service.cancelAdvisorReminder();
    if (operation === 'master') await h.service.setRemindersEnabled(false);
    if (operation === 'clear') await h.service.clearAllReminders();
    if (operation.startsWith('category')) {
      if (operation === 'category-master-off') h.values.set(NOTIFICATIONS_KEY, 'false');
      await h.service.setNotificationPreferences({ ...DEFAULT_NOTIFICATION_PREFERENCES, advisorNudges: false });
    }
    expect([...h.scheduled.keys()]).toEqual(['unrelated']);
    expect(h.values.has(AUTOMATIC_ADVISOR_REMINDERS_KEY)).toBe(operation !== 'clear');
    h.values.set(NOTIFICATIONS_KEY, 'true');
    h.values.set(NOTIFICATION_PREFERENCES_KEY, JSON.stringify(DEFAULT_NOTIFICATION_PREFERENCES));
    const restored = operation === 'automatic' || operation === 'clear';
    await expect(h.reconcile()).resolves.toBe(restored ? 'scheduled' : 'unchanged');
    expect(h.native.scheduleNotificationAsync).toHaveBeenCalledTimes(restored ? 2 : 1);
  });

  it('discovers an automatic stable ID even if its metadata and journal are missing', async () => {
    const h = harness();
    h.orphan(AUTOMATIC_ADVISOR_REMINDER_ID, { deliveryKind: 'unknown' });
    await h.service.clearAllReminders();
    expect(h.scheduled.size).toBe(0);
  });

  it('does not let an already-stale caller cancel a newer pending notification', async () => {
    const h = harness();
    await h.reconcile();
    await expect(h.reconcile(input({ ownerKey: 'old' }), async () => false)).resolves.toBe('disabled');
    expect(h.scheduled.size).toBe(1);
    expect(h.native.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
  });

  it('rechecks ownership immediately before the native call', async () => {
    const h = harness();
    const guard = vi.fn().mockResolvedValue(true);
    vi.mocked(h.storage.setItem).mockImplementation(async (key, value) => {
      h.values.set(key, value);
      guard.mockResolvedValue(false);
    });
    await expect(h.reconcile(input(), guard)).resolves.toBe('disabled');
    expect(h.native.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it.each(['false', 'throws'])('compensates when the post-schedule owner check %s', async (outcome) => {
    const h = harness();
    let scheduled = false;
    const original = h.native.scheduleNotificationAsync.getMockImplementation()!;
    h.native.scheduleNotificationAsync.mockImplementation(async (request) => {
      const id = await original(request);
      scheduled = true;
      return id;
    });
    const guard = async () => {
      if (!scheduled) return true;
      if (outcome === 'throws') throw new Error('owner check failed');
      return false;
    };
    if (outcome === 'throws') await expect(h.reconcile(input(), guard)).rejects.toThrow('owner check failed');
    else await expect(h.reconcile(input(), guard)).resolves.toBe('disabled');
    expect(h.scheduled.size).toBe(0);
  });

  it('serializes automatic cancellation and explicit scheduling behind an in-flight native schedule', async () => {
    const h = harness();
    let release!: () => void;
    let entered!: () => void;
    const started = new Promise<void>((resolve) => { entered = resolve; });
    const blocked = new Promise<void>((resolve) => { release = resolve; });
    const original = h.native.scheduleNotificationAsync.getMockImplementation()!;
    h.native.scheduleNotificationAsync.mockImplementationOnce(async (request) => {
      entered();
      await blocked;
      return original(request);
    });
    const automatic = h.reconcile();
    await started;
    const cancellation = h.service.cancelAutomaticAdvisorReminder();
    const explicit = h.service.scheduleAdvisorReminder(local(2, 15));
    release();
    await automatic;
    await cancellation;
    await explicit;
    expect([...h.scheduled.keys()]).toEqual(['notification-1']);
  });

  it('fails closed on a corrupt durable journal instead of duplicating an orphan', async () => {
    const h = harness();
    h.values.set(AUTOMATIC_ADVISOR_REMINDERS_KEY, '{broken');
    h.orphan();
    await expect(h.reconcile()).resolves.toBe('disabled');
    expect(h.scheduled.size).toBe(0);
    expect(h.native.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('never schedules if reserving durable dedupe state fails', async () => {
    const h = harness();
    vi.mocked(h.storage.setItem).mockImplementation(async (key, value) => {
      if (key === AUTOMATIC_ADVISOR_REMINDERS_KEY) throw new Error('disk full');
      h.values.set(key, value);
    });
    await expect(h.reconcile()).rejects.toThrow('disk full');
    expect(h.native.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('compensates an ambiguous native scheduling failure and never retries that attempt', async () => {
    const h = harness();
    const original = h.native.scheduleNotificationAsync.getMockImplementation()!;
    h.native.scheduleNotificationAsync.mockImplementationOnce(async (request) => {
      await original(request);
      throw new Error('native response lost');
    });
    await expect(h.reconcile()).rejects.toThrow('native response lost');
    expect(h.scheduled.size).toBe(0);
    await expect(h.restart().reconcileAutomaticAdvisorReminder(input(), current)).resolves.toBe('unchanged');
    expect(h.native.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
  });

  it('surfaces compensation failure and leaves enough native identity for cleanup', async () => {
    const h = harness();
    let currentOwner = true;
    const original = h.native.scheduleNotificationAsync.getMockImplementation()!;
    h.native.scheduleNotificationAsync.mockImplementationOnce(async (request) => {
      const id = await original(request);
      currentOwner = false;
      h.native.cancelScheduledNotificationAsync.mockRejectedValue(new Error('cancel failed'));
      return id;
    });
    await expect(h.reconcile(input(), async () => currentOwner)).rejects.toThrow('could not be removed');
    expect(h.scheduled.size).toBe(1);
    h.native.cancelScheduledNotificationAsync.mockImplementation(async (id) => { h.scheduled.delete(id); });
    await h.restart().cancelAutomaticAdvisorReminder();
    expect(h.scheduled.size).toBe(0);
  });

  it('never schedules a replacement if orphan cancellation fails', async () => {
    const h = harness();
    h.orphan();
    h.native.cancelScheduledNotificationAsync.mockRejectedValue(new Error('cancel failed'));
    await expect(h.reconcile()).rejects.toThrow('could not be removed');
    expect(h.native.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('compensates the stable native ID even if discovery fails after scheduling', async () => {
    const h = harness();
    let currentOwner = true;
    const original = h.native.scheduleNotificationAsync.getMockImplementation()!;
    h.native.scheduleNotificationAsync.mockImplementationOnce(async (request) => {
      const id = await original(request);
      currentOwner = false;
      h.native.getAllScheduledNotificationsAsync.mockRejectedValue(new Error('discovery failed'));
      return id;
    });
    await expect(h.reconcile(input(), async () => currentOwner)).rejects.toThrow('could not be removed');
    expect(h.scheduled.size).toBe(0);
  });

  it('removes extra orphan requests on an unchanged reconcile without recreating the stable one', async () => {
    const h = harness();
    await h.reconcile();
    h.orphan();
    await expect(h.reconcile()).resolves.toBe('unchanged');
    expect([...h.scheduled.keys()]).toEqual([AUTOMATIC_ADVISOR_REMINDER_ID]);
    expect(h.native.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
  });

  it('bounds durable future attempts without evicting still-replayable records', async () => {
    const h = harness();
    for (let index = 0; index < 64; index += 1) {
      await expect(h.reconcile(input({ actionId: `action-${index}` }))).resolves.toBe('scheduled');
    }
    await expect(h.reconcile(input({ actionId: 'action-65' }))).resolves.toBe('disabled');
    expect(h.scheduled.size).toBe(0);
    expect(JSON.parse(h.values.get(AUTOMATIC_ADVISOR_REMINDERS_KEY)!)).toHaveLength(64);
    vi.setSystemTime(local(2, 13));
    await expect(h.reconcile(input({ followUpAt: local(2, 15).toISOString() }))).resolves.toBe('scheduled');
    expect(JSON.parse(h.values.get(AUTOMATIC_ADVISOR_REMINDERS_KEY)!)).toHaveLength(1);
  });
});

describe('automatic Advisor pending proof and cleanup', () => {
  const history = (h: ReturnType<typeof harness>) => JSON.parse(h.values.get(AUTOMATIC_ADVISOR_REMINDERS_KEY)!) as {
    ownerKey: string; actionId: string; followUpAt: string; scheduledFor: string; state: string; attemptId: string;
  }[];
  const changedQuiet = () => input({ quietStartHour: 11, quietEndHour: 14 });

  it('durably resumes a confirmed future cancellation after repeated pause and restart', async () => {
    const h = harness();
    await h.reconcile();
    await h.service.cancelAutomaticAdvisorReminder(input().ownerKey);
    expect(history(h)[0].state).toBe('cancelled');
    await h.restart().cancelAutomaticAdvisorReminder(input().ownerKey);
    expect(history(h)[0].state).toBe('cancelled');
    await expect(h.restart().reconcileAutomaticAdvisorReminder(input(), current)).resolves.toBe('scheduled');
    expect(history(h)[0].state).toBe('pending');
    expect(h.scheduled.size).toBe(1);
    expect(h.native.scheduleNotificationAsync).toHaveBeenCalledTimes(2);
  });

  it('does not resume a confirmed cancellation after its original deadline', async () => {
    const h = harness();
    await h.reconcile();
    await h.service.cancelAutomaticAdvisorReminder();
    vi.setSystemTime(local(2, 13));
    await expect(h.restart().reconcileAutomaticAdvisorReminder(changedQuiet(), current)).resolves.toBe('unchanged');
    expect(h.scheduled.size).toBe(0);
    expect(h.native.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
  });

  it.each(['pause', 'quiet'])('never replays an absent/delivered request during %s', async (operation) => {
    const h = harness();
    await h.reconcile();
    h.scheduled.clear();
    if (operation === 'pause') await h.service.cancelAutomaticAdvisorReminder();
    await expect(h.restart().reconcileAutomaticAdvisorReminder(changedQuiet(), current)).resolves.toBe('unchanged');
    expect(h.native.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
    expect(h.scheduled.size).toBe(0);
  });

  it.each(['pause', 'quiet'])('fails closed if cancellation crosses delivery during %s', async (operation) => {
    const h = harness();
    await h.reconcile();
    h.native.cancelScheduledNotificationAsync.mockImplementation(async (id) => {
      vi.setSystemTime(local(2, 12));
      h.scheduled.delete(id);
    });
    if (operation === 'pause') await h.service.cancelAutomaticAdvisorReminder();
    else await expect(h.reconcile(changedQuiet())).resolves.toBe('unchanged');
    expect(history(h)[0].state).toBe('ambiguous');
    vi.setSystemTime(local(2, 10));
    await expect(h.restart().reconcileAutomaticAdvisorReminder(changedQuiet(), current)).resolves.toBe('unchanged');
    expect(h.native.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
  });

  it('never promotes an ambiguous cancellation to resumable on retry', async () => {
    const h = harness();
    await h.reconcile();
    h.native.cancelScheduledNotificationAsync.mockRejectedValueOnce(new Error('cancel response lost'));
    await expect(h.service.cancelAutomaticAdvisorReminder()).rejects.toThrow('could not be removed');
    expect(history(h)[0].state).toBe('ambiguous');
    await h.restart().cancelAutomaticAdvisorReminder();
    await expect(h.restart().reconcileAutomaticAdvisorReminder(input(), current)).resolves.toBe('unchanged');
    expect(h.native.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
  });

  it('rejects a successful cancellation response when the native request remains pending', async () => {
    const h = harness();
    await h.reconcile();
    h.native.cancelScheduledNotificationAsync.mockImplementation(async () => {});
    await expect(h.service.cancelAutomaticAdvisorReminder()).rejects.toThrow('could not be removed');
    expect(history(h)[0].state).toBe('ambiguous');
    expect(h.native.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
  });

  it.each(['before', 'after'])('does not resume when cancellation journal persistence fails %s native cleanup', async (phase) => {
    const h = harness();
    await h.reconcile();
    const original = vi.mocked(h.storage.setItem).getMockImplementation()!;
    vi.mocked(h.storage.setItem).mockImplementation(async (key, value) => {
      if (key === AUTOMATIC_ADVISOR_REMINDERS_KEY && JSON.parse(value)[0].state ===
          (phase === 'before' ? 'ambiguous' : 'cancelled')) throw new Error('disk failed');
      await original(key, value);
    });
    await expect(h.service.cancelAutomaticAdvisorReminder()).rejects.toThrow('disk failed');
    expect(h.scheduled.size).toBe(0);
    vi.mocked(h.storage.setItem).mockImplementation(original);
    await expect(h.restart().reconcileAutomaticAdvisorReminder(input(), current)).resolves.toBe('unchanged');
    expect(h.native.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
  });

  it('keeps a scheduling commit failure ambiguous across restart', async () => {
    const h = harness();
    const original = vi.mocked(h.storage.setItem).getMockImplementation()!;
    vi.mocked(h.storage.setItem).mockImplementation(async (key, value) => {
      if (key === AUTOMATIC_ADVISOR_REMINDERS_KEY && JSON.parse(value)[0].state === 'pending') throw new Error('commit failed');
      await original(key, value);
    });
    await expect(h.reconcile()).rejects.toThrow('commit failed');
    expect(h.scheduled.size).toBe(0);
    vi.mocked(h.storage.setItem).mockImplementation(original);
    await expect(h.restart().reconcileAutomaticAdvisorReminder(input(), current)).resolves.toBe('unchanged');
  });

  it('does not adjust legacy journal entries that cannot prove a matching native attempt', async () => {
    const h = harness();
    await h.reconcile();
    const [{ state: _state, attemptId: _attempt, ...legacy }] = history(h);
    h.values.set(AUTOMATIC_ADVISOR_REMINDERS_KEY, JSON.stringify([legacy]));
    await expect(h.reconcile(changedQuiet())).resolves.toBe('unchanged');
    await expect(h.restart().reconcileAutomaticAdvisorReminder(input(), current)).resolves.toBe('unchanged');
    expect(h.native.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
  });

  it('does not adjust a shared native ID with a mismatched attempt token', async () => {
    const h = harness();
    await h.reconcile();
    h.request().content.data!.automaticAdvisorAttemptId = 'different-attempt';
    await expect(h.reconcile(changedQuiet())).resolves.toBe('unchanged');
    expect(h.native.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
  });

  it('rechecks the owner after cancelling a quiet-hours adjustment', async () => {
    const h = harness();
    await h.reconcile();
    let ownerCurrent = true;
    h.native.cancelScheduledNotificationAsync.mockImplementation(async (id) => {
      h.scheduled.delete(id);
      ownerCurrent = false;
    });
    await expect(h.reconcile(changedQuiet(), async () => ownerCurrent)).resolves.toBe('disabled');
    expect(h.scheduled.size).toBe(0);
    expect(h.native.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
  });

  it('does not let old-owner cancellation touch the new owner or unattributed orphans', async () => {
    const h = harness();
    await h.reconcile();
    const second = input({ ownerKey: 'new-owner' });
    await h.reconcile(second);
    const journal = h.values.get(AUTOMATIC_ADVISOR_REMINDERS_KEY);
    h.native.cancelScheduledNotificationAsync.mockClear();
    await h.restart().cancelAutomaticAdvisorReminder(input().ownerKey);
    expect(h.native.cancelScheduledNotificationAsync).not.toHaveBeenCalled();
    expect(h.scheduled.size).toBe(1);
    h.orphan();
    await expect(h.restart().cancelAutomaticAdvisorReminder(input().ownerKey)).rejects.toThrow('unknown ownership');
    expect(h.native.cancelScheduledNotificationAsync).not.toHaveBeenCalled();
    expect(h.scheduled.size).toBe(2);
    expect(h.values.get(AUTOMATIC_ADVISOR_REMINDERS_KEY)).toBe(journal);
    await h.service.cancelAutomaticAdvisorReminder();
    expect(h.scheduled.size).toBe(0);
  });

  it('does not cancel an unattributed stable ID when an owner is supplied', async () => {
    const h = harness();
    h.orphan(AUTOMATIC_ADVISOR_REMINDER_ID);
    await expect(h.service.cancelAutomaticAdvisorReminder('old-owner')).rejects.toThrow('unknown ownership');
    expect(h.scheduled.size).toBe(1);
    expect(h.native.cancelScheduledNotificationAsync).not.toHaveBeenCalled();
    await h.service.cancelAutomaticAdvisorReminder();
    expect(h.scheduled.size).toBe(0);
  });

  it.each(['corrupt', 'null', '{}'])('rejects owner cancellation with corrupt history %s without touching native state', async (raw) => {
    const h = harness();
    await h.reconcile();
    h.values.set(AUTOMATIC_ADVISOR_REMINDERS_KEY, raw);
    h.native.cancelScheduledNotificationAsync.mockClear();
    await expect(h.restart().cancelAutomaticAdvisorReminder(input().ownerKey)).rejects.toThrow('unknown ownership');
    expect(h.native.cancelScheduledNotificationAsync).not.toHaveBeenCalled();
    expect(h.scheduled.size).toBe(1);
    expect(h.values.get(AUTOMATIC_ADVISOR_REMINDERS_KEY)).toBe(raw);
    await h.service.cancelAutomaticAdvisorReminder();
    expect(h.scheduled.size).toBe(0);
    expect(h.values.get(AUTOMATIC_ADVISOR_REMINDERS_KEY)).toBe(raw);
  });

  it('erases only an old owner history while retaining the new owner pending request', async () => {
    const h = harness();
    await h.reconcile();
    await h.reconcile(input({ ownerKey: 'new-owner' }));
    const retained = history(h)[1];
    h.native.cancelScheduledNotificationAsync.mockClear();
    await h.service.clearAutomaticAdvisorHistory(input().ownerKey);
    expect(history(h)).toEqual([retained]);
    expect(h.native.cancelScheduledNotificationAsync).not.toHaveBeenCalled();
    expect(h.scheduled.size).toBe(1);
  });

  it('cancels the owner request before erasing its final history entry', async () => {
    const h = harness();
    await h.reconcile();
    const original = vi.mocked(h.storage.removeItem).getMockImplementation()!;
    vi.mocked(h.storage.removeItem).mockImplementation(async (key) => {
      if (key === AUTOMATIC_ADVISOR_REMINDERS_KEY) expect(h.scheduled.size).toBe(0);
      await original(key);
    });
    await h.service.clearAutomaticAdvisorHistory(input().ownerKey);
    expect(h.values.has(AUTOMATIC_ADVISOR_REMINDERS_KEY)).toBe(false);
    expect(h.scheduled.size).toBe(0);
  });

  it('does not erase owner history if cancellation fails', async () => {
    const h = harness();
    await h.reconcile();
    h.native.cancelScheduledNotificationAsync.mockRejectedValueOnce(new Error('cancel failed'));
    await expect(h.service.clearAutomaticAdvisorHistory(input().ownerKey)).rejects.toThrow('could not be removed');
    expect(history(h)).toHaveLength(1);
    expect(history(h)[0].state).toBe('ambiguous');
    await h.restart().clearAutomaticAdvisorHistory(input().ownerKey);
    expect(h.values.has(AUTOMATIC_ADVISOR_REMINDERS_KEY)).toBe(false);
  });

  it('does not erase or cancel an unknown orphan during owner-specific cleanup', async () => {
    const h = harness();
    await h.reconcile();
    h.request().content.data!.automaticAdvisorAttemptId = 'unknown';
    const journal = h.values.get(AUTOMATIC_ADVISOR_REMINDERS_KEY);
    h.native.cancelScheduledNotificationAsync.mockClear();
    await expect(h.service.clearAutomaticAdvisorHistory(input().ownerKey)).rejects.toThrow('unknown ownership');
    expect(h.values.get(AUTOMATIC_ADVISOR_REMINDERS_KEY)).toBe(journal);
    expect(h.native.cancelScheduledNotificationAsync).not.toHaveBeenCalled();
  });

  it.each(['rejected', 'still-pending'])('retains the journal if clearAll cancellation is %s', async (failure) => {
    const h = harness();
    await h.reconcile();
    if (failure === 'rejected') h.native.cancelScheduledNotificationAsync.mockRejectedValueOnce(new Error('cancel failed'));
    else h.native.cancelScheduledNotificationAsync.mockImplementation(async () => {});
    await expect(h.service.clearAllReminders()).rejects.toThrow('could not be removed');
    expect(h.values.has(AUTOMATIC_ADVISOR_REMINDERS_KEY)).toBe(true);
  });

  it('can destructively clear corrupt history after native orphan cleanup', async () => {
    const h = harness();
    h.values.set(AUTOMATIC_ADVISOR_REMINDERS_KEY, 'corrupt');
    h.orphan();
    await h.service.clearAllReminders();
    expect(h.values.has(AUTOMATIC_ADVISOR_REMINDERS_KEY)).toBe(false);
    expect(h.scheduled.size).toBe(0);
  });
});

describe('notification content and owner-boundary queue isolation', () => {
  function deferred() {
    let resolve!: () => void;
    const promise = new Promise<void>((done) => { resolve = done; });
    return { promise, resolve };
  }
  const plan = (title = 'Prepared content'): ReminderSchedulePlan => ({
    daily: [{ title, body: 'Open the app.', screen: '/goals', category: 'dailyPlanning' }],
    dueDates: [{ title, body: 'Open the app.', screen: '/goals', category: 'goalReminders', date: local(3, 12) }],
  });
  const kinds = ['scheduleMoodReminders', 'scheduleDueDateReminders'] as const;

  it.each(kinds)('allows pause and guarded cleanup before %s content resolves', async (kind) => {
    const entered = deferred(); const release = deferred();
    const h = harness('ios', async () => { entered.resolve(); await release.promise; return plan(); });
    await h.reconcile();
    const refresh = h.service[kind]();
    await entered.promise;
    await h.service.cancelAutomaticAdvisorReminder(input().ownerKey);
    expect(h.scheduled.size).toBe(0);
    await expect(h.service.clearAllReminders(async () => true)).resolves.toBeUndefined();
    expect(h.values.get(NOTIFICATIONS_KEY)).toBe('false');
    expect(h.values.has(AUTOMATIC_ADVISOR_REMINDERS_KEY)).toBe(false);
    release.resolve();
    await expect(refresh).resolves.toEqual([]);
    expect(h.scheduled.size).toBe(0);
  });

  it.each(kinds)('disables master during %s without waiting for remote content', async (kind) => {
    const entered = deferred(); const release = deferred();
    const h = harness('ios', async () => { entered.resolve(); await release.promise; return plan(); });
    const refresh = h.service[kind]();
    await entered.promise;
    await expect(h.service.setRemindersEnabled(false)).resolves.toBe(false);
    release.resolve();
    await expect(refresh).resolves.toEqual([]);
    expect(h.native.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it.each(kinds)('disables categories during %s without querying content again', async (kind) => {
    const entered = deferred(); const release = deferred();
    const h = harness('ios', async () => { entered.resolve(); await release.promise; return plan(); });
    const refresh = h.service[kind]();
    await entered.promise;
    await h.service.setNotificationPreferences({ ...DEFAULT_NOTIFICATION_PREFERENCES, dailyPlanning: false, goalReminders: false });
    expect(h.provider).toHaveBeenCalledTimes(1);
    release.resolve();
    await expect(refresh).resolves.toEqual([]);
    expect(h.native.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it.each(kinds)('does not let old-owner %s content or its dirty rerun overwrite a re-enabled owner', async (kind) => {
    const entered = deferred(); const release = deferred();
    const h = harness('ios', async () => plan('New owner'));
    h.provider.mockImplementationOnce(async () => { entered.resolve(); await release.promise; return plan('Old owner'); });
    const first = h.service[kind]();
    await entered.promise;
    const coalesced = h.service[kind]();
    await h.service.clearAllReminders(async () => true);
    await h.service.setRemindersEnabled(true);
    await h.service[kind]();
    const requests = Array.from(h.scheduled.entries());
    const values = Array.from(h.values.entries());
    const calls = h.provider.mock.calls.length;
    release.resolve();
    await expect(Promise.all([first, coalesced])).resolves.toEqual([[], []]);
    expect(Array.from(h.scheduled.entries())).toEqual(requests);
    expect(Array.from(h.values.entries())).toEqual(values);
    expect(h.provider).toHaveBeenCalledTimes(calls);
    expect(requests.every(([, request]) => request.content.title === 'New owner')).toBe(true);
  });

  it.each(['enable', 'times', 'preferences', 'rollback'] as const)('keeps cleanup responsive during the %s content phase', async (operation) => {
    const entered = deferred(); const release = deferred();
    const h = harness('ios', async () => { entered.resolve(); await release.promise; return plan(); });
    if (operation === 'preferences') h.values.set(NOTIFICATION_PREFERENCES_KEY, JSON.stringify({ ...DEFAULT_NOTIFICATION_PREFERENCES, affirmations: false }));
    if (operation === 'rollback') h.provider.mockRejectedValueOnce(new Error('original fetch failed'));
    const work = operation === 'enable' ? h.service.setRemindersEnabled(true) :
      operation === 'preferences' ? h.service.setNotificationPreferences({ ...DEFAULT_NOTIFICATION_PREFERENCES }) :
        h.service.setReminderTimes([19]);
    const settled = work.then((value) => ({ value, error: null }), (error: Error) => ({ value: null, error }));
    await entered.promise;
    await h.service.clearAllReminders(async () => true);
    const values = Array.from(h.values.entries());
    release.resolve();
    const result = await settled;
    if (operation === 'rollback') expect(result.error?.message).toBe('original fetch failed');
    else expect(result.error).toBeNull();
    if (operation === 'enable') expect(result.value).toBe(false);
    expect(h.scheduled.size).toBe(0);
    expect(Array.from(h.values.entries())).toEqual(values);
  });

  it.each(kinds)('revalidates raw times and categories before %s native mutations', async (kind) => {
    const entered = deferred(); const release = deferred();
    const h = harness('ios', async () => { entered.resolve(); await release.promise; return plan(); });
    const refresh = h.service[kind]();
    await entered.promise;
    h.values.set(REMINDER_TIMES_KEY, '[17]');
    h.values.set(NOTIFICATION_PREFERENCES_KEY, JSON.stringify({ ...DEFAULT_NOTIFICATION_PREFERENCES, dailyPlanning: false }));
    h.native.cancelScheduledNotificationAsync.mockClear();
    release.resolve();
    await expect(refresh).resolves.toEqual([]);
    expect(h.native.scheduleNotificationAsync).not.toHaveBeenCalled();
    expect(h.native.cancelScheduledNotificationAsync).not.toHaveBeenCalled();
  });

  it.each(kinds)('rejects old-account %s content even when stale cleanup correctly does nothing', async (kind) => {
    const entered = deferred(); const release = deferred();
    let owner: string | null = 'old-owner';
    const h = harness('ios', async () => plan('New owner'), async () => owner);
    h.provider.mockImplementationOnce(async () => { entered.resolve(); await release.promise; return plan('Old owner'); });
    const old = h.service[kind]();
    await entered.promise;
    owner = 'new-owner';
    await h.service.clearAllReminders(async () => owner === 'old-owner');
    // This must not coalesce onto the old account's still-blocked request.
    await h.service[kind]();
    const requests = Array.from(h.scheduled.entries());
    h.native.cancelScheduledNotificationAsync.mockClear();
    release.resolve();
    await expect(old).resolves.toEqual([]);
    expect(Array.from(h.scheduled.entries())).toEqual(requests);
    expect(h.native.cancelScheduledNotificationAsync).not.toHaveBeenCalled();
    expect(requests.every(([, request]) => request.content.title === 'New owner')).toBe(true);
  });

  it('propagates an owner read failure without mutating native reminders', async () => {
    const entered = deferred(); const release = deferred();
    let fail = false;
    const h = harness('ios', async () => { entered.resolve(); await release.promise; return plan(); }, async () => {
      if (fail) throw new Error('session unavailable');
      return 'owner';
    });
    const work = h.service.scheduleMoodReminders();
    await entered.promise;
    fail = true;
    release.resolve();
    await expect(work).rejects.toThrow('session unavailable');
    expect(h.native.scheduleNotificationAsync).not.toHaveBeenCalled();
    expect(h.native.cancelScheduledNotificationAsync).not.toHaveBeenCalled();
    fail = false;
    expect(await h.service.scheduleMoodReminders()).toHaveLength(3);
  });

  it('does not roll back newer settings after an obsolete content failure', async () => {
    const entered = deferred(); const release = deferred();
    const h = harness('ios', async () => plan());
    h.provider.mockImplementationOnce(async () => { entered.resolve(); await release.promise; throw new Error('old fetch failed'); });
    const failed = h.service.setReminderTimes([19]).catch((error: Error) => error);
    await entered.promise;
    await h.service.setReminderTimes([17]);
    const requests = Array.from(h.scheduled.entries());
    release.resolve();
    expect(await failed).toEqual(new Error('old fetch failed'));
    expect(h.values.get(REMINDER_TIMES_KEY)).toBe('[17]');
    expect(Array.from(h.scheduled.entries())).toEqual(requests);
  });

  it('preserves a pending time rebuild when a category-only disable returns before content', async () => {
    const entered = deferred(); const release = deferred();
    const h = harness('ios', async () => plan());
    h.values.set(REMINDER_TIMES_KEY, '[9]');
    await h.service.scheduleMoodReminders();
    h.provider.mockImplementationOnce(async () => { entered.resolve(); await release.promise; return plan(); });
    const changingTimes = h.service.setReminderTimes([19]);
    await entered.promise;
    await h.service.setNotificationPreferences({ ...DEFAULT_NOTIFICATION_PREFERENCES, affirmations: false });
    expect(h.provider).toHaveBeenCalledTimes(2);
    expect(Array.from(h.scheduled.values()).map((request) => (request.trigger as { hour: number }).hour)).toEqual([9]);
    release.resolve();
    await changingTimes;
    expect(h.values.get(REMINDER_TIMES_KEY)).toBe('[19]');
    const daily = Array.from(h.scheduled.values()).filter((request) => (request.trigger as { type: string }).type === 'daily');
    expect(daily.map((request) => (request.trigger as { hour: number }).hour)).toEqual([19]);
    expect(JSON.parse(h.values.get(NOTIFICATION_PREFERENCES_KEY)!).affirmations).toBe(false);
  });

  it('preserves a pending due-date rebuild and applies the latest category filter', async () => {
    const entered = deferred(); const release = deferred();
    const original = plan();
    const h = harness('ios', async () => original);
    await h.service.scheduleDueDateReminders();
    const replacement: ReminderSchedulePlan = {
      daily: [],
      dueDates: [
        { ...original.dueDates[0], date: local(4, 15) },
        { ...original.dueDates[0], category: 'planReminders', screen: '/planner', date: local(4, 16) },
      ],
    };
    h.provider.mockImplementationOnce(async () => { entered.resolve(); await release.promise; return replacement; });
    const updating = h.service.scheduleDueDateReminders();
    await entered.promise;
    await h.service.setNotificationPreferences({ ...DEFAULT_NOTIFICATION_PREFERENCES, planReminders: false });
    release.resolve();
    expect(await updating).toHaveLength(1);
    const requests = Array.from(h.scheduled.values());
    expect(requests).toHaveLength(1);
    expect((requests[0].trigger as { date: Date }).date).toEqual(local(4, 15));
  });

  it.each(kinds)('keeps %s refreshes coalesced across a category-only edit', async (kind) => {
    const entered = deferred(); const release = deferred();
    const h = harness('ios', async () => plan('Fresh content'));
    h.provider.mockImplementationOnce(async () => { entered.resolve(); await release.promise; return plan('Older content'); });
    const first = h.service[kind]();
    await entered.promise;
    await h.service.setNotificationPreferences({ ...DEFAULT_NOTIFICATION_PREFERENCES, affirmations: false });
    const second = h.service[kind]();
    release.resolve();
    const [firstIds, secondIds] = await Promise.all([first, second]);
    expect(firstIds).toEqual(secondIds);
    expect(h.provider).toHaveBeenCalledTimes(2);
    expect(Array.from(h.scheduled.values()).every((request) => request.content.title === 'Fresh content')).toBe(true);
  });

  it('does not roll back a newer category-off edit if a preserved time rebuild fails', async () => {
    const entered = deferred(); const release = deferred();
    const h = harness('ios', async () => plan());
    h.values.set(REMINDER_TIMES_KEY, '[9]');
    await h.service.scheduleMoodReminders();
    h.provider.mockImplementationOnce(async () => { entered.resolve(); await release.promise; throw new Error('fetch failed'); });
    const changingTimes = h.service.setReminderTimes([19]).catch((error: Error) => error);
    await entered.promise;
    await h.service.setNotificationPreferences({ ...DEFAULT_NOTIFICATION_PREFERENCES, affirmations: false });
    release.resolve();
    expect(await changingTimes).toEqual(new Error('fetch failed'));
    expect(JSON.parse(h.values.get(NOTIFICATION_PREFERENCES_KEY)!).affirmations).toBe(false);
  });

  it.each(kinds)('rechecks owner after %s commit permission resolves', async (kind) => {
    const entered = deferred(); const release = deferred();
    let owner = 'old-owner';
    const h = harness('ios', async () => plan('Old owner'), async () => owner);
    const granted = { granted: true, ios: { status: 2 } };
    h.native.getPermissionsAsync.mockResolvedValueOnce(granted).mockImplementationOnce(async () => {
      entered.resolve(); await release.promise; return granted;
    });
    const refresh = h.service[kind]();
    await entered.promise;
    owner = 'new-owner';
    const cleanup = h.service.clearAllReminders(async () => owner === 'old-owner');
    release.resolve();
    await expect(refresh).resolves.toEqual([]);
    await cleanup;
    expect(h.native.scheduleNotificationAsync).not.toHaveBeenCalled();
    expect(h.native.cancelScheduledNotificationAsync).not.toHaveBeenCalled();
    expect(h.scheduled.size).toBe(0);
  });

  it.each(kinds.flatMap((kind) => ['schedule', 'persist'].flatMap((phase) =>
    ['switch', 'error'].map((outcome) => ({ kind, phase, outcome })))))('compensates $kind when ownership $outcome occurs during $phase', async ({ kind, phase, outcome }) => {
    const entered = deferred(); const release = deferred();
    let owner = 'old-owner'; let failOwner = false;
    const h = harness('ios', async () => plan('Old owner'), async () => {
      if (failOwner) throw new Error('owner read failed');
      return owner;
    });
    const key = kind === 'scheduleMoodReminders' ? MOOD_REMINDER_IDS_KEY : DUE_DATE_REMINDER_IDS_KEY;
    if (phase === 'schedule') {
      const original = h.native.scheduleNotificationAsync.getMockImplementation()!;
      h.native.scheduleNotificationAsync.mockImplementationOnce(async (request) => {
        const id = await original(request);
        entered.resolve(); await release.promise; return id;
      });
    } else {
      const original = vi.mocked(h.storage.setItem).getMockImplementation()!;
      vi.mocked(h.storage.setItem).mockImplementation(async (storageKey, value) => {
        await original(storageKey, value);
        if (storageKey === key) { entered.resolve(); await release.promise; }
      });
    }
    const refresh = h.service[kind]();
    await entered.promise;
    if (outcome === 'switch') owner = 'new-owner';
    else failOwner = true;
    release.resolve();
    if (outcome === 'switch') await expect(refresh).resolves.toEqual([]);
    else await expect(refresh).rejects.toThrow('owner read failed');
    expect(h.scheduled.size).toBe(0);
    expect(h.values.has(key)).toBe(false);
    if (phase === 'schedule') expect(h.native.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
  });

  it.each(kinds)('reports failed ownership-loss compensation and retains %s IDs for cleanup', async (kind) => {
    let owner = 'old-owner';
    const h = harness('ios', async () => plan(), async () => owner);
    const original = h.native.scheduleNotificationAsync.getMockImplementation()!;
    h.native.scheduleNotificationAsync.mockImplementationOnce(async (request) => {
      const id = await original(request);
      owner = 'new-owner';
      return id;
    });
    h.native.cancelScheduledNotificationAsync.mockRejectedValueOnce(new Error('native cancel failed'));
    await expect(h.service[kind]()).rejects.toThrow('could not be removed');
    const key = kind === 'scheduleMoodReminders' ? MOOD_REMINDER_IDS_KEY : DUE_DATE_REMINDER_IDS_KEY;
    expect(JSON.parse(h.values.get(key)!)).toHaveLength(1);
    expect(h.scheduled.size).toBe(1);
    await h.service.clearAllReminders();
    expect(h.scheduled.size).toBe(0);
  });

  it('checks the clear guard after waiting for the native queue slot', async () => {
    const entered = deferred(); const release = deferred();
    const h = harness();
    const nativeSchedule = h.native.scheduleNotificationAsync.getMockImplementation()!;
    h.native.scheduleNotificationAsync.mockImplementationOnce(async (request) => {
      entered.resolve(); await release.promise; return nativeSchedule(request);
    });
    const scheduling = h.reconcile(input({ ownerKey: 'new-owner' }));
    await entered.promise;
    h.native.cancelScheduledNotificationAsync.mockClear();
    let ownerCurrent = true;
    const guard = vi.fn(async () => ownerCurrent);
    const cleanup: Promise<void> = h.service.clearAllReminders(guard);
    expect(guard).not.toHaveBeenCalled();
    ownerCurrent = false;
    release.resolve();
    await scheduling;
    await expect(cleanup).resolves.toBeUndefined();
    expect(guard).toHaveBeenCalledOnce();
    expect(h.scheduled.size).toBe(1);
    expect(h.values.get(NOTIFICATIONS_KEY)).toBe('true');
    expect(JSON.parse(h.values.get(AUTOMATIC_ADVISOR_REMINDERS_KEY)!)[0].ownerKey).toBe('new-owner');
    expect(h.native.cancelScheduledNotificationAsync).not.toHaveBeenCalled();
  });

  it.each(['false', 'throws'])('does not invalidate current-owner content when the clear guard %s', async (outcome) => {
    const entered = deferred(); const release = deferred();
    const h = harness('ios', async () => { entered.resolve(); await release.promise; return plan(); });
    const work = h.service.scheduleMoodReminders();
    await entered.promise;
    const clear = h.service.clearAllReminders(async () => {
      if (outcome === 'throws') throw new Error('owner unavailable');
      return false;
    });
    if (outcome === 'throws') await expect(clear).rejects.toThrow('owner unavailable');
    else await expect(clear).resolves.toBeUndefined();
    expect(h.native.cancelScheduledNotificationAsync).not.toHaveBeenCalled();
    release.resolve();
    expect(await work).toHaveLength(3);
    expect(h.values.has(MOOD_REMINDER_IDS_KEY)).toBe(true);
    expect(h.values.has(DUE_DATE_REMINDER_IDS_KEY)).toBe(false);
  });
});

describe('automatic Advisor quiet hours', () => {
  it.each([
    [20, 59, 2, 20, 59], [21, 0, 3, 8, 0], [23, 30, 3, 8, 0],
    [0, 30, 2, 8, 0], [7, 59, 2, 8, 0], [8, 0, 2, 8, 0],
  ])('maps %i:%i to the correct local quiet-hours boundary', async (hour, minute, day, endHour, endMinute) => {
    vi.setSystemTime(local(1, 10));
    const h = harness();
    await expect(h.reconcile(input({ followUpAt: local(2, hour, minute).toISOString() }))).resolves.toBe('scheduled');
    expect(h.fireAt()).toEqual(local(day, endHour, endMinute));
  });

  it('supports same-day quiet windows', async () => {
    const h = harness();
    await expect(h.reconcile(input({ quietStartHour: 11, quietEndHour: 14 }))).resolves.toBe('scheduled');
    expect(h.fireAt()).toEqual(local(2, 14));
  });

  it('crosses month and year boundaries using calendar dates', async () => {
    const h = harness();
    await h.reconcile(input({ followUpAt: new Date(2026, 11, 31, 23, 30).toISOString() }));
    expect(h.fireAt()).toEqual(new Date(2027, 0, 1, 8));
  });

  it('never catches up a missed quiet-hours follow-up later the same day', async () => {
    vi.setSystemTime(local(2, 6));
    const h = harness();
    await expect(h.reconcile(input({ followUpAt: local(2, 5).toISOString() }))).resolves.toBe('elapsed');
    expect(h.native.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('preserves an already-scheduled deferral after the original follow-up time passes', async () => {
    vi.setSystemTime(local(2, 4));
    const h = harness();
    const value = input({ followUpAt: local(2, 5).toISOString() });
    await h.reconcile(value);
    vi.setSystemTime(local(2, 6));
    await expect(h.restart().reconcileAutomaticAdvisorReminder(value, current)).resolves.toBe('unchanged');
    expect(h.fireAt()).toEqual(local(2, 8));
    expect(h.native.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
  });

  it('adjusts a proven pending reminder for changed quiet hours without creating duplicates', async () => {
    const h = harness();
    await h.reconcile();
    const originalAttempt = h.request().content.data!.automaticAdvisorAttemptId;
    const changed = input({ quietStartHour: 11, quietEndHour: 14 });
    await expect(h.reconcile(changed)).resolves.toBe('scheduled');
    expect(h.fireAt()).toEqual(local(2, 14));
    expect(h.scheduled.size).toBe(1);
    expect(h.request().content.data!.automaticAdvisorAttemptId).not.toBe(originalAttempt);
    await expect(h.restart().reconcileAutomaticAdvisorReminder(changed, current)).resolves.toBe('unchanged');
    expect(h.native.scheduleNotificationAsync).toHaveBeenCalledTimes(2);
  });

  it('checks the original and adjusted deadlines again after asynchronous work', async () => {
    const h = harness();
    const guard = async () => {
      if (h.values.has(AUTOMATIC_ADVISOR_REMINDERS_KEY)) vi.setSystemTime(local(2, 13));
      return true;
    };
    await expect(h.reconcile(input(), guard)).resolves.toBe('elapsed');
    expect(h.native.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  // Run this file with TZ=America/Toronto to exercise actual offset transitions.
  it.each([
    [new Date(2026, 2, 7, 23), new Date(2026, 2, 8, 8)],
    [new Date(2026, 9, 31, 23), new Date(2026, 10, 1, 8)],
  ])('uses calendar time through a DST transition from %s', async (due, expected) => {
    vi.setSystemTime(new Date(due.getTime() - 60_000));
    const h = harness();
    await expect(h.reconcile(input({ followUpAt: due.toISOString() }))).resolves.toBe('scheduled');
    expect(h.fireAt()).toEqual(expected);
    if (process.env.TZ === 'America/Toronto') {
      expect(due.getTimezoneOffset()).not.toBe(expected.getTimezoneOffset());
    }
  });

  it('skips a spring-forward day when its entire allowed window does not exist', async () => {
    vi.setSystemTime(new Date(2026, 2, 8, 0));
    const h = harness();
    await h.reconcile(input({ followUpAt: new Date(2026, 2, 8, 1, 30).toISOString(),
      quietStartHour: 3, quietEndHour: 2 }));
    const expectedDay = new Date(2026, 2, 8, 2).getHours() === 2 ? 8 : 9;
    expect(h.fireAt()).toEqual(new Date(2026, 2, expectedDay, 2));
  });
});
