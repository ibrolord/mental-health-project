import { spawnSync } from 'node:child_process';
import {
  findMigrationMismatches,
  findPendingMigrations,
  parseMigrationList,
} from './lib/supabase-migration-parity.mjs';

const result = spawnSync('npx', ['supabase', 'migration', 'list'], {
  cwd: process.cwd(),
  encoding: 'utf8',
});

const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
if (result.status !== 0) {
  process.stderr.write(output);
  process.exit(result.status ?? 1);
}

const rows = parseMigrationList(output);
if (rows.length === 0) {
  process.stderr.write('Could not parse any Supabase migration rows.\n');
  process.exit(1);
}

const mismatches = findMigrationMismatches(rows);
if (mismatches.length > 0) {
  process.stderr.write('Supabase migration history is out of sync:\n');
  for (const row of mismatches) {
    process.stderr.write(`  local=${row.local ?? '-'} remote=${row.remote ?? '-'}\n`);
  }
  process.exit(1);
}

const pending = findPendingMigrations(rows);
const matched = rows.filter((row) => row.local === row.remote).length;
const pendingMessage = pending.length > 0
  ? `; ${pending.length} newer local migration${pending.length === 1 ? '' : 's'} pending deployment`
  : '';
console.log(`PASS Supabase migration parity: ${matched} versions match production${pendingMessage}.`);
