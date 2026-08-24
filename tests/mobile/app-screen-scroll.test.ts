import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const appUi = readFileSync(
  resolve(process.cwd(), 'mobile/components/AppUI.tsx'),
  'utf8'
);

describe('AppScreen scrolling', () => {
  it('does not constrain scrollable page content to the viewport', () => {
    expect(appUi).toContain('scroll ? styles.scrollInner : styles.content');
    const scrollInner = appUi.match(/scrollInner:\s*\{([^}]*)\}/)?.[1];
    expect(scrollInner).toBeDefined();
    expect(scrollInner).not.toContain('flex:');
  });
});
