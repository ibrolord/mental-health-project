/**
 * Which third-party sign-in providers this Supabase project actually has
 * enabled.
 *
 * Google requires an OAuth client to be created in Google Cloud and its
 * credentials pasted into the Supabase dashboard. Until that happens the
 * provider is off and `signInWithOAuth` fails. Rather than shipping a button
 * that errors, the UI asks the project at runtime and gates on the answer,
 * which also means the button starts working the moment the provider is
 * switched on, with no redeploy.
 *
 * The settings endpoint is public and safe to call with the anon key.
 */

const SETTINGS_PATH = '/auth/v1/settings';

export type EnabledProviders = {
  google: boolean;
  apple: boolean;
  email: boolean;
};

const FALLBACK: EnabledProviders = { google: false, apple: false, email: true };

let cached: Promise<EnabledProviders> | null = null;

export function getEnabledAuthProviders(): Promise<EnabledProviders> {
  if (cached) return cached;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) return Promise.resolve(FALLBACK);

  cached = fetch(`${url}${SETTINGS_PATH}`, { headers: { apikey: key } })
    .then((response) => {
      if (!response.ok) throw new Error(`settings returned ${response.status}`);
      return response.json();
    })
    .then((body) => ({
      google: body?.external?.google === true,
      apple: body?.external?.apple === true,
      email: body?.external?.email !== false,
    }))
    .catch(() => {
      // Fail closed. A network blip should hide the button, not present one
      // that throws when pressed.
      cached = null;
      return FALLBACK;
    });

  return cached;
}
