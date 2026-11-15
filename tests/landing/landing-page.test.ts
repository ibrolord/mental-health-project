import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  APP_SCREENS,
  APP_STORE_BADGE,
  APP_STORE_URL,
  SOURCE_REPOSITORY,
} from '../../lib/landing-content';

const root = resolve(__dirname, '../..');
// Source contract: the web suite runs in node without a DOM, so these pin the
// landing page markup rather than rendering it.
const home = readFileSync(resolve(root, 'app/page.tsx'), 'utf8');
const css = readFileSync(resolve(root, 'app/landing.module.css'), 'utf8');

describe('landing page: iPhone app hero', () => {
  it('links the official App Store badge to the MHtoolkit listing', () => {
    expect(APP_STORE_URL).toBe('https://apps.apple.com/ca/app/mhtoolkit/id6760159800');
    expect(home).toContain('<a href={APP_STORE_URL} className={styles.badgeLink}>');
    expect(home).toContain('alt="Download on the App Store"');
    expect(APP_STORE_BADGE.src).toBe('/badges/download-on-the-app-store.svg');
  });

  it('ships Apple badge artwork as a real SVG at or above the 40px minimum height', () => {
    const svg = readFileSync(resolve(root, 'public', APP_STORE_BADGE.src.slice(1)), 'utf8');
    expect(svg.trimStart().startsWith('<svg')).toBe(true);
    expect(svg).toContain('viewBox="0 0 119.66407 40"');
    const match = home.match(/const height = size === 'large' \? (\d+) : (\d+);/);
    expect(match).not.toBeNull();
    for (const h of [Number(match![1]), Number(match![2])]) expect(h).toBeGreaterThanOrEqual(40);
    expect(home).toContain('width={width} height={height}');
    // CSS must not override the HTML size (e.g. width:auto would drop it back to the intrinsic 40px).
    const badgeRule = css.match(/\n\.badge \{([^}]*)\}/);
    expect(badgeRule).not.toBeNull();
    expect(badgeRule![1]).not.toMatch(/(^|[;\s])width\s*:/);
  });

  it('does not animate, rotate or filter the badge', () => {
    const badgeRules = css.split('\n').filter(line => /\.badge(Link)?\b/.test(line));
    expect(badgeRules.length).toBeGreaterThan(0);
    for (const rule of badgeRules) expect(rule).not.toMatch(/animation|transform|filter|opacity|transition/);
    expect(css).not.toMatch(/\.heroCopy\s*\{[^}]*animation/);
  });

  it('offers the browser as the secondary option', () => {
    expect(home).toContain('No iPhone? <Link href="/daily-reset">Use it in your browser</Link>');
  });

  it('says plainly that it is open source and not for profit, with a GitHub link', () => {
    expect(SOURCE_REPOSITORY).toBe('https://github.com/ibrolord/mental-health-project');
    expect(home).toContain('Free and open source. No ads, no subscriptions, and nobody makes money from it.');
    expect(home).toContain('<a href={SOURCE_REPOSITORY}>See the code on GitHub</a>');
    expect(home).toContain('AGPL-3.0');
    expect(home).not.toMatch(/registered charity|non-?profit organi[sz]ation|nonprofit company/i);
  });

  it('shows real app screenshots, with the Today screen first and prioritised', () => {
    expect(APP_SCREENS[0].id).toBe('today');
    for (const screen of APP_SCREENS) {
      expect(existsSync(resolve(root, 'public', screen.src.slice(1)))).toBe(true);
      expect(screen.alt.length).toBeGreaterThan(20);
    }
    expect(home).toMatch(/src=\{APP_SCREENS\[0\]\.src\}[^\n]*priority/);
  });

  it('makes the horizontally scrolling screenshot gallery keyboard-focusable and labelled', () => {
    expect(home).toContain('<h2 id="screens-title">');
    expect(home).toContain('<ul className={styles.screenList} tabIndex={0} aria-labelledby="screens-title">');
    expect(css).toMatch(/\.screenList:focus-visible\s*\{[^}]*outline:\s*3px solid/);
  });

  it('keeps crisis help and trusted resources reachable', () => {
    expect(home).toContain('<Link href="/resources">find local support</Link>');
    expect(home).toContain('<Link href="/resources">Find urgent support</Link>');
    expect(home).toContain('TRUSTED_RESOURCES.map');
  });
});
