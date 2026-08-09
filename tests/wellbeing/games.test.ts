import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  createMathProblem,
  createDigitSequence,
  scoreMathAnswer,
  scoreColorResponse,
  shuffledVisualGrid,
} from '../../lib/wellbeing/games';

describe('local mind-game helpers', () => {
  it('bounds digit sequences and supports deterministic generation', () => {
    expect(createDigitSequence(0, () => 0.49)).toEqual(['4']);
    expect(createDigitSequence(20, () => 0.99)).toEqual(
      Array.from({ length: 9 }, () => '9')
    );
  });

  it('places exactly one target in a bounded visual grid', () => {
    const grid = shuffledVisualGrid(100, 'Q', 'O', () => 0.5);
    expect(grid).toHaveLength(36);
    expect(grid.filter((value) => value === 'Q')).toHaveLength(1);
    expect(grid.filter((value) => value === 'O')).toHaveLength(35);
  });

  it('scores the ink answer rather than the displayed word', () => {
    expect(scoreColorResponse('red', 'blue', 'blue')).toBe(true);
    expect(scoreColorResponse('red', 'blue', 'red')).toBe(false);
    expect(scoreColorResponse('', 'blue', 'blue')).toBe(false);
  });

  it('creates bounded easy math with non-negative subtraction', () => {
    const samples = [0.99, 0.1, 0.9];
    const problem = createMathProblem('easy', () => samples.shift() ?? 0);

    expect(problem).toEqual({
      left: 19,
      right: 3,
      operator: '-',
      answer: 16,
    });
  });

  it('keeps every easy result whole, non-negative, and at most 20', () => {
    let seed = 0x12345678;
    const random = () => {
      seed = (1664525 * seed + 1013904223) >>> 0;
      return seed / 0x1_0000_0000;
    };

    for (let index = 0; index < 1000; index += 1) {
      const problem = createMathProblem('easy', random);
      expect(['+', '-']).toContain(problem.operator);
      expect(Number.isInteger(problem.answer)).toBe(true);
      expect(problem.answer).toBeGreaterThanOrEqual(0);
      expect(problem.answer).toBeLessThanOrEqual(20);
    }
  });

  it('creates whole-number division at challenge difficulty', () => {
    const samples = [0.99, 0.4, 0.7];
    const problem = createMathProblem('challenge', () => samples.shift() ?? 0);

    expect(problem.operator).toBe('÷');
    expect(problem.left / problem.right).toBe(problem.answer);
    expect(Number.isInteger(problem.answer)).toBe(true);
  });

  it('scores only complete integer math answers', () => {
    const problem = { left: 7, right: 5, operator: '+' as const, answer: 12 };

    expect(scoreMathAnswer(problem, '12')).toBe(true);
    expect(scoreMathAnswer(problem, ' 12 ')).toBe(true);
    expect(scoreMathAnswer(problem, '')).toBe(false);
    expect(scoreMathAnswer(problem, '12px')).toBe(false);
    expect(scoreMathAnswer(problem, '11')).toBe(false);
  });
});

describe('Number flow rendering', () => {
  it('uses a deterministic problem for the hydration-sensitive initial render', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'app/mind-games/page.tsx'),
      'utf8'
    );

    expect(source).toContain("createMathProblem('easy', () => 0)");
    expect(source).toContain('useState(INITIAL_NUMBER_FLOW_PROBLEM)');
    expect(source).not.toContain("useState(() => createMathProblem('easy'))");
  });
});
