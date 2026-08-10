import { Platform } from 'react-native';
import type {
  CategorySampleTyped,
  ObjectTypeIdentifier,
  QueryStatisticsResponse,
  StateOfMindSampleTyped,
  WorkoutProxyTyped,
} from '@kingstinct/react-native-healthkit/types';
import {
  APPLE_HEALTH_WINDOW_DAYS,
  appleHealthDateRange,
  buildAppleHealthSnapshot,
  runAppleHealthQuery,
  type AppleHealthSnapshot,
  type DatedValue,
  type HealthInterval,
  type StateOfMindValue,
} from './apple-health-core';

type HealthKitModule = typeof import('@kingstinct/react-native-healthkit');

export const APPLE_HEALTH_READ_TYPES = [
  'HKQuantityTypeIdentifierStepCount',
  'HKQuantityTypeIdentifierAppleExerciseTime',
  'HKCategoryTypeIdentifierMindfulSession',
  'HKCategoryTypeIdentifierSleepAnalysis',
  'HKWorkoutTypeIdentifier',
  'HKStateOfMindTypeIdentifier',
] as const satisfies readonly ObjectTypeIdentifier[];

export const APPLE_HEALTH_DATA_LABELS = [
  'Steps',
  'Exercise minutes',
  'Workouts',
  'Sleep',
  'Mindful minutes',
  'State of Mind',
] as const;

const SLEEP_VALUES = new Set([1, 3, 4, 5]);

export class AppleHealthUnavailableError extends Error {
  constructor() {
    super('Apple Health is not available on this device.');
    this.name = 'AppleHealthUnavailableError';
  }
}

async function loadHealthKit(): Promise<HealthKitModule> {
  if (Platform.OS !== 'ios') throw new AppleHealthUnavailableError();
  return import('@kingstinct/react-native-healthkit');
}

function availableReadTypes(healthKit: HealthKitModule): ObjectTypeIdentifier[] {
  return APPLE_HEALTH_READ_TYPES.filter((identifier) =>
    healthKit.isObjectTypeAvailable(identifier)
  );
}

export async function isAppleHealthAvailable(): Promise<boolean> {
  if (Platform.OS !== 'ios') return false;
  try {
    const healthKit = await loadHealthKit();
    return healthKit.isHealthDataAvailable();
  } catch {
    return false;
  }
}

export async function requestAppleHealthReadAccess(): Promise<{
  available: true;
  requestCompleted: boolean;
  requestedTypes: ObjectTypeIdentifier[];
}> {
  const healthKit = await loadHealthKit();
  if (!healthKit.isHealthDataAvailable()) throw new AppleHealthUnavailableError();
  const requestedTypes = availableReadTypes(healthKit);
  if (requestedTypes.length === 0) throw new AppleHealthUnavailableError();
  const requestCompleted = await healthKit.requestAuthorization({
    toRead: requestedTypes,
  });
  return { available: true, requestCompleted, requestedTypes };
}

function statisticValues(
  results: readonly QueryStatisticsResponse[]
): DatedValue[] {
  return results.flatMap((result) => {
    if (!result.startDate) return [];
    return [
      {
        date: new Date(result.startDate),
        value: result.sumQuantity?.quantity ?? null,
      },
    ];
  });
}

function intervalValues(
  samples: readonly { startDate: Date; endDate: Date }[]
): HealthInterval[] {
  return samples.map((sample) => ({
    startDate: new Date(sample.startDate),
    endDate: new Date(sample.endDate),
  }));
}

export async function loadAppleHealthSnapshot(
  days = APPLE_HEALTH_WINDOW_DAYS,
  now = new Date()
): Promise<AppleHealthSnapshot> {
  const healthKit = await loadHealthKit();
  if (!healthKit.isHealthDataAvailable()) throw new AppleHealthUnavailableError();

  const range = appleHealthDateRange(days, now);
  const available = healthKit.areObjectTypesAvailable(APPLE_HEALTH_READ_TYPES);
  const dateFilter = {
    date: {
      startDate: range.start,
      endDate: range.end,
      strictStartDate: false,
      strictEndDate: false,
    },
  };
  const queryOptions = { filter: dateFilter, limit: 0, ascending: true } as const;

  const stepsPromise = available.HKQuantityTypeIdentifierStepCount
    ? runAppleHealthQuery(() => healthKit.queryStatisticsCollectionForQuantity(
        'HKQuantityTypeIdentifierStepCount',
        ['cumulativeSum'],
        range.start,
        { day: 1 },
        { filter: dateFilter, unit: 'count' }
      ))
    : Promise.resolve([] as readonly QueryStatisticsResponse[]);
  const exercisePromise = available.HKQuantityTypeIdentifierAppleExerciseTime
    ? runAppleHealthQuery(() => healthKit.queryStatisticsCollectionForQuantity(
        'HKQuantityTypeIdentifierAppleExerciseTime',
        ['cumulativeSum'],
        range.start,
        { day: 1 },
        { filter: dateFilter, unit: 'min' }
      ))
    : Promise.resolve([] as readonly QueryStatisticsResponse[]);
  const sleepPromise = available.HKCategoryTypeIdentifierSleepAnalysis
    ? runAppleHealthQuery(() => healthKit.queryCategorySamples(
        'HKCategoryTypeIdentifierSleepAnalysis',
        queryOptions
      ))
    : Promise.resolve(
        [] as readonly CategorySampleTyped<'HKCategoryTypeIdentifierSleepAnalysis'>[]
      );
  const mindfulPromise = available.HKCategoryTypeIdentifierMindfulSession
    ? runAppleHealthQuery(() => healthKit.queryCategorySamples(
        'HKCategoryTypeIdentifierMindfulSession',
        queryOptions
      ))
    : Promise.resolve(
        [] as readonly CategorySampleTyped<'HKCategoryTypeIdentifierMindfulSession'>[]
      );
  const workoutsPromise = available.HKWorkoutTypeIdentifier
    ? runAppleHealthQuery(() => healthKit.queryWorkoutSamples(queryOptions))
    : Promise.resolve([] as readonly WorkoutProxyTyped[]);
  const statesPromise = available.HKStateOfMindTypeIdentifier
    ? runAppleHealthQuery(() => healthKit.queryStateOfMindSamples(queryOptions))
    : Promise.resolve([] as readonly StateOfMindSampleTyped[]);

  const [steps, exercise, sleep, mindful, workouts, states] = await Promise.all([
    stepsPromise,
    exercisePromise,
    sleepPromise,
    mindfulPromise,
    workoutsPromise,
    statesPromise,
  ]);

  const sleepIntervals = intervalValues(
    sleep.filter((sample) => SLEEP_VALUES.has(Number(sample.value)))
  );
  const mindfulIntervals = intervalValues(mindful);
  const stateValues: StateOfMindValue[] = states.map((sample) => ({
    date: new Date(sample.startDate),
    valence: sample.valence,
  }));

  return buildAppleHealthSnapshot(
    {
      steps: statisticValues(steps),
      exerciseMinutes: statisticValues(exercise),
      sleep: sleepIntervals,
      mindfulSessions: mindfulIntervals,
      workouts: workouts.map((workout) => ({ date: new Date(workout.startDate) })),
      statesOfMind: stateValues,
    },
    now,
    days
  );
}
