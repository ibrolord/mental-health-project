import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  AFRICA_COUNTRIES,
  AFRICA_COUNTRY_LOOKUPS,
  AFRICA_SUPPORT,
  ONLINE_COMMUNITIES,
  SUPPORT_GROUPS,
} from '../../lib/resources';

describe('global support resources', () => {
  it('covers all 54 African countries with unique country links', () => {
    expect(AFRICA_COUNTRIES).toHaveLength(54);
    expect(new Set(AFRICA_COUNTRIES.map(({ name }) => name)).size).toBe(54);
    expect(new Set(AFRICA_COUNTRIES.map(({ code }) => code)).size).toBe(54);
    expect(AFRICA_COUNTRY_LOOKUPS).toHaveLength(54);
    expect(
      AFRICA_COUNTRY_LOOKUPS.every(
        ({ url }) =>
          url === 'https://findahelpline.com' ||
          /^https:\/\/findahelpline\.com\/countries\/[a-z]{2}$/.test(url)
      )
    ).toBe(true);
    expect(
      AFRICA_COUNTRY_LOOKUPS.every(({ note }) =>
        ['Country page', 'Global lookup'].includes(note ?? '')
      )
    ).toBe(true);
  });

  it('includes peer-led organizations from multiple African countries', () => {
    const regions = new Set(
      [...AFRICA_SUPPORT, ...SUPPORT_GROUPS].map(({ region }) => region)
    );
    for (const region of [
      'Nigeria',
      'Kenya',
      'South Africa',
      'Uganda',
      'Zimbabwe',
    ] as const) {
      expect(regions.has(region)).toBe(true);
    }
  });

  it('labels every online community with its important limits', () => {
    expect(ONLINE_COMMUNITIES.length).toBeGreaterThanOrEqual(4);
    for (const community of ONLINE_COMMUNITIES) {
      expect(community.caveat?.length).toBeGreaterThan(20);
      expect(community.url).toMatch(/^https:\/\//);
    }
  });

  it('explains when a country falls back to the global directory', () => {
    const finder = readFileSync(
      resolve(process.cwd(), 'components/africa-support-finder.tsx'),
      'utf8'
    );

    expect(finder).toContain('Dedicated pages open when available');
    expect(finder).toContain('global country picker');
    expect(finder).not.toContain('Each link opens a maintained country directory');
  });
});
