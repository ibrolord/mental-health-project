import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const root = process.cwd();

function mobileSource(relativePath: string) {
  return fs.readFileSync(path.join(root, 'mobile', relativePath), 'utf8');
}

describe('iOS calm utility design contract', () => {
  it('keeps all tool collections collapsed until the user opens one', () => {
    const source = mobileSource('app/(tabs)/assessments.tsx');

    expect(source).toContain("useState('')");
    expect(source).toContain('Three focused collections');
  });

  it('uses an adaptive mood layout without capping Dynamic Type', () => {
    const source = mobileSource('components/MoodPicker.tsx');

    expect(source).toContain('fontScale >= 1.35');
    expect(source).toContain('styles.rowWrapped');
    expect(source).not.toContain('maxFontSizeMultiplier');
    expect(source).toContain('allowFontScaling={false}');
  });

  it('keeps navigation and header actions usable at accessibility text sizes', () => {
    const tabs = mobileSource('app/(tabs)/_layout.tsx');
    const appUi = mobileSource('components/AppUI.tsx');

    expect(tabs).toContain('tabBarShowLabel: !hidesTabLabels');
    expect(appUi).toContain('styles.headerTopStacked');
  });

  it('does not describe provider-processed AI chat as a private conversation', () => {
    const source = mobileSource('app/(tabs)/chat.tsx');

    expect(source).toContain('AI-GUIDED CONVERSATION');
    expect(source).not.toContain('A PRIVATE CONVERSATION');
  });

  it('consolidates partner features under one Together entry', () => {
    const source = mobileSource('app/(tabs)/more.tsx');
    const togetherIndex = source.indexOf('title="Together & sharing"');

    expect(togetherIndex).toBeGreaterThan(-1);
    expect(source).not.toContain('title="Partner sharing"');
    expect(mobileSource('app/accountability/index.tsx')).toContain("router.push('/partner')");
  });

  it('binds Together privacy controls to an explicitly selected partner', () => {
    const source = mobileSource('app/accountability/index.tsx');

    expect(source).toContain("const [scopes, setScopes] = useState<Record<string, ScopeControl>>({})");
    expect(source).toContain("const [selectedConnectionId, setSelectedConnectionId] = useState('')");
    expect(source).toContain('scopes[selectedConnectionId]');
    expect(source).toContain('commitment.connectionId === selectedConnectionId');
    expect(source).toContain('nudge.connectionId === selectedConnectionId');
  });
});
