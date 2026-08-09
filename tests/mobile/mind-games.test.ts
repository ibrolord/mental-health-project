import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  MIND_GAMES,
  createMathProblem,
  scoreMathAnswer,
} from '../../mobile/lib/wellbeing/games';

const screen = readFileSync(
  resolve(process.cwd(), 'mobile/app/mind-games.tsx'),
  'utf8'
);
const numberFlow = screen.slice(
  screen.indexOf('function NumberFlow()'),
  screen.indexOf('function GameRunner')
);

describe('mobile number-flow game', () => {
  it('lists the local untimed arithmetic game without efficacy claims', () => {
    const game = MIND_GAMES.find(({ id }) => id === 'number-flow');

    expect(game).toMatchObject({
      title: 'Number flow',
      skill: 'Focused calculation',
      duration: '2–4 min',
    });
    expect(game?.description).toContain('without a timer');
    expect(game?.evidenceNote).toContain('not an IQ score');
    expect(game?.evidenceNote).toContain('not a');
    expect(game?.evidenceNote).not.toMatch(/treat|therapy|rehabilitat/i);
  });

  it('creates deterministic bounded easy subtraction', () => {
    const samples = [0.99, 0.1, 0.9];

    expect(createMathProblem('easy', () => samples.shift() ?? 0)).toEqual({
      left: 19,
      right: 3,
      operator: '-',
      answer: 16,
    });
  });

  it('creates deterministic steady multiplication', () => {
    const samples = [0.99, 0, 1];

    expect(createMathProblem('steady', () => samples.shift() ?? 0)).toEqual({
      left: 2,
      right: 12,
      operator: '×',
      answer: 24,
    });
  });

  it('creates whole-number challenge division', () => {
    const samples = [0.99, 0.4, 0.7];
    const problem = createMathProblem(
      'challenge',
      () => samples.shift() ?? 0
    );

    expect(problem).toEqual({
      left: 54,
      right: 6,
      operator: '÷',
      answer: 9,
    });
  });

  it('scores only complete integer answers', () => {
    const problem = { left: 7, right: 5, operator: '+' as const, answer: 12 };

    expect(scoreMathAnswer(problem, '12')).toBe(true);
    expect(scoreMathAnswer(problem, ' 12 ')).toBe(true);
    expect(scoreMathAnswer(problem, '')).toBe(false);
    expect(scoreMathAnswer(problem, '12px')).toBe(false);
    expect(scoreMathAnswer(problem, '12.0')).toBe(false);
    expect(scoreMathAnswer(problem, '11')).toBe(false);
  });

  it('keeps the native round local and exposes accessible controls', () => {
    expect(numberFlow).not.toMatch(/fetch\(|apiRequest|supabase/i);
    expect(numberFlow).toContain('accessibilityRole="radiogroup"');
    expect(numberFlow).toContain('accessibilityRole="radio"');
    expect(numberFlow).toContain('accessibilityState={{ selected }}');
    expect(numberFlow).toContain('accessibilityRole="progressbar"');
    expect(numberFlow).toContain('accessibilityLabel="Math answer"');
    expect(numberFlow).toContain('accessibilityLiveRegion="polite"');
    expect(numberFlow).toContain('not a measure of intelligence');
  });
});
