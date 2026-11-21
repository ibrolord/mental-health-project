import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  CANONICAL_SITE_URL,
  LEGACY_API_URL,
  createApiBaseResolver,
} from '../../mobile/lib/api-base';

function manifestResponse(name = 'MHtoolkit', status = 200) {
  return new Response(JSON.stringify({ name }), {
    status,
    headers: { 'Content-Type': 'application/manifest+json' },
  });
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (entry === 'node_modules' || entry === '__tests__') return [];
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(entry) ? [path] : [];
  });
}

describe('mobile API base', () => {
  it('uses mhtoolkit.org as the canonical host and keeps the legacy host as fallback only', () => {
    expect(CANONICAL_SITE_URL).toBe('https://mhtoolkit.org');
    expect(LEGACY_API_URL).toBe('https://mhtoolkit.vercel.app');
  });

  it('uses an explicit override without probing', async () => {
    const fetch = vi.fn();
    const resolve = createApiBaseResolver({
      override: 'http://localhost:3000',
      fetch,
      now: () => 0,
    });

    await expect(resolve()).resolves.toBe('http://localhost:3000');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('probes the canonical host once with a GET and then reuses it', async () => {
    const fetch = vi.fn(async (_input: string, _init?: RequestInit) => manifestResponse());
    const resolve = createApiBaseResolver({ override: null, fetch, now: () => 0 });

    const [first, second] = await Promise.all([resolve(), resolve()]);
    expect(first).toBe(CANONICAL_SITE_URL);
    expect(second).toBe(CANONICAL_SITE_URL);
    await expect(resolve()).resolves.toBe(CANONICAL_SITE_URL);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith(
      'https://mhtoolkit.org/manifest.webmanifest',
      expect.objectContaining({ method: 'GET' })
    );
    // The probe is anonymous: no token or user data leaves before the real call.
    const init = fetch.mock.calls[0][1] ?? {};
    expect(init.headers).not.toHaveProperty('Authorization');
    expect(init.body).toBeUndefined();
  });

  it.each([
    ['a network error', async () => { throw new TypeError('Network request failed'); }],
    ['a server error', async () => manifestResponse('MHtoolkit', 503)],
    ['a parked domain', async () => manifestResponse('Domain for sale')],
    ['a non-JSON page', async () => new Response('<html></html>', { status: 200 })],
  ])('falls back to the legacy host after %s and retries later', async (_label, failure) => {
    let now = 0;
    const fetch = vi.fn(failure);
    const resolve = createApiBaseResolver({ override: null, fetch, now: () => now });

    await expect(resolve()).resolves.toBe(LEGACY_API_URL);
    now = 30_000;
    await expect(resolve()).resolves.toBe(LEGACY_API_URL);
    expect(fetch).toHaveBeenCalledTimes(1);

    fetch.mockImplementation(async () => manifestResponse());
    now = 61_000;
    await expect(resolve()).resolves.toBe(CANONICAL_SITE_URL);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('keeps the legacy host out of every other mobile source file', () => {
    const offenders = ['mobile/app', 'mobile/components', 'mobile/lib']
      .flatMap(sourceFiles)
      .filter((path) => !path.endsWith(join('lib', 'api-base.ts')))
      .filter((path) => readFileSync(path, 'utf8').includes('mhtoolkit.vercel.app'));

    expect(offenders).toEqual([]);
  });

  it('routes every mobile API caller through the shared resolver', () => {
    for (const path of [
      'mobile/lib/api.ts',
      'mobile/app/voice.tsx',
      'mobile/components/JournalVoiceRecorder.tsx',
      'mobile/lib/accountability/runtime.ts',
    ]) {
      const source = readFileSync(path, 'utf8');
      expect(source, path).toContain('resolveApiUrl');
      expect(source, path).not.toContain('process.env.EXPO_PUBLIC_API_URL');
    }
  });
});
