import { getSupabaseAdmin } from '@/lib/supabase/server';
import { GOAL_ATTACHMENT_BUCKET } from '@/lib/goals/details';

const STORAGE_PAGE_SIZE = 1000;

async function listStorageEntries(prefix: string) {
  const supabaseAdmin = getSupabaseAdmin();
  const entries: Array<{ id: string | null; name: string }> = [];
  for (let offset = 0; ; offset += STORAGE_PAGE_SIZE) {
    const { data, error } = await supabaseAdmin.storage
      .from(GOAL_ATTACHMENT_BUCKET)
      .list(prefix, {
        limit: STORAGE_PAGE_SIZE,
        offset,
        sortBy: { column: 'name', order: 'asc' },
      });
    if (error) return { entries: [], error: error.message };
    const page = (data ?? []).map(({ id, name }) => ({ id, name }));
    entries.push(...page);
    if (page.length < STORAGE_PAGE_SIZE) break;
  }
  return { entries, error: null };
}

export async function removeGoalAttachmentObjectsForUser(
  userId: string
): Promise<{ error: string | null }> {
  const supabaseAdmin = getSupabaseAdmin();
  const paths = new Set<string>();
  for (let from = 0; ; from += STORAGE_PAGE_SIZE) {
    const { data, error } = await supabaseAdmin
      .from('goal_attachments')
      .select('storage_path')
      .eq('user_id', userId)
      .order('storage_path', { ascending: true })
      .range(from, from + STORAGE_PAGE_SIZE - 1);
    if (error) return { error: error.message };
    for (const row of data ?? []) paths.add(row.storage_path);
    if ((data ?? []).length < STORAGE_PAGE_SIZE) break;
  }

  const prefixes = [userId];
  while (prefixes.length > 0) {
    const prefix = prefixes.shift()!;
    const result = await listStorageEntries(prefix);
    if (result.error) return { error: result.error };
    for (const entry of result.entries) {
      const path = `${prefix}/${entry.name}`;
      if (entry.id) paths.add(path);
      else prefixes.push(path);
    }
  }

  const allPaths = [...paths];
  for (let index = 0; index < allPaths.length; index += STORAGE_PAGE_SIZE) {
    const { error: storageError } = await supabaseAdmin.storage
      .from(GOAL_ATTACHMENT_BUCKET)
      .remove(allPaths.slice(index, index + STORAGE_PAGE_SIZE));
    if (storageError) return { error: storageError.message };
  }
  return { error: null };
}
