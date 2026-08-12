export function parseMigrationList(output) {
  return output
    .split(/\r?\n/)
    .map((line) => line.match(/^\s*(\d+)?\s*\|\s*(\d+)?\s*\|/))
    .filter(Boolean)
    .map((match) => ({
      local: match[1] ?? null,
      remote: match[2] ?? null,
    }))
    .filter((row) => row.local || row.remote);
}

export function findMigrationMismatches(rows) {
  const remoteVersions = rows
    .map((row) => row.remote)
    .filter(Boolean);
  const latestRemote = remoteVersions.length > 0
    ? remoteVersions.reduce((latest, version) => version > latest ? version : latest)
    : null;

  return rows.filter((row) => {
    if (row.local === row.remote) return false;
    if (!row.remote && row.local && latestRemote && row.local > latestRemote) {
      return false;
    }
    return true;
  });
}

export function findPendingMigrations(rows) {
  const remoteVersions = rows
    .map((row) => row.remote)
    .filter(Boolean);
  if (remoteVersions.length === 0) return [];

  const latestRemote = remoteVersions.reduce(
    (latest, version) => version > latest ? version : latest
  );
  return rows.filter(
    (row) => row.local && !row.remote && row.local > latestRemote
  );
}
