import {
  normalizeLegacyAffirmations,
  quoteFallbacksForMood,
  type AffirmationDisplayRecord,
} from '@/lib/affirmations';
import { isQuoteStorySchemaMissingError } from '@/lib/release-capabilities';
import { supabase } from '@/lib/supabase';

const ATTRIBUTED_COLUMNS =
  'id, content, category, kind, attribution_name, source_title, source_url';

export type AffirmationCatalogResult = {
  records: AffirmationDisplayRecord[];
  attributionSchemaReady: boolean;
};

export async function loadAffirmationCatalog(
  mood?: string | null
): Promise<AffirmationCatalogResult> {
  let query = supabase.from('affirmations').select(ATTRIBUTED_COLUMNS);
  if (mood) query = query.contains('mood_tags', [mood]);
  const attributed = await query;
  if (!attributed.error) {
    return {
      records: (attributed.data ?? []).map((record) => ({
        ...record,
        kind: record.kind as 'affirmation' | 'quote',
        historyEligible: true,
      })),
      attributionSchemaReady: true,
    };
  }
  if (!isQuoteStorySchemaMissingError(attributed.error)) {
    throw attributed.error;
  }

  let legacyQuery = supabase
    .from('affirmations')
    .select('id, content, category');
  if (mood) legacyQuery = legacyQuery.contains('mood_tags', [mood]);
  const legacy = await legacyQuery;
  if (legacy.error) throw legacy.error;
  return {
    records: [
      ...normalizeLegacyAffirmations(legacy.data ?? []),
      ...quoteFallbacksForMood(mood),
    ],
    attributionSchemaReady: false,
  };
}
