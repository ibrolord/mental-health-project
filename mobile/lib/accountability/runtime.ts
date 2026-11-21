import { resolveApiUrl } from '@/lib/api-base';
import { supabase } from '@/lib/supabase';
import { createAccountabilityClient } from './client';

export const accountabilityClient = createAccountabilityClient({
  // The host is resolved per request in fetch below; paths arrive relative.
  baseUrl: '',
  getAccessToken: async () => {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    if (!data.session || data.session.user.is_anonymous) return null;
    return data.session.access_token;
  },
  fetch: async (input, init) => fetch(`${await resolveApiUrl()}${input}`, init),
  now: () => Date.now(),
});
