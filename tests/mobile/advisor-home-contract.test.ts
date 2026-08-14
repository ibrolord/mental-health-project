import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (file: string) => readFileSync(path.resolve(process.cwd(), file), 'utf8');
const home = read('mobile/app/(tabs)/index.tsx');
const card = read('mobile/components/AdvisorHomeCard.tsx');
const tabs = read('mobile/app/(tabs)/_layout.tsx');
const advisor = read('mobile/app/(tabs)/advisor.tsx');
const dashboardLayout = read('mobile/lib/dashboard-layout.ts');

describe('mobile Advisor Home contracts', () => {
  it('keeps Today to greeting, mood, one Advisor doorway, and a compact customizable day', () => {
    expect(home.match(/<AdvisorHomeCard\b/g)).toHaveLength(1);
    expect(home).toContain('<BotanicalHero style={styles.hero}>');
    expect(home).not.toContain('<LeafMark');
    expect(home).toContain('<MoodPicker');
    expect(home).toContain('<RowGroup>');
    expect(home).toContain('Customize your Today page');
    expect(dashboardLayout).toMatch(/mixed:[\s\S]*?'accountability'/);

    const greeting = home.indexOf('{greetingForHour(now.getHours())}');
    const mood = home.indexOf('<View style={styles.moodSection}>');
    const advisor = home.indexOf('<AdvisorHomeCard');
    const yourDay = home.indexOf('title="Your day"');
    expect(greeting).toBeGreaterThan(-1);
    expect(mood).toBeGreaterThan(greeting);
    expect(advisor).toBeGreaterThan(mood);
    expect(yourDay).toBeGreaterThan(advisor);
  });

  it('makes Home a read-only Advisor doorway rather than a second recommendation engine', () => {
    expect(card).toContain('YOUR ADVISOR');
    expect(card).toContain('Open Advisor');
    expect(home).toContain("router.navigate('/advisor')");
    expect(home).not.toMatch(/selectAdvisorRecommendation|recordAdvisorOffered|markAdvisorStarted/);
    expect(home).not.toMatch(/answerAdvisorHelpfulness|advisor-observation-ledger/);
    expect(card).not.toContain('AdvisorRecommendation');
    expect(card).not.toContain('Try something else');
    expect(card).not.toContain('Why this?');
    expect(card).not.toContain('Was this suggestion useful?');
  });

  it('gives Advisor a first-class tab and keeps chat available from Advisor only', () => {
    expect(tabs).toContain('name="advisor"');
    expect(tabs).toContain("title: 'Advisor'");
    expect(tabs).toContain('<Feather name="compass"');
    expect(tabs).toMatch(/name="chat"[\s\S]*?href: null/);
    expect(advisor).toContain('export default function AdvisorScreen()');
    expect(advisor).toContain('<BotanicalHero style={styles.hero}>');
    expect(advisor).not.toContain('<LeafMark');
  });

  it('keeps low-energy mode calm and owner-bound', () => {
    expect(home).toContain('lowEnergyOwnerKey === ownerKey && lowEnergyMode');
    expect(home).toContain('lowEnergy={visibleLowEnergyMode}');
    expect(home).toContain("? 'Ask someone you trust to check in.'");
    expect(home).toContain('setLowEnergyOwnerKey(expectedOwnerKey)');
  });

  it('surfaces safety support without duplicating the recommendation ledger', () => {
    expect(home).toContain('hasUnsafeAdvisorContext(advisorContext)');
    expect(home).toContain('visibleAdvisorSafety');
    expect(home).toContain('may need support beyond Advisor');
    expect(home).toContain('Find immediate and local support');
    expect(home).not.toMatch(/recordAdvisorOffered|markAdvisorStarted/);
  });

  it('preserves owner isolation and safe mood saving', () => {
    expect(home).toContain('const ownerKeyRef = useRef(ownerKey)');
    expect(home).toContain('moodOwnerKey === ownerKey ? todayMood : null');
    expect(home).toContain('ownerKeyRef.current !== expectedOwnerKey');
    expect(home).toContain('saveCheckInWithAttribution(expectedUserId, {');
  });

  it('adapts decorative art at large text sizes and labels every custom control', () => {
    expect(card).toContain('fontScale < LARGE_TEXT_SCALE');
    expect(card).toContain('accessible={false}');
    expect(card).toContain('style={styles.artwork}');
    expect(card).toContain('minHeight: 44');
    expect(card).toContain('accessibilityLabel="Open Advisor"');
    expect(home).toContain('accessibilityLabel="Add context to this check-in"');
  });
});
