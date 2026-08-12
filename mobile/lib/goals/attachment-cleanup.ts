import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';
import { GOAL_ATTACHMENT_BUCKET } from '@/lib/goals/details';

const CLEANUP_KEY_PREFIX = 'goal_attachment_cleanup_v1';
const REMOVE_BATCH_SIZE = 100;
const cleanupTails = new Map<string, Promise<void>>();

function cleanupKey(userId: string): string {
  return `${CLEANUP_KEY_PREFIX}:${userId}`;
}

function ownedPaths(userId: string, values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  return Array.from(new Set(values.filter(
    (value): value is string =>
      typeof value === 'string' && value.startsWith(`${userId}/`)
  )));
}

async function readQueue(userId: string): Promise<string[]> {
  try {
    const stored = await AsyncStorage.getItem(cleanupKey(userId));
    return ownedPaths(userId, stored ? JSON.parse(stored) : []);
  } catch {
    return [];
  }
}

function enqueueMutation<T>(userId: string, operation: () => Promise<T>): Promise<T> {
  const previous = cleanupTails.get(userId) ?? Promise.resolve();
  const run = previous.then(operation, operation);
  cleanupTails.set(userId, run.then(() => undefined, () => undefined));
  return run;
}

async function writeQueue(userId: string, paths: string[]): Promise<void> {
  if (paths.length === 0) {
    await AsyncStorage.removeItem(cleanupKey(userId));
    return;
  }
  await AsyncStorage.setItem(cleanupKey(userId), JSON.stringify(paths));
}

export async function enqueueGoalAttachmentCleanup(
  userId: string,
  paths: string[]
): Promise<void> {
  const pending = ownedPaths(userId, paths);
  if (pending.length === 0) return;
  await enqueueMutation(userId, async () => {
    await writeQueue(userId, ownedPaths(userId, [
      ...(await readQueue(userId)),
      ...pending,
    ]));
  });
}

export async function flushGoalAttachmentCleanup(userId: string): Promise<string[]> {
  return enqueueMutation(userId, async () => {
    const pending = await readQueue(userId);
    if (pending.length === 0) return [];

    const remaining: string[] = [];
    for (let index = 0; index < pending.length; index += REMOVE_BATCH_SIZE) {
      const batch = pending.slice(index, index + REMOVE_BATCH_SIZE);
      const { error } = await supabase.storage
        .from(GOAL_ATTACHMENT_BUCKET)
        .remove(batch);
      if (error) remaining.push(...batch);
    }

    await writeQueue(userId, remaining);
    return remaining;
  });
}
