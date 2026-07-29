import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const dashboardPage = readFileSync(
  resolve(process.cwd(), 'app/dashboard/page.tsx'),
  'utf8'
);
const libraryPage = readFileSync(
  resolve(process.cwd(), 'app/library/page.tsx'),
  'utf8'
);
const mobileJournalPage = readFileSync(
  resolve(process.cwd(), 'mobile/app/journal.tsx'),
  'utf8'
);

describe('owner-scoped dashboard and journal UI state', () => {
  it('clears mood state and rejects stale owner load or save completions', () => {
    expect(dashboardPage).toContain('setTodayMood(null)');
    expect(dashboardPage).toContain('setWeekMoods([])');
    expect(dashboardPage).toContain(
      'currentMoodOwnerKeyRef.current !== ownerKey'
    );
    expect(dashboardPage).toContain(
      'moodLoadRevisionRef.current !== loadRevision'
    );
    expect(dashboardPage).toContain(
      'const ownerRevision = moodLoadRevisionRef.current'
    );
    expect(dashboardPage).toContain(
      'moodLoadRevisionRef.current === ownerRevision'
    );
  });

  it('uses owner generations to reject A-to-B-to-A mutation completions', () => {
    expect(libraryPage).toContain('const ownerGenerationRef = useRef(0)');
    expect(libraryPage).toContain(
      'const ownerGeneration = ++ownerGenerationRef.current'
    );
    expect(libraryPage).toContain(
      'ownerGenerationRef.current === ownerGeneration'
    );
    expect(mobileJournalPage).toContain(
      'const ownerGenerationRef = useRef(0)'
    );
    expect(mobileJournalPage).toContain('ownerGenerationRef.current += 1');
    expect(mobileJournalPage).toContain(
      'ownerGenerationRef.current !== ownerGeneration'
    );
  });

  it('labels linked mobile journal entries from their real media type', () => {
    expect(mobileJournalPage).toContain(
      "entry.linked_media_type === 'video'"
    );
    expect(mobileJournalPage).toContain(
      "entry.linked_media_type === 'story'"
    );
    expect(mobileJournalPage).toContain('{libraryEntryLabel(entry)}:');
    expect(mobileJournalPage).not.toContain('📖');
  });
});
