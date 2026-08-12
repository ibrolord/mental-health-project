import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('native mood visual consistency', () => {
  it('keeps the requested emoji style and readable labels on the full tracker', () => {
    const tracker = readFileSync(
      resolve(process.cwd(), 'mobile/app/(tabs)/tracker.tsx'),
      'utf8'
    );

    expect(tracker).toContain("import { getMoodLabel, MoodPicker } from '@/components/MoodPicker';");
    expect(tracker).toContain('<MoodPicker');

    const picker = readFileSync(
      resolve(process.cwd(), 'mobile/components/MoodPicker.tsx'),
      'utf8'
    );
    expect(picker).toContain('{choice.emoji}');
    expect(picker).toContain('fontSize: 12');
    expect(picker).not.toContain('fontSize: 10');
    expect(picker).not.toContain('MaterialCommunityIcons');
    expect(picker).not.toContain('maxFontSizeMultiplier={1.4}');
  });

  it('renders the Today botanical artwork as a deterministic decorative layer', () => {
    const dashboard = readFileSync(
      resolve(process.cwd(), 'mobile/app/(tabs)/index.tsx'),
      'utf8'
    );

    expect(existsSync(resolve(process.cwd(), 'mobile/assets/today-botanical.png'))).toBe(true);
    expect(dashboard).toContain("source={require('../../assets/today-botanical.png')}");
    expect(dashboard).toContain('style={s.nextStepArtwork}');
    expect(dashboard).toContain('accessible={false}');
    expect(dashboard).toContain('...StyleSheet.absoluteFillObject');
    expect(dashboard).not.toContain('<ImageBackground');
  });
});
