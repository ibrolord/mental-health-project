import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('shared mobile input accessibility', () => {
  it('uses the visible label as the default VoiceOver label', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'mobile/components/AppUI.tsx'),
      'utf8'
    );

    expect(source).toContain(
      'accessibilityLabel={props.accessibilityLabel ?? label}'
    );
  });

  it('provides an iOS keyboard dismissal control for multiline and numeric inputs', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'mobile/components/AppUI.tsx'),
      'utf8'
    );

    expect(source).toContain('InputAccessoryView');
    expect(source).toContain("accessibilityLabel=\"Dismiss keyboard\"");
    expect(source).toContain('onPress={Keyboard.dismiss}');
    expect(source).toMatch(/usesNumericKeyboard \|\| props\.multiline === true/);
  });
});
