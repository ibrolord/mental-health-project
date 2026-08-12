import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const chat = readFileSync(
  resolve(process.cwd(), 'mobile/app/(tabs)/chat.tsx'),
  'utf8'
);

describe('native chat concurrency boundaries', () => {
  it('serializes owner-bound context selection persistence', () => {
    expect(chat).toContain('contextSelectionPersistenceRef');
    expect(chat).toContain('contextSelectionGenerationRef');
    expect(chat).toContain('contextSelectionRequestRef');
    expect(chat).toContain('consentRequestRef');
    expect(chat).toContain('selectionsRef.current');
    expect(chat).toContain('ownerRef.current !== expectedOwner');
    expect(chat).toContain('Could not save your context choices.');
    expect(chat).toContain('contextSelectionGenerationRef.current !== hydrationGeneration');
  });

  it('does not mark an expanded conversation saved from a stale snapshot', () => {
    expect(chat).toContain('const saveGeneration = messageGenerationRef.current;');
    expect(chat).toContain('messageGenerationRef.current === saveGeneration');
    expect(chat).toContain('ownerRef.current === saveOwner');
    expect(chat).toContain('activeSaveOperationRef.current === saveOperation');
  });
});
