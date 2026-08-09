import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const webSaved = readFileSync(
  resolve(process.cwd(), 'app/saved/page.tsx'),
  'utf8'
);
const mobileSaved = readFileSync(
  resolve(process.cwd(), 'mobile/app/saved.tsx'),
  'utf8'
);
const productState = readFileSync(
  resolve(process.cwd(), 'lib/product-state.ts'),
  'utf8'
);
const webLibrary = readFileSync(
  resolve(process.cwd(), 'app/library/page.tsx'),
  'utf8'
);
const mobileLibrary = readFileSync(
  resolve(process.cwd(), 'mobile/app/library.tsx'),
  'utf8'
);
const webJournal = readFileSync(
  resolve(process.cwd(), 'app/journal/page.tsx'),
  'utf8'
);
const mobileJournal = readFileSync(
  resolve(process.cwd(), 'mobile/app/journal.tsx'),
  'utf8'
);

describe('Saved library and journal composition pages', () => {
  it('reads existing library saved/up-next and journal important state', () => {
    for (const source of [webSaved, mobileSaved]) {
      expect(source).toContain(".from('user_library_items')");
      expect(source).toContain(
        ".select('content_id, media_type, is_saved, priority, updated_at')"
      );
      expect(source).toContain(".from('journal_entries')");
      expect(source).toContain(
        ".select('id, is_favorite, created_at, updated_at')"
      );
      expect(source).toContain(".eq('is_favorite', true)");
    }
  });

  it('never copies Saved data or selects journal titles/private content', () => {
    for (const source of [webSaved, mobileSaved]) {
      expect(source).not.toContain('.insert(');
      expect(source).not.toContain('.upsert(');
      expect(source).not.toContain(".select('id, title");
      expect(source).not.toContain(".select('id, content");
      expect(source).not.toContain(".from('practice_progress')");
      expect(source).not.toMatch(/\bToday\b/);
    }
  });

  it('routes every saved card back to its exact source record', () => {
    expect(productState).toContain(
      'route: `/library?item=${encodeURIComponent(item.id)}`'
    );
    expect(productState).toContain(
      'route: `/journal?entry=${encodeURIComponent(row.id)}`'
    );
    expect(webLibrary).toContain(".get(\n      'item'\n    )");
    expect(mobileLibrary).toContain('params.item');
    expect(webJournal).toContain(".get('entry')");
    expect(mobileJournal).toContain('params.entry');
    expect(webLibrary).toContain('is no longer available');
    expect(mobileJournal).toContain('is no longer available');
  });

  it('applies a web library deep link once after the current owner state loads', () => {
    expect(webLibrary).toContain('const appliedRequestRef = useRef<string | null>(null)');
    expect(webLibrary).toContain('stateOwnerIdRef.current !== context.user_id');
    expect(webLibrary).toContain('if (appliedRequestRef.current === requestKey) return');
    expect(webLibrary).toContain('appliedRequestRef.current = requestKey');
  });
});
