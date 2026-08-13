import type { AuthChangeEvent, Session } from '@supabase/supabase-js';

export function isValidatedPasswordRecovery(
  event: AuthChangeEvent,
  session: Session | null
): session is Session {
  return event === 'PASSWORD_RECOVERY' && session !== null;
}
