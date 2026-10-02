import {
  completeAdvisorProfile,
  normalizeAdvisorProfile,
  sanitizeAdvisorName,
  type AdvisorProfile,
} from './advisor-profile';
import { normalizePersonalPlan, type AdvisorPersonalPlan } from './onboarding-journey';

export const STARTING_FOCUS_OPTIONS = [
  { id: 'steady', label: 'Feel steadier', description: 'Make space to pause and check in.', icon: 'wind',
    preview: 'Check in with how you feel, at your own pace.', action: 'Check in with myself',
    consequence: 'Advisor will prioritize mood check-ins.', route: '/(tabs)/tracker' },
  { id: 'routine', label: 'Build a routine', description: 'Start with one small, repeatable habit.', icon: 'sun',
    preview: 'Choose one small habit that fits your day.', action: 'Choose my habit',
    consequence: 'Advisor will prioritize habits.', route: '/habits' },
  { id: 'follow-through', label: 'Make progress on a goal', description: 'Turn a goal into a doable next step.', icon: 'flag',
    preview: 'Choose something important and find a place to begin.', action: 'Choose my goal',
    consequence: 'Advisor will prioritize goals.', route: '/goals' },
] as const;

export type StartingFocus = typeof STARTING_FOCUS_OPTIONS[number]['id'];

const dismissedThisSession = new Set<string>();

export function dismissAdvisorWelcomeForSession(ownerKey: string | null): void {
  if (ownerKey) dismissedThisSession.add(ownerKey);
}

export function shouldOfferAdvisorSetup(profile: AdvisorProfile, ownerKey?: string | null): boolean {
  return !profile.completedAt && !profile.onboardingDismissedAt &&
    !(ownerKey && dismissedThisSession.has(ownerKey));
}

export function advisorWelcomeOption(focus: StartingFocus) {
  return STARTING_FOCUS_OPTIONS.find((option) => option.id === focus)!;
}

export function createWelcomeSaveGate() {
  const pending = new Map<string | null, symbol>();
  return {
    has: (owner: string | null) => pending.has(owner),
    begin(owner: string | null): symbol | null {
      if (pending.has(owner)) return null;
      const operation = Symbol('welcome-save');
      pending.set(owner, operation);
      return operation;
    },
    finish(owner: string | null, operation: symbol): void {
      if (pending.get(owner) === operation) pending.delete(owner);
    },
  };
}

export function finishAdvisorWelcome(
  profile: AdvisorProfile,
  focus: StartingFocus | null,
  preferredName: string,
  nowIso = new Date().toISOString(),
  personalPlan?: AdvisorPersonalPlan
): AdvisorProfile {
  // Skipping is not consent to personalization and does not invent priorities.
  if (!focus) {
    return normalizeAdvisorProfile({ ...profile, onboardingDismissedAt: nowIso, updatedAt: nowIso });
  }
  // Save only the priority described in the preview, not inferred secondary needs.
  const choices: Record<StartingFocus, Pick<AdvisorProfile, 'focus' | 'priorities'>> = {
    steady: { focus: 'stability', priorities: ['mood'] },
    routine: { focus: 'structure', priorities: ['habits'] },
    'follow-through': { focus: 'momentum', priorities: ['goals'] },
  };
  return completeAdvisorProfile({
    ...profile,
    ...choices[focus],
    preferredName: sanitizeAdvisorName(preferredName),
    ...(personalPlan ? { personalPlan: normalizePersonalPlan(personalPlan) } : {}),
  }, nowIso);
}

export async function saveAdvisorWelcomeAndOpen({
  profile, focus, name, personalPlan, save, isCurrent, open,
}: {
  profile: AdvisorProfile;
  focus: StartingFocus;
  name: string;
  personalPlan?: AdvisorPersonalPlan;
  save: (next: AdvisorProfile) => Promise<boolean>;
  isCurrent: () => boolean;
  open: (route: ReturnType<typeof advisorWelcomeOption>['route']) => void;
}): Promise<'saved' | 'failed' | 'stale'> {
  if (!isCurrent()) return 'stale';
  let saved = false;
  try {
    saved = await save(finishAdvisorWelcome(profile, focus, name, undefined, personalPlan));
  } catch {
    // A failed preference write must not navigate or claim setup succeeded.
  }
  if (!isCurrent()) return 'stale';
  if (!saved) return 'failed';
  open(advisorWelcomeOption(focus).route);
  return 'saved';
}

export function todayGreeting(hour: number, preferredName: string): string {
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const name = sanitizeAdvisorName(preferredName);
  return name ? `${greeting}, ${name}.` : `${greeting}.`;
}
