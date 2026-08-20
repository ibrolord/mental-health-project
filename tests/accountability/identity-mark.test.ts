import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const root = process.cwd();

describe('Together identity mark', () => {
  it('keeps the accessible leaf on the web entry page', () => {
    const source = fs.readFileSync(path.join(root, 'app/accountability/page.tsx'), 'utf8');

    expect(source).toContain("import { Leaf } from 'lucide-react'");
    expect(source).toContain('aria-label="Together leaf"');
    expect(source).toContain('<Leaf aria-hidden="true"');
  });

  it('keeps the accessible leaf on the iOS Together home', () => {
    const source = fs.readFileSync(path.join(root, 'mobile/app/accountability/index.tsx'), 'utf8');

    expect(source).toContain('name="leaf"');
    expect(source).toContain('accessibilityLabel="Together leaf"');
    expect(source).toContain('style={styles.leafMark}');
    expect(source).toContain("params: { returnTo: '/accountability' }");
  });

  it('keeps Together prominent on the web dashboard and onboarding', () => {
    const dashboard = fs.readFileSync(path.join(root, 'app/dashboard/page.tsx'), 'utf8');
    const onboarding = fs.readFileSync(path.join(root, 'app/onboarding/page.tsx'), 'utf8');

    expect(dashboard).toContain('Accountability partner');
    expect(dashboard).toContain('Do it together');
    expect(dashboard).toContain("router.push('/accountability')");
    expect(dashboard).toContain('<Leaf aria-hidden="true"');
    expect(onboarding).toContain('Stay accountable with someone');
    expect(onboarding).toContain("route: '/accountability'");
  });

  it('keeps Together prominent on the iOS Today screen', () => {
    const source = fs.readFileSync(path.join(root, 'mobile/app/(tabs)/index.tsx'), 'utf8');
    const layout = fs.readFileSync(path.join(root, 'mobile/lib/dashboard-layout.ts'), 'utf8');

    expect(layout).toContain("id: 'accountability', title: 'Together'");
    expect(layout).toContain('Share a commitment with someone you trust.');
    expect(layout).toMatch(/mixed:[\s\S]*?'accountability'/);
    expect(layout).toContain("href: '/accountability'");
    expect(source).toContain('<BotanicalHero style={styles.hero}>');
    expect(source).not.toContain('<LeafMark');
    expect(source).toContain("visibleModuleIds.filter((moduleId) => moduleId !== 'advisor').map");
    expect(source.indexOf('<MoodPicker')).toBeLessThan(source.indexOf('<RowGroup>'));
  });
});
