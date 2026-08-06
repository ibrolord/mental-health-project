export type YogaSetting = 'chair' | 'floor' | 'restorative';

export type YogaPoseId =
  | 'seated-arrival'
  | 'seated-cat'
  | 'seated-cow'
  | 'seated-side-reach'
  | 'seated-twist'
  | 'tabletop-neutral'
  | 'tabletop-round'
  | 'tabletop-cow'
  | 'child-pose'
  | 'supported-child'
  | 'floor-rest'
  | 'supported-savasana';

export type YogaPose = {
  id: YogaPoseId;
  name: string;
  imagePath: string;
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
    name: 'Seated Mountain',
    imagePath: '/images/yoga/seated-arrival.jpg',
    imageAlt: 'A person in Seated Mountain Pose, sitting tall with both feet on the floor.',
  },
  'seated-cat': {
    id: 'seated-cat',
    name: 'Seated Cat',
    imagePath: '/images/yoga/seated-cat.jpg',
    imageAlt: 'A seated person gently rounding their spine in Seated Cat Pose.',
  },
  'seated-cow': {
    id: 'seated-cow',
    name: 'Seated Cow',
    imagePath: '/images/yoga/seated-cow.jpg',
    imageAlt: 'A seated person gently lifting their chest in Seated Cow Pose.',
  },
  'seated-side-reach': {
    id: 'seated-side-reach',
    name: 'Seated Side Bend',
    imagePath: '/images/yoga/seated-side-reach.jpg',
    imageAlt: 'A seated person making a gentle yoga side bend with one arm overhead.',
  },
  'seated-twist': {
    id: 'seated-twist',
    name: 'Seated Twist',
    imagePath: '/images/yoga/seated-twist.jpg',
    imageAlt: 'A person sitting tall in a gentle seated yoga twist.',
  },
  'tabletop-round': {
    id: 'tabletop-round',
    name: 'Cat Pose',
    imagePath: '/images/yoga/tabletop-round.jpg',
    imageAlt: 'A person on hands and knees rounding their spine in Cat Pose.',
  },
  'tabletop-neutral': {
    id: 'tabletop-neutral',
    name: 'Tabletop Pose',
    imagePath: '/images/yoga/tabletop-neutral.jpg',
    imageAlt: 'A person in Tabletop Pose with hands under shoulders and knees under hips.',
  },
  'tabletop-cow': {
    id: 'tabletop-cow',
    name: 'Cow Pose',
    imagePath: '/images/yoga/tabletop-cow.jpg',
    imageAlt: 'A person on hands and knees gently lifting their chest in Cow Pose.',
  },
  'child-pose': {
    id: 'child-pose',
    name: "Child's Pose",
    imagePath: '/images/yoga/child-pose.jpg',
    imageAlt: "A person resting forward with their forehead supported in Child's Pose.",
  },
  'supported-child': {
    id: 'supported-child',
    name: "Supported Child's Pose",
    imagePath: '/images/yoga/supported-child.jpg',
    imageAlt: "A kneeling person resting on a chair in Supported Child's Pose.",
  },
  'floor-rest': {
    id: 'floor-rest',
    name: 'Constructive Rest',
    imagePath: '/images/yoga/floor-rest.jpg',
    imageAlt: 'A person in Constructive Rest with knees bent and feet on the floor.',
  },
  'supported-savasana': {
    id: 'supported-savasana',
    name: 'Supported Savasana',
    imagePath: '/images/yoga/supported-savasana.jpg',
    imageAlt: 'A person resting on their back with a yoga bolster supporting both knees.',
  },
};

export const YOGA_PRACTICES: YogaPractice[] = [
  {
    id: 'chair-yoga',
    title: 'Chair yoga',
    summary: 'Seated Mountain, Cat-Cow, side bends, and twists.',
    setting: 'chair',
    equipment: 'A sturdy chair without wheels',
    safetyNote: 'Keep both feet planted and make every bend or twist small enough to feel steady.',
    evidenceIds: ['yoga-safety', 'physical-activity'],
    steps: [
      {
        label: 'Seated Mountain',
        instruction:
          'Sit near the middle of the chair. Place both feet under your knees, rest your hands on your thighs, and lengthen your spine.',
        seconds: 30,
        poseId: 'seated-arrival',
      },
      {
        label: 'Seated Cow',
        instruction:
          'Keep your hands on your thighs. Tip your pelvis slightly forward and lift your chest without throwing your head back. Return to neutral and repeat slowly.',
        seconds: 40,
        poseId: 'seated-cow',
      },
      {
        label: 'Seated Cat',
        instruction:
          'Tuck your pelvis slightly and round your spine toward the chair back. Keep your head in line with your spine. Return to neutral and repeat slowly.',
        seconds: 40,
        poseId: 'seated-cat',
      },
      {
        label: 'Side Bend left',
        instruction:
          'Keep both feet down. Lift your right arm and lean a little to the left without twisting or forcing the reach.',
        seconds: 30,
        poseId: 'seated-side-reach',
        imageAlt: 'A seated person lifting the right arm and leaning gently to the left.',
      },
      {
        label: 'Side Bend right',
        instruction:
          'Return upright, then lift your left arm and lean a little to the right. Keep the movement comfortable.',
        seconds: 30,
        poseId: 'seated-side-reach',
        imageAlt: 'A seated person lifting the left arm and leaning gently to the right.',
        mirrorImage: true,
      },
      {
        label: 'Twist left',
        instruction:
          'Keep your knees facing forward. Sit tall and turn your ribs gently to the left, placing your hands lightly on your thigh and chair.',
        seconds: 30,
        poseId: 'seated-twist',
        imageAlt: 'A person sitting tall in a gentle seated yoga twist to the left.',
      },
      {
        label: 'Twist right',
        instruction:
          'Return to center. Keep your knees forward, sit tall, and turn your ribs gently to the right.',
        seconds: 30,
        poseId: 'seated-twist',
        imageAlt: 'A person sitting tall in a gentle seated yoga twist to the right.',
        mirrorImage: true,
      },
      {
        label: 'Seated Mountain',
        instruction:
          'Face forward with both hands on your thighs. Feel the chair and floor supporting you before you finish.',
        seconds: 30,
        poseId: 'seated-arrival',
      },
    ],
  },
  {
    id: 'gentle-floor-yoga',
    title: 'Gentle floor yoga',
    summary: "Tabletop, Cat-Cow, Child's Pose, and rest.",
    setting: 'floor',
    equipment: 'A mat or soft floor and a sturdy chair',
    safetyNote: 'Choose Chair yoga if floor transitions or weight on your hands and knees are not comfortable.',
    evidenceIds: ['yoga-safety', 'physical-activity'],
    steps: [
      {
        label: 'Tabletop Pose',
        instruction:
          'Come to hands and knees only if that transition is comfortable. Keep wrists under shoulders and knees under hips.',
        seconds: 30,
        poseId: 'tabletop-neutral',
      },
      {
        label: 'Cat Pose',
        instruction:
          'Press evenly through your hands and gently round your spine. Keep your head in line with the curve, then return to Tabletop.',
        seconds: 45,
        poseId: 'tabletop-round',
      },
      {
        label: 'Cow Pose',
        instruction:
          'From Tabletop, let your belly lower slightly as your chest moves forward. Keep the back of your neck long, then return to Tabletop.',
        seconds: 45,
        poseId: 'tabletop-cow',
      },
      {
        label: "Child's Pose",
        instruction:
          'Bring your hips toward your heels and rest your forehead on a folded towel. Keep your knees comfortably apart and come out early if they object.',
        seconds: 90,
        poseId: 'child-pose',
      },
      {
        label: 'Constructive Rest',
        instruction:
          'Roll onto your back with knees bent and feet down. Let your arms rest by your sides and keep your breathing ordinary.',
        seconds: 90,
        poseId: 'floor-rest',
      },
    ],
  },
  {
    id: 'restorative-yoga',
    title: 'Restorative yoga',
    summary: "Supported Child's Pose and Savasana with a bolster.",
    setting: 'restorative',
    equipment: 'A mat, sturdy chair, folded towel, and firm bolster or cushion',
    safetyNote: 'Change position if you feel pressure, numbness, tingling, or difficulty getting up.',
    evidenceIds: ['yoga-safety', 'yoga-depression'],
    steps: [
      {
        label: "Supported Child's Pose",
        instruction:
          'Kneel in front of the chair and rest your forearms and forehead on the seat. Keep your hips where your knees feel comfortable.',
        seconds: 120,
        poseId: 'supported-child',
      },
      {
        label: 'Constructive Rest',
        instruction:
          'Move onto your back with knees bent and feet down. Pause here before placing support under your knees.',
        seconds: 60,
        poseId: 'floor-rest',
      },
      {
        label: 'Supported Savasana',
        instruction:
          'Place a firm bolster under both knees. Let your legs and arms rest, keep your head neutral, and breathe normally.',
        seconds: 240,
        poseId: 'supported-savasana',
      },
      {
        label: 'Return to rest',
        instruction:
          'Remove the bolster and place both feet down. Pause with knees bent, then roll to one side before sitting up when ready.',
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
