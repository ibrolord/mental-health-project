export interface SupabaseRuntimeConfig {
  url: string;
  anonKey: string;
  storageNamespace: string;
  isConfigured: boolean;
}

const FALLBACK_CONFIG: SupabaseRuntimeConfig = {
  url: 'https://mhtoolkit-unconfigured.invalid',
  anonKey: 'mhtoolkit-unconfigured-anon-key',
  storageNamespace: 'mhtoolkit-unconfigured',
  isConfigured: false,
};

function hashOrigin(value: string, seed: number): string {
  let hash = seed;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function createStorageNamespace(url: URL): string {
  const origin = url.origin.toLowerCase();
  const readableHost =
    url.hostname
      .toLowerCase()
      .replace(/[^a-z0-9.-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48) || 'host';
  return `${readableHost}-${hashOrigin(origin, 0x811c9dc5)}-${hashOrigin(
    origin,
    0x9e3779b9
  )}`;
}

export function resolveSupabaseConfig(
  rawUrl: string | undefined,
  rawAnonKey: string | undefined
): SupabaseRuntimeConfig {
  const url = rawUrl?.trim();
  const anonKey = rawAnonKey?.trim();
  if (!url || !anonKey || !/^https?:\/\//i.test(url)) {
    return FALLBACK_CONFIG;
  }

  try {
    const parsedUrl = new URL(url);
    if (
      !['http:', 'https:'].includes(parsedUrl.protocol) ||
      !parsedUrl.hostname
    ) {
      return FALLBACK_CONFIG;
    }

    return {
      url,
      anonKey,
      storageNamespace: createStorageNamespace(parsedUrl),
      isConfigured: true,
    };
  } catch {
    return FALLBACK_CONFIG;
  }
}
