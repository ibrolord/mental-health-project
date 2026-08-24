export const ADVISOR_PROFILE_VERSION = 1;

export type AdvisorFocus = 'stability' | 'momentum' | 'recovery' | 'structure';
export type AdvisorPriority =
  | 'sleep'
  | 'movement'
  | 'mood'
  | 'habits'
  | 'goals'
  | 'study'
  | 'relationships';
export type AdvisorSupportStyle = 'direct' | 'gentle' | 'practical';
export type AdvisorLowEnergyEssential =
  | 'grounding'
  | 'rest'
  | 'connect'
  | 'mood'
  | 'habits'
  | 'goals';

export type AdvisorProfile = {
  version: number;
  preferredName: string;
  focus: AdvisorFocus;
  priorities: AdvisorPriority[];
  supportStyle: AdvisorSupportStyle;
  lowEnergyEssentials: AdvisorLowEnergyEssential[];
  completedAt: string | null;
  updatedAt: string;
};

const FOCUSES = new Set<AdvisorFocus>(['stability', 'momentum', 'recovery', 'structure']);
const PRIORITIES = new Set<AdvisorPriority>([
  'sleep', 'movement', 'mood', 'habits', 'goals', 'study', 'relationships',
]);
const STYLES = new Set<AdvisorSupportStyle>(['direct', 'gentle', 'practical']);
const ESSENTIALS = new Set<AdvisorLowEnergyEssential>([
  'grounding', 'rest', 'connect', 'mood', 'habits', 'goals',
]);

export const ADVISOR_FOCUS_OPTIONS = Object.freeze([
  { id: 'stability' as const, label: 'Feel steadier', description: 'Mood, sleep, and a sustainable baseline.' },
  { id: 'momentum' as const, label: 'Build momentum', description: 'Goals, habits, and follow-through.' },
  { id: 'recovery' as const, label: 'Recover gently', description: 'Reduce pressure and restore capacity.' },
  { id: 'structure' as const, label: 'Create structure', description: 'Plan work, study, and daily priorities.' },
]);

export const ADVISOR_PRIORITY_OPTIONS = Object.freeze([
  { id: 'goals' as const, label: 'Goals' },
  { id: 'habits' as const, label: 'Habits' },
  { id: 'study' as const, label: 'School or study' },
  { id: 'mood' as const, label: 'Mood' },
  { id: 'sleep' as const, label: 'Sleep' },
  { id: 'movement' as const, label: 'Movement' },
  { id: 'relationships' as const, label: 'Relationships' },
]);

export const ADVISOR_STYLE_OPTIONS = Object.freeze([
  { id: 'direct' as const, label: 'Direct' },
  { id: 'gentle' as const, label: 'Gentle' },
  { id: 'practical' as const, label: 'Practical' },
]);

export const ADVISOR_ESSENTIAL_OPTIONS = Object.freeze([
  { id: 'grounding' as const, label: 'Grounding' },
  { id: 'rest' as const, label: 'Rest' },
  { id: 'connect' as const, label: 'Connect' },
  { id: 'mood' as const, label: 'Mood check-in' },
  { id: 'habits' as const, label: 'Habits' },
  { id: 'goals' as const, label: 'Goals' },
]);

const FOCUS_PRIORITIES: Record<AdvisorFocus, AdvisorPriority[]> = {
  stability: ['mood', 'sleep'],
  momentum: ['goals', 'habits'],
  recovery: ['mood', 'sleep'],
  structure: ['goals', 'study'],
};

export function sanitizeAdvisorName(value: string): string {
  return Array.from(value.trim().replace(/\s+/g, ' ')).slice(0, 24).join('');
}

export function defaultAdvisorProfile(nowIso = new Date().toISOString()): AdvisorProfile {
  return {
    version: ADVISOR_PROFILE_VERSION,
    preferredName: '',
    focus: 'stability',
    priorities: [...FOCUS_PRIORITIES.stability],
    supportStyle: 'gentle',
    lowEnergyEssentials: ['grounding'],
    completedAt: null,
    updatedAt: nowIso,
  };
}

export function prioritiesForAdvisorFocus(focus: AdvisorFocus): AdvisorPriority[] {
  return [...FOCUS_PRIORITIES[focus]];
}

export function normalizeAdvisorProfile(value: unknown): AdvisorProfile {
  const fallback = defaultAdvisorProfile();
  if (!value || typeof value !== 'object') return fallback;
  const raw = value as Record<string, unknown>;
  if (typeof raw.version === 'number' && raw.version > ADVISOR_PROFILE_VERSION) return fallback;
  const focus = typeof raw.focus === 'string' && FOCUSES.has(raw.focus as AdvisorFocus)
    ? raw.focus as AdvisorFocus
    : fallback.focus;
  const priorities = Array.isArray(raw.priorities)
    ? [...new Set(raw.priorities)]
        .filter((item): item is AdvisorPriority => typeof item === 'string' && PRIORITIES.has(item as AdvisorPriority))
        .slice(0, 3)
    : [];
  const lowEnergyEssentials = Array.isArray(raw.lowEnergyEssentials)
    ? [...new Set(raw.lowEnergyEssentials)]
        .filter((item): item is AdvisorLowEnergyEssential => typeof item === 'string' && ESSENTIALS.has(item as AdvisorLowEnergyEssential))
        .slice(0, 3)
    : [];
  return {
    version: ADVISOR_PROFILE_VERSION,
    preferredName: typeof raw.preferredName === 'string' ? sanitizeAdvisorName(raw.preferredName) : '',
    focus,
    priorities: priorities.length ? priorities : prioritiesForAdvisorFocus(focus),
    supportStyle: typeof raw.supportStyle === 'string' && STYLES.has(raw.supportStyle as AdvisorSupportStyle)
      ? raw.supportStyle as AdvisorSupportStyle
      : fallback.supportStyle,
    lowEnergyEssentials: lowEnergyEssentials.length ? lowEnergyEssentials : ['grounding'],
    completedAt: typeof raw.completedAt === 'string' && Number.isFinite(new Date(raw.completedAt).getTime())
      ? raw.completedAt
      : null,
    updatedAt: typeof raw.updatedAt === 'string' && Number.isFinite(new Date(raw.updatedAt).getTime())
      ? raw.updatedAt
      : fallback.updatedAt,
  };
}

export function hasUnsupportedAdvisorProfileVersion(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const version = (value as Record<string, unknown>).version;
  return typeof version === 'number' && version > ADVISOR_PROFILE_VERSION;
}

export function completeAdvisorProfile(
  profile: AdvisorProfile,
  nowIso = new Date().toISOString()
): AdvisorProfile {
  return normalizeAdvisorProfile({
    ...profile,
    completedAt: profile.completedAt ?? nowIso,
    updatedAt: nowIso,
  });
}
