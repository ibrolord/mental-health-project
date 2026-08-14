import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AdvisorRecommendation } from './advisor-core';

const STORAGE_PREFIX = 'mhtoolkit.advisor_outcomes.v1';
const MAX_OUTCOMES = 20;
const RETENTION_MS = 90 * 24 * 60 * 60 * 1000;

export type AdvisorOutcome = {
  recommendationId: string;
  offeredAt: string;
  startedAt: string | null;
  completedAt: string | null;
  helpful: boolean | null;
  feedbackAt: string | null;
  shownSignalId?: string | null;
};

export type AdvisorOutcomeStorageAdapter = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};

type RecommendationReference = Pick<AdvisorRecommendation, 'id'>;

export function advisorOutcomesStorageKey(ownerKey: string): string {
  return `${STORAGE_PREFIX}:${encodeURIComponent(ownerKey)}`;
}

function validIso(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(new Date(value).getTime());
}

function validSignalId(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= 160;
}

function parseOutcomes(raw: string | null): AdvisorOutcome[] | null {
  if (raw === null) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    const outcomes: AdvisorOutcome[] = [];
    for (const value of parsed) {
      if (!value || typeof value !== 'object') return null;
      const row = value as Record<string, unknown>;
      if (
        typeof row.recommendationId !== 'string' ||
        !row.recommendationId.trim() ||
        !validIso(row.offeredAt) ||
        !(row.startedAt === null || validIso(row.startedAt)) ||
        !(row.completedAt === null || validIso(row.completedAt)) ||
        !(row.helpful === null || typeof row.helpful === 'boolean') ||
        !(
          row.feedbackAt === undefined ||
          row.feedbackAt === null ||
          validIso(row.feedbackAt)
        ) ||
        !(
          row.shownSignalId === undefined ||
          row.shownSignalId === null ||
          validSignalId(row.shownSignalId)
        )
      ) {
        return null;
      }
      const outcome: AdvisorOutcome = {
        recommendationId: row.recommendationId,
        offeredAt: row.offeredAt,
        startedAt: row.startedAt,
        completedAt: row.completedAt,
        helpful: row.helpful,
        feedbackAt: validIso(row.feedbackAt) ? row.feedbackAt : null,
      };
      if (row.shownSignalId === null || validSignalId(row.shownSignalId)) {
        outcome.shownSignalId = row.shownSignalId;
      }
      outcomes.push(outcome);
    }
    return outcomes;
  } catch {
    return null;
  }
}

function retainedOutcomes(
  outcomes: AdvisorOutcome[],
  now: Date
): AdvisorOutcome[] {
  const cutoff = now.getTime() - RETENTION_MS;
  return outcomes
    .filter((outcome) => new Date(outcome.offeredAt).getTime() >= cutoff)
    .sort(
      (left, right) =>
        new Date(right.offeredAt).getTime() - new Date(left.offeredAt).getTime()
    )
    .slice(0, MAX_OUTCOMES);
}

function operationDate(nowIso: string | undefined, clock: () => Date): Date {
  if (nowIso) {
    const supplied = new Date(nowIso);
    if (Number.isFinite(supplied.getTime())) return supplied;
  }
  return clock();
}

function localDayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

export function createAdvisorOutcomeStorage(
  storage: AdvisorOutcomeStorageAdapter,
  clock: () => Date = () => new Date()
) {
  const queues = new Map<string, Promise<void>>();

  function serialize<T>(
    ownerKey: string,
    operation: () => Promise<T>
  ): Promise<T> {
    const previous = queues.get(ownerKey) ?? Promise.resolve();
    const next = previous.catch(() => undefined).then(operation);
    const settled = next.then(
      () => undefined,
      () => undefined
    );
    queues.set(ownerKey, settled);
    void settled.finally(() => {
      if (queues.get(ownerKey) === settled) queues.delete(ownerKey);
    });
    return next;
  }

  async function read(ownerKey: string): Promise<AdvisorOutcome[]> {
    const parsed = parseOutcomes(
      await storage.getItem(advisorOutcomesStorageKey(ownerKey))
    );
    return parsed ?? [];
  }

  async function write(
    ownerKey: string,
    outcomes: AdvisorOutcome[],
    now: Date
  ): Promise<void> {
    const retained = retainedOutcomes(outcomes, now);
    const key = advisorOutcomesStorageKey(ownerKey);
    if (retained.length === 0) {
      await storage.removeItem(key);
      return;
    }
    await storage.setItem(key, JSON.stringify(retained));
  }

  async function loadAdvisorOutcomes(
    ownerKey: string | null
  ): Promise<AdvisorOutcome[]> {
    if (!ownerKey) return [];
    try {
      return await serialize(ownerKey, async () => {
        const now = clock();
        const outcomes = retainedOutcomes(await read(ownerKey), now);
        await write(ownerKey, outcomes, now);
        return outcomes;
      });
    } catch {
      return [];
    }
  }

  async function recordAdvisorOffered(
    ownerKey: string | null,
    recommendation: RecommendationReference,
    nowIso?: string
  ): Promise<void> {
    if (!ownerKey || !recommendation.id.trim()) return;
    const now = operationDate(nowIso, clock);
    await serialize(ownerKey, async () => {
      const outcomes = await read(ownerKey);
      const alreadyOfferedToday = outcomes.some(
        (outcome) =>
          outcome.recommendationId === recommendation.id &&
          localDayKey(new Date(outcome.offeredAt)) === localDayKey(now)
      );
      if (alreadyOfferedToday) {
        await write(ownerKey, outcomes, now);
        return;
      }
      await write(
        ownerKey,
        [
          {
            recommendationId: recommendation.id,
            offeredAt: now.toISOString(),
            startedAt: null,
            completedAt: null,
            helpful: null,
            feedbackAt: null,
          },
          ...outcomes,
        ],
        now
      );
    });
  }

  async function markAdvisorStarted(
    ownerKey: string | null,
    recommendationId: string,
    nowIso?: string,
    shownSignalId?: string | null
  ): Promise<void> {
    if (!ownerKey || !recommendationId.trim()) return;
    const now = operationDate(nowIso, clock);
    await serialize(ownerKey, async () => {
      const outcomes = await read(ownerKey);
      const target = outcomes.find(
        (outcome) => outcome.recommendationId === recommendationId
      );
      if (!target) return;
      if (!target.startedAt && !target.completedAt) {
        target.startedAt = now.toISOString();
        if (shownSignalId === null || validSignalId(shownSignalId)) {
          target.shownSignalId = shownSignalId;
        }
      }
      await write(ownerKey, outcomes, now);
    });
  }

  async function answerAdvisorCompletion(
    ownerKey: string | null,
    recommendationId: string,
    completed: boolean,
    nowIso?: string
  ): Promise<void> {
    if (!ownerKey || !recommendationId.trim()) return;
    const now = operationDate(nowIso, clock);
    await serialize(ownerKey, async () => {
      const outcomes = await read(ownerKey);
      const target = outcomes.find(
        (outcome) => outcome.recommendationId === recommendationId
      );
      if (!target) return;
      if (completed && target.startedAt && !target.completedAt) {
        target.completedAt = now.toISOString();
      }
      await write(ownerKey, outcomes, now);
    });
  }

  async function answerAdvisorHelpfulness(
    ownerKey: string | null,
    recommendationId: string,
    helpful: boolean | null,
    nowIso?: string
  ): Promise<void> {
    if (!ownerKey || !recommendationId.trim()) return;
    const now = operationDate(nowIso, clock);
    await serialize(ownerKey, async () => {
      const outcomes = await read(ownerKey);
      const target = outcomes.find(
        (outcome) => outcome.recommendationId === recommendationId
      );
      if (!target || !target.startedAt || target.feedbackAt) return;
      target.helpful = helpful;
      target.feedbackAt = now.toISOString();
      await write(ownerKey, outcomes, now);
    });
  }

  async function clearAdvisorOutcomes(ownerKey: string | null): Promise<void> {
    if (!ownerKey) return;
    await serialize(ownerKey, () =>
      storage.removeItem(advisorOutcomesStorageKey(ownerKey))
    );
  }

  return {
    loadAdvisorOutcomes,
    recordAdvisorOffered,
    markAdvisorStarted,
    answerAdvisorCompletion,
    answerAdvisorHelpfulness,
    clearAdvisorOutcomes,
  };
}

const advisorOutcomeStorage = createAdvisorOutcomeStorage(AsyncStorage);

export const loadAdvisorOutcomes = advisorOutcomeStorage.loadAdvisorOutcomes;
export const recordAdvisorOffered = advisorOutcomeStorage.recordAdvisorOffered;
export const markAdvisorStarted = advisorOutcomeStorage.markAdvisorStarted;
export const answerAdvisorCompletion = advisorOutcomeStorage.answerAdvisorCompletion;
export const answerAdvisorHelpfulness = advisorOutcomeStorage.answerAdvisorHelpfulness;
export const clearAdvisorOutcomes = advisorOutcomeStorage.clearAdvisorOutcomes;
