export type MeditationIssue =
  | 'stress'
  | 'racing-thoughts'
  | 'sleep'
  | 'grief'
  | 'low-mood'
  | 'trauma-sensitive'
  | 'focus'
  | 'restlessness';

export const MEDITATION_ISSUES: {
  id: MeditationIssue;
  label: string;
}[] = [
  { id: 'stress', label: 'Stress' },
  { id: 'racing-thoughts', label: 'Racing thoughts' },
  { id: 'sleep', label: 'Sleep transition' },
  { id: 'grief', label: 'Grief' },
  { id: 'low-mood', label: 'Low mood' },
  { id: 'trauma-sensitive', label: 'Eyes-open / trauma-sensitive' },
  { id: 'focus', label: 'Focus' },
  { id: 'restlessness', label: 'Restlessness' },
];

export type MeditationStep = {
  label: string;
  instruction: string;
  seconds: number;
};

export type MeditationPractice = {
  id: string;
  title: string;
  summary: string;
  issues: MeditationIssue[];
  steps: MeditationStep[];
  safetyNote?: string;
  sourceIds: ('who' | 'nhs' | 'nccih' | 'va')[];
};

export const MEDITATION_SOURCES = {
  who: {
    name: 'WHO: Doing What Matters in Times of Stress',
    url: 'https://www.who.int/publications/i/item/9789240003927',
  },
  nhs: {
    name: 'NHS: Breathing exercises for stress',
    url: 'https://www.nhs.uk/mental-health/self-help/guides-tools-and-activities/breathing-exercises-for-stress/',
  },
  nccih: {
    name: 'NCCIH: Meditation effectiveness and safety',
    url: 'https://www.nccih.nih.gov/health/meditation-and-mindfulness-effectiveness-and-safety',
  },
  va: {
    name: 'VA National Center for PTSD: Managing stress reactions',
    url: 'https://www.ptsd.va.gov/professional/treat/care/toolkits/police/managingStrategies.asp',
  },
} as const;

export const MEDITATION_PRACTICES: MeditationPractice[] = [
  {
    id: 'gentle-breath-reset',
    title: 'Gentle breath reset',
    summary:
      'A short, unforced breathing rhythm for moments when stress is running high.',
    issues: ['stress', 'racing-thoughts'],
    safetyNote:
      'Keep the breath comfortable. Stop counting if you feel dizzy, air-hungry, or more anxious.',
    sourceIds: ['nhs', 'nccih'],
    steps: [
      {
        label: 'Arrive',
        instruction:
          'Let your feet meet the floor or your body meet the chair. Keep your eyes open if that feels steadier.',
        seconds: 30,
      },
      {
        label: 'Find your pace',
        instruction:
          'Breathe in gently through your nose while counting up to four. Do not force a full breath.',
        seconds: 45,
      },
      {
        label: 'Soften the exhale',
        instruction:
          'Let the breath out gently while counting up to five. Use a shorter count if that is more comfortable.',
        seconds: 60,
      },
      {
        label: 'Release the count',
        instruction:
          'Let breathing return to normal. Notice one place your body feels supported.',
        seconds: 45,
      },
    ],
  },
  {
    id: 'name-and-unhook',
    title: 'Name and unhook',
    summary:
      'Notice a difficult thought as an experience you are having, rather than a command you must follow.',
    issues: ['racing-thoughts', 'stress'],
    sourceIds: ['who', 'nccih'],
    steps: [
      {
        label: 'Notice',
        instruction:
          'Notice the thought that is pulling hardest. You do not need to solve or challenge it.',
        seconds: 45,
      },
      {
        label: 'Name',
        instruction:
          'Quietly say: “I notice I am having the thought that…” and finish the sentence once.',
        seconds: 45,
      },
      {
        label: 'Return',
        instruction:
          'Feel your feet or hands. Name three things you can see without judging them.',
        seconds: 60,
      },
      {
        label: 'Choose',
        instruction:
          'Ask: what is one small action that matters in the next ten minutes?',
        seconds: 60,
      },
    ],
  },
  {
    id: 'eyes-open-orienting',
    title: 'Eyes-open orienting',
    summary:
      'A no-visualization practice that keeps attention on the present room and your choices.',
    issues: ['trauma-sensitive', 'stress'],
    safetyNote:
      'Skip internal body scanning if it feels activating. You can stand, move, or leave the exercise at any time.',
    sourceIds: ['va', 'who', 'nccih'],
    steps: [
      {
        label: 'Look around',
        instruction:
          'Keep your eyes open. Turn your head slowly and find the door, a window, and one object you chose to look at.',
        seconds: 60,
      },
      {
        label: 'Locate yourself',
        instruction:
          'Say your name, today’s date, and where you are now. Remind yourself that this moment is different from the memory.',
        seconds: 60,
      },
      {
        label: 'Use contact',
        instruction:
          'Press both feet into the floor or both hands into a stable surface. Notice the pressure.',
        seconds: 60,
      },
    ],
  },
  {
    id: 'sleep-body-release',
    title: 'Sleep transition',
    summary:
      'A slow release practice for shifting from doing into rest without forcing sleep.',
    issues: ['sleep', 'stress'],
    sourceIds: ['nhs', 'nccih'],
    steps: [
      {
        label: 'Settle',
        instruction:
          'Choose a comfortable position. Let sleep be optional; the goal is simply to rest here.',
        seconds: 60,
      },
      {
        label: 'Face and jaw',
        instruction:
          'Notice your forehead, eyes, and jaw. On each easy exhale, allow ten percent less effort.',
        seconds: 90,
      },
      {
        label: 'Shoulders and hands',
        instruction:
          'Feel the weight of your shoulders and hands. Let the surface beneath you carry more of it.',
        seconds: 90,
      },
      {
        label: 'Hips and legs',
        instruction:
          'Notice contact through your hips, legs, and feet. Nothing needs to be changed.',
        seconds: 90,
      },
      {
        label: 'Rest',
        instruction:
          'Let go of the scan. Follow ordinary breathing or the quietest sound you can hear.',
        seconds: 150,
      },
    ],
  },
  {
    id: 'grief-companion',
    title: 'Make room for grief',
    summary:
      'A gentle practice for acknowledging loss without demanding acceptance or a positive lesson.',
    issues: ['grief', 'low-mood'],
    safetyNote:
      'Stop if this feels too intense. Reorient to the room or contact someone you trust.',
    sourceIds: ['who', 'nccih'],
    steps: [
      {
        label: 'Choose support',
        instruction:
          'Sit near something steady or hold a familiar object. You can keep your eyes open.',
        seconds: 60,
      },
      {
        label: 'Acknowledge',
        instruction:
          'Name what is here in a few words: sadness, longing, anger, numbness, or something else.',
        seconds: 60,
      },
      {
        label: 'Allow a boundary',
        instruction:
          'Tell yourself: “I can make room for this feeling for the next minute. I do not have to carry all of it at once.”',
        seconds: 90,
      },
      {
        label: 'Offer kindness',
        instruction:
          'Use the words you would offer someone you care about facing the same loss.',
        seconds: 90,
      },
      {
        label: 'Return',
        instruction:
          'Notice the room again and choose one gentle thing you need after this practice.',
        seconds: 60,
      },
    ],
  },
  {
    id: 'self-kindness-pause',
    title: 'Self-kindness pause',
    summary:
      'A small compassionate pause for low-energy or self-critical moments.',
    issues: ['low-mood', 'stress'],
    sourceIds: ['who', 'nccih'],
    steps: [
      {
        label: 'Recognize',
        instruction:
          'Name what is difficult without grading how well you are handling it.',
        seconds: 60,
      },
      {
        label: 'Normalize',
        instruction:
          'Remind yourself that struggle is part of being human, not proof that you are failing.',
        seconds: 60,
      },
      {
        label: 'Respond',
        instruction:
          'Choose one kind sentence that feels believable, such as: “I can take the next step slowly.”',
        seconds: 90,
      },
      {
        label: 'Make it concrete',
        instruction:
          'Pick one caring action under five minutes: water, light, food, movement, or contacting someone.',
        seconds: 90,
      },
    ],
  },
  {
    id: 'single-point-focus',
    title: 'Single-point focus',
    summary:
      'A brief attention reset before reading, studying, or returning to one task.',
    issues: ['focus', 'racing-thoughts'],
    sourceIds: ['who', 'nccih'],
    steps: [
      {
        label: 'Reduce the field',
        instruction:
          'Put one object or one line of text in front of you. Let everything else wait.',
        seconds: 45,
      },
      {
        label: 'Notice detail',
        instruction:
          'Study color, edge, texture, or shape. When attention leaves, return without criticism.',
        seconds: 75,
      },
      {
        label: 'Set direction',
        instruction:
          'Name the one task you will do for the next ten minutes and the first physical action.',
        seconds: 60,
      },
    ],
  },
  {
    id: 'walking-anchor',
    title: 'Walking anchor',
    summary:
      'A movement-based option when sitting still makes restlessness or tension worse.',
    issues: ['restlessness', 'stress', 'focus'],
    safetyNote:
      'Use a clear, safe walking area. Keep your attention on obstacles and stop if you feel unsteady.',
    sourceIds: ['who', 'nccih'],
    steps: [
      {
        label: 'Begin',
        instruction:
          'Stand only if it is safe. Feel both feet before taking the first step.',
        seconds: 45,
      },
      {
        label: 'Track contact',
        instruction:
          'Walk at an ordinary pace and notice heel, sole, and toes meeting the floor.',
        seconds: 90,
      },
      {
        label: 'Use the room',
        instruction:
          'Notice colors and shapes around you while continuing to walk safely.',
        seconds: 90,
      },
      {
        label: 'Choose the next action',
        instruction:
          'Slow down, stop, and name what you want to do with the energy you have now.',
        seconds: 75,
      },
    ],
  },
];

export function practiceDurationSeconds(practice: MeditationPractice): number {
  return practice.steps.reduce((total, step) => total + step.seconds, 0);
}

export function practicesForIssue(
  issue: MeditationIssue | 'all'
): MeditationPractice[] {
  if (issue === 'all') return MEDITATION_PRACTICES;
  return MEDITATION_PRACTICES.filter((practice) =>
    practice.issues.includes(issue)
  );
}
