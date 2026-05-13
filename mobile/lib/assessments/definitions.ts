import { Assessment } from './types';

export const GAD7: Assessment = {
  type: 'GAD7',
  name: 'GAD-7 Anxiety Symptom Screener',
  description: '7-item anxiety symptom screening tool',
  source: 'Spitzer RL, Kroenke K, Williams JB, Lowe B. A brief measure for assessing generalized anxiety disorder: the GAD-7. Arch Intern Med. 2006.',
  citationUrl: 'https://pubmed.ncbi.nlm.nih.gov/16717171/',
  maxScore: 21,
  questions: [
    {
      id: 'q1',
      text: 'Feeling nervous, anxious, or on edge',
      options: [
        { value: 0, label: 'Not at all' },
        { value: 1, label: 'Several days' },
        { value: 2, label: 'More than half the days' },
        { value: 3, label: 'Nearly every day' },
      ],
    },
    {
      id: 'q2',
      text: 'Not being able to stop or control worrying',
      options: [
        { value: 0, label: 'Not at all' },
        { value: 1, label: 'Several days' },
        { value: 2, label: 'More than half the days' },
        { value: 3, label: 'Nearly every day' },
      ],
    },
    {
      id: 'q3',
      text: 'Worrying too much about different things',
      options: [
        { value: 0, label: 'Not at all' },
        { value: 1, label: 'Several days' },
        { value: 2, label: 'More than half the days' },
        { value: 3, label: 'Nearly every day' },
      ],
    },
    {
      id: 'q4',
      text: 'Trouble relaxing',
      options: [
        { value: 0, label: 'Not at all' },
        { value: 1, label: 'Several days' },
        { value: 2, label: 'More than half the days' },
        { value: 3, label: 'Nearly every day' },
      ],
    },
    {
      id: 'q5',
      text: 'Being so restless that it\'s hard to sit still',
      options: [
        { value: 0, label: 'Not at all' },
        { value: 1, label: 'Several days' },
        { value: 2, label: 'More than half the days' },
        { value: 3, label: 'Nearly every day' },
      ],
    },
    {
      id: 'q6',
      text: 'Becoming easily annoyed or irritable',
      options: [
        { value: 0, label: 'Not at all' },
        { value: 1, label: 'Several days' },
        { value: 2, label: 'More than half the days' },
        { value: 3, label: 'Nearly every day' },
      ],
    },
    {
      id: 'q7',
      text: 'Feeling afraid as if something awful might happen',
      options: [
        { value: 0, label: 'Not at all' },
        { value: 1, label: 'Several days' },
        { value: 2, label: 'More than half the days' },
        { value: 3, label: 'Nearly every day' },
      ],
    },
  ],
  interpret: (score) => {
    if (score <= 4) {
      return {
        level: 'Minimal Anxiety Symptom Range',
        message: 'Your responses fall in the minimal range for anxiety symptoms on this screener.',
        suggestions: [
          'Continue with your current self-care practices',
          'Use the mood tracker to monitor changes',
          'Practice stress management techniques preventatively',
        ],
      };
    } else if (score <= 9) {
      return {
        level: 'Mild Anxiety Symptom Range',
        message: 'Your responses fall in the mild range for anxiety symptoms on this screener.',
        suggestions: [
          'Talk to our AI about anxiety management techniques',
          'Try daily relaxation exercises or meditation',
          'Read: "The Happiness Trap" in our book library',
          'Set goals around stress reduction',
        ],
      };
    } else if (score <= 14) {
      return {
        level: 'Moderate Anxiety Symptom Range',
        message: 'Your responses fall in the moderate range for anxiety symptoms on this screener.',
        suggestions: [
          'Consider speaking with a mental health professional',
          'Talk to our AI about cognitive reframing techniques',
          'Build daily habits around anxiety management',
          'Track your mood patterns to identify triggers',
        ],
      };
    } else {
      return {
        level: 'Severe Anxiety Symptom Range',
        message: 'Your responses fall in the severe range for anxiety symptoms on this screener.',
        suggestions: [
          'We strongly recommend consulting a mental health professional',
          'Crisis resources: 988 Suicide & Crisis Lifeline',
          'Use the app for grounding and coping ideas while you arrange support',
          'Focus on basic self-care: sleep, nutrition, gentle movement',
        ],
      };
    }
  },
};

export const PHQ9: Assessment = {
  type: 'PHQ9',
  name: 'PHQ-9 Depression Symptom Screener',
  description: '9-item depression symptom screening tool',
  source: 'Kroenke K, Spitzer RL, Williams JB. The PHQ-9: validity of a brief depression severity measure. J Gen Intern Med. 2001.',
  citationUrl: 'https://pubmed.ncbi.nlm.nih.gov/11556941/',
  maxScore: 27,
  questions: [
    {
      id: 'q1',
      text: 'Little interest or pleasure in doing things',
      options: [
        { value: 0, label: 'Not at all' },
        { value: 1, label: 'Several days' },
        { value: 2, label: 'More than half the days' },
        { value: 3, label: 'Nearly every day' },
      ],
    },
    {
      id: 'q2',
      text: 'Feeling down, depressed, or hopeless',
      options: [
        { value: 0, label: 'Not at all' },
        { value: 1, label: 'Several days' },
        { value: 2, label: 'More than half the days' },
        { value: 3, label: 'Nearly every day' },
      ],
    },
    {
      id: 'q3',
      text: 'Trouble falling or staying asleep, or sleeping too much',
      options: [
        { value: 0, label: 'Not at all' },
        { value: 1, label: 'Several days' },
        { value: 2, label: 'More than half the days' },
        { value: 3, label: 'Nearly every day' },
      ],
    },
    {
      id: 'q4',
      text: 'Feeling tired or having little energy',
      options: [
        { value: 0, label: 'Not at all' },
        { value: 1, label: 'Several days' },
        { value: 2, label: 'More than half the days' },
        { value: 3, label: 'Nearly every day' },
      ],
    },
    {
      id: 'q5',
      text: 'Poor appetite or overeating',
      options: [
        { value: 0, label: 'Not at all' },
        { value: 1, label: 'Several days' },
        { value: 2, label: 'More than half the days' },
        { value: 3, label: 'Nearly every day' },
      ],
    },
    {
      id: 'q6',
      text: 'Feeling bad about yourself - or that you are a failure or have let yourself or your family down',
      options: [
        { value: 0, label: 'Not at all' },
        { value: 1, label: 'Several days' },
        { value: 2, label: 'More than half the days' },
        { value: 3, label: 'Nearly every day' },
      ],
    },
    {
      id: 'q7',
      text: 'Trouble concentrating on things, such as reading the newspaper or watching television',
      options: [
        { value: 0, label: 'Not at all' },
        { value: 1, label: 'Several days' },
        { value: 2, label: 'More than half the days' },
        { value: 3, label: 'Nearly every day' },
      ],
    },
    {
      id: 'q8',
      text: 'Moving or speaking so slowly that other people could have noticed. Or the opposite - being so fidgety or restless that you have been moving around a lot more than usual',
      options: [
        { value: 0, label: 'Not at all' },
        { value: 1, label: 'Several days' },
        { value: 2, label: 'More than half the days' },
        { value: 3, label: 'Nearly every day' },
      ],
    },
    {
      id: 'q9',
      text: 'Thoughts that you would be better off dead, or of hurting yourself in some way',
      options: [
        { value: 0, label: 'Not at all' },
        { value: 1, label: 'Several days' },
        { value: 2, label: 'More than half the days' },
        { value: 3, label: 'Nearly every day' },
      ],
    },
  ],
  interpret: (score) => {
    if (score <= 4) {
      return {
        level: 'Minimal Depression Symptom Range',
        message: 'Your responses fall in the minimal range for depression symptoms on this screener.',
        suggestions: [
          'Maintain healthy routines and self-care',
          'Track your mood to notice early changes',
          'Explore our book library for personal growth',
        ],
      };
    } else if (score <= 9) {
      return {
        level: 'Mild Depression Symptom Range',
        message: 'Your responses fall in the mild range for depression symptoms on this screener.',
        suggestions: [
          'Read "Feeling Good" in our library (CBT techniques)',
          'Talk to our AI about thought patterns',
          'Set small, achievable daily goals',
          'Build habits around sleep, exercise, and social connection',
        ],
      };
    } else if (score <= 14) {
      return {
        level: 'Moderate Depression Symptom Range',
        message: 'Your responses fall in the moderate range for depression symptoms on this screener.',
        suggestions: [
          'Consider consulting a mental health professional',
          'Use chat for daily emotional reflection and coping ideas',
          'Focus on one small positive action per day',
          'Track mood patterns to understand triggers',
        ],
      };
    } else if (score <= 19) {
      return {
        level: 'Moderately Severe Depression Symptom Range',
        message: 'Your responses fall in the moderately severe range for depression symptoms on this screener.',
        suggestions: [
          'We strongly recommend speaking with a mental health professional',
          'Crisis Line: 988 Suicide & Crisis Lifeline',
          'Use grounding tools while you arrange professional or trusted-person support',
          'Prioritize basic needs: sleep, food, safety',
        ],
      };
    } else {
      return {
        level: 'Severe Depression Symptom Range',
        message: 'Your responses fall in the severe range for depression symptoms on this screener.',
        suggestions: [
          'Please reach out to a mental health professional immediately',
          'Crisis resources: 988 Suicide & Crisis Lifeline or text "HOME" to 741741',
          'You are not alone - support is available',
          'Use the app for grounding while seeking professional help',
        ],
      };
    }
  },
};

export const CBI: Assessment = {
  type: 'CBI',
  name: 'Copenhagen Burnout Inventory',
  description: 'Short personal burnout screening tool',
  source: 'Kristensen TS, Borritz M, Villadsen E, Christensen KB. The Copenhagen Burnout Inventory: A new tool for the assessment of burnout. Work & Stress. 2005.',
  citationUrl: 'https://doi.org/10.1080/02678370500297720',
  maxScore: 24,
  questions: [
    {
      id: 'q1',
      text: 'How often do you feel tired?',
      options: [
        { value: 0, label: 'Never/Very infrequently' },
        { value: 2, label: 'Sometimes' },
        { value: 3, label: 'Often' },
        { value: 4, label: 'Always' },
      ],
    },
    {
      id: 'q2',
      text: 'How often are you physically exhausted?',
      options: [
        { value: 0, label: 'Never/Very infrequently' },
        { value: 2, label: 'Sometimes' },
        { value: 3, label: 'Often' },
        { value: 4, label: 'Always' },
      ],
    },
    {
      id: 'q3',
      text: 'How often are you emotionally exhausted?',
      options: [
        { value: 0, label: 'Never/Very infrequently' },
        { value: 2, label: 'Sometimes' },
        { value: 3, label: 'Often' },
        { value: 4, label: 'Always' },
      ],
    },
    {
      id: 'q4',
      text: 'How often do you think: "I can\'t take it anymore"?',
      options: [
        { value: 0, label: 'Never/Very infrequently' },
        { value: 2, label: 'Sometimes' },
        { value: 3, label: 'Often' },
        { value: 4, label: 'Always' },
      ],
    },
    {
      id: 'q5',
      text: 'How often do you feel worn out?',
      options: [
        { value: 0, label: 'Never/Very infrequently' },
        { value: 2, label: 'Sometimes' },
        { value: 3, label: 'Often' },
        { value: 4, label: 'Always' },
      ],
    },
    {
      id: 'q6',
      text: 'How often do you feel weak and susceptible to illness?',
      options: [
        { value: 0, label: 'Never/Very infrequently' },
        { value: 2, label: 'Sometimes' },
        { value: 3, label: 'Often' },
        { value: 4, label: 'Always' },
      ],
    },
  ],
  interpret: (score) => {
    if (score <= 8) {
      return {
        level: 'Low Burnout Range',
        message: 'Your responses fall in the low range for burnout symptoms on this screener.',
        suggestions: [
          'Maintain work-life boundaries',
          'Continue your current self-care practices',
          'Build habits that prevent burnout (rest, hobbies, connection)',
        ],
      };
    } else if (score <= 16) {
      return {
        level: 'Moderate Burnout Range',
        message: 'Your responses fall in the moderate range for burnout symptoms on this screener.',
        suggestions: [
          'Read "Burnout" by Nagoski in our library',
          'Set clear boundaries around work and rest',
          'Talk to our AI about stress management',
          'Practice completing the stress cycle (movement, breathing)',
        ],
      };
    } else {
      return {
        level: 'High Burnout Range',
        message: 'Your responses fall in the high range for burnout symptoms on this screener.',
        suggestions: [
          'Consider taking time off if possible',
          'Speak with a mental health professional or doctor',
          'Read "When the Body Says No" in our library',
          'Focus on rest as a priority, not a luxury',
          'Use our life organizer to reduce overwhelm',
        ],
      };
    }
  },
};

export const PSS4: Assessment = {
  type: 'PSS4',
  name: 'Perceived Stress Scale',
  description: '4-item perceived stress screening tool',
  source: 'Cohen S, Kamarck T, Mermelstein R. A global measure of perceived stress. J Health Soc Behav. 1983.',
  citationUrl: 'https://cancercontrol.cancer.gov/brp/research/group-evaluated-measures/adopt/perceived-stress-scale',
  maxScore: 16,
  questions: [
    {
      id: 'q1',
      text: 'In the last month, how often have you felt that you were unable to control the important things in your life?',
      options: [
        { value: 0, label: 'Never' },
        { value: 1, label: 'Almost never' },
        { value: 2, label: 'Sometimes' },
        { value: 3, label: 'Fairly often' },
        { value: 4, label: 'Very often' },
      ],
    },
    {
      id: 'q2',
      text: 'In the last month, how often have you felt confident about your ability to handle your personal problems?',
      options: [
        { value: 4, label: 'Never' },
        { value: 3, label: 'Almost never' },
        { value: 2, label: 'Sometimes' },
        { value: 1, label: 'Fairly often' },
        { value: 0, label: 'Very often' },
      ],
    },
    {
      id: 'q3',
      text: 'In the last month, how often have you felt that things were going your way?',
      options: [
        { value: 4, label: 'Never' },
        { value: 3, label: 'Almost never' },
        { value: 2, label: 'Sometimes' },
        { value: 1, label: 'Fairly often' },
        { value: 0, label: 'Very often' },
      ],
    },
    {
      id: 'q4',
      text: 'In the last month, how often have you felt difficulties were piling up so high that you could not overcome them?',
      options: [
        { value: 0, label: 'Never' },
        { value: 1, label: 'Almost never' },
        { value: 2, label: 'Sometimes' },
        { value: 3, label: 'Fairly often' },
        { value: 4, label: 'Very often' },
      ],
    },
  ],
  interpret: (score) => {
    if (score <= 5) {
      return {
        level: 'Low Perceived Stress Range',
        message: 'Your responses fall in the low range for perceived stress on this screener.',
        suggestions: [
          'Continue managing stress effectively',
          'Maintain healthy coping strategies',
          'Use our mood tracker to stay aware',
        ],
      };
    } else if (score <= 10) {
      return {
        level: 'Moderate Perceived Stress Range',
        message: 'Your responses fall in the moderate range for perceived stress on this screener.',
        suggestions: [
          'Talk to our AI about stress reduction techniques',
          'Use the life organizer to prioritize and reduce overwhelm',
          'Build daily stress-relief habits (exercise, meditation, hobbies)',
          'Read stress management resources in our library',
        ],
      };
    } else {
      return {
        level: 'High Perceived Stress Range',
        message: 'Your responses fall in the high range for perceived stress on this screener.',
        suggestions: [
          'Consider speaking with a mental health professional',
          'Read "Burnout" in our library about completing the stress cycle',
          'Practice daily relaxation or grounding exercises',
          'Use our AI for immediate support and coping strategies',
          'Simplify your commitments where possible',
        ],
      };
    }
  },
};

export const ASSESSMENTS = {
  GAD7,
  PHQ9,
  CBI,
  PSS4,
};
