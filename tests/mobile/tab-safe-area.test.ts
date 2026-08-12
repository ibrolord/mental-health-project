import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('native tab safe areas', () => {
  it('keeps every primary tab below the iPhone sensor housing', () => {
    const layout = readFileSync(
      resolve(process.cwd(), 'mobile/app/(tabs)/_layout.tsx'),
      'utf8'
    );

    expect(layout).toContain(
      "import { SafeAreaView } from 'react-native-safe-area-context'"
    );
    expect(layout).toContain("edges={['top', 'left', 'right']}");
    expect(layout.indexOf('<SafeAreaView')).toBeLessThan(layout.indexOf('<Tabs'));
    expect(layout.indexOf('</Tabs>')).toBeLessThan(layout.indexOf('</SafeAreaView>'));
    expect(layout).not.toContain('height: 82');
    expect(layout).not.toContain('paddingBottom: 22');
  });
});
