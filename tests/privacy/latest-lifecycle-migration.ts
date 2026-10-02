import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

/** Inspect the effective definition rather than a superseded migration. */
export function latestLifecycleMigration(): string {
  const directory = resolve(process.cwd(), 'supabase/migrations');
  for (const name of readdirSync(directory).filter((name) => name.endsWith('.sql')).sort().reverse()) {
    const sql = readFileSync(resolve(directory, name), 'utf8');
    if (/CREATE OR REPLACE FUNCTION public\.delete_owned_data\s*\(/i.test(sql)) {
      return sql;
    }
  }
  throw new Error('No delete_owned_data migration found');
}
