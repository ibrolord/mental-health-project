export type MindGameId =
  | 'sensory-orient'
  | 'color-switch'
  | 'sequence-hold'
  | 'visual-sweep'
  | 'category-sprint';

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
];

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
