export type BodyPractice = {
  id: 'muscle-release' | 'gentle-settling';
  title: string;
  description: string;
  note: string;
  steps: { label: string; instruction: string; seconds: number }[];
  source: { label: string; url: string };
};

export const BODY_PRACTICES: BodyPractice[] = [
  {
    id: 'muscle-release', title: 'Gentle muscle relaxation',
    description: 'Notice the difference between a little tension and letting go.',
    note: 'Skip painful or injured areas. You can just imagine softening instead of tensing. Stop for pain, cramping, or discomfort; ask a clinician about relevant injuries or muscle conditions.',
    source: { label: 'NHS relaxation guidance', url: 'https://www.rnoh.nhs.uk/patients-and-visitors/patient-information-guides/relaxation-techniques-pain-management' },
    steps: [
      { label: 'Get comfortable', instruction: 'Sit or lie with support. Keep breathing normally throughout; leave your eyes open if you prefer.', seconds: 20 },
      { label: 'Hands', instruction: 'If comfortable, gently curl your fingers for a few seconds, then release. Leave them relaxed for the rest of this step. Skip any painful area.', seconds: 30 },
      { label: 'Shoulders', instruction: 'If comfortable, lift your shoulders a little for a few seconds, then let them drop. Keep your neck easy. Stay relaxed for the rest of this step.', seconds: 30 },
      { label: 'Feet', instruction: 'If comfortable, gently press your feet into their support for a few seconds, then release. Or simply notice their weight. Rest for the remaining time.', seconds: 30 },
      { label: 'Let go', instruction: 'Let all effort stop. Notice your surroundings and take your time returning. No particular feeling is required.', seconds: 20 },
    ],
  },
  {
    id: 'gentle-settling', title: 'Gentle settling',
    description: 'A comfortable posture, an easy breath, and a moment in the present.',
    note: 'This is a relaxation practice, not a vagus nerve reset or treatment. Nothing needs to be forced. Stop or return to your surroundings if this feels unpleasant.',
    source: { label: 'NHS comfortable breathing guidance', url: 'https://www.nhs.uk/mental-health/self-help/guides-tools-and-activities/breathing-exercises-for-stress/' },
    steps: [
      { label: 'Find support', instruction: 'Let the chair or floor support you. Look around and notice a neutral object nearby.', seconds: 30 },
      { label: 'Ease the effort', instruction: 'Let your hands rest. Allow your jaw and shoulders to soften without pressing or stretching them.', seconds: 30 },
      { label: 'An easy breath', instruction: 'Let your breath move at a comfortable pace. Do not hold it or force a deep breath. You can focus on the room instead.', seconds: 45 },
      { label: 'Choose what comes next', instruction: 'Notice where you are. Choose whether to rest, move, or return to your day. No change is okay.', seconds: 15 },
    ],
  },
];

export const VISUAL_FOCUS_SECONDS = 30;
export function visualFocusTravel(width: number, narrow: boolean): number {
  if (!Number.isFinite(width)) return 0;
  return Math.max(0, Math.min((width - 64) / 2, narrow ? 36 : 76));
}
