import { JOURNAL_LIMITS } from './journal';

export type ReflectionTemplateId =
  | 'balanced-thought'
  | 'solve-one-thing'
  | 'make-room'
  | 'compassionate-reset'
  | 'good-moments'
  | 'express-and-close'
  | 'weekly-patterns';

export type ReflectionStep = {
  id: string;
  label: string;
  prompt: string;
  placeholder: string;
};

export type ReflectionTemplate = {
  id: ReflectionTemplateId;
  title: string;
  skill: string;
  summary: string;
  duration: string;
  primary: boolean;
  tags: string[];
  evidenceIds: string[];
  steps: ReflectionStep[];
};

export const REFLECTION_RESPONSE_LIMIT = 2_000;

export const REFLECTION_TEMPLATES: ReflectionTemplate[] = [
  {
    id: 'balanced-thought',
    title: 'Untangle a thought',
    skill: 'Perspective',
    summary:
      'Slow down one difficult thought and look for a balanced, believable response.',
    duration: '5-8 min',
    primary: true,
    tags: ['thought record', 'perspective'],
    evidenceIds: ['guided-self-help', 'journaling-reflection'],
    steps: [
      {
        id: 'situation',
        label: 'What happened',
        prompt: 'Describe the situation using only the facts you know.',
        placeholder: 'Where were you, who was involved, and what happened?',
      },
      {
        id: 'feeling',
        label: 'What you noticed',
        prompt: 'Name the emotions and body sensations that showed up.',
        placeholder: 'For example: tense, disappointed, relieved, hopeful...',
      },
      {
        id: 'thought',
        label: 'The thought',
        prompt: 'What did your mind say the situation meant?',
        placeholder: 'Write the thought in your own words.',
      },
      {
        id: 'supporting-evidence',
        label: 'What supports it',
        prompt: 'What facts make the thought feel true?',
        placeholder: 'Stick to observable evidence rather than guesses.',
      },
      {
        id: 'other-evidence',
        label: 'What else is true',
        prompt: 'What facts, context, or exceptions does the thought leave out?',
        placeholder: 'Consider what a neutral observer might notice.',
      },
      {
        id: 'balanced-response',
        label: 'A balanced response',
        prompt: 'Write a response that includes the full picture and feels believable.',
        placeholder: 'Aim for balanced, not artificially positive.',
      },
      {
        id: 'next-step',
        label: 'What now',
        prompt: 'What is one safe, useful next step?',
        placeholder: 'A conversation, pause, boundary, task, or request for support.',
      },
    ],
  },
  {
    id: 'solve-one-thing',
    title: 'Solve one thing',
    skill: 'Problem solving',
    summary: 'Turn one current, solvable problem into a small plan you can test.',
    duration: '4-7 min',
    primary: true,
    tags: ['problem solving', 'next step'],
    evidenceIds: ['guided-self-help', 'implementation-intentions'],
    steps: [
      {
        id: 'problem',
        label: 'Name the problem',
        prompt: 'What specific problem are you trying to solve?',
        placeholder: 'Keep it current and narrow enough to act on.',
      },
      {
        id: 'control',
        label: 'Your part',
        prompt: 'Which parts can you influence, and which parts are outside your control?',
        placeholder: 'Separate your actions from other people or uncertain outcomes.',
      },
      {
        id: 'options',
        label: 'Possible moves',
        prompt: 'List a few safe options without judging them yet.',
        placeholder: 'Include asking for help, reducing the task, or waiting for information.',
      },
      {
        id: 'choice',
        label: 'Choose one',
        prompt: 'Which option is useful and realistic with the capacity you have today?',
        placeholder: 'Pick the smallest option worth testing.',
      },
      {
        id: 'if-then',
        label: 'Make it specific',
        prompt: 'Complete: If this situation occurs, then I will...',
        placeholder: 'If [cue], then I will [specific action].',
      },
    ],
  },
  {
    id: 'make-room',
    title: 'Make room',
    skill: 'Acceptance and values',
    summary:
      'Notice what is present without forcing it away, then choose a values-based action.',
    duration: '3-5 min',
    primary: true,
    tags: ['acceptance', 'values'],
    evidenceIds: ['who-stress-skills'],
    steps: [
      {
        id: 'notice',
        label: 'Notice and name',
        prompt: 'What thought, feeling, or urge is present right now?',
        placeholder: 'Try: I notice that I am feeling... or my mind is telling me...',
      },
      {
        id: 'body',
        label: 'Make room',
        prompt: 'Where do you notice it in your body, and can it be there for this moment?',
        placeholder: 'Describe the sensation without needing to change it.',
      },
      {
        id: 'values',
        label: 'Choose your direction',
        prompt: 'What quality do you want to bring to this situation?',
        placeholder: 'For example: honesty, care, patience, courage, or fairness.',
      },
      {
        id: 'action',
        label: 'One values action',
        prompt: 'What small action would express that quality today?',
        placeholder: 'Choose something observable and within your control.',
      },
    ],
  },
  {
    id: 'compassionate-reset',
    title: 'Compassionate reset',
    skill: 'Self-compassion',
    summary: 'Respond to self-criticism with honesty, care, and one supportive action.',
    duration: '3-5 min',
    primary: false,
    tags: ['self-compassion', 'support'],
    evidenceIds: ['self-compassion-reflection'],
    steps: [
      {
        id: 'criticism',
        label: 'The criticism',
        prompt: 'What are you criticizing or blaming yourself for?',
        placeholder: 'Write the message your inner critic is repeating.',
      },
      {
        id: 'context',
        label: 'The full context',
        prompt: 'What difficulty, effort, need, or limitation deserves to be acknowledged?',
        placeholder: 'Compassion can include responsibility without humiliation.',
      },
      {
        id: 'friend',
        label: 'A kinder response',
        prompt: 'What would you say to someone you care about in this situation?',
        placeholder: 'Use words that are warm, honest, and believable.',
      },
      {
        id: 'support',
        label: 'Support yourself',
        prompt: 'What supportive action can you take next?',
        placeholder: 'Rest, repair, ask for help, set a boundary, or try again differently.',
      },
    ],
  },
  {
    id: 'good-moments',
    title: 'Notice a good moment',
    skill: 'Appreciation',
    summary:
      'Record something meaningful or pleasant without denying what is difficult.',
    duration: '2-4 min',
    primary: false,
    tags: ['appreciation', 'good moment'],
    evidenceIds: ['gratitude-reflection'],
    steps: [
      {
        id: 'moment',
        label: 'The moment',
        prompt: 'What felt good, meaningful, useful, or quietly okay?',
        placeholder: 'It can be very small and does not need to cancel out a hard day.',
      },
      {
        id: 'detail',
        label: 'What you noticed',
        prompt: 'What specific detail made the moment stand out?',
        placeholder: 'A person, place, sensation, action, or change.',
      },
      {
        id: 'meaning',
        label: 'Why it mattered',
        prompt: 'What did this moment give you or remind you of?',
        placeholder: 'Connection, relief, progress, beauty, capability, or something else.',
      },
      {
        id: 'repeat',
        label: 'Make room for another',
        prompt: 'Is there a gentle way to create another opportunity like it?',
        placeholder: 'Keep this optional and realistic.',
      },
    ],
  },
  {
    id: 'express-and-close',
    title: 'Express and close',
    skill: 'Expressive writing',
    summary: 'Write honestly for a bounded moment, then choose how you want to close.',
    duration: '5-10 min',
    primary: false,
    tags: ['expressive writing', 'closure'],
    evidenceIds: ['journaling-reflection'],
    steps: [
      {
        id: 'write',
        label: 'Say what needs saying',
        prompt: 'What feels unfinished, unspoken, or heavy right now?',
        placeholder: 'Write freely. You do not need to make it polished or positive.',
      },
      {
        id: 'meaning',
        label: 'What matters underneath',
        prompt: 'What need, value, loss, hope, or boundary sits underneath this?',
        placeholder: 'Name what this is important to you.',
      },
      {
        id: 'close',
        label: 'Close the page',
        prompt: 'What would help you leave this reflection and return to the present?',
        placeholder: 'Ground, move, rest, connect, make a plan, or stop for now.',
      },
    ],
  },
  {
    id: 'weekly-patterns',
    title: 'Weekly pattern review',
    skill: 'Self-observation',
    summary: 'Review the week for patterns without turning them into a diagnosis.',
    duration: '6-10 min',
    primary: false,
    tags: ['weekly review', 'patterns'],
    evidenceIds: ['journaling-reflection'],
    steps: [
      {
        id: 'events',
        label: 'What shaped the week',
        prompt: 'Which situations, demands, or changes affected you most?',
        placeholder: 'Include positive, difficult, and neutral events.',
      },
      {
        id: 'patterns',
        label: 'Patterns you noticed',
        prompt: 'What repeated across your mood, energy, thoughts, or behavior?',
        placeholder: 'Describe patterns without diagnosing their cause.',
      },
      {
        id: 'helped',
        label: 'What helped',
        prompt: 'Which actions, people, places, routines, or supports were useful?',
        placeholder: 'Notice what helped even a little.',
      },
      {
        id: 'drained',
        label: 'What made things harder',
        prompt: 'What added strain or reduced your capacity?',
        placeholder: 'Consider workload, sleep, conflict, health, isolation, or uncertainty.',
      },
      {
        id: 'continue',
        label: 'Carry one thing forward',
        prompt: 'What will you continue, change, ask for, or discuss with a professional?',
        placeholder: 'Choose one realistic next step.',
      },
    ],
  },
];

export function reflectionTemplateById(
  id: ReflectionTemplateId | null
): ReflectionTemplate | null {
  return REFLECTION_TEMPLATES.find((template) => template.id === id) ?? null;
}

export function completedReflectionSteps(
  template: ReflectionTemplate,
  responses: Record<string, string>
): number {
  return template.steps.filter((step) => responses[step.id]?.trim()).length;
}

export function serializeReflectionResponses(
  template: ReflectionTemplate,
  responses: Record<string, string>
): string {
  return template.steps
    .flatMap((step) => {
      const response = responses[step.id]?.trim();
      return response ? [`## ${step.label}\n${response}`] : [];
    })
    .join('\n\n');
}

export function validateReflectionResponses(
  template: ReflectionTemplate,
  responses: Record<string, string>
): string | null {
  const values = template.steps.map((step) => responses[step.id] ?? '');
  if (!values.some((value) => value.trim())) {
    return 'Write at least one response before saving.';
  }
  if (values.some((value) => value.length > REFLECTION_RESPONSE_LIMIT)) {
    return `Keep each response under ${REFLECTION_RESPONSE_LIMIT.toLocaleString()} characters.`;
  }
  if (serializeReflectionResponses(template, responses).length > JOURNAL_LIMITS.content) {
    return `Keep the reflection under ${JOURNAL_LIMITS.content.toLocaleString()} characters.`;
  }
  return null;
}
