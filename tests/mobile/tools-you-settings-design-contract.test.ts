import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const root = process.cwd();

function mobileSource(relativePath: string) {
  return fs.readFileSync(path.join(root, 'mobile', relativePath), 'utf8');
}

describe('Tools, You, and Settings redesign contracts', () => {
  it('keeps one inverse grounding emphasis above flat disclosures', () => {
    const tools = mobileSource('app/(tabs)/assessments.tsx');

    expect(tools).toContain('useState(GROUPS[0].title)');
    expect(tools.match(/backgroundColor: Colors\.primary/g)).toHaveLength(1);
    expect(tools).toContain('<DisclosureCard');
    expect(tools).not.toContain('<AppCard');
  });

  it('uses quiet row groups instead of navigation cards on You', () => {
    const you = mobileSource('app/(tabs)/more.tsx');

    expect(you.match(/<RowGroup>/g)?.length).toBeGreaterThanOrEqual(3);
    expect(you).not.toContain('styles.accountCard');
    expect(you).not.toContain('Radius.');
    expect(you).toContain('loadAmbientAdvisorContext');
    expect(you).toContain('ownerKeyRef.current !== expectedOwnerKey');
    expect(you).toContain('advisorSummary?.ownerKey === ownerKey');
  });

  it('uses row groups without a decorative Settings header icon or local card stack', () => {
    const settings = mobileSource('app/settings.tsx');

    expect(settings.match(/<RowGroup>/g)?.length).toBeGreaterThanOrEqual(5);
    expect(settings).not.toContain('<AppCard');
    expect(settings).not.toContain('icon="settings"');
    expect(settings).not.toContain('<TouchableOpacity');
  });

  it('makes notification children follow the master notification state', () => {
    const settings = mobileSource('app/settings.tsx');

    expect(settings).toContain('Master control for every notification type below.');
    expect(settings).toContain('importantForAccessibility={remindersOn ?');
    expect(settings).toContain(
      'disabled={reminderBusy || !reminderHydrated || !remindersOn}'
    );
    expect(settings).toContain('!remindersOn && s.notificationChildrenDisabled');
  });
});
