import { describe, expect, it } from 'vitest';

import { createAccountabilityClient } from '../client';
import { AccountabilityApiError, AccountabilityAuthError } from '../errors';
import { createHarness } from './helpers';

/**
 * CRITICAL — response envelope handling and API error translation.
 *
 * PROPOSED ENVELOPE (no existing route defines one; app/api routes return
 * ad-hoc shapes like `{ deleted: true }` / `{ error: '...' }`):
 *   success -> { data: T }
 *   failure -> { error: string }
 *
 * Server error text is never shown to the user verbatim. It is translated to a
 * fixed user-safe message and the raw text is kept only on `error.detail`.
 */
describe('response envelope handling', () => {
  it('unwraps the data property on success', async () => {
    const harness = createHarness({ responseBody: { data: { id: 'conn-1' } } });
    const client = createAccountabilityClient(harness.deps as never);

    await expect(client.listConnections()).resolves.toEqual({ id: 'conn-1' });
  });

  it('unwraps an array payload without collapsing it', async () => {
    const harness = createHarness({ responseBody: { data: [{ id: 'a' }, { id: 'b' }] } });
    const client = createAccountabilityClient(harness.deps as never);

    await expect(client.listConnections()).resolves.toEqual([{ id: 'a' }, { id: 'b' }]);
  });

  it('preserves a legitimately null data payload', async () => {
    const harness = createHarness({ responseBody: { data: null } });
    const client = createAccountabilityClient(harness.deps as never);

    await expect(client.listConnections()).resolves.toBeNull();
  });

  it('throws AccountabilityApiError when a 200 response has no data property', async () => {
    const harness = createHarness({ responseBody: { id: 'conn-1' } });
    const client = createAccountabilityClient(harness.deps as never);

    await expect(client.listConnections()).rejects.toThrow(AccountabilityApiError);
  });

  it('throws AccountabilityApiError when a 200 response is not valid JSON', async () => {
    const harness = createHarness({ responseText: '<html>gateway</html>' });
    const client = createAccountabilityClient(harness.deps as never);

    await expect(client.listConnections()).rejects.toThrow(AccountabilityApiError);
  });

  it('throws AccountabilityApiError when a 200 response body is empty', async () => {
    const harness = createHarness({ responseText: '' });
    const client = createAccountabilityClient(harness.deps as never);

    await expect(client.listConnections()).rejects.toThrow(AccountabilityApiError);
  });
});

describe('API error translation', () => {
  it('translates 401 to AccountabilityAuthError', async () => {
    const harness = createHarness({ status: 401, responseBody: { error: 'Unauthorized.' } });
    const client = createAccountabilityClient(harness.deps as never);

    await expect(client.listConnections()).rejects.toThrow(AccountabilityAuthError);
  });

  it('translates 403 to a user-safe permission message', async () => {
    const harness = createHarness({ status: 403, responseBody: { error: 'RLS denied' } });
    const client = createAccountabilityClient(harness.deps as never);

    await expect(client.listConnections()).rejects.toThrow(/permission/i);
  });

  it('explains when an invite belongs to a different email address', async () => {
    const harness = createHarness({ status: 403, responseBody: { error: 'Invite is not for this account' } });
    const client = createAccountabilityClient(harness.deps as never);
    await expect(client.listConnections()).rejects.toThrow(/different email/i);
  });

  it('translates 404 to a user-safe not-found message', async () => {
    const harness = createHarness({ status: 404, responseBody: { error: 'no row' } });
    const client = createAccountabilityClient(harness.deps as never);

    await expect(client.listConnections()).rejects.toThrow(/couldn't find|not found/i);
  });

  it('translates 429 to a user-safe rate limit message', async () => {
    const harness = createHarness({ status: 429, responseBody: { error: 'slow down' } });
    const client = createAccountabilityClient(harness.deps as never);

    await expect(client.listConnections()).rejects.toThrow(/too many|try again/i);
  });

  it('translates 500 to a generic user-safe message', async () => {
    const harness = createHarness({
      status: 500,
      responseBody: { error: 'PG::UndefinedTable accountability_connections' },
    });
    const client = createAccountabilityClient(harness.deps as never);

    await expect(client.listConnections()).rejects.toThrow(/something went wrong/i);
  });

  it('does not leak raw server error text into the user-facing message', async () => {
    const harness = createHarness({
      status: 500,
      responseBody: { error: 'PG::UndefinedTable accountability_connections' },
    });
    const client = createAccountabilityClient(harness.deps as never);

    const error: unknown = await client.listConnections().then(() => null, (cause: unknown) => cause);

    expect(error).toBeInstanceOf(Error);
    if (!(error instanceof Error)) throw new Error('Expected an API error');
    expect(error.message.includes('PG::UndefinedTable')).toBe(false);
  });

  it('retains the raw server error text on the detail property for logging', async () => {
    const harness = createHarness({ status: 500, responseBody: { error: 'boom' } });
    const client = createAccountabilityClient(harness.deps as never);

    const error = (await client
      .listConnections()
      .catch((e) => e)) as AccountabilityApiError;

    expect(error.detail).toBe('boom');
  });

  it('exposes the HTTP status on the thrown error', async () => {
    const harness = createHarness({ status: 503, responseBody: { error: 'down' } });
    const client = createAccountabilityClient(harness.deps as never);

    const error = (await client
      .listConnections()
      .catch((e) => e)) as AccountabilityApiError;

    expect(error.status).toBe(503);
  });

  it('handles an error response whose body is not JSON', async () => {
    const harness = createHarness({ status: 502, responseText: '<html>bad gateway</html>' });
    const client = createAccountabilityClient(harness.deps as never);

    await expect(client.listConnections()).rejects.toThrow(AccountabilityApiError);
  });

  it('translates a network level fetch rejection to AccountabilityApiError', async () => {
    const harness = createHarness();
    const client = createAccountabilityClient({
      ...(harness.deps as Record<string, unknown>),
      fetch: async () => {
        throw new TypeError('Network request failed');
      },
    } as never);

    await expect(client.listConnections()).rejects.toThrow(AccountabilityApiError);
  });

  it('gives a user-safe offline message on a network level failure', async () => {
    const harness = createHarness();
    const client = createAccountabilityClient({
      ...(harness.deps as Record<string, unknown>),
      fetch: async () => {
        throw new TypeError('Network request failed');
      },
    } as never);

    await expect(client.listConnections()).rejects.toThrow(/connect|offline|internet/i);
  });

  it('never swallows a failure by resolving to undefined', async () => {
    const harness = createHarness({ status: 500, responseBody: { error: 'boom' } });
    const client = createAccountabilityClient(harness.deps as never);

    const outcome = await client
      .listConnections()
      .then(() => 'resolved')
      .catch(() => 'rejected');

    expect(outcome).toBe('rejected');
  });

  it('never includes the access token in an API error', async () => {
    const harness = createHarness({ status: 500, responseBody: { error: 'boom' } });
    const client = createAccountabilityClient(harness.deps as never);

    const error = await client.listConnections().catch((e) => e as Error);

    expect(
      JSON.stringify(error, Object.getOwnPropertyNames(error)).includes('eyJ')
    ).toBe(false);
  });
});
