export type YogaSetting = 'chair' | 'floor';

export type YogaPoseId =
  | 'seated-arrival'
  | 'seated-side-reach'
  | 'tabletop-neutral'
  | 'tabletop-round'
  | 'supported-child'
  | 'floor-rest'
  | 'legs-on-chair';

export type YogaPose = {
  id: YogaPoseId;
  name: string;
  imageAlt: string;
};

export type YogaStep = {
  label: string;
  instruction: string;
  seconds: number;
  poseId: YogaPoseId;
  imageAlt?: string;
  mirrorImage?: boolean;
};

export type YogaPractice = {
  id: string;
  title: string;
  summary: string;
  setting: YogaSetting;
  equipment: string;
  steps: YogaStep[];
  safetyNote: string;
  evidenceIds: ('yoga-safety' | 'yoga-depression' | 'physical-activity')[];
};

export const YOGA_POSES: Record<YogaPoseId, YogaPose> = {
  'seated-arrival': {
    id: 'seated-arrival',
    name: 'Seated arrival',
    imageAlt: 'A person sitting upright on a sturdy chair with both feet on the floor.',
  },
  'seated-side-reach': {
    id: 'seated-side-reach',
    name: 'Seated side reach',
    imageAlt: 'A seated person making a gentle side reach with one arm overhead.',
  },
  'tabletop-round': {
    id: 'tabletop-round',
    name: 'Tabletop wave',
    imageAlt: 'A person on hands and knees gently rounding their upper back.',
  },
  'tabletop-neutral': {
    id: 'tabletop-neutral',
    name: 'Neutral tabletop',
    imageAlt: 'A person on hands and knees with a long, neutral spine.',
  },
  'supported-child': {
    id: 'supported-child',
    name: 'Supported rest',
    imageAlt: 'A kneeling person resting their forearms and head on the seat of a chair.',
  },
  'floor-rest': {
    id: 'floor-rest',
    name: 'Floor rest',
    imageAlt: 'A person lying on their back with knees bent and feet on the floor.',
  },
  'legs-on-chair': {
    id: 'legs-on-chair',
    name: 'Supported leg rest',
    imageAlt: 'A person lying on their back with lower legs resting on a chair.',
  },
};

export const YOGA_PRACTICES: YogaPractice[] = [
  {
    id: 'chair-reset',
    title: 'Chair reset',
    summary: 'A short seated sequence for easing out of a tense or still moment.',
    setting: 'chair',
    equipment: 'A sturdy chair without wheels',
    safetyNote: 'Keep both sitting bones supported and stay within an easy range.',
    evidenceIds: ['yoga-safety', 'physical-activity'],
    steps: [
      {
        label: 'Arrive',
        instruction:
          'Sit toward the middle of a sturdy chair. Let both feet meet the floor and rest your hands on your thighs.',
        seconds: 45,
        poseId: 'seated-arrival',
      },
      {
        label: 'Reach left',
        instruction:
          'Keep your weight even. Lift your right arm and lean a little to the left without twisting or forcing the reach.',
        seconds: 45,
        poseId: 'seated-side-reach',
        imageAlt: 'A seated person lifting the right arm and leaning gently to the left.',
      },
      {
        label: 'Reach right',
        instruction:
          'Return upright, then lift your left arm and lean a little to the right. Keep the movement comfortable.',
        seconds: 45,
        poseId: 'seated-side-reach',
        imageAlt: 'A seated person lifting the left arm and leaning gently to the right.',
        mirrorImage: true,
      },
      {
        label: 'Settle',
        instruction:
          'Return both hands to your thighs. Notice the chair and floor supporting you before you stand or continue.',
        seconds: 45,
        poseId: 'seated-arrival',
      },
    ],
  },
  {
    id: 'floor-unwind',
    title: 'Gentle floor unwind',
    summary: 'Slow spinal movement followed by supported rest.',
    setting: 'floor',
    equipment: 'A mat or soft floor and a sturdy chair',
    safetyNote: 'Choose the chair reset if getting to or from the floor is not comfortable.',
    evidenceIds: ['yoga-safety', 'physical-activity'],
    steps: [
      {
        label: 'Find tabletop',
        instruction:
          'Come to hands and knees only if that transition is comfortable. Keep wrists under shoulders and knees under hips.',
        seconds: 30,
        poseId: 'tabletop-neutral',
      },
      {
        label: 'Round and release',
        instruction:
          'Gently round your back, then return to a neutral spine. Move slowly through a range that feels easy.',
        seconds: 90,
        poseId: 'tabletop-round',
      },
      {
        label: 'Use support',
        instruction:
          'Bring your hips toward your heels and rest your forearms on the chair. Skip this position if knees or hips object.',
        seconds: 90,
        poseId: 'supported-child',
      },
      {
        label: 'Rest on your back',
        instruction:
          'Roll onto your back with knees bent and feet down. Let your breathing stay ordinary and unforced.',
        seconds: 90,
        poseId: 'floor-rest',
      },
    ],
  },
  {
    id: 'supported-rest',
    title: 'Supported rest',
    summary: 'A quiet floor sequence for shifting out of doing mode.',
    setting: 'floor',
    equipment: 'A mat or soft floor and a sturdy chair',
    safetyNote: 'Come out early if your back, hips, or legs become uncomfortable or numb.',
    evidenceIds: ['yoga-safety', 'yoga-depression'],
    steps: [
      {
        label: 'Set up',
        instruction:
          'Lie on your back with knees bent and feet down. Keep your head supported in a neutral position.',
        seconds: 60,
        poseId: 'floor-rest',
      },
      {
        label: 'Rest your legs',
        instruction:
          'Place your lower legs on the chair. Adjust until your back and hips feel easy, or return your feet to the floor.',
        seconds: 240,
        poseId: 'legs-on-chair',
      },
      {
        label: 'Return slowly',
        instruction:
          'Bring one foot down at a time. Pause with knees bent, then roll to one side before sitting up when ready.',
        seconds: 60,
        poseId: 'floor-rest',
      },
    ],
  },
];

export function yogaPracticeDurationSeconds(practice: YogaPractice): number {
  return practice.steps.reduce((total, step) => total + step.seconds, 0);
}

export function getYogaPose(poseId: YogaPoseId): YogaPose {
  return YOGA_POSES[poseId];
}
