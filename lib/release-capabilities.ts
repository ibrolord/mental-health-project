import type { LibraryMediaType } from './library/content';

type SupabaseLikeError = {
  code?: string | null;
  message?: string | null;
};

const MISSING_SCHEMA_CODES = new Set(['42703', 'PGRST204']);

export function isQuoteStorySchemaMissingError(
  error: SupabaseLikeError | null | undefined
): boolean {
  if (!error) return false;
  if (error.code && MISSING_SCHEMA_CODES.has(error.code)) return true;

  const message = error.message?.toLocaleLowerCase() ?? '';
  return (
    message.includes('kind') &&
    (message.includes('does not exist') || message.includes('schema cache'))
  );
}

export function canPersistLibraryMedia(
  mediaType: LibraryMediaType,
  quoteStorySchemaReady: boolean | null
): boolean {
  return mediaType !== 'story' || quoteStorySchemaReady === true;
}
