import type { StartingFocus } from './advisor-onboarding';

export const JOURNEY_STEPS = ['focus', 'motivation', 'obstacle', 'evidence', 'commitment', 'review'] as const;
export type JourneyStep = typeof JOURNEY_STEPS[number];
export type PersonalObstacle = 'energy' | 'overwhelm' | 'time' | 'forget' | 'unsure' | 'custom';
export type AdvisorPersonalPlan = {
  motivation: string;
  obstacle: PersonalObstacle | null;
  obstacleDetail: string;
  action: string;
  cue: string;
};

export const MOTIVATIONS = ['Feel more like myself', 'Be present for people I care about', 'Have more space for what I enjoy', 'Trust myself to follow through'];
export const OBSTACLES: { id: PersonalObstacle; label: string; response: string }[] = [
  { id: 'energy', label: 'My energy runs low', response: 'Keep the next step small enough for a low-energy day.' },
  { id: 'overwhelm', label: 'It all feels like too much', response: 'One step at a time, with the rest out of the way.' },
  { id: 'time', label: 'My day gets too busy', response: 'Fit one small step into a moment you already have.' },
  { id: 'forget', label: 'I lose track or forget', response: 'Attach the step to something already in your day.' },
  { id: 'unsure', label: 'I am not sure where to start', response: 'Begin with one clear action, not the whole goal.' },
];
export const COMMITMENT_ACTIONS: Record<StartingFocus, readonly string[]> = {
  steady: ['Name one feeling', 'Notice five things around me', 'Write one honest sentence'],
  routine: ['Drink a glass of water', 'Stretch for two minutes', 'Step outside for two minutes'],
  'follow-through': ['Write my smallest next step', 'Spend two minutes starting', 'Choose one priority for today'],
};
export const COMMITMENT_CUES = ['After my first drink of the day', 'When I take a break', 'Before I settle down for the night'];

export function boundedPlanText(value: unknown, max = 180): string {
  return typeof value === 'string'
    ? Array.from(value.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().replace(/\s+/g, ' ')).slice(0, max).join('')
    : '';
}

export function normalizePersonalPlan(value: unknown): AdvisorPersonalPlan {
  const raw = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const obstacle = [...OBSTACLES.map((item) => item.id), 'custom'].includes(raw.obstacle as PersonalObstacle)
    ? raw.obstacle as PersonalObstacle : null;
  const action = boundedPlanText(raw.action, 120);
  return {
    motivation: boundedPlanText(raw.motivation),
    obstacle,
    obstacleDetail: obstacle === 'custom' ? boundedPlanText(raw.obstacleDetail) : '',
    action,
    cue: action ? boundedPlanText(raw.cue, 100) : '',
  };
}

export function obstacleResponse(plan: AdvisorPersonalPlan): string {
  return OBSTACLES.find((item) => item.id === plan.obstacle)?.response ?? 'Start at a pace that works for you.';
}

export function nextJourneyStep(step: JourneyStep): JourneyStep {
  return JOURNEY_STEPS[Math.min(JOURNEY_STEPS.indexOf(step) + 1, JOURNEY_STEPS.length - 1)];
}

export function previousJourneyStep(step: JourneyStep): JourneyStep {
  return JOURNEY_STEPS[Math.max(JOURNEY_STEPS.indexOf(step) - 1, 0)];
}

export function personalPlanKey(plan: AdvisorPersonalPlan): string {
  // The action ledger needs a stable opaque key, never the user's private text.
  let hash = 2166136261;
  for (const character of JSON.stringify(normalizePersonalPlan(plan))) {
    hash = Math.imul(hash ^ character.codePointAt(0)!, 16777619);
  }
  return `personal-plan:${(hash >>> 0).toString(16)}`;
}
