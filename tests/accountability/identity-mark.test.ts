import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const root = process.cwd();

describe('Together identity mark', () => {
  it('keeps the accessible leaf on the web entry page', () => {
    const source = fs.readFileSync(path.join(root, 'app/accountability/page.tsx'), 'utf8');

    expect(source).toContain("import { Leaf } from 'lucide-react'");
    expect(source).toContain('aria-label="Together leaf"');
    expect(source).toContain('<Leaf aria-hidden="true"');
  });

  it('keeps the accessible leaf on the iOS Together home', () => {
    const source = fs.readFileSync(path.join(root, 'mobile/app/accountability/index.tsx'), 'utf8');

    expect(source).toContain('name="leaf"');
    expect(source).toContain('accessibilityLabel="Together leaf"');
    expect(source).toContain('style={styles.leafMark}');
  });
});
