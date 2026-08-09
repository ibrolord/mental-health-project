import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');
const today = read('mobile/app/(tabs)/index.tsx');
const tracker = read('mobile/app/(tabs)/tracker.tsx');
const library = read('mobile/app/library.tsx');
const dashboard = read('app/dashboard/page.tsx');

describe('iOS owner-isolated wellbeing screens', () => {
  it('clears Today state immediately and rejects stale owner responses', () => {
    expect(today).toContain('const ownerKeyRef = useRef(ownerKey)');
    expect(today).toContain('setTodayMood(null)');
    expect(today).toContain('setWeekMoods([])');
    expect(today).toContain('setAffirmation(\'\')');
    expect(today).toContain('ownerKeyRef.current !== expectedOwnerKey');
  });

  it('clears tracker content and editor input on every owner change', () => {
    expect(tracker).toContain('const ownerKeyRef = useRef(ownerKey)');
    expect(tracker).toContain('setMoods([])');
    expect(tracker).toContain("setNewNote('')");
    expect(tracker).toContain('setNewEmotions([])');
    expect(tracker).toContain('setCustomEmotions([])');
    expect(tracker).toContain('ownerKeyRef.current !== expectedOwnerKey');
    expect(tracker).toContain('Choose the closest fit, then save.');
  });

  it('does not expose a previous owner library note while a deep link loads', () => {
    expect(library).toContain('const [loadedOwnerId, setLoadedOwnerId]');
    expect(library).toContain('loadedOwnerId === currentOwnerId');
    expect(library).toContain(
      'const effectiveItemStates = ownerStateReady ? itemStates : EMPTY_ITEM_STATES'
    );
    expect(library).toContain('if (!ownerStateReady) return;');
    expect(library).toContain(
      "effectiveItemStates[requestedItem.id]?.custom_notes ?? ''"
    );
    expect(library).toContain(
      'const selectedForOwner = ownerStateReady ? selected : null'
    );
  });

  it('renders dashboard private state only for the owner that loaded it', () => {
    expect(dashboard).toContain('moodStateOwnerKey === moodOwnerKey');
    expect(dashboard).toContain('weeklySummaryOwnerId === user?.id');
    expect(dashboard).toContain('productStateOwnerId === user?.id');
    expect(dashboard).toContain('<WeeklyInsight summary={visibleWeeklySummary} />');
    expect(dashboard).toContain('{visibleSavedItem.title}');
    expect(dashboard).not.toContain('<WeeklyInsight summary={weeklySummary} />');
  });
});
