const SETTINGS_PATH = '/auth/v1/settings';

export type EnabledProviders = {
  google: boolean;
  apple: boolean;
};

const FALLBACK: EnabledProviders = { google: false, apple: false };
const SETTINGS_TIMEOUT_MS = 5_000;
let cached: Promise<EnabledProviders> | null = null;

export function parseEnabledAuthProviders(body: unknown): EnabledProviders {
  if (typeof body !== 'object' || body === null || !('external' in body)) {
    return FALLBACK;
  }

  const external = body.external;
  if (typeof external !== 'object' || external === null) return FALLBACK;

  return {
    google: 'google' in external && external.google === true,
    apple: 'apple' in external && external.apple === true,
  };
}

export function getEnabledAuthProviders(): Promise<EnabledProviders> {
  if (cached) return cached;

  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return Promise.resolve(FALLBACK);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SETTINGS_TIMEOUT_MS);
  cached = fetch(`${url}${SETTINGS_PATH}`, {
    headers: { apikey: key },
    signal: controller.signal,
  })
    .then((response) => {
      if (!response.ok) throw new Error(`settings returned ${response.status}`);
      return response.json();
    })
    .then(parseEnabledAuthProviders)
    .catch(() => {
      cached = null;
      return FALLBACK;
    })
    .finally(() => clearTimeout(timeout));

  return cached;
}
