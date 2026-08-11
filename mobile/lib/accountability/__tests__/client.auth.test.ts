import { describe, expect, it } from 'vitest';

import { createAccountabilityClient } from '../client';
import { AccountabilityAuthError } from '../errors';
import { createHarness, makeToken, NOW_MS } from './helpers';

/**
 * CRITICAL — auth-required behaviour.
 *
 * Every accountability call is authenticated. There is no anonymous path: the
 * X-Session-Id fallback in lib/api/auth.ts is legacy and must NOT be used for
 * accountability, because accountability data is shared between two humans and
 * an unauthenticated session cannot be attributed to an owner.
 */
describe('createAccountabilityClient auth', () => {
  it('sends the bearer token on an authenticated request', async () => {
    const harness = createHarness({ token: makeToken({ sub: 'owner-1' }) });
    const client = createAccountabilityClient(harness.deps as never);

    await client.listConnections();

    expect(harness.calls[0].headers.Authorization).toBe(
      `Bearer ${makeToken({ sub: 'owner-1' })}`
    );
  });

  it('sends a JSON content type on write requests', async () => {
    const harness = createHarness();
    const client = createAccountabilityClient(harness.deps as never);

    await client.createConnection({ inviteeEmail: 'p@example.com' });

    expect(harness.calls[0].headers['Content-Type']).toBe('application/json');
  });

  it('never sends the legacy X-Session-Id anonymous header', async () => {
    const harness = createHarness();
    const client = createAccountabilityClient(harness.deps as never);

    await client.listConnections();

    expect(Object.keys(harness.calls[0].headers).map((k) => k.toLowerCase())).not.toContain(
      'x-session-id'
    );
  });

  it('throws AccountabilityAuthError when there is no session token', async () => {
    const harness = createHarness({ token: null });
    const client = createAccountabilityClient(harness.deps as never);

    await expect(client.listConnections()).rejects.toThrow(AccountabilityAuthError);
  });

  it('does not call fetch when there is no session token', async () => {
    const harness = createHarness({ token: null });
    const client = createAccountabilityClient(harness.deps as never);

    await client.listConnections().catch(() => undefined);

    expect(harness.calls).toHaveLength(0);
  });

  it('throws AccountabilityAuthError when the token is malformed', async () => {
    const harness = createHarness({ token: 'not-a-jwt' });
    const client = createAccountabilityClient(harness.deps as never);

    await expect(client.listConnections()).rejects.toThrow(AccountabilityAuthError);
  });

  it('does not call fetch when the token is malformed', async () => {
    const harness = createHarness({ token: 'not-a-jwt' });
    const client = createAccountabilityClient(harness.deps as never);

    await client.listConnections().catch(() => undefined);

    expect(harness.calls).toHaveLength(0);
  });

  it('does not call fetch when the token is already expired', async () => {
    const harness = createHarness({
      token: makeToken({ exp: Math.floor(NOW_MS / 1000) - 60 }),
    });
    const client = createAccountabilityClient(harness.deps as never);

    await client.listConnections().catch(() => undefined);

    expect(harness.calls).toHaveLength(0);
  });

  it('throws AccountabilityAuthError when the token is already expired', async () => {
    const harness = createHarness({
      token: makeToken({ exp: Math.floor(NOW_MS / 1000) - 60 }),
    });
    const client = createAccountabilityClient(harness.deps as never);

    await expect(client.listConnections()).rejects.toThrow(AccountabilityAuthError);
  });

  it('still sends a token expiring in the next second (no premature client-side rejection)', async () => {
    const harness = createHarness({
      token: makeToken({ exp: Math.floor(NOW_MS / 1000) + 1 }),
    });
    const client = createAccountabilityClient(harness.deps as never);

    await client.listConnections();

    expect(harness.calls).toHaveLength(1);
  });

  it('surfaces a user-safe message when the session is missing', async () => {
    const harness = createHarness({ token: null });
    const client = createAccountabilityClient(harness.deps as never);

    await expect(client.listConnections()).rejects.toThrow(/sign in/i);
  });

  it('never includes the access token in an auth error message', async () => {
    const token = 'not-a-jwt-but-secret-material';
    const harness = createHarness({ token });
    const client = createAccountabilityClient(harness.deps as never);

    const error: unknown = await client.listConnections().then(() => null, (cause: unknown) => cause);

    expect(error).toBeInstanceOf(Error);
    if (!(error instanceof Error)) throw new Error('Expected an authentication error');
    expect(error.message.includes(token)).toBe(false);
  });

  it('re-reads the token on every call rather than caching it', async () => {
    const tokens = [makeToken({ sub: 'a' }), makeToken({ sub: 'b' })];
    let index = 0;
    const harness = createHarness();
    const client = createAccountabilityClient({
      ...(harness.deps as Record<string, unknown>),
      getAccessToken: async () => tokens[index++],
    } as never);

    await client.listConnections();
    await client.listConnections();

    expect(harness.calls[1].headers.Authorization).toBe(`Bearer ${tokens[1]}`);
  });
});
