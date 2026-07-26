export interface BookRecord {
  id: string;
  title: string;
  author: string;
  summary: string;
  takeaways: string[];
  quote: string | null;
  action_step: string | null;
  tags: string[];
  read_time_minutes: number;
}

export const LIBRARY_TOPICS = [
  'All',
  'Anxiety & stress',
  'Mood & self-compassion',
  'Habits & growth',
  'Burnout & recovery',
  'Trauma',
] as const;

export type LibraryTopic = (typeof LIBRARY_TOPICS)[number];

export interface CuratedBook extends BookRecord {
  topic: Exclude<LibraryTopic, 'All'>;
  displayTags: string[];
  editorialNote: string;
}

type EditorialOverride = Pick<
  CuratedBook,
  'summary' | 'takeaways' | 'action_step' | 'topic' | 'displayTags' | 'editorialNote'
>;

const BOOK_METADATA: Array<
  Pick<BookRecord, 'id' | 'title' | 'author' | 'read_time_minutes'>
> = [
  { id: 'atomic-habits', title: 'Atomic Habits', author: 'James Clear', read_time_minutes: 7 },
  {
    id: 'the-happiness-trap',
    title: 'The Happiness Trap',
    author: 'Russ Harris',
    read_time_minutes: 8,
  },
  { id: 'feeling-good', title: 'Feeling Good', author: 'David D. Burns', read_time_minutes: 10 },
  {
    id: 'when-the-body-says-no',
    title: 'When the Body Says No',
    author: 'Gabor Maté',
    read_time_minutes: 9,
  },
  {
    id: 'burnout-stress-cycle',
    title: 'Burnout: The Secret to Unlocking the Stress Cycle',
    author: 'Emily Nagoski & Amelia Nagoski',
    read_time_minutes: 8,
  },
  {
    id: 'gifts-of-imperfection',
    title: 'The Gifts of Imperfection',
    author: 'Brené Brown',
    read_time_minutes: 7,
  },
  {
    id: 'the-body-keeps-the-score',
    title: 'The Body Keeps the Score',
    author: 'Bessel van der Kolk',
    read_time_minutes: 12,
  },
  { id: 'mindset', title: 'Mindset', author: 'Carol Dweck', read_time_minutes: 6 },
];

const STANDARD_NOTE =
  "This note summarizes the author's framework. It is not medical guidance, and inclusion does not mean MHtoolkit endorses every claim.";

const EDITORIAL_OVERRIDES: Record<string, EditorialOverride> = {
  'Atomic Habits': {
    topic: 'Habits & growth',
    displayTags: ['Habits', 'Behavior change'],
    summary:
      'A popular self-help framework for making behavior change easier through small, repeatable cues and routines. It is not a clinical treatment manual.',
    takeaways: [
      'The author recommends focusing on repeatable systems rather than relying only on goals.',
      'Changing cues and reducing friction may make a chosen behavior easier to repeat.',
      'Small changes can be useful, but progress is not always linear or fully under personal control.',
    ],
    action_step:
      'Choose one small action that matters to you and make the first step easier to start. Keep it optional and realistic.',
    editorialNote: STANDARD_NOTE,
  },
  'The Happiness Trap': {
    topic: 'Anxiety & stress',
    displayTags: ['Acceptance', 'Values'],
    summary:
      'An Acceptance and Commitment Therapy-informed self-help book about making room for difficult thoughts and feelings while acting on personal values.',
    takeaways: [
      'The book argues that struggling to eliminate every difficult feeling can become unhelpful.',
      'It encourages noticing thoughts without automatically treating them as facts or commands.',
      'Values can help guide small actions even when discomfort is present.',
    ],
    action_step:
      'Name one value that matters to you, then choose one small and safe action that expresses it today.',
    editorialNote: STANDARD_NOTE,
  },
  'Feeling Good': {
    topic: 'Mood & self-compassion',
    displayTags: ['Self-help', 'Thought patterns'],
    summary:
      'A self-help book based on cognitive behavioral therapy ideas, focused on noticing and examining unhelpful thinking patterns. A book is not a substitute for assessment or therapy.',
    takeaways: [
      'Thoughts, emotions, behavior, and context can influence one another.',
      'Writing down a thought can make it easier to examine the evidence for and against it.',
      'A more balanced thought should be believable, not forced positivity.',
    ],
    action_step:
      'Write down one distressing thought and one piece of evidence for and against it. If this increases distress, stop and seek support.',
    editorialNote: STANDARD_NOTE,
  },
  'When the Body Says No': {
    topic: 'Anxiety & stress',
    displayTags: ['Stress', 'Boundaries'],
    summary:
      "The author presents a perspective on relationships among stress, emotional patterns, and physical health. Some causal interpretations are debated; do not use the book to explain symptoms without medical evaluation.",
    takeaways: [
      'Stress can affect wellbeing, but physical symptoms can have many different causes.',
      'Boundaries and support may be useful parts of caring for yourself.',
      "The author's mind-body explanations are perspectives, not individual diagnoses.",
    ],
    action_step:
      'Notice one situation where a clearer boundary may help. For new, persistent, or worsening physical symptoms, consult a qualified healthcare professional.',
    editorialNote:
      "This book includes debated medical claims. This note separates the author's perspective from established clinical guidance.",
  },
  'Burnout: The Secret to Unlocking the Stress Cycle': {
    topic: 'Burnout & recovery',
    displayTags: ['Burnout', 'Recovery'],
    summary:
      'A popular self-help model that distinguishes sources of stress from the body and mind responses that can continue afterward.',
    takeaways: [
      'Addressing a stressor and recovering from its effects may require different actions.',
      'Rest, movement, creativity, and connection can be recovery options, depending on the person.',
      'Burnout can also reflect working conditions that individual coping cannot fix alone.',
    ],
    action_step:
      'Choose one brief recovery activity that feels safe and realistic. Also identify one demand or condition that may need practical change.',
    editorialNote: STANDARD_NOTE,
  },
  'The Gifts of Imperfection': {
    topic: 'Mood & self-compassion',
    displayTags: ['Self-compassion', 'Perfectionism'],
    summary:
      'A self-help book about vulnerability, perfectionism, shame, and self-compassion, based on the author\'s qualitative research and reflections.',
    takeaways: [
      'Perfectionism can be different from healthy effort or learning.',
      'Self-compassion does not require ignoring mistakes or responsibilities.',
      'Sharing selectively with safe people may support connection.',
    ],
    action_step:
      'Choose one low-stakes task where "good enough" is safe, and notice what makes stopping difficult.',
    editorialNote: STANDARD_NOTE,
  },
  'The Body Keeps the Score': {
    topic: 'Trauma',
    displayTags: ['Trauma', 'Professional care'],
    summary:
      "An overview of trauma research and treatment perspectives that combines established findings with the author's interpretations. Trauma symptoms and treatment choices require individualized professional assessment.",
    takeaways: [
      'Trauma can affect emotions, attention, relationships, sleep, and physical responses.',
      'People respond differently, and no single treatment is right for everyone.',
      'Safety, consent, and qualified support matter when exploring traumatic experiences.',
    ],
    action_step:
      'If you feel activated, orient to the present by noticing your surroundings. Do not push through trauma memories alone; consider qualified support.',
    editorialNote:
      "This note does not endorse every treatment or scientific claim in the book. Use trauma resources with care and professional support.",
  },
  Mindset: {
    topic: 'Habits & growth',
    displayTags: ['Learning', 'Resilience'],
    summary:
      'A popular account of research on beliefs about learning and ability. The framework can be useful, but outcomes also depend on resources, health, opportunity, and context.',
    takeaways: [
      'Skills can often improve with practice, feedback, and support.',
      'A setback can provide information without defining a person.',
      'Effort alone is not always enough; strategy, rest, access, and context also matter.',
    ],
    action_step:
      'Pick one skill you want to practice and define a small experiment, including what support or feedback would make it fair.',
    editorialNote: STANDARD_NOTE,
  },
};

export function applyEditorialReview(book: BookRecord): CuratedBook | null {
  const override = EDITORIAL_OVERRIDES[book.title];
  if (!override) return null;

  return {
    ...book,
    ...override,
    quote: null,
  };
}

export const CURATED_LIBRARY: CuratedBook[] = BOOK_METADATA.map((metadata) => {
  const reviewed = applyEditorialReview({
    ...metadata,
    summary: '',
    takeaways: [],
    quote: null,
    action_step: null,
    tags: [],
  });

  if (!reviewed) {
    throw new Error(`Missing editorial review for ${metadata.title}`);
  }

  return reviewed;
}).sort((a, b) => a.title.localeCompare(b.title));
