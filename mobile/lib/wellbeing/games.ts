export type MindGameId =
  | 'sensory-orient'
  | 'color-switch'
  | 'sequence-hold'
  | 'visual-sweep'
  | 'category-sprint'
  | 'number-flow';

export type MathDifficulty = 'easy' | 'steady' | 'challenge';

export type MathProblem = {
  left: number;
  right: number;
  operator: '+' | '-' | '×' | '÷';
  answer: number;
};

export type MindGame = {
  id: MindGameId;
  title: string;
  skill: string;
  duration: string;
  description: string;
  evidenceIds: string[];
  evidenceNote: string;
};

export const MIND_GAMES: MindGame[] = [
  {
    id: 'sensory-orient',
    title: 'Sensory orient',
    skill: 'Grounding',
    duration: '2–4 min',
    description:
      'Name what you can see, feel, hear, smell, and taste to shift attention toward the present environment.',
    evidenceIds: ['slow-breathing'],
    evidenceNote:
      'A commonly used grounding exercise. Direct trial evidence for this exact sequence is limited, so it is not presented as treatment.',
  },
  {
    id: 'color-switch',
    title: 'Color switch',
    skill: 'Inhibitory control',
    duration: '60 sec',
    description:
      'Respond to ink color rather than the written color word in a short Stroop-style task.',
    evidenceIds: ['working-memory-training'],
    evidenceNote:
      'Practices the task in front of you. It does not promise broad cognitive improvement.',
  },
  {
    id: 'sequence-hold',
    title: 'Sequence hold',
    skill: 'Working memory',
    duration: '2 min',
    description:
      'Hold a short sequence in mind, then reproduce it after it disappears.',
    evidenceIds: ['working-memory-training'],
    evidenceNote:
      'Working-memory training produces small average gains; everyday transfer may be minimal.',
  },
  {
    id: 'visual-sweep',
    title: 'Visual sweep',
    skill: 'Selective attention',
    duration: '60 sec',
    description:
      'Find a target among similar shapes while keeping your breathing and pace steady.',
    evidenceIds: ['working-memory-training'],
    evidenceNote:
      'A brief attention task, not a diagnostic test or cognitive rehabilitation program.',
  },
  {
    id: 'category-sprint',
    title: 'Category sprint',
    skill: 'Mental flexibility',
    duration: '60 sec',
    description:
      'Generate examples from a safe everyday category without judging the total.',
    evidenceIds: ['working-memory-training'],
    evidenceNote:
      'Uses a familiar verbal-fluency format for practice. Scores are not interpreted clinically.',
  },
  {
    id: 'number-flow',
    title: 'Number flow',
    skill: 'Focused calculation',
    duration: '2–4 min',
    description:
      'Work through ten short arithmetic questions at a comfortable difficulty, without a timer.',
    evidenceIds: ['working-memory-training'],
    evidenceNote:
      'A focused arithmetic practice task. Results are not an IQ score, clinical measure, or proof of broader cognitive improvement.',
  },
];

function randomInteger(min: number, max: number, random: () => number): number {
  const sample = Math.min(0.999999, Math.max(0, random()));
  return Math.floor(sample * (max - min + 1)) + min;
}

export function createMathProblem(
  difficulty: MathDifficulty,
  random = Math.random
): MathProblem {
  const operators =
    difficulty === 'easy'
      ? (['+', '-'] as const)
      : difficulty === 'steady'
        ? (['+', '-', '×'] as const)
        : (['+', '-', '×', '÷'] as const);
  const operator = operators[randomInteger(0, operators.length - 1, random)];

  if (operator === '÷') {
    const right = randomInteger(2, 12, random);
    const answer = randomInteger(2, 12, random);
    return { left: right * answer, right, operator, answer };
  }

  if (operator === '×') {
    const maxFactor = difficulty === 'steady' ? 12 : 15;
    const left = randomInteger(2, maxFactor, random);
    const right = randomInteger(2, maxFactor, random);
    return { left, right, operator, answer: left * right };
  }

  const [minOperand, maxOperand] =
    difficulty === 'easy'
      ? [1, 20]
      : difficulty === 'steady'
        ? [10, 60]
        : [20, 99];
  const first = randomInteger(minOperand, maxOperand, random);
  const second = randomInteger(minOperand, maxOperand, random);
  const left = operator === '-' ? Math.max(first, second) : first;
  const right = operator === '-' ? Math.min(first, second) : second;

  return {
    left,
    right,
    operator,
    answer: operator === '+' ? left + right : left - right,
  };
}

export function scoreMathAnswer(problem: MathProblem, answer: string): boolean {
  const clean = answer.trim();
  return /^-?\d+$/.test(clean) && Number(clean) === problem.answer;
}

export function createDigitSequence(length: number, random = Math.random): string[] {
  return Array.from({ length: Math.max(1, Math.min(9, length)) }, () =>
    Math.floor(random() * 10).toString()
  );
}

export function shuffledVisualGrid(
  size: number,
  target: string,
  distractor: string,
  random = Math.random
): string[] {
  const safeSize = Math.max(4, Math.min(36, size));
  const targetIndex = Math.floor(random() * safeSize);
  return Array.from({ length: safeSize }, (_, index) =>
    index === targetIndex ? target : distractor
  );
}

export function scoreColorResponse(word: string, ink: string, answer: string): boolean {
  return word.length > 0 && ink === answer;
}
