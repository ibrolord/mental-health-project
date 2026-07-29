import { describe, expect, it } from 'vitest';
import {
  canPersistLibraryMedia,
  isQuoteStorySchemaMissingError,
} from '../../lib/release-capabilities';

describe('quote and story release capabilities', () => {
  it('falls back only for recognized missing-schema errors', () => {
    expect(isQuoteStorySchemaMissingError({ code: '42703' })).toBe(true);
    expect(isQuoteStorySchemaMissingError({ code: 'PGRST204' })).toBe(true);
    expect(
      isQuoteStorySchemaMissingError({
        message: "Could not find the 'kind' column in the schema cache",
      })
    ).toBe(true);
    expect(isQuoteStorySchemaMissingError({ code: '42501' })).toBe(false);
    expect(isQuoteStorySchemaMissingError({ message: 'Network unavailable' })).toBe(
      false
    );
  });

  it('fails closed for story persistence until the migration is visible', () => {
    expect(canPersistLibraryMedia('book', null)).toBe(true);
    expect(canPersistLibraryMedia('video', false)).toBe(true);
    expect(canPersistLibraryMedia('story', null)).toBe(false);
    expect(canPersistLibraryMedia('story', false)).toBe(false);
    expect(canPersistLibraryMedia('story', true)).toBe(true);
  });
});
