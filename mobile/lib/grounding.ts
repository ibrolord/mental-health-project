export type GroundingNeed =
  | 'panic'
  | 'detached'
  | 'flashback'
  | 'overwhelmed'
  | 'spiraling'
  | 'unsure';

export type GroundingStep = {
  label: string;
  instruction: string;
  seconds: number;
};

export type GroundingPath = {
  id: GroundingNeed;
  label: string;
  prompt: string;
  technique: string;
  why: string;
  steps: GroundingStep[];
};

export const GROUNDING_AUDIO_SOURCES = [
  {
    name: 'WHO audio grounding exercises',
    url: 'https://tdr.who.int/home/our-work/global-engagement/9789240003927',
  },
  {
    name: 'VA audio-led grounding',
    url: 'https://www.ptsd.va.gov/apps/ptsdcoachonline/tools/be-in-the-moment/pages/page-2.html',
  },
  {
    name: 'PNAS natural-sound review',
    url: 'https://doi.org/10.1073/pnas.2013097118',
  },
  {
    name: 'PLOS One binaural-beat review',
    url: 'https://doi.org/10.1371/journal.pone.0286023',
  },
] as const;

export const GROUNDING_PATHS: Record<GroundingNeed, GroundingPath> = {
  panic: {
    id: 'panic',
    label: 'My body feels panicky or on edge',
    prompt: 'My body feels alarmed, shaky, breathless, or very fast.',
    technique: 'Orient, press, and breathe comfortably',
    why: 'This starts with external safety cues and physical support before asking you to change your breath.',
    steps: [
      {
        label: 'Find the room',
        instruction:
          'Keep your eyes open. Name where you are, today’s date, and one exit you can see.',
        seconds: 35,
      },
      {
        label: 'Use pressure',
        instruction:
          'Press both feet into the floor or both hands into a stable surface. Notice the surface pressing back.',
        seconds: 45,
      },
      {
        label: 'Let the exhale soften',
        instruction:
          'If it is comfortable, breathe out a little more slowly than you breathe in. Keep the timing easy and unforced.',
        seconds: 60,
      },
      {
        label: 'Choose one fact',
        instruction:
          'Name one fact about this moment that is different from what your alarm is predicting.',
        seconds: 40,
      },
    ],
  },
  detached: {
    id: 'detached',
    label: 'I feel distant or numb',
    prompt: 'I feel far away, blank, numb, or disconnected from the room.',
    technique: 'Temperature, texture, and movement',
    why: 'Clear, present-time sensory input can help reconnect attention with the current environment.',
    steps: [
      {
        label: 'Name now',
        instruction:
          'Say your name, where you are, and the current date out loud or silently.',
        seconds: 35,
      },
      {
        label: 'Find texture',
        instruction:
          'Touch a safe textured object or fabric. Describe three details: rough, smooth, warm, cool, firm, or soft.',
        seconds: 55,
      },
      {
        label: 'Add movement',
        instruction:
          'Press your palms together, roll your shoulders, or slowly stamp each foot. Choose movement that feels safe.',
        seconds: 55,
      },
      {
        label: 'Use color',
        instruction:
          'Find five objects of one color and name each object.',
        seconds: 55,
      },
    ],
  },
  flashback: {
    id: 'flashback',
    label: 'A memory feels present',
    prompt: 'A memory feels present, vivid, or as if it is happening again.',
    technique: 'Eyes-open present-time orientation',
    why: 'This keeps attention on concrete differences between the memory and the room you are in now.',
    steps: [
      {
        label: 'Locate yourself',
        instruction:
          'Keep your eyes open. Say: “I am in [place]. It is [date]. I am noticing a memory.”',
        seconds: 45,
      },
      {
        label: 'Find differences',
        instruction:
          'Name three things in this room that were not present in the memory.',
        seconds: 60,
      },
      {
        label: 'Find choice',
        instruction:
          'Notice one choice you have now: move, stand, call someone, open a door, or change rooms.',
        seconds: 45,
      },
      {
        label: 'Use support',
        instruction:
          'Feel a chair, wall, or floor supporting your weight. Stay with that pressure.',
        seconds: 50,
      },
    ],
  },
  overwhelmed: {
    id: 'overwhelmed',
    label: 'Too much is coming at me',
    prompt: 'Everything feels urgent and I cannot decide what to do first.',
    technique: 'Shrink the field',
    why: 'Reducing the number of inputs can make one safe next action easier to identify.',
    steps: [
      {
        label: 'Pause inputs',
        instruction:
          'Put down what you are holding. Silence one notification or turn away from one screen if it is safe.',
        seconds: 35,
      },
      {
        label: 'Name three',
        instruction:
          'Name three things that truly need attention today. Let everything else be a later list.',
        seconds: 60,
      },
      {
        label: 'Choose one',
        instruction:
          'Pick the smallest safe action under five minutes. It can be water, a message, one document, or asking for help.',
        seconds: 50,
      },
      {
        label: 'Begin physically',
        instruction:
          'Name the first physical movement, then do only that movement.',
        seconds: 35,
      },
    ],
  },
  spiraling: {
    id: 'spiraling',
    label: 'My thoughts won’t slow down',
    prompt: 'My mind keeps repeating a fear, argument, or worst-case outcome.',
    technique: '5–4–3–2–1 sensory grounding',
    why: 'A structured sensory scan gives attention a concrete job in the present.',
    steps: [
      {
        label: 'Five things you see',
        instruction:
          'Name five visible objects. Use plain descriptions rather than judging them.',
        seconds: 50,
      },
      {
        label: 'Four things you feel',
        instruction:
          'Name four points of physical contact, such as feet, clothing, chair, or air.',
        seconds: 50,
      },
      {
        label: 'Three sounds',
        instruction: 'Name three sounds, including quiet or distant ones.',
        seconds: 40,
      },
      {
        label: 'Two scents',
        instruction:
          'Notice two scents. If none are clear, name two scents you find familiar.',
        seconds: 35,
      },
      {
        label: 'One taste',
        instruction:
          'Notice one taste, or take one safe sip of water and notice it.',
        seconds: 35,
      },
    ],
  },
  unsure: {
    id: 'unsure',
    label: 'I am not sure',
    prompt: 'I just need something simple to help me return to the present.',
    technique: 'Three-point orientation',
    why: 'This combines sight, contact, and one next choice without requiring you to explain what is happening.',
    steps: [
      {
        label: 'Three sights',
        instruction: 'Name three objects and their colors.',
        seconds: 45,
      },
      {
        label: 'Three contacts',
        instruction:
          'Notice three places your body meets a surface. Press gently into one.',
        seconds: 50,
      },
      {
        label: 'Three facts',
        instruction:
          'Name your location, the date, and one person or service you could contact if you need support.',
        seconds: 55,
      },
      {
        label: 'One choice',
        instruction:
          'Choose one next action: stay here, move rooms, drink water, or contact someone.',
        seconds: 40,
      },
    ],
  },
};

export const GROUNDING_NEEDS = Object.values(GROUNDING_PATHS);

export function groundingPathFor(need: GroundingNeed): GroundingPath {
  return GROUNDING_PATHS[need];
}
