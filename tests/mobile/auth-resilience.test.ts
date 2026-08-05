import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { resolveSupabaseConfig } from '../../mobile/lib/supabase-config';

const read = (path: string) =>
  readFileSync(resolve(process.cwd(), path), 'utf8');

const authContext = read('mobile/lib/auth-context.tsx');
const loginScreen = read('mobile/app/auth/login.tsx');

describe('mobile authentication resilience', () => {
  it('blocks the app and offers a retry when profile initialization fails', () => {
    expect(authContext).toContain('AUTH_INIT_ERROR_MESSAGE');
    expect(authContext).toContain("if (initializationError || !user)");
    expect(authContext).toContain('Unable to start securely');
    expect(authContext).toContain('setAuthAttempt((attempt) => attempt + 1)');
    expect(authContext).toContain('Try authentication again');
    expect(authContext).toContain('createAnonymousSessionManager');
    expect(authContext).toContain('anonymousSessionManager.ensureSession()');
  });

  it('lets a user inspect or hide the password they entered', () => {
    expect(loginScreen).toContain('secureTextEntry={!showPassword}');
    expect(loginScreen).toContain("showPassword ? 'Hide password' : 'Show password'");
    expect(loginScreen).toContain("name={showPassword ? 'eye-off' : 'eye'}");
  });

  it.each([
    [undefined, undefined],
    ['', ''],
    ['not a URL', 'key'],
    ['ftp://project.supabase.co', 'key'],
    ['https:project.supabase.co', 'key'],
  ])('does not configure a crashing Supabase client for %s', (url, key) => {
    expect(resolveSupabaseConfig(url, key)).toEqual({
      url: 'https://mhtoolkit-unconfigured.invalid',
      anonKey: 'mhtoolkit-unconfigured-anon-key',
      storageNamespace: 'mhtoolkit-unconfigured',
      isConfigured: false,
    });
  });

  it('preserves a valid configured Supabase endpoint', () => {
    const config = resolveSupabaseConfig(
      ' https://project.supabase.co ',
      ' anon-key '
    );
    expect(config).toMatchObject({
      url: 'https://project.supabase.co',
      anonKey: 'anon-key',
      isConfigured: true,
    });
    expect(config.storageNamespace).toMatch(/^[a-z0-9._-]+$/);
  });

  it('creates safe distinct storage namespaces from the complete origin', () => {
    const ipv6 = resolveSupabaseConfig('http://[::1]:54321', 'key');
    const firstCustomDomain = resolveSupabaseConfig(
      'https://app.example.com',
      'key'
    );
    const secondCustomDomain = resolveSupabaseConfig(
      'https://app.example.net',
      'key'
    );

    expect(ipv6.isConfigured).toBe(true);
    expect(ipv6.storageNamespace).toMatch(/^[a-z0-9._-]+$/);
    expect(firstCustomDomain.storageNamespace).not.toBe(
      secondCustomDomain.storageNamespace
    );
  });
});
