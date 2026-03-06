import { Assessment } from './types';

export const GAD7: Assessment = {
  type: 'GAD7',
  name: 'GAD-7 Anxiety Assessment',
  description: 'Generalized Anxiety Disorder 7-item scale',
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
        level: 'Minimal Anxiety',
        message: 'Your anxiety levels appear to be minimal.',
        suggestions: [
          'Continue with your current self-care practices',
          'Use the mood tracker to monitor changes',
          'Practice stress management techniques preventatively',
        ],
      };
    } else if (score <= 9) {
      return {
        level: 'Mild Anxiety',
        message: 'You may be experiencing mild anxiety symptoms.',
        suggestions: [
          'Talk to our AI about anxiety management techniques',
          'Try daily relaxation exercises or meditation',
          'Read: "The Happiness Trap" in our book library',
          'Set goals around stress reduction',
        ],
      };
    } else if (score <= 14) {
      return {
        level: 'Moderate Anxiety',
        message: 'You are likely experiencing moderate anxiety.',
        suggestions: [
          'Consider speaking with a mental health professional',
          'Talk to our AI about cognitive reframing techniques',
          'Build daily habits around anxiety management',
          'Track your mood patterns to identify triggers',
        ],
      };
    } else {
      return {
        level: 'Severe Anxiety',
        message: 'You may be experiencing severe anxiety symptoms.',
        suggestions: [
          'We strongly recommend consulting a mental health professional',
          'Crisis resources: 988 Suicide & Crisis Lifeline',
          'Use our AI for immediate emotional support',
          'Focus on basic self-care: sleep, nutrition, gentle movement',
        ],
      };
    }
  },
};

export const PHQ9: Assessment = {
  type: 'PHQ9',
  name: 'PHQ-9 Depression Assessment',
  description: 'Patient Health Questionnaire-9',
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
        level: 'Minimal Depression',
        message: 'Your depression symptoms appear to be minimal.',
        suggestions: [
          'Maintain healthy routines and self-care',
          'Track your mood to notice early changes',
          'Explore our book library for personal growth',
        ],
      };
    } else if (score <= 9) {
      return {
        level: 'Mild Depression',
        message: 'You may be experiencing mild depression symptoms.',
        suggestions: [
          'Read "Feeling Good" in our library (CBT techniques)',
          'Talk to our AI about thought patterns',
          'Set small, achievable daily goals',
          'Build habits around sleep, exercise, and social connection',
        ],
      };
    } else if (score <= 14) {
      return {
        level: 'Moderate Depression',
        message: 'You are likely experiencing moderate depression.',
        suggestions: [
          'Consider consulting a mental health professional',
          'Use our AI for daily emotional support',
          'Focus on one small positive action per day',
          'Track mood patterns to understand triggers',
        ],
      };
    } else if (score <= 19) {
      return {
        level: 'Moderately Severe Depression',
        message: 'You may be experiencing moderately severe depression.',
        suggestions: [
          'We strongly recommend speaking with a mental health professional',
          'Crisis Line: 988 Suicide & Crisis Lifeline',
          'Talk to our AI when you need immediate support',
          'Prioritize basic needs: sleep, food, safety',
        ],
      };
    } else {
      return {
        level: 'Severe Depression',
        message: 'You may be experiencing severe depression symptoms.',
        suggestions: [
          'Please reach out to a mental health professional immediately',
          'Crisis resources: 988 Suicide & Crisis Lifeline or text "HELLO" to 741741',
          'You are not alone - support is available',
          'Use our AI for emotional support while seeking professional help',
        ],
      };
    }
  },
};

export const CBI: Assessment = {
  type: 'CBI',
  name: 'Copenhagen Burnout Inventory',
  description: 'Short burnout assessment',
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
        level: 'Low Burnout',
        message: 'Your burnout levels appear to be low.',
        suggestions: [
          'Maintain work-life boundaries',
          'Continue your current self-care practices',
          'Build habits that prevent burnout (rest, hobbies, connection)',
        ],
      };
    } else if (score <= 16) {
      return {
        level: 'Moderate Burnout',
        message: 'You are experiencing moderate burnout symptoms.',
        suggestions: [
          'Read "Burnout" by Nagoski in our library',
          'Set clear boundaries around work and rest',
          'Talk to our AI about stress management',
          'Practice completing the stress cycle (movement, breathing)',
        ],
      };
    } else {
      return {
        level: 'High Burnout',
        message: 'You are experiencing high levels of burnout.',
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
  description: '4-item stress assessment',
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
        level: 'Low Stress',
        message: 'Your perceived stress levels are low.',
        suggestions: [
          'Continue managing stress effectively',
          'Maintain healthy coping strategies',
          'Use our mood tracker to stay aware',
        ],
      };
    } else if (score <= 10) {
      return {
        level: 'Moderate Stress',
        message: 'You are experiencing moderate stress levels.',
        suggestions: [
          'Talk to our AI about stress reduction techniques',
          'Use the life organizer to prioritize and reduce overwhelm',
          'Build daily stress-relief habits (exercise, meditation, hobbies)',
          'Read stress management resources in our library',
        ],
      };
    } else {
      return {
        level: 'High Stress',
        message: 'You are experiencing high perceived stress.',
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

