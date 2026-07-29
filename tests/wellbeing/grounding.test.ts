import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  GROUNDING_AUDIO_SOURCES,
  GROUNDING_NEEDS,
  GROUNDING_PATHS,
  groundingPathFor,
} from '../../lib/grounding';

const groundPage = readFileSync(
  resolve(process.cwd(), 'app/ground/page.tsx'),
  'utf8'
);
const soundscapeComponent = readFileSync(
  resolve(process.cwd(), 'components/optional-soundscape.tsx'),
  'utf8'
);

describe('grounding routes', () => {
  it('maps every choice deterministically without AI or user data', () => {
    expect(GROUNDING_NEEDS).toHaveLength(6);
    for (const need of GROUNDING_NEEDS) {
      expect(groundingPathFor(need.id)).toBe(GROUNDING_PATHS[need.id]);
    }
  });

  it('gives each route multiple timed, present-focused steps', () => {
    for (const path of GROUNDING_NEEDS) {
      expect(path.steps.length).toBeGreaterThanOrEqual(4);
      expect(path.steps.every(({ seconds }) => seconds >= 30)).toBe(true);
      expect(path.why.length).toBeGreaterThan(30);
    }
  });

  it('does not instruct breath holding or use diagnostic labels', () => {
    const text = JSON.stringify(GROUNDING_PATHS).toLocaleLowerCase();
    expect(text).not.toMatch(/\bhold your breath\b/);
    expect(text).not.toMatch(/\byou have (ptsd|panic disorder|dissociation)\b/);
  });

  it('cites grounding audio and the limits of natural-sound claims', () => {
    expect(GROUNDING_AUDIO_SOURCES).toHaveLength(4);
    expect(
      GROUNDING_AUDIO_SOURCES.every(({ url }) => url.startsWith('https://'))
    ).toBe(true);
    expect(
      GROUNDING_AUDIO_SOURCES.some(({ name }) => name.includes('WHO'))
    ).toBe(true);
    expect(
      GROUNDING_AUDIO_SOURCES.some(({ name }) => name.includes('binaural'))
    ).toBe(true);
    expect(groundPage).toContain("options={['off', 'rain', 'ocean']}");
    expect(groundPage).toContain('href="/research#grounding"');
    expect(groundPage).not.toContain('does not use binaural beats');
    expect(soundscapeComponent).toContain(
      "useState<SoundscapeId>('off')"
    );
    expect(groundPage).not.toContain("from('@/lib/supabase");
  });
});
