import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export interface AccountabilityContext {
  db: SupabaseClient;
  userId: string;
}

export class AccountabilityAuthError extends Error {
  readonly status = 401;
}

export async function requireAccountabilityContext(
  request: Request
): Promise<AccountabilityContext> {
  const authorization = request.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ')) {
    throw new AccountabilityAuthError('Permanent account required');
  }

  const token = authorization.slice(7);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Missing Supabase configuration');

  const authClient = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await authClient.auth.getUser(token);
  if (error || !data.user || data.user.is_anonymous) {
    throw new AccountabilityAuthError('Permanent account required');
  }

  const db = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  return { db, userId: data.user.id };
}
