import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  buildAppleHealthSnapshot,
  createAppleHealthAiSummary,
  createAppleHealthOverview,
  createAppleHealthPattern,
  formatHealthMinutes,
  localDayKey,
  runAppleHealthQuery,
} from '../../mobile/lib/apple-health-core';
import { createAppleHealthPreference } from '../../mobile/lib/apple-health-preference';
import { appleHealthAiSharePreview } from '../../mobile/lib/apple-health-ai-preview';

const root = process.cwd();

function localDate(day: number, hour = 12, minute = 0) {
  return new Date(2026, 7, day, hour, minute, 0, 0);
}

function emptyRaw() {
  return {
    steps: [],
    exerciseMinutes: [],
    sleep: [],
    mindfulSessions: [],
    workouts: [],
    statesOfMind: [],
  };
}

describe('Apple Health local summaries', () => {
  it('isolates rejected and synchronously failing category queries', async () => {
    await expect(runAppleHealthQuery(async () => [1, 2])).resolves.toEqual([1, 2]);
    await expect(
      runAppleHealthQuery(async () => {
        throw new Error('denied');
      })
    ).resolves.toEqual([]);
    await expect(
      runAppleHealthQuery(() => {
        throw new Error('native call failed');
      })
    ).resolves.toEqual([]);
  });

  it('builds a fixed local-day window and merges overlapping sleep samples', () => {
    const snapshot = buildAppleHealthSnapshot(
      {
        ...emptyRaw(),
        steps: [{ date: localDate(8), value: 4820.4 }],
        exerciseMinutes: [{ date: localDate(8), value: 21.6 }],
        sleep: [
          { startDate: localDate(7, 23), endDate: localDate(8, 3) },
          { startDate: localDate(8, 2), endDate: localDate(8, 6) },
        ],
        mindfulSessions: [
          { startDate: localDate(8, 9), endDate: localDate(8, 9, 12) },
        ],
        workouts: [{ date: localDate(8, 7) }, { date: localDate(8, 18) }],
        statesOfMind: [
          { date: localDate(8, 10), valence: -0.2 },
          { date: localDate(8, 20), valence: 0.6 },
        ],
      },
      localDate(9),
      3
    );

    expect(snapshot.days.map((day) => day.date)).toEqual([
      localDayKey(localDate(7)),
      localDayKey(localDate(8)),
      localDayKey(localDate(9)),
    ]);
    expect(snapshot.days[1]).toMatchObject({
      steps: 4820,
      exerciseMinutes: 22,
      sleepMinutes: 420,
      mindfulMinutes: 12,
      workoutCount: 2,
      stateOfMindCount: 2,
    });
    expect(snapshot.days[1].stateOfMindValence).toBeCloseTo(0.2);
  });

  it('ignores malformed values and caps merged durations at one day', () => {
    const snapshot = buildAppleHealthSnapshot(
      {
        ...emptyRaw(),
        steps: [{ date: localDate(8), value: -1 }],
        sleep: [
          { startDate: localDate(7, 0), endDate: localDate(8, 23, 59) },
        ],
        statesOfMind: [{ date: localDate(8), valence: 2 }],
      },
      localDate(8),
      1
    );

    expect(snapshot.days[0]).toMatchObject({
      steps: null,
      sleepMinutes: 1440,
      stateOfMindCount: 0,
      stateOfMindValence: null,
    });
  });

  it('skips malformed dates in every HealthKit category without losing valid data', () => {
    const invalidDate = new Date(Number.NaN);
    const snapshot = buildAppleHealthSnapshot(
      {
        steps: [
          { date: invalidDate, value: 9000 },
          { date: localDate(8), value: 1234 },
        ],
        exerciseMinutes: [{ date: invalidDate, value: 30 }],
        sleep: [{ startDate: invalidDate, endDate: invalidDate }],
        mindfulSessions: [{ startDate: invalidDate, endDate: invalidDate }],
        workouts: [{ date: invalidDate }],
        statesOfMind: [{ date: invalidDate, valence: 0.5 }],
      },
      localDate(8),
      1
    );

    expect(snapshot.days[0]).toMatchObject({
      steps: 1234,
      exerciseMinutes: null,
      sleepMinutes: null,
      mindfulMinutes: null,
      workoutCount: 0,
      stateOfMindCount: 0,
      stateOfMindValence: null,
    });
  });

  it('keeps low-level comparisons available without exposing them in the overview', () => {
    const snapshot = buildAppleHealthSnapshot(
      {
        ...emptyRaw(),
        sleep: [
          { startDate: localDate(1, 22), endDate: localDate(2, 6) },
          { startDate: localDate(2, 22), endDate: localDate(3, 6) },
          { startDate: localDate(3, 23), endDate: localDate(4, 5) },
          { startDate: localDate(4, 23), endDate: localDate(5, 5) },
        ],
      },
      localDate(5),
      5
    );
    const moods = [
      { emoji: '😄', created_at: localDate(2, 12).toISOString() },
      { emoji: '🙂', created_at: localDate(3, 12).toISOString() },
      { emoji: '😞', created_at: localDate(4, 12).toISOString() },
      { emoji: '😢', created_at: localDate(5, 12).toISOString() },
    ];

    expect(createAppleHealthPattern(snapshot.days, moods)).toBe(
      'Higher-mood check-in days averaged 8.0 hr sleep; lower-mood days averaged 6.0 hr sleep.'
    );
    const overview = createAppleHealthOverview(snapshot, moods);
    expect(overview.thirtyDay.coverageDays).toBe(4);
    expect(overview.thirtyDay.averageSleepMinutes).toBe(420);
    expect(overview.pattern).toBe('Health data is available on 4 of the last 30 days.');
    expect(overview.pattern).not.toMatch(/mood|higher|lower|cause|diagnos|advice/i);
  });

  it('calculates neutral aggregate stats and data coverage', () => {
    const snapshot = buildAppleHealthSnapshot(
      {
        ...emptyRaw(),
        steps: [
          { date: localDate(7), value: 3000 },
          { date: localDate(8), value: 5000 },
        ],
        exerciseMinutes: [
          { date: localDate(7), value: 20 },
          { date: localDate(8), value: 40 },
        ],
        sleep: [
          { startDate: localDate(6, 23), endDate: localDate(7, 6) },
          { startDate: localDate(7, 23), endDate: localDate(8, 7) },
        ],
        mindfulSessions: [
          { startDate: localDate(8, 9), endDate: localDate(8, 9, 15) },
        ],
        workouts: [{ date: localDate(7) }, { date: localDate(8) }],
      },
      localDate(9),
      3
    );

    const overview = createAppleHealthOverview(snapshot, [
      { emoji: '😢', created_at: localDate(7).toISOString() },
      { emoji: '😄', created_at: localDate(8).toISOString() },
    ]);

    expect(overview.sevenDay).toMatchObject({
      coverageDays: 2,
      averageSteps: 4000,
      averageSleepMinutes: 450,
      exerciseMinutes: 60,
      mindfulMinutes: 15,
      workoutCount: 2,
    });
    expect(overview.thirtyDay).toEqual(overview.sevenDay);
    expect(overview.pattern).toBe('Health data is available on 2 of the last 30 days.');
  });

  it('returns a clean neutral overview when no Health data is available', () => {
    const snapshot = buildAppleHealthSnapshot(emptyRaw(), localDate(9), 30);
    const overview = createAppleHealthOverview(snapshot, [
      { emoji: '😄', created_at: localDate(9).toISOString() },
    ]);

    expect(overview.sevenDay.coverageDays).toBe(0);
    expect(overview.thirtyDay.coverageDays).toBe(0);
    expect(overview.sevenDay.averageSteps).toBeNull();
    expect(overview.sevenDay.averageSleepMinutes).toBeNull();
    expect(overview.pattern).toBe('No Health data is available from the last 30 days.');
    expect(overview.pattern).not.toMatch(/mood|overlap|pattern|cause|diagnos|advice/i);
  });

  it('uses neutral copy when there is not enough overlap for a comparison', () => {
    const snapshot = buildAppleHealthSnapshot(
      { ...emptyRaw(), steps: [{ date: localDate(8), value: 3000 }] },
      localDate(8),
      1
    );
    expect(
      createAppleHealthPattern(snapshot.days, [
        { emoji: '🙂', created_at: localDate(8).toISOString() },
      ])
    ).toBe('Mood and Apple Health overlap on 1 of the last 30 days.');
    expect(formatHealthMinutes(90)).toBe('1h 30m');
    expect(formatHealthMinutes(119.6)).toBe('2h');
    expect(formatHealthMinutes(null)).toBe('—');
  });

  it('uses the recorded local mood date when it differs from the timestamp day', () => {
    const snapshot = buildAppleHealthSnapshot(
      { ...emptyRaw(), steps: [{ date: localDate(8), value: 3000 }] },
      localDate(8),
      1
    );
    const mood = {
      emoji: '🙂',
      created_at: localDate(7, 23).toISOString(),
      local_date: localDayKey(localDate(8)),
    };
    expect(createAppleHealthPattern(snapshot.days, [mood])).toBe(
      'Mood and Apple Health overlap on 1 of the last 30 days.'
    );
  });

  it('creates a bounded AI aggregate without samples, dates, or source metadata', () => {
    const snapshot = buildAppleHealthSnapshot(
      {
        ...emptyRaw(),
        steps: [{ date: localDate(8), value: 4200 }],
        sleep: [{ startDate: localDate(7, 23), endDate: localDate(8, 6) }],
        workouts: [{ date: localDate(8) }],
      },
      localDate(8),
      1
    );
    const summary = createAppleHealthAiSummary(
      createAppleHealthOverview(snapshot, [])
    );
    const serialized = JSON.stringify(summary);

    expect(summary.thirtyDay).toMatchObject({
      coverageDays: 1,
      averageSteps: 4200,
      averageSleepMinutes: 420,
      workoutCount: 1,
    });
    expect(Object.keys(summary.thirtyDay)).toEqual([
      'coverageDays',
      'averageSteps',
      'averageSleepMinutes',
      'exerciseMinutes',
      'mindfulMinutes',
      'workoutCount',
      'stateOfMindCount',
    ]);
    expect(serialized).not.toMatch(
      /generatedAt|"days"|"date"|source|identifier|rawSamples|2026-08-08/i
    );
  });

  it('previews every field that the bounded aggregate sends', () => {
    const preview = appleHealthAiSharePreview({
      sevenDay: {
        coverageDays: 4,
        averageSteps: 4101,
        averageSleepMinutes: 422,
        exerciseMinutes: 83,
        mindfulMinutes: 17,
        workoutCount: 2,
        stateOfMindCount: 3,
      },
      thirtyDay: {
        coverageDays: 21,
        averageSteps: 3902,
        averageSleepMinutes: null,
        exerciseMinutes: 284,
        mindfulMinutes: 59,
        workoutCount: 7,
        stateOfMindCount: 8,
      },
      moodComparison: 'A bounded comparison.',
    });

    for (const value of [
      '4 days with data',
      '4,101 average steps',
      '7h 2m average sleep',
      '83 exercise minutes',
      '17 mindful minutes',
      '2 workouts',
      '3 State of Mind entries',
      '21 days with data',
      '3,902 average steps',
      '— average sleep',
      '284 exercise minutes',
      '59 mindful minutes',
      '7 workouts',
      '8 State of Mind entries',
      'Mood comparison: A bounded comparison.',
    ]) {
      expect(preview).toContain(value);
    }
  });
});

describe('Apple Health preference', () => {
  it('is account-scoped and stores no health samples', async () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: vi.fn(async (key: string) => values.get(key) ?? null),
      setItem: vi.fn(async (key: string, value: string) => {
        values.set(key, value);
      }),
      removeItem: vi.fn(async (key: string) => {
        values.delete(key);
      }),
    };
    const preference = createAppleHealthPreference(storage);
    const ownerAChanges: boolean[] = [];
    const ownerBChanges: boolean[] = [];
    const unsubscribeA = preference.subscribe('owner-a', (enabled) =>
      ownerAChanges.push(enabled)
    );
    const unsubscribeB = preference.subscribe('owner-b', (enabled) =>
      ownerBChanges.push(enabled)
    );

    await preference.write('owner-a', true);
    expect(await preference.read('owner-a')).toBe(true);
    expect(await preference.read('owner-b')).toBe(false);
    expect([...values.values()]).toEqual(['enabled']);
    await preference.clear('owner-a');
    expect(await preference.read('owner-a')).toBe(false);
    expect(ownerAChanges).toEqual([true, false]);
    expect(ownerBChanges).toEqual([]);
    unsubscribeA();
    unsubscribeB();
  });

  it('rejects blank owners', async () => {
    const preference = createAppleHealthPreference({
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    });
    await expect(preference.read(' ')).rejects.toThrow('owner is required');
  });
});

describe('Apple Health release boundaries', () => {
  it('configures read-only foreground HealthKit access', () => {
    const app = JSON.parse(
      readFileSync(resolve(root, 'mobile/app.json'), 'utf8')
    ).expo;
    const plugin = app.plugins.find(
      (entry: unknown) => Array.isArray(entry) && entry[0] === '@kingstinct/react-native-healthkit'
    );
    expect(app.version).toBe('1.0.4');
    expect(plugin?.[1]).toMatchObject({
      background: false,
    });
    expect(plugin?.[1].NSHealthShareUsageDescription).toContain(
      'Raw samples stay on your device'
    );
    expect(plugin?.[1].NSHealthShareUsageDescription).toContain(
      'include it in a Visit Brief'
    );
    expect(plugin?.[1].NSHealthUpdateUsageDescription).toContain(
      'does not add or change Apple Health data'
    );
  });

  it('discloses explicit Visit Brief aggregate sharing in release privacy copy', () => {
    const privacy = readFileSync(resolve(root, 'app/privacy/page.tsx'), 'utf8');
    const reviewNotes = readFileSync(resolve(root, 'mobile/APP_REVIEW_NOTES.md'), 'utf8');
    expect(privacy).toContain('include that aggregate in a Visit Brief');
    expect(privacy).toContain('choose');
    expect(privacy).toContain('its recipient through the iOS share sheet');
    expect(reviewNotes).toContain('add');
    expect(reviewNotes).toContain('the aggregate to a Visit Brief');
    expect(reviewNotes).toContain('choose its recipient through the iOS share');
  });

  it('keeps raw HealthKit data out of AI, partner, analytics, and cloud modules', () => {
    for (const path of [
      'mobile/lib/partner-sharing.ts',
      'mobile/lib/observability.ts',
      'mobile/lib/supabase.ts',
    ]) {
      expect(readFileSync(resolve(root, path), 'utf8')).not.toMatch(
        /apple-health|react-native-healthkit|HealthKit/i
      );
    }
    const adapter = readFileSync(
      resolve(root, 'mobile/lib/apple-health.ts'),
      'utf8'
    );
    expect(adapter).not.toMatch(/supabase|apiRequest|fetch\(|recordOperationalEvent/);
    expect(adapter).toContain('toRead: requestedTypes');
    expect(adapter).not.toContain('toShare:');
    expect(adapter.match(/runAppleHealthQuery\(/g)).toHaveLength(6);

    const chat = readFileSync(
      resolve(root, 'mobile/app/(tabs)/chat.tsx'),
      'utf8'
    );
    expect(chat).toContain('confirmAppleHealthAiShare');
    expect(chat).toContain('Confirm every send');
    expect(chat).toContain("process.env.EXPO_PUBLIC_HEALTH_AI_ENABLED === 'true'");
    expect(chat).toContain('useLocalSearchParams');
    expect(chat).toContain('setAppleHealthContext(true)');
    expect(chat).not.toContain('snapshot.days');
    expect(chat).not.toContain('generatedAt');

    const insights = readFileSync(
      resolve(root, 'mobile/components/AppleHealthInsights.tsx'),
      'utf8'
    );
    expect(insights).toContain("label=\"Open today’s suggestion\"");
    expect(insights).toContain("pathname: '/advisor'");
    expect(insights).toContain("params: { health: '1' }");
    expect(insights).not.toContain('Raw Health samples stay on this device.');
    expect(insights).toContain('No recent Health data');
    expect(insights).toContain('Nothing available from the last 30 days.');
    expect(insights).not.toMatch(
      /make sense|higher-mood|lower-mood|mood and apple health|overlap|pattern|cause|diagnos|motivation|capacity|advice/i
    );
    expect(insights).not.toContain("mood: '1'");

    const advisorContext = readFileSync(
      resolve(root, 'mobile/lib/advisor-context.ts'),
      'utf8'
    );
    expect(advisorContext).toContain('createAdvisorHealthFeatures(snapshot)');
    expect(advisorContext).toContain('withTimeout(loadAppleHealthSnapshot(), HEALTH_TIMEOUT_MS)');
    expect(advisorContext).not.toMatch(/fetch\(|apiRequest|generateText|streamText/);

    const consent = readFileSync(
      resolve(root, 'mobile/lib/apple-health-ai-consent.ts'),
      'utf8'
    );
    expect(consent).toContain("text: 'Share once'");
    const preview = readFileSync(
      resolve(root, 'mobile/lib/apple-health-ai-preview.ts'),
      'utf8'
    );
    expect(preview).toContain('Raw samples, dates, source devices, and identifiers');
  });

  it('cleans Health preferences across every terminal session path', () => {
    const authContext = readFileSync(
      resolve(root, 'mobile/lib/auth-context.tsx'),
      'utf8'
    );
    expect(authContext.match(/appleHealthPreference\.clear\(/g)).toHaveLength(4);
    expect(authContext).toContain('Expired-session local cleanup failed:');
    expect(
      readFileSync(resolve(root, 'mobile/components/AppleHealthInsights.tsx'), 'utf8')
    ).toContain('appleHealthPreference.subscribe');
    const insights = readFileSync(
      resolve(root, 'mobile/components/AppleHealthInsights.tsx'),
      'utf8'
    );
    expect(insights).toContain('useFocusEffect');
    expect(insights).toContain('resolvedOwnerId !== ownerId');
    const settings = readFileSync(
      resolve(root, 'mobile/components/AppleHealthSettingsCard.tsx'),
      'utf8'
    );
    expect(settings).toContain('announceForAccessibility');
    expect(settings).toContain('lifecycleGenerationRef.current === expectedGeneration');
    expect(settings).toContain('await appleHealthPreference.clear(expectedOwnerId)');
    expect(settings).not.toContain('AI sharing needs approval each time');
    expect(settings).not.toContain('Never shared with partners');
    const tracker = readFileSync(
      resolve(root, 'mobile/app/(tabs)/tracker.tsx'),
      'utf8'
    );
    expect(tracker).toContain("format(subDays(now, 29), 'yyyy-MM-dd')");
    expect(tracker).toContain(".gte('local_date', rangeStart)");
    expect(tracker).not.toContain('startOfMonth');
  });

  it('publishes the exact categories and on-device disclosure', () => {
    const privacy = readFileSync(resolve(root, 'app/privacy/page.tsx'), 'utf8');
    const description = readFileSync(
      resolve(root, 'mobile/fastlane/metadata/en-US/description.txt'),
      'utf8'
    );
    for (const phrase of [
      'steps',
      'exercise minutes',
      'workouts',
      'sleep',
      'mindful sessions',
      'State of Mind',
    ]) {
      expect(privacy).toContain(phrase);
    }
    expect(privacy).toContain('Raw Apple Health samples, dates, source devices, and');
    expect(privacy).toContain('Share once');
    expect(description).toContain('OPTIONAL APPLE HEALTH CONTEXT');
    expect(description).toContain('read-only');
    expect(description).toContain('one AI request');
  });
});
