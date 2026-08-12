import { describe, expect, it } from 'vitest';

import {
  findMigrationMismatches,
  findPendingMigrations,
  parseMigrationList,
} from '../../scripts/lib/supabase-migration-parity.mjs';

describe('Supabase migration parity guard', () => {
  it('parses aligned migration rows', () => {
    const rows = parseMigrationList(`
      Local          | Remote         | Time (UTC)
      ----------------|----------------|---------------------
      001            | 001            | 001
      20260811081540 | 20260811081540 | 2026-08-11 08:15:40
    `);

    expect(rows).toEqual([
      { local: '001', remote: '001' },
      { local: '20260811081540', remote: '20260811081540' },
    ]);
    expect(findMigrationMismatches(rows)).toEqual([]);
  });

  it('allows only newer local migrations that are pending deployment', () => {
    const rows = parseMigrationList(`
      20260811081540 | 20260811081540 | 2026-08-11 08:15:40
      20260812095352 |                | 2026-08-12 09:53:52
    `);

    expect(findMigrationMismatches(rows)).toEqual([]);
    expect(findPendingMigrations(rows)).toEqual([
      { local: '20260812095352', remote: null },
    ]);
  });

  it('rejects remote-only history and local insertions before production head', () => {
    const rows = parseMigrationList(`
      20260810213203 |                | 2026-08-10 21:32:03
                       | 20260811070000 | 2026-08-11 07:00:00
      20260811081540 | 20260811081540 | 2026-08-11 08:15:40
    `);

    expect(findMigrationMismatches(rows)).toEqual([
      { local: '20260810213203', remote: null },
      { local: null, remote: '20260811070000' },
    ]);
    expect(findPendingMigrations(rows)).toEqual([]);
  });

  it('does not treat an unlinked local-only history as safe pending work', () => {
    const rows = parseMigrationList(`
      20260812095352 |                | 2026-08-12 09:53:52
    `);

    expect(findMigrationMismatches(rows)).toEqual([
      { local: '20260812095352', remote: null },
    ]);
    expect(findPendingMigrations(rows)).toEqual([]);
  });
});
