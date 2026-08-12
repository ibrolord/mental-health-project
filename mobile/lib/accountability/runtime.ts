import { API_URL } from '@/lib/constants';
import { supabase } from '@/lib/supabase';
import { createAccountabilityClient } from './client';

export const accountabilityClient = createAccountabilityClient({
  baseUrl: API_URL,
  getAccessToken: async () => {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    if (!data.session || data.session.user.is_anonymous) return null;
    return data.session.access_token;
  },
  fetch: (input, init) => fetch(input, init),
  now: () => Date.now(),
});
