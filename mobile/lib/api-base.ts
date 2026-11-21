/** Canonical public site and API host for new builds. */
export const CANONICAL_SITE_URL = 'https://mhtoolkit.org';
/**
 * Same Vercel deployment as the canonical host. Older iOS builds still call it,
 * so it keeps serving; new builds only use it when the canonical host fails.
 */
export const LEGACY_API_URL = 'https://mhtoolkit.vercel.app';

const PROBE_PATH = '/manifest.webmanifest';
const PROBE_TIMEOUT_MS = 4_000;
const FAILED_PROBE_RETRY_MS = 60_000;

function normalizeApiUrl(value: string | undefined): string | null {
  const trimmed = value?.trim().replace(/\/+$/, '');
  return trimmed ? trimmed : null;
}

/** EXPO_PUBLIC_API_URL is baked in at build time and always wins. */
export const API_URL_OVERRIDE = normalizeApiUrl(process.env.EXPO_PUBLIC_API_URL);

interface ApiBaseResolverOptions {
  override: string | null;
  fetch: (input: string, init?: RequestInit) => Promise<Response>;
  now: () => number;
}

/**
 * Picks the API host once per app run. An explicit override is used as-is so
 * dev and staging builds never silently reach production. Otherwise a cheap GET
 * proves the canonical host is this deployment; if it does not, requests go to
 * the legacy host and the probe is retried later. Requests themselves are never
 * replayed on another host, so a POST cannot run twice.
 */
export function createApiBaseResolver(options: ApiBaseResolverOptions) {
  let resolved: string | null = options.override;
  let pending: Promise<string> | null = null;
  let retryAfter = 0;

  async function probeCanonical(): Promise<boolean> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
    try {
      const response = await options.fetch(`${CANONICAL_SITE_URL}${PROBE_PATH}`, {
        method: 'GET',
        headers: { Accept: 'application/manifest+json, application/json' },
        signal: controller.signal,
      });
      if (!response.ok) return false;
      // A parked or hijacked domain can still answer 200; check it is ours.
      const manifest = (await response.json()) as { name?: unknown } | null;
      return manifest?.name === 'MHtoolkit';
    } catch {
      return false;
    } finally {
      clearTimeout(timeout);
    }
  }

  return function resolveApiUrl(): Promise<string> {
    if (resolved) return Promise.resolve(resolved);
    if (options.now() < retryAfter) return Promise.resolve(LEGACY_API_URL);
    pending ??= probeCanonical().then((ok) => {
      pending = null;
      if (ok) {
        resolved = CANONICAL_SITE_URL;
        return CANONICAL_SITE_URL;
      }
      retryAfter = options.now() + FAILED_PROBE_RETRY_MS;
      return LEGACY_API_URL;
    });
    return pending;
  };
}

export const resolveApiUrl = createApiBaseResolver({
  override: API_URL_OVERRIDE,
  fetch: (input, init) => fetch(input, init),
  now: () => Date.now(),
});
