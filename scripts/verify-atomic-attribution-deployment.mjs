import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env.local', quiet: true });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  console.error(
    'Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY before running this check.'
  );
  process.exit(1);
}

const supabase = createClient(url, anonKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const { error } = await supabase.rpc('save_check_in_with_attribution', {
  p_emoji: '😐',
  p_note: null,
  p_tags: [],
  p_local_date: '2026-07-19',
  p_utc_offset_minutes: 0,
  p_source: 'direct',
  p_medium: 'direct',
  p_campaign: 'seven_day_check_in',
  p_content: 'unspecified',
  p_platform: 'web',
});

if (!error) {
  console.error(
    'Atomic attribution preflight failed: the unauthenticated call unexpectedly succeeded.'
  );
  process.exit(1);
}

if (
  error.code === 'PGRST202' ||
  error.message.includes('Could not find the function')
) {
  console.error(
    'Atomic attribution preflight failed: save_check_in_with_attribution is not deployed.'
  );
  process.exit(2);
}

if (
  error.code !== '42501' ||
  !error.message.toLowerCase().includes('permission denied')
) {
  console.error(
    `Atomic attribution preflight failed with unexpected error code ${error.code ?? 'unknown'}.`
  );
  process.exit(1);
}

console.log(
  'PASS atomic attribution deployment: RPC exists and anonymous execution is denied.'
);
