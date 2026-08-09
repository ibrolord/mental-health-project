import { describe, expect, it } from 'vitest';
import { EN_CA_MESSAGES } from '../../lib/i18n/catalogs/en-CA';
import {
  message,
  normalizeInternalLocale,
  normalizePublicLocale,
} from '../../lib/i18n/core';

describe('web localization foundation', () => {
  it('falls back to Canadian English for unsupported public locales', () => {
    expect(normalizePublicLocale('fr-CA')).toBe('en-CA');
    expect(normalizePublicLocale(null)).toBe('en-CA');
  });

  it('keeps the expansion-test locale internal and complete', () => {
    expect(normalizeInternalLocale('en-XA')).toBe('en-XA');
    for (const key of Object.keys(EN_CA_MESSAGES) as Array<keyof typeof EN_CA_MESSAGES>) {
      expect(message('en-CA', key)).toBeTruthy();
      expect(message('en-XA', key)).toMatch(/^\[!! .+ !!\]$/);
    }
  });
});
