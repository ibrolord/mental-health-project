import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { goBackOrReplace } from '../../mobile/lib/navigation';

const rootLayout = readFileSync(
  resolve(process.cwd(), 'mobile/app/_layout.tsx'),
  'utf8'
);
const checklist = JSON.parse(
  readFileSync(
    resolve(process.cwd(), 'mobile/qa/ios-release-checklist.json'),
    'utf8'
  )
) as {
  routes: Array<{ source: string }>;
};

describe('mobile back navigation', () => {
  it('pops the current screen when navigation history exists', () => {
    const router = {
      back: vi.fn(),
      canGoBack: vi.fn(() => true),
      replace: vi.fn(),
    };

    goBackOrReplace(router, '/(tabs)');

    expect(router.back).toHaveBeenCalledOnce();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('uses the fallback when a screen was opened without navigation history', () => {
    const router = {
      back: vi.fn(),
      canGoBack: vi.fn(() => false),
      replace: vi.fn(),
    };

    goBackOrReplace(router, '/(tabs)/assessments');

    expect(router.back).not.toHaveBeenCalled();
    expect(router.replace).toHaveBeenCalledWith('/(tabs)/assessments');
  });

  it('registers every non-tab route with the shared Back header', () => {
    const stackRoutes = checklist.routes
      .map(({ source }) => source)
      .filter((source) => !source.startsWith('app/(tabs)/'))
      .map((source) => source.replace(/^app\//, '').replace(/\.tsx$/, ''));

    expect(rootLayout).toContain('headerLeft: () => <AppBackButton fallback={fallback} />');
    for (const route of stackRoutes) {
      expect(rootLayout, `${route} must use the shared Back header`).toContain(
        `<Stack.Screen name="${route}" options={stackScreenOptions(`
      );
    }
  });
});
