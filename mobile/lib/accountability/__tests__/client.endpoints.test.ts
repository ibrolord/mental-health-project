import { describe, expect, it } from 'vitest';

import { createAccountabilityClient } from '../client';
import { bodyOf, createHarness } from './helpers';

/**
 * CRITICAL — exact endpoint / method / body mapping.
 *
 * The paths are asserted as literal strings on purpose. Importing an endpoint
 * constant from the implementation would let a wrong client and wrong test
 * agree with each other.
 *
 * DELETE is used only for cancelling an invitation. The shared API CORS
 * contract explicitly allows it for the mobile cross-origin caller.
 */
describe('accountability endpoint mapping', () => {
  // --- connections ---

  it('maps listConnections to GET /api/accountability/connections', async () => {
    const harness = createHarness();
    const client = createAccountabilityClient(harness.deps as never);

    await client.listConnections();

    expect({ url: harness.calls[0].url, method: harness.calls[0].method }).toEqual({
      url: 'https://api.test/api/accountability/connections',
      method: 'GET',
    });
  });

  it('sends no request body on a GET', async () => {
    const harness = createHarness();
    const client = createAccountabilityClient(harness.deps as never);

    await client.listConnections();

    expect(harness.calls[0].body).toBeUndefined();
  });

  it('maps createConnection to POST /api/accountability/connections with the invite body', async () => {
    const harness = createHarness();
    const client = createAccountabilityClient(harness.deps as never);

    await client.createConnection({ inviteeEmail: 'partner@example.com' });

    expect({
      url: harness.calls[0].url,
      method: harness.calls[0].method,
      body: bodyOf(harness.calls[0]),
    }).toEqual({
      url: 'https://api.test/api/accountability/connections',
      method: 'POST',
      body: { inviteeEmail: 'partner@example.com' },
    });
  });

  it('maps revokeConnection to POST /api/accountability/connections/revoke', async () => {
    const harness = createHarness();
    const client = createAccountabilityClient(harness.deps as never);

    await client.revokeConnection({ connectionId: 'conn-1' });

    expect({
      url: harness.calls[0].url,
      method: harness.calls[0].method,
      body: bodyOf(harness.calls[0]),
    }).toEqual({
      url: 'https://api.test/api/accountability/connections/revoke',
      method: 'POST',
      body: { connectionId: 'conn-1' },
    });
  });

  it('maps cancelInvite to DELETE on the tokenless connection id', async () => {
    const harness = createHarness();
    const client = createAccountabilityClient(harness.deps as never);
    await client.cancelInvite({ connectionId: 'pending/one' });
    expect({ url: harness.calls[0].url, method: harness.calls[0].method }).toEqual({
      url: 'https://api.test/api/accountability/invites/pending%2Fone',
      method: 'DELETE',
    });
  });

  // --- commitments ---

  it('maps listCommitments to GET with connectionId in the query string', async () => {
    const harness = createHarness();
    const client = createAccountabilityClient(harness.deps as never);

    await client.listCommitments({ connectionId: 'conn-1' });

    expect(harness.calls[0].url).toBe(
      'https://api.test/api/accountability/commitments?connectionId=conn-1'
    );
  });

  it('percent-encodes query parameter values', async () => {
    const harness = createHarness();
    const client = createAccountabilityClient(harness.deps as never);

    await client.listCommitments({ connectionId: 'a b&c=d' });

    expect(harness.calls[0].url).toBe(
      'https://api.test/api/accountability/commitments?connectionId=a+b%26c%3Dd'
    );
  });

  it('maps createCommitment to POST /api/accountability/commitments', async () => {
    const harness = createHarness();
    const client = createAccountabilityClient(harness.deps as never);

    await client.createCommitment({
      connectionId: 'conn-1',
      title: 'Walk daily',
      cadence: 'daily',
    });

    expect({
      url: harness.calls[0].url,
      method: harness.calls[0].method,
      body: bodyOf(harness.calls[0]),
    }).toEqual({
      url: 'https://api.test/api/accountability/commitments',
      method: 'POST',
      body: { connectionId: 'conn-1', title: 'Walk daily', cadence: 'daily' },
    });
  });

  it('does not forward unknown fields on a commitment body', async () => {
    const harness = createHarness();
    const client = createAccountabilityClient(harness.deps as never);

    await client.createCommitment({
      connectionId: 'conn-1',
      title: 'Walk daily',
      cadence: 'daily',
      moodId: 'mood-9',
    } as never);

    expect(bodyOf(harness.calls[0])).toEqual({
      connectionId: 'conn-1',
      title: 'Walk daily',
      cadence: 'daily',
    });
  });

  it('archives a commitment without issuing a destructive DELETE', async () => {
    const harness = createHarness();
    const client = createAccountabilityClient(harness.deps as never);
    await client.archiveCommitment({ commitmentId: 'c-1' });
    expect({ url: harness.calls[0].url, method: harness.calls[0].method, body: bodyOf(harness.calls[0]) }).toEqual({
      url: 'https://api.test/api/accountability/commitments/archive',
      method: 'POST',
      body: { commitmentId: 'c-1' },
    });
  });

  it('revokes commitment note sharing through the owner-checked endpoint', async () => {
    const harness = createHarness();
    const client = createAccountabilityClient(harness.deps as never);
    await client.setCommitmentNoteSharing({ commitmentId: 'c-1', shared: false });
    expect({ url: harness.calls[0].url, method: harness.calls[0].method, body: bodyOf(harness.calls[0]) }).toEqual({
      url: 'https://api.test/api/accountability/notes/commitment-sharing',
      method: 'POST',
      body: { commitmentId: 'c-1', shared: false },
    });
  });

  it('revokes check-in note sharing through the owner-checked endpoint', async () => {
    const harness = createHarness();
    const client = createAccountabilityClient(harness.deps as never);
    await client.setCheckInNoteSharing({ checkInId: 'ci-1', shared: false });
    expect({ url: harness.calls[0].url, method: harness.calls[0].method, body: bodyOf(harness.calls[0]) }).toEqual({
      url: 'https://api.test/api/accountability/notes/check-in-sharing',
      method: 'POST',
      body: { checkInId: 'ci-1', shared: false },
    });
  });

  // --- check-ins ---

  it('maps createCheckIn to POST /api/accountability/check-ins', async () => {
    const harness = createHarness();
    const client = createAccountabilityClient(harness.deps as never);

    await client.createCheckIn({ commitmentId: 'c-1', checkInDate: '2026-08-11' });

    expect({
      url: harness.calls[0].url,
      method: harness.calls[0].method,
      body: bodyOf(harness.calls[0]),
    }).toEqual({
      url: 'https://api.test/api/accountability/check-ins',
      method: 'POST',
      body: { commitmentId: 'c-1', checkInDate: '2026-08-11' },
    });
  });

  it('rejects a check-in date that is not YYYY-MM-DD before calling fetch', async () => {
    const harness = createHarness();
    const client = createAccountabilityClient(harness.deps as never);

    await client
      .createCheckIn({ commitmentId: 'c-1', checkInDate: '11/08/2026' })
      .catch(() => undefined);

    expect(harness.calls).toHaveLength(0);
  });

  it('forwards only an explicitly shared check-in note', async () => {
    const harness = createHarness();
    const client = createAccountabilityClient(harness.deps as never);

    await client.createCheckIn({
      commitmentId: 'c-1',
      checkInDate: '2026-08-11',
      note: 'Took the first step',
      shareNote: true,
    });

    expect(bodyOf(harness.calls[0])).toEqual({
      commitmentId: 'c-1',
      checkInDate: '2026-08-11',
      note: 'Took the first step',
      shareNote: true,
    });
  });

  // --- progress ---

  it('maps getProgress to GET with connectionId and asOfDate', async () => {
    const harness = createHarness({
      responseBody: {
        data: {
          daysShownUp: 3,
          windowDays: 14,
          windowStart: '2026-07-29',
          windowEnd: '2026-08-11',
        },
      },
    });
    const client = createAccountabilityClient(harness.deps as never);

    await client.getProgress({ connectionId: 'conn-1', asOfDate: '2026-08-11' });

    expect(harness.calls[0].url).toBe(
      'https://api.test/api/accountability/progress?connectionId=conn-1&asOfDate=2026-08-11'
    );
  });

  it('returns a progress model matching the web DaysShownUpProgress shape', async () => {
    // Integration boundary: lib/accountability/progress.ts already defines this
    // exact shape. The mobile model must not diverge.
    const harness = createHarness({
      responseBody: {
        data: {
          daysShownUp: 3,
          windowDays: 14,
          windowStart: '2026-07-29',
          windowEnd: '2026-08-11',
        },
      },
    });
    const client = createAccountabilityClient(harness.deps as never);

    await expect(
      client.getProgress({ connectionId: 'conn-1', asOfDate: '2026-08-11' })
    ).resolves.toEqual({
      daysShownUp: 3,
      windowDays: 14,
      windowStart: '2026-07-29',
      windowEnd: '2026-08-11',
    });
  });

  // --- nudges, comments, suggestions, rewards ---

  it('maps sendNudge to POST /api/accountability/nudges', async () => {
    const harness = createHarness({ role: 'partner' });
    const client = createAccountabilityClient(harness.deps as never);

    await client.sendNudge({ connectionId: 'conn-1', kind: 'encouragement' });

    expect({
      url: harness.calls[0].url,
      method: harness.calls[0].method,
      body: bodyOf(harness.calls[0]),
    }).toEqual({
      url: 'https://api.test/api/accountability/nudges',
      method: 'POST',
      body: { connectionId: 'conn-1', kind: 'encouragement' },
    });
  });

  it('can target a fixed nudge at one shared commitment', async () => {
    const harness = createHarness({ role: 'partner' });
    const client = createAccountabilityClient(harness.deps as never);

    await client.sendNudge({ connectionId: 'conn-1', commitmentId: 'c-1', kind: 'celebrate' });

    expect(bodyOf(harness.calls[0])).toEqual({
      connectionId: 'conn-1',
      commitmentId: 'c-1',
      kind: 'celebrate',
    });
  });

  it('loads received nudges for the active connection', async () => {
    const harness = createHarness({ responseBody: { data: [] } });
    const client = createAccountabilityClient(harness.deps as never);
    await client.listNudges({ connectionId: 'conn-1' });
    expect(harness.calls[0].url).toBe('https://api.test/api/accountability/nudges?connectionId=conn-1');
  });

  it('maps listComments to GET with commitmentId in the query string', async () => {
    const harness = createHarness({ responseBody: { data: [] } });
    const client = createAccountabilityClient(harness.deps as never);

    await client.listComments({ commitmentId: 'c-1' });

    expect(harness.calls[0].url).toBe(
      'https://api.test/api/accountability/comments?commitmentId=c-1'
    );
  });

  it('maps createComment to POST /api/accountability/comments', async () => {
    const harness = createHarness({ role: 'partner' });
    const client = createAccountabilityClient(harness.deps as never);

    await client.createComment({ commitmentId: 'c-1', body: 'proud of you' });

    expect({
      url: harness.calls[0].url,
      method: harness.calls[0].method,
      body: bodyOf(harness.calls[0]),
    }).toEqual({
      url: 'https://api.test/api/accountability/comments',
      method: 'POST',
      body: { commitmentId: 'c-1', body: 'proud of you' },
    });
  });

  it('maps listSuggestions to GET /api/accountability/suggestions', async () => {
    const harness = createHarness({ responseBody: { data: [] } });
    const client = createAccountabilityClient(harness.deps as never);

    await client.listSuggestions({ connectionId: 'conn-1' });

    expect(harness.calls[0].url).toBe(
      'https://api.test/api/accountability/suggestions?connectionId=conn-1'
    );
  });

  it('maps createSuggestion to POST without changing the owner commitment directly', async () => {
    const harness = createHarness({ role: 'partner' });
    const client = createAccountabilityClient(harness.deps as never);

    await client.createSuggestion({ commitmentId: 'c-1', priority: 'high' });

    expect({
      url: harness.calls[0].url,
      method: harness.calls[0].method,
      body: bodyOf(harness.calls[0]),
    }).toEqual({
      url: 'https://api.test/api/accountability/suggestions',
      method: 'POST',
      body: { commitmentId: 'c-1', priority: 'high' },
    });
  });

  it('maps owner approval to the dedicated suggestion response endpoint', async () => {
    const harness = createHarness();
    const client = createAccountabilityClient(harness.deps as never);

    await client.respondToSuggestion({ suggestionId: 's-1', approved: true });

    expect({
      url: harness.calls[0].url,
      method: harness.calls[0].method,
      body: bodyOf(harness.calls[0]),
    }).toEqual({
      url: 'https://api.test/api/accountability/suggestions/respond',
      method: 'POST',
      body: { suggestionId: 's-1', approved: true },
    });
  });

  it('maps listRewards to GET /api/accountability/rewards', async () => {
    const harness = createHarness({ responseBody: { data: [] } });
    const client = createAccountabilityClient(harness.deps as never);

    await client.listRewards({ connectionId: 'conn-1' });

    expect(harness.calls[0].url).toBe(
      'https://api.test/api/accountability/rewards?connectionId=conn-1'
    );
  });

  it('maps a self-set reward to POST /api/accountability/rewards', async () => {
    const harness = createHarness();
    const client = createAccountabilityClient(harness.deps as never);

    await client.setReward({ commitmentId: 'c-1', description: 'Movie night' });

    expect({
      url: harness.calls[0].url,
      method: harness.calls[0].method,
      body: bodyOf(harness.calls[0]),
    }).toEqual({
      url: 'https://api.test/api/accountability/rewards',
      method: 'POST',
      body: { commitmentId: 'c-1', description: 'Movie night' },
    });
  });

  // --- scope control ---

  it('maps getScopeControl to GET /api/accountability/scope-control', async () => {
    const harness = createHarness({
      responseBody: {
        data: {
          connectionId: 'conn-1',
          sharesProgress: true,
          sharesCommitmentTitles: true,
          sharesNotes: false,
        },
      },
    });
    const client = createAccountabilityClient(harness.deps as never);

    await client.getScopeControl({ connectionId: 'conn-1' });

    expect(harness.calls[0].url).toBe(
      'https://api.test/api/accountability/scope-control?connectionId=conn-1'
    );
  });

  it('maps updateScopeControl to POST /api/accountability/scope-control', async () => {
    const harness = createHarness({
      responseBody: {
        data: {
          connectionId: 'conn-1',
          sharesProgress: true,
          sharesCommitmentTitles: false,
          sharesNotes: false,
        },
      },
    });
    const client = createAccountabilityClient(harness.deps as never);

    await client.updateScopeControl({
      connectionId: 'conn-1',
      sharesProgress: true,
      sharesCommitmentTitles: false,
      sharesNotes: false,
    });

    expect({
      url: harness.calls[0].url,
      method: harness.calls[0].method,
      body: bodyOf(harness.calls[0]),
    }).toEqual({
      url: 'https://api.test/api/accountability/scope-control',
      method: 'POST',
      body: {
        connectionId: 'conn-1',
        sharesProgress: true,
        sharesCommitmentTitles: false,
        sharesNotes: false,
      },
    });
  });

  it('uses only the CORS-allowlisted methods across the typed surface', async () => {
    const harness = createHarness({ responseBody: { data: [] } });
    const client = createAccountabilityClient(harness.deps as never);

    await client.listConnections();
    await client.createConnection({ inviteeEmail: 'p@example.com' });
    await client.revokeConnection({ connectionId: 'conn-1' });
    await client.listCommitments({ connectionId: 'conn-1' });
    await client.createCommitment({ connectionId: 'conn-1', title: 't', cadence: 'daily' });
    await client.createCheckIn({ commitmentId: 'c-1', checkInDate: '2026-08-11' });
    await client.cancelInvite({ connectionId: 'conn-2' });

    expect([...new Set(harness.calls.map((c) => c.method))].sort()).toEqual(['DELETE', 'GET', 'POST']);
  });
});
