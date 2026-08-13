import { createClient } from '@supabase/supabase-js';
import { shouldDetectAuthSessionInUrl } from '@/lib/auth/url-session-detection';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // The reset page owns its recovery fragment through an isolated client.
    detectSessionInUrl: shouldDetectAuthSessionInUrl(
      typeof window === 'undefined' ? null : window.location.pathname
    ),
  },
});
