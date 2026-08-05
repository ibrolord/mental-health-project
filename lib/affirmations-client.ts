'use client';

import {
  normalizeLegacyAffirmations,
  quoteFallbacksForMood,
  resolveAffirmationCatalog,
  type AffirmationDisplayRecord,
} from './affirmations';
import { isQuoteStorySchemaMissingError } from './release-capabilities';
import { supabase } from './supabase/client';

const ATTRIBUTED_AFFIRMATION_COLUMNS =
  'id, content, category, kind, attribution_name, source_title, source_url';

export type AffirmationCatalogResult = {
  records: AffirmationDisplayRecord[];
  attributionSchemaReady: boolean;
};

export async function loadAffirmationCatalog(
  mood?: string | null
): Promise<AffirmationCatalogResult> {
  let attributedQuery = supabase
    .from('affirmations')
    .select(ATTRIBUTED_AFFIRMATION_COLUMNS);
  if (mood) {
    attributedQuery = attributedQuery.contains('mood_tags', [mood]);
  }

  const attributedResult = await attributedQuery;
  if (!attributedResult.error) {
    const records = (attributedResult.data ?? []).map((record) => ({
      ...record,
      historyEligible: true,
    }));
    return {
      records: resolveAffirmationCatalog(records, mood),
      attributionSchemaReady: true,
    };
  }

  if (!isQuoteStorySchemaMissingError(attributedResult.error)) {
    throw attributedResult.error;
  }

  // Keep the page usable only while the additive quote migration is rolling out.
  let legacyQuery = supabase
    .from('affirmations')
    .select('id, content, category');
  if (mood) {
    legacyQuery = legacyQuery.contains('mood_tags', [mood]);
  }

  const legacyResult = await legacyQuery;
  if (legacyResult.error) {
    throw legacyResult.error;
  }

  return {
    records: [
      ...normalizeLegacyAffirmations(legacyResult.data ?? []),
      ...quoteFallbacksForMood(mood),
    ],
    attributionSchemaReady: false,
  };
}
