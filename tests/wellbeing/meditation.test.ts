import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  MEDITATION_ISSUES,
  MEDITATION_PRACTICES,
  MEDITATION_SOURCES,
  practiceDurationSeconds,
} from '../../lib/meditation';

const meditatePage = readFileSync(
  resolve(process.cwd(), 'app/meditate/page.tsx'),
  'utf8'
);

describe('meditation catalog', () => {
  it('has unique practices and covers every stated issue', () => {
    expect(new Set(MEDITATION_PRACTICES.map(({ id }) => id)).size).toBe(
      MEDITATION_PRACTICES.length
    );
    for (const issue of MEDITATION_ISSUES) {
      expect(
        MEDITATION_PRACTICES.some((practice) =>
          practice.issues.includes(issue.id)
        )
      ).toBe(true);
    }
  });

  it('contains complete, reasonably short guided sessions', () => {
    for (const practice of MEDITATION_PRACTICES) {
      expect(practice.steps.length).toBeGreaterThanOrEqual(3);
      expect(practiceDurationSeconds(practice)).toBeGreaterThanOrEqual(120);
      expect(practiceDurationSeconds(practice)).toBeLessThanOrEqual(900);
      expect(practice.steps.every(({ seconds }) => seconds > 0)).toBe(true);
    }
  });

  it('avoids breath holds and cites only the reviewed source set', () => {
    const instructions = MEDITATION_PRACTICES.flatMap((practice) =>
      practice.steps.map(({ instruction }) => instruction.toLocaleLowerCase())
    );
    expect(instructions.some((instruction) => /\bhold your breath\b/.test(instruction))).toBe(
      false
    );
    for (const practice of MEDITATION_PRACTICES) {
      for (const sourceId of practice.sourceIds) {
        expect(MEDITATION_SOURCES[sourceId].url).toMatch(/^https:\/\//);
      }
    }
    expect(meditatePage).toContain('<OptionalSoundscape');
    expect(meditatePage).toContain("options={['off', 'rain', 'ocean']}");
    expect(meditatePage).toContain('href="/research#meditation"');
    expect(meditatePage).not.toContain('does not use binaural beats');
  });
});
