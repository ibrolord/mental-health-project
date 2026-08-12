export type MigrationParityRow = {
  local: string | null;
  remote: string | null;
};

export function parseMigrationList(output: string): MigrationParityRow[];

export function findMigrationMismatches(
  rows: MigrationParityRow[]
): MigrationParityRow[];

export function findPendingMigrations(
  rows: MigrationParityRow[]
): MigrationParityRow[];
