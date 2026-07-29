import { describe, expect, it } from 'vitest';
import {
  createDigitSequence,
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
});
