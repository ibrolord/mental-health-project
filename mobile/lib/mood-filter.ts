interface TaggedEntry {
  tags: string[];
}

export function collectMoodTags(entries: TaggedEntry[]): string[] {
  return [...new Set(entries.flatMap((entry) => entry.tags))];
}

export function filterMoodEntriesByTag<T extends TaggedEntry>(
  entries: T[],
  tag: string | null
): T[] {
  if (!tag) return entries;
  return entries.filter((entry) => entry.tags.includes(tag));
}
