import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const detailSource = readFileSync(
  resolve(process.cwd(), 'mobile/app/accountability/[commitmentId].tsx'),
  'utf8'
);

describe('native Together commitment detail', () => {
  it('shows progress for the selected commitment instead of connection-wide activity', () => {
    expect(detailSource).toContain('commitment.daysShownUp');
    expect(detailSource).not.toContain('accountabilityClient.getProgress');
    expect(detailSource).toContain('for this commitment');
  });

  it('keeps an unshared commitment note visible to its owner', () => {
    expect(detailSource).toContain('commitment.note && (commitment.isMine || commitment.notesShared)');
    expect(detailSource).toContain("commitment.notesShared ? 'Shared note' : 'Private note'");
    expect(detailSource).toContain('commitment.isMine && commitment.notesShared');
  });
});
