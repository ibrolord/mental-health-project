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
    expect(picker).toContain('borderColor: Colors.borderStrong');
    expect(picker).toContain('backgroundColor: Colors.card');
    expect(picker).not.toContain('fontSize: 10');
    expect(picker).not.toContain('MaterialCommunityIcons');
    expect(picker).not.toContain('maxFontSizeMultiplier={1.4}');
  });

  it('keeps the tracker hierarchy direct, discoverable, and nonclinical', () => {
    const tracker = readFileSync(
      resolve(process.cwd(), 'mobile/app/(tabs)/tracker.tsx'),
      'utf8'
    );
    const health = readFileSync(
      resolve(process.cwd(), 'mobile/components/AppleHealthInsights.tsx'),
      'utf8'
    );
    const sleep = readFileSync(
      resolve(process.cwd(), 'mobile/components/SleepDiary.tsx'),
      'utf8'
    );

    expect(tracker).toContain('const [historyOpen, setHistoryOpen] = useState(true);');
    expect(tracker).toContain('<View style={s.checkInSection}>');
    expect(tracker).toContain('<View style={s.historySection}>');
    expect(health).not.toContain('<AppCard');
    expect(sleep).not.toMatch(/<AppCard|<DisclosureCard/);
    expect(`${tracker}\n${health}\n${sleep}`).not.toMatch(/diagnos|caused by|because of your mood/i);
  });

  it('renders the Today botanical artwork as a deterministic decorative layer', () => {
    const advisorCard = readFileSync(
      resolve(process.cwd(), 'mobile/components/AdvisorHomeCard.tsx'),
      'utf8'
    );
    const botanicalHero = readFileSync(
      resolve(process.cwd(), 'mobile/components/BotanicalHero.tsx'),
      'utf8'
    );

    expect(existsSync(resolve(process.cwd(), 'mobile/assets/today-botanical.png'))).toBe(true);
    expect(advisorCard).toContain("source={require('../assets/today-botanical.png')}");
    expect(advisorCard).toContain('style={styles.artwork}');
    expect(advisorCard).toContain('accessible={false}');
    expect(advisorCard).toContain('fontScale < LARGE_TEXT_SCALE');
    expect(advisorCard).toContain("position: 'absolute'");
    expect(advisorCard).not.toContain('<ImageBackground');
    expect(botanicalHero).toContain("source={require('../assets/today-botanical.png')}");
    expect(botanicalHero).toContain('accessibilityElementsHidden');
    expect(botanicalHero).toContain('fontScale < LARGE_TEXT_SCALE');
    expect(botanicalHero).toContain('...StyleSheet.absoluteFillObject');
  });
});
