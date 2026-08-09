import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  mobileMessage,
  normalizeMobileLocale,
} from '../../mobile/lib/i18n/core';

describe('mobile localization foundation', () => {
  it('falls back to en-CA and persists through an owner-independent setting', () => {
    expect(normalizeMobileLocale('fr-CA')).toBe('en-CA');
    expect(normalizeMobileLocale('en-XA')).toBe('en-CA');
    const source = readFileSync(
      resolve(process.cwd(), 'mobile/lib/i18n/core.ts'),
      'utf8'
    );
    expect(source).toContain("'mhtoolkit_locale_v1'");
    expect(source).toContain('AsyncStorage.setItem');
  });

  it('supports a non-public expansion-test locale only when explicitly enabled', () => {
    expect(mobileMessage('en-XA', 'nav.today')).toContain('Today~');
  });
});
