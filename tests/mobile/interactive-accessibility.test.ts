import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function mobileSource(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

describe('interactive mobile accessibility', () => {
  it('labels journal editing, search, and row actions', () => {
    const source = mobileSource('mobile/app/journal.tsx');

    for (const label of [
      'New journal entry',
      'Journal title',
      'Journal notes',
      'Journal tags',
      'Search journal entries',
      'Dismiss journal keyboard',
    ]) {
      expect(source).toContain(`accessibilityLabel=\"${label}\"`);
    }
    expect(source).toContain('accessibilityLabel={`Edit ${entry.title}`}');
    expect(source).toContain('accessibilityLabel={`Delete ${entry.title}`}');
  });

  it('distinguishes previous-step controls from route navigation', () => {
    expect(mobileSource('mobile/app/reflect.tsx')).toContain(
      'accessibilityLabel="Previous reflection step"'
    );
    expect(mobileSource('mobile/app/assessments/[type].tsx')).toContain(
      'accessibilityLabel="Previous assessment question"'
    );
  });

  it('labels notification enablement and each reminder-time option', () => {
    const source = mobileSource('mobile/app/settings.tsx');

    expect(source).toContain('accessibilityLabel="Daily reminders"');
    expect(source).toContain('accessibilityLabel={`Reminder time ${opt.label}`}');
    expect(source).toContain('accessibilityState={{ selected }}');
  });
});
