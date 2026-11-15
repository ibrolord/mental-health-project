import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import manifest from '../../app/manifest';
import { TRUSTED_RESOURCES } from '../../lib/landing-content';
import { isPublicRoute } from '../../lib/navigation';

const root = resolve(__dirname, '../..');

describe('daily reset entry point', () => {
  it('is a public route so it works without the signed-in app shell', () => {
    expect(isPublicRoute('/daily-reset')).toBe(true);
  });

  it('is the browser option under the App Store badge on the home page', () => {
    const home = readFileSync(resolve(root, 'app/page.tsx'), 'utf8');
    expect(home).toContain('Burned out?');
    expect(home).toContain('No iPhone? <Link href="/daily-reset">Use it in your browser</Link>');
    expect(home).toContain('On Android, you can add it to your home screen');
  });

  it('keeps reset data local and points to crisis resources', () => {
    const flow = readFileSync(resolve(root, 'components/daily-reset/daily-reset-flow.tsx'), 'utf8');
    expect(flow).not.toMatch(/supabase\.|localStorage|sessionStorage|fetch\(/);
    expect(flow).toContain('href="/resources"');
    expect(flow).toContain('not a crisis service');
  });
});

describe('daily reset keyboard navigation', () => {
  // Source contract: the web test suite runs in node without a DOM, so this
  // pins the focus wiring rather than simulating key presses.
  const flow = readFileSync(resolve(root, 'components/daily-reset/daily-reset-flow.tsx'), 'utf8');

  it('makes the step and completion headings programmatically focusable', () => {
    expect(flow).toMatch(/id="reset-step-title"\s+ref=\{stepHeadingRef\}\s+tabIndex=\{-1\}/);
    expect(flow).toMatch(/id="reset-done-title"\s+ref=\{doneHeadingRef\}\s+tabIndex=\{-1\}/);
  });

  it('moves focus to the new heading after every step change, but not on first load', () => {
    expect(flow).toContain('const focusedStepRef = useRef(step);');
    expect(flow).toContain('if (focusedStepRef.current === step) return;');
    expect(flow).toContain('(step === 3 ? doneHeadingRef : stepHeadingRef).current?.focus();');
    expect(flow).toMatch(/\.focus\(\);\s*\}, \[step\]\);/);
  });
});

describe('web app manifest', () => {
  it('declares an installable standalone app with existing icons', () => {
    const value = manifest();
    expect(value.name).toBe('MHtoolkit');
    expect(value.short_name).toBe('MHtoolkit');
    expect(value.start_url).toBe('/');
    expect(value.display).toBe('standalone');
    const icons = value.icons ?? [];
    expect(icons.map((icon) => icon.sizes)).toEqual(['192x192', '512x512', '512x512']);
    expect(icons.some((icon) => icon.purpose === 'maskable')).toBe(true);
    for (const icon of icons) {
      expect(existsSync(resolve(root, 'public', icon.src.replace(/^\//, '')))).toBe(true);
    }
  });
});

describe('resources we trust', () => {
  it('lists partners with https links', () => {
    expect(TRUSTED_RESOURCES.length).toBeGreaterThan(0);
    for (const resource of TRUSTED_RESOURCES) {
      expect(new URL(resource.url).protocol).toBe('https:');
      expect(resource.name.trim()).not.toBe('');
    }
  });
});
