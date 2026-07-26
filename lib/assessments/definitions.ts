import { Assessment } from './types';

const TWO_WEEK_OPTIONS = [
  { value: 0, label: 'Not at all' },
  { value: 1, label: 'Several days' },
  { value: 2, label: 'More than half the days' },
  { value: 3, label: 'Nearly every day' },
];

const CBI_OPTIONS = [
  { value: 0, label: 'Never / almost never' },
  { value: 25, label: 'Seldom' },
  { value: 50, label: 'Sometimes' },
  { value: 75, label: 'Often' },
  { value: 100, label: 'Always' },
];

const FUNCTIONING_QUESTION = {
  id: 'functioning',
  text: 'If you checked off any problems, how difficult have these problems made it for you to do your work, take care of things at home, or get along with other people?',
  contextLabel: 'Daily-life impact. This answer is not included in the total score.',
  options: [
    { value: 0, label: 'Not difficult at all' },
    { value: 1, label: 'Somewhat difficult' },
    { value: 2, label: 'Very difficult' },
    { value: 3, label: 'Extremely difficult' },
  ],
};

function orderedAnswers(
  responses: Record<string, number>,
  count: number,
  allowedValues: readonly number[]
): number[] {
  return Array.from({ length: count }, (_, index) => {
    const value = responses[`q${index + 1}`];
    if (!allowedValues.includes(value)) {
      throw new Error('Assessment responses are incomplete or invalid');
    }
    return value;
  });
}

function sumAnswers(
  responses: Record<string, number>,
  count: number,
  allowedValues: readonly number[]
): number {
  return orderedAnswers(responses, count, allowedValues).reduce(
    (total, value) => total + value,
    0
  );
}

export const GAD7: Assessment = {
  type: 'GAD7',
  name: 'GAD-7 Anxiety Symptom Screener',
  shortName: 'Anxiety symptoms',
  description: 'Checks the frequency of seven common anxiety symptoms.',
  measureType: 'Validated symptom screener',
  timeframe: 'Past 2 weeks',
  instructions:
    'Over the last 2 weeks, how often have you been bothered by the following problems?',
  scoreMeaning:
    'Scores range from 0-21. Published symptom ranges are 0-4 minimal, 5-9 mild, 10-14 moderate, and 15-21 severe. The daily-life impact answer is not added to the score. A score is not a diagnosis.',
  source:
    'Spitzer RL, Kroenke K, Williams JBW, Lowe B. A brief measure for assessing generalized anxiety disorder: the GAD-7. Arch Intern Med. 2006.',
  citationUrl: 'https://pubmed.ncbi.nlm.nih.gov/16717171/',
  reviewedAt: 'July 2026',
  maxScore: 21,
  questions: [
    { id: 'q1', text: 'Feeling nervous, anxious, or on edge', options: TWO_WEEK_OPTIONS },
    {
      id: 'q2',
      text: 'Not being able to stop or control worrying',
      options: TWO_WEEK_OPTIONS,
    },
    {
      id: 'q3',
      text: 'Worrying too much about different things',
      options: TWO_WEEK_OPTIONS,
    },
    { id: 'q4', text: 'Trouble relaxing', options: TWO_WEEK_OPTIONS },
    {
      id: 'q5',
      text: "Being so restless that it's hard to sit still",
      options: TWO_WEEK_OPTIONS,
    },
    {
      id: 'q6',
      text: 'Becoming easily annoyed or irritable',
      options: TWO_WEEK_OPTIONS,
    },
    {
      id: 'q7',
      text: 'Feeling afraid as if something awful might happen',
      options: TWO_WEEK_OPTIONS,
    },
  ],
  functioningQuestion: FUNCTIONING_QUESTION,
  calculateScore: (responses) => sumAnswers(responses, 7, [0, 1, 2, 3]),
  interpret: (score) => {
    if (score <= 4) {
      return {
        level: 'Minimal anxiety symptom range',
        message:
          'Your GAD-7 score is in the published minimal range. A low score does not rule out distress or another condition.',
        suggestions: [
          'Notice whether anxiety is still interfering with sleep, work, study, or relationships.',
          'Repeat the same screener later only if comparing the same two-week window would be useful.',
          'Talk with a qualified professional if symptoms concern you, regardless of the score.',
        ],
      };
    }
    if (score <= 9) {
      return {
        level: 'Mild anxiety symptom range',
        message:
          'Your GAD-7 score is in the published mild range. The result describes symptom frequency, not a diagnosis.',
        suggestions: [
          'Monitor whether symptoms persist, worsen, or interfere with daily functioning.',
          'Use low-risk supports such as a regular sleep schedule, movement, and brief relaxation practice.',
          'Consider discussing the result with a qualified professional if you want support.',
        ],
      };
    }
    if (score <= 14) {
      return {
        level: 'Moderate anxiety symptom range',
        message:
          'Your GAD-7 score is in the published moderate range. Further assessment can clarify the cause and appropriate support.',
        suggestions: [
          'Consider arranging an evaluation with a doctor or licensed mental health professional.',
          'Bring this score and examples of how symptoms affect daily life to that conversation.',
          'Seek help sooner if symptoms are rapidly worsening or you feel unable to stay safe.',
        ],
      };
    }
    return {
      level: 'Severe anxiety symptom range',
      message:
        'Your GAD-7 score is in the published severe range. A qualified professional should assess the symptoms and their impact.',
      suggestions: [
        'Arrange a timely evaluation with a doctor or licensed mental health professional.',
        'Tell a trusted person if anxiety is making daily activities or self-care difficult.',
        'Use this result as a conversation aid, not as a diagnosis or treatment plan.',
      ],
    };
  },
};

export const PHQ9: Assessment = {
  type: 'PHQ9',
  name: 'PHQ-9 Depression Symptom Screener',
  shortName: 'Depression symptoms',
  description: 'Checks the frequency of nine common depression symptoms.',
  measureType: 'Validated symptom screener',
  timeframe: 'Past 2 weeks',
  instructions:
    'Over the last 2 weeks, how often have you been bothered by the following problems?',
  scoreMeaning:
    'Scores range from 0-27. Published symptom ranges are 0-4 minimal, 5-9 mild, 10-14 moderate, 15-19 moderately severe, and 20-27 severe. The daily-life impact answer is not added to the score. A score is not a diagnosis.',
  source:
    'Kroenke K, Spitzer RL, Williams JBW. The PHQ-9: validity of a brief depression severity measure. J Gen Intern Med. 2001.',
  citationUrl: 'https://pubmed.ncbi.nlm.nih.gov/11556941/',
  reviewedAt: 'July 2026',
  maxScore: 27,
  questions: [
    {
      id: 'q1',
      text: 'Little interest or pleasure in doing things',
      options: TWO_WEEK_OPTIONS,
    },
    {
      id: 'q2',
      text: 'Feeling down, depressed, or hopeless',
      options: TWO_WEEK_OPTIONS,
    },
    {
      id: 'q3',
      text: 'Trouble falling or staying asleep, or sleeping too much',
      options: TWO_WEEK_OPTIONS,
    },
    {
      id: 'q4',
      text: 'Feeling tired or having little energy',
      options: TWO_WEEK_OPTIONS,
    },
    { id: 'q5', text: 'Poor appetite or overeating', options: TWO_WEEK_OPTIONS },
    {
      id: 'q6',
      text: 'Feeling bad about yourself - or that you are a failure or have let yourself or your family down',
      options: TWO_WEEK_OPTIONS,
    },
    {
      id: 'q7',
      text: 'Trouble concentrating on things, such as reading the newspaper or watching television',
      options: TWO_WEEK_OPTIONS,
    },
    {
      id: 'q8',
      text: 'Moving or speaking so slowly that other people could have noticed. Or the opposite - being so fidgety or restless that you have been moving around a lot more than usual',
      options: TWO_WEEK_OPTIONS,
    },
    {
      id: 'q9',
      text: 'Thoughts that you would be better off dead, or of hurting yourself in some way',
      options: TWO_WEEK_OPTIONS,
    },
  ],
  functioningQuestion: FUNCTIONING_QUESTION,
  calculateScore: (responses) => sumAnswers(responses, 9, [0, 1, 2, 3]),
  interpret: (score) => {
    if (score <= 4) {
      return {
        level: 'Minimal depression symptom range',
        message:
          'Your PHQ-9 score is in the published minimal range. A low score does not rule out distress or another condition.',
        suggestions: [
          'Notice whether symptoms are still interfering with sleep, work, study, or relationships.',
          'Repeat the same screener later only if comparing the same two-week window would be useful.',
          'Talk with a qualified professional if symptoms concern you, regardless of the score.',
        ],
      };
    }
    if (score <= 9) {
      return {
        level: 'Mild depression symptom range',
        message:
          'Your PHQ-9 score is in the published mild range. The result describes symptom frequency, not a diagnosis.',
        suggestions: [
          'Monitor whether symptoms persist, worsen, or interfere with daily functioning.',
          'Keep daily goals small and maintain regular sleep, meals, movement, and social contact where possible.',
          'Consider discussing the result with a qualified professional if you want support.',
        ],
      };
    }
    if (score <= 14) {
      return {
        level: 'Moderate depression symptom range',
        message:
          'Your PHQ-9 score is in the published moderate range. Further assessment can clarify the cause and appropriate support.',
        suggestions: [
          'Consider arranging an evaluation with a doctor or licensed mental health professional.',
          'Bring this score and examples of how symptoms affect daily life to that conversation.',
          'Seek help sooner if symptoms are rapidly worsening or you feel unable to stay safe.',
        ],
      };
    }
    if (score <= 19) {
      return {
        level: 'Moderately severe depression symptom range',
        message:
          'Your PHQ-9 score is in the published moderately severe range. A qualified professional should assess the symptoms and their impact.',
        suggestions: [
          'Arrange a timely evaluation with a doctor or licensed mental health professional.',
          'Tell a trusted person if symptoms are making daily activities or self-care difficult.',
          'Use this result as a conversation aid, not as a diagnosis or treatment plan.',
        ],
      };
    }
    return {
      level: 'Severe depression symptom range',
      message:
        'Your PHQ-9 score is in the published severe range. A qualified professional should assess the symptoms and their impact.',
      suggestions: [
        'Arrange a prompt evaluation with a doctor or licensed mental health professional.',
        'Ask a trusted person to help you connect with care if doing so feels difficult.',
        'Use this result as a conversation aid, not as a diagnosis or treatment plan.',
      ],
    };
  },
};

export const CBI: Assessment = {
  type: 'CBI',
  name: 'CBI Personal Burnout Measure',
  shortName: 'Personal burnout',
  description: 'Measures physical and emotional exhaustion with the six-item CBI subscale.',
  measureType: 'Validated self-report measure',
  timeframe: 'How you generally feel',
  instructions: 'For each item, choose the answer that best reflects how often it is true for you.',
  scoreMeaning:
    'Each response is converted to 0, 25, 50, 75, or 100 and the six items are averaged. Higher scores mean greater reported exhaustion. This measure has no diagnostic result or universal individual cutoff.',
  source:
    'Kristensen TS, Borritz M, Villadsen E, Christensen KB. The Copenhagen Burnout Inventory: a new tool for the assessment of burnout. Work & Stress. 2005.',
  citationUrl: 'https://nfa.dk/media/hl5nbers/cbi-first-edition.pdf',
  reviewedAt: 'July 2026',
  maxScore: 100,
  questions: [
    { id: 'q1', text: 'How often do you feel tired?', options: CBI_OPTIONS },
    {
      id: 'q2',
      text: 'How often are you physically exhausted?',
      options: CBI_OPTIONS,
    },
    {
      id: 'q3',
      text: 'How often are you emotionally exhausted?',
      options: CBI_OPTIONS,
    },
    {
      id: 'q4',
      text: 'How often do you think: "I can\'t take it anymore"?',
      options: CBI_OPTIONS,
    },
    { id: 'q5', text: 'How often do you feel worn out?', options: CBI_OPTIONS },
    {
      id: 'q6',
      text: 'How often do you feel weak and susceptible to illness?',
      options: CBI_OPTIONS,
    },
  ],
  calculateScore: (responses) => {
    const answers = orderedAnswers(responses, 6, [0, 25, 50, 75, 100]);
    return Math.round(answers.reduce((total, value) => total + value, 0) / answers.length);
  },
  interpret: () => ({
    level: 'Personal burnout score',
    message:
      'This score is a rounded 0-100 average of the six personal-burnout items. Higher scores reflect more reported exhaustion, but the CBI does not diagnose a medical or mental health condition and does not define a universal individual cutoff.',
    suggestions: [
      'Look at which forms of exhaustion are affecting you and whether they are persistent.',
      'Consider practical changes to workload, rest, support, and recovery where possible.',
      'Persistent fatigue can have many physical and mental health causes; consider a professional evaluation if it continues or impairs daily life.',
    ],
  }),
};

export const ASSESSMENTS = {
  GAD7,
  PHQ9,
  CBI,
} as const;

export type AssessmentKey = keyof typeof ASSESSMENTS;

export function hasPositivePhq9SafetyResponse(
  assessment: Assessment,
  responses: Record<string, number>
): boolean {
  return assessment.type === 'PHQ9' && (responses.q9 ?? 0) > 0;
}
