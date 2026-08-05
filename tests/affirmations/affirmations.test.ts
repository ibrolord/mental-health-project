import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  chooseRandomAffirmation,
  quoteFallbacksForMood,
  resolveAffirmationCatalog,
  SOURCED_QUOTE_FALLBACKS,
} from '../../lib/affirmations';

const affirmationsPage = readFileSync(
  resolve(process.cwd(), 'app/affirmations/page.tsx'),
  'utf8'
);

const affirmations = [
  { id: 'a', content: 'A' },
  { id: 'b', content: 'B' },
  { id: 'c', content: 'C' },
];

describe('random affirmation selection', () => {
  it('returns null when no affirmations are available', () => {
    expect(chooseRandomAffirmation([])).toBeNull();
  });

  it('avoids affirmations already shown today before recycling', () => {
    expect(
      chooseRandomAffirmation(affirmations, {
        excludeIds: ['a', 'b'],
        random: () => 0.99,
      })
    ).toEqual({ id: 'c', content: 'C' });
  });

  it('avoids an immediate repeat after the available set is exhausted', () => {
    expect(
      chooseRandomAffirmation(affirmations, {
        excludeIds: ['a', 'b', 'c'],
        currentId: 'b',
        random: () => 0,
      })
    ).toEqual({ id: 'a', content: 'A' });
  });

  it('deduplicates repeated records and safely bounds random values', () => {
    expect(
      chooseRandomAffirmation([...affirmations, affirmations[2]], {
        random: () => 1,
      })
    ).toEqual({ id: 'c', content: 'C' });
  });

  it('does not send free-text mood notes for AI affirmations', () => {
    expect(affirmationsPage).toContain(".select('emoji')");
    expect(affirmationsPage).not.toContain(".select('emoji, note')");
    expect(affirmationsPage).toContain('Mood notes are not sent.');
  });

  it('serializes history selection across tabs and avoids the current item', () => {
    expect(affirmationsPage).toContain('navigator.locks.request');
    expect(affirmationsPage).toContain(
      'currentId: currentAffirmationIdRef.current'
    );
  });

  it('keeps a sourced quote fallback available during additive schema rollout', () => {
    expect(SOURCED_QUOTE_FALLBACKS).toHaveLength(12);
    expect(quoteFallbacksForMood('😢').length).toBeGreaterThan(0);
    expect(quoteFallbacksForMood('😁')).toEqual(SOURCED_QUOTE_FALLBACKS);

    for (const quote of SOURCED_QUOTE_FALLBACKS) {
      expect(quote.kind).toBe('quote');
      expect(quote.attribution_name).toBeTruthy();
      expect(quote.source_url).toMatch(/^https:\/\//);
      expect(quote.historyEligible).toBe(false);
    }
  });

  it('uses sourced quotes when a valid catalog has no row for the current mood', () => {
    expect(resolveAffirmationCatalog([], '😁')).toEqual(SOURCED_QUOTE_FALLBACKS);
    expect(resolveAffirmationCatalog([SOURCED_QUOTE_FALLBACKS[0]], '😁')).toEqual([
      SOURCED_QUOTE_FALLBACKS[0],
    ]);
  });
});
