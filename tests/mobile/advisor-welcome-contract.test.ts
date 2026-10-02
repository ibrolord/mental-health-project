import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (file: string) => readFileSync(path.resolve(process.cwd(), file), 'utf8');
const welcome = read('mobile/components/AdvisorWelcome.tsx');
const setup = read('mobile/app/advisor-setup.tsx');

describe('Guided Start screen contracts', () => {
  it('keeps optional setup escapable without a loaded profile or successful save', () => {
    expect(setup).not.toContain('{ready ? <AdvisorWelcome');
    expect(setup).toContain('onSkip={skipWelcome}');
    const skip = setup.slice(setup.indexOf('const skipWelcome ='), setup.indexOf('if (welcome) return'));
    expect(skip).not.toContain('await');
    expect(skip).toContain('router.dismissTo(destination)');
    const exitButton = welcome.slice(welcome.indexOf('<AppButton label={busy ?'), welcome.indexOf('</View>', welcome.indexOf('<AppButton label={busy ?')));
    expect(exitButton).toContain('onSkip()');
    expect(exitButton).not.toContain('disabled=');
    expect(exitButton).not.toContain('loading=');
  });

  it('keeps name optional and collapsed, with no keyboard or permission prompts on mount', () => {
    expect(welcome).toContain('useState(false)');
    expect(welcome).toContain('{nameExpanded ? <AppInput');
    expect(welcome).toContain('returnKeyType="done"');
    expect(welcome).not.toMatch(/autoFocus|requestPermissions|ensureAiDataSharingConsent/);
    expect(welcome).toContain('Continue without saving');
  });

  it('makes choice, preview, and accessibility state explicit', () => {
    expect(welcome).toContain('accessibilityRole="radio"');
    expect(welcome).toContain('checked: focus === option.id');
    expect(welcome).toContain("Platform.OS === 'ios'");
    expect(welcome).toContain('AccessibilityInfo.announceForAccessibility');
    expect(welcome).toContain('selected?.consequence');
    expect(welcome).toContain('selected?.action');
    expect(welcome).toContain('styles.stackedBrandRow');
    expect(welcome).toContain('fontScale >= LARGE_TEXT_SCALE && styles.stackedNameCopy');
    expect(welcome).toContain('fontScale >= LARGE_TEXT_SCALE && styles.stackedNameLabel');
    expect(welcome).toContain('fontScale < LARGE_TEXT_SCALE');
  });
});
