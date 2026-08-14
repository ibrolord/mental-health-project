import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AdvisorDailyBrief } from './advisor-brief-core';
import type { AdvisorRecommendation } from './advisor-core';

type BriefStorage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};

export type StoredAdvisorBrief = {
  version: 1;
  ownerKey: string;
  localDate: string;
  fingerprint: string;
  generatedAt: string;
  model: 'gemini' | 'claude' | null;
  recommendation: AdvisorRecommendation;
  brief: AdvisorDailyBrief;
};

const PREFIX = 'mhtoolkit.advisor.daily-brief.v1.';
const ROUTES = new Set([
  '/ground',
  '/goals',
  '/habits',
  '/(tabs)/tracker',
  '/plans',
  '/resources',
]);
const FOCUSES = new Set(['steady', 'deadline', 'routine', 'baseline', 'recover']);
const SIGNAL_KINDS = new Set([
  'mood',
  'deadline',
  'routine',
  'streak',
  'health',
  'notifications',
]);

function keyForOwner(ownerKey: string): string {
  const normalized = ownerKey.trim();
  if (!normalized) throw new Error('An owner is required for an Advisor brief.');
  return `${PREFIX}${normalized}`;
}

function isStoredAdvisorBrief(value: unknown): value is StoredAdvisorBrief {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Partial<StoredAdvisorBrief>;
  const recommendation = record.recommendation as Partial<AdvisorRecommendation> | undefined;
  const brief = record.brief as Partial<AdvisorDailyBrief> | undefined;
  const validRecommendation = Boolean(
    recommendation &&
    typeof recommendation.id === 'string' &&
    (recommendation.kind === 'standard' || recommendation.kind === 'safety') &&
    typeof recommendation.observation === 'string' &&
    typeof recommendation.action === 'string' &&
    typeof recommendation.smallerAction === 'string' &&
    typeof recommendation.route === 'string' &&
    ROUTES.has(recommendation.route) &&
    Array.isArray(recommendation.sourceLabels) &&
    recommendation.sourceLabels.every((item) => typeof item === 'string') &&
    typeof recommendation.resourceLabel === 'string' &&
    Array.isArray(recommendation.observations) &&
    recommendation.observations.every((item) => typeof item === 'string')
  );
  const validBrief = Boolean(
    brief &&
    typeof brief.focus === 'string' &&
    FOCUSES.has(brief.focus) &&
    typeof brief.headline === 'string' &&
    typeof brief.usedAppleHealth === 'boolean' &&
    Array.isArray(brief.signals) &&
    brief.signals.every(
      (signal) =>
        Boolean(signal) &&
        typeof signal.id === 'string' &&
        typeof signal.kind === 'string' &&
        SIGNAL_KINDS.has(signal.kind) &&
        typeof signal.text === 'string'
    )
  );
  return record.version === 1 &&
    typeof record.ownerKey === 'string' &&
    typeof record.localDate === 'string' &&
    typeof record.fingerprint === 'string' &&
    typeof record.generatedAt === 'string' &&
    (record.model === 'gemini' || record.model === 'claude' || record.model === null) &&
    validRecommendation &&
    validBrief;
}

export function createAdvisorBriefStorage(storage: BriefStorage) {
  return {
    async read(
      ownerKey: string,
      localDate: string,
      fingerprint: string
    ): Promise<StoredAdvisorBrief | null> {
      const raw = await storage.getItem(keyForOwner(ownerKey));
      if (!raw) return null;
      try {
        const parsed = JSON.parse(raw) as unknown;
        if (
          !isStoredAdvisorBrief(parsed) ||
          parsed.ownerKey !== ownerKey ||
          parsed.localDate !== localDate ||
          parsed.fingerprint !== fingerprint
        ) {
          return null;
        }
        return parsed;
      } catch {
        return null;
      }
    },

    async write(value: StoredAdvisorBrief): Promise<void> {
      if (!isStoredAdvisorBrief(value)) {
        throw new Error('Advisor brief is invalid.');
      }
      await storage.setItem(keyForOwner(value.ownerKey), JSON.stringify(value));
    },

    async clear(ownerKey: string): Promise<void> {
      await storage.removeItem(keyForOwner(ownerKey));
    },
  };
}

export const advisorBriefStorage = createAdvisorBriefStorage(AsyncStorage);
