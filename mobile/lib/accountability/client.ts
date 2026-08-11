import { AccountabilityApiError, AccountabilityAuthError } from './errors';
import { parseAccessToken, parseInviteToken } from './token';
import type {
  AccountabilityComment,
  AccountabilityConnection,
  AccountabilityNudge,
  AccountabilityReward,
  AccountabilitySuggestion,
  CheckIn,
  CommitmentCadence,
  DaysShownUpProgress,
  ScopeControl,
  SharedCommitment,
} from './types';

interface ClientDependencies {
  baseUrl: string;
  getAccessToken: () => Promise<string | null>;
  fetch: (input: string, init?: RequestInit) => Promise<Response>;
  now: () => number;
  role?: 'owner' | 'partner';
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'DELETE';
  query?: Record<string, string>;
  body?: Record<string, unknown>;
}

function safeMessage(status: number, detail?: string): string {
  if (status === 403 && /not for this account/i.test(detail ?? '')) return 'This invite was sent to a different email address.';
  if (status === 403) return 'You do not have permission to do that.';
  if (status === 404) return "We couldn't find that Together item.";
  if (status === 429) return 'Too many requests. Please try again shortly.';
  return 'Something went wrong. Please try again.';
}

export function createAccountabilityClient(deps: ClientDependencies) {
  async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const token = await deps.getAccessToken();
    if (!token) throw new AccountabilityAuthError();
    const parsed = parseAccessToken(token);
    if (parsed.expiresAtMs <= deps.now()) {
      throw new AccountabilityAuthError('Your session expired. Please sign in again.');
    }

    const query = options.query ? `?${new URLSearchParams(options.query).toString()}` : '';
    const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
    const init: RequestInit = { method: options.method ?? 'GET', headers };
    if (options.body) {
      headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(options.body);
    }

    let response: Response;
    try {
      response = await deps.fetch(`${deps.baseUrl}${path}${query}`, init);
    } catch {
      throw new AccountabilityApiError(
        'Unable to connect. Check your internet connection and try again.'
      );
    }

    let envelope: unknown;
    let detail: string | undefined;
    try {
      envelope = JSON.parse(await response.text()) as unknown;
      if (envelope && typeof envelope === 'object' && !Array.isArray(envelope)) {
        const error = (envelope as Record<string, unknown>).error;
        if (typeof error === 'string') detail = error;
      }
    } catch {
      envelope = undefined;
    }

    if (!response.ok) {
      if (response.status === 401) {
        throw new AccountabilityAuthError('Your session expired. Please sign in again.');
      }
      throw new AccountabilityApiError(safeMessage(response.status, detail), response.status, detail);
    }

    if (!envelope || typeof envelope !== 'object' || Array.isArray(envelope) || !('data' in envelope)) {
      throw new AccountabilityApiError('Something went wrong. Please try again.', response.status);
    }
    return (envelope as { data: T }).data;
  }

  return {
    listConnections: () => request<AccountabilityConnection[]>('/api/accountability/connections'),
    createConnection: ({ inviteeEmail }: { inviteeEmail: string }) =>
      request<AccountabilityConnection>('/api/accountability/connections', {
        method: 'POST', body: { inviteeEmail },
      }),
    joinConnection: ({ inviteToken }: { inviteToken: string }) =>
      request<AccountabilityConnection>('/api/accountability/connections/join', {
        method: 'POST', body: { inviteToken: parseInviteToken(inviteToken) },
      }),
    revokeConnection: ({ connectionId }: { connectionId: string }) =>
      request<AccountabilityConnection>('/api/accountability/connections/revoke', {
        method: 'POST', body: { connectionId },
      }),
    blockConnection: ({ connectionId }: { connectionId: string }) =>
      request<AccountabilityConnection>('/api/accountability/connections/block', {
        method: 'POST', body: { connectionId },
      }),
    listCommitments: ({ connectionId }: { connectionId: string }) =>
      request<SharedCommitment[]>('/api/accountability/commitments', { query: { connectionId } }),
    getCommitment: ({ commitmentId }: { commitmentId: string }) =>
      request<SharedCommitment>('/api/accountability/commitments/detail', { query: { commitmentId } }),
    createCommitment: (input: { connectionId: string; title: string; cadence: CommitmentCadence; note?: string; notesShared?: boolean }) =>
      request<SharedCommitment>('/api/accountability/commitments', {
        method: 'POST',
        body: {
          connectionId: input.connectionId,
          title: input.title,
          cadence: input.cadence,
          ...(input.note !== undefined ? { note: input.note } : {}),
          ...(input.notesShared !== undefined ? { notesShared: input.notesShared } : {}),
        },
      }),
    archiveCommitment: ({ commitmentId }: { commitmentId: string }) =>
      request<{ archived: boolean }>('/api/accountability/commitments/archive', {
        method: 'POST', body: { commitmentId },
      }),
    setCommitmentNoteSharing: ({ commitmentId, shared }: { commitmentId: string; shared: boolean }) =>
      request<{ updated: boolean }>('/api/accountability/notes/commitment-sharing', {
        method: 'POST', body: { commitmentId, shared },
      }),
    setCheckInNoteSharing: ({ checkInId, shared }: { checkInId: string; shared: boolean }) =>
      request<{ updated: boolean }>('/api/accountability/notes/check-in-sharing', {
        method: 'POST', body: { checkInId, shared },
      }),
    createCheckIn: ({ commitmentId, checkInDate, note, shareNote }: { commitmentId: string; checkInDate: string; note?: string; shareNote?: boolean }) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(checkInDate)) {
        return Promise.reject(new AccountabilityApiError('Choose a valid check-in date.'));
      }
      return request<CheckIn>('/api/accountability/check-ins', {
        method: 'POST', body: {
          commitmentId,
          checkInDate,
          ...(note !== undefined ? { note } : {}),
          ...(shareNote !== undefined ? { shareNote } : {}),
        },
      });
    },
    getProgress: ({ connectionId, asOfDate }: { connectionId: string; asOfDate: string }) =>
      request<DaysShownUpProgress>('/api/accountability/progress', {
        query: { connectionId, asOfDate },
      }),
    sendNudge: ({ connectionId, commitmentId, kind }: { connectionId: string; commitmentId?: string; kind: 'encouragement' | 'check_in' | 'celebrate' }) =>
      request('/api/accountability/nudges', {
        method: 'POST', body: { connectionId, kind, ...(commitmentId ? { commitmentId } : {}) },
      }),
    listNudges: ({ connectionId }: { connectionId: string }) =>
      request<AccountabilityNudge[]>('/api/accountability/nudges', { query: { connectionId } }),
    listComments: ({ commitmentId }: { commitmentId: string }) =>
      request<AccountabilityComment[]>('/api/accountability/comments', { query: { commitmentId } }),
    createComment: ({ commitmentId, body }: { commitmentId: string; body: string }) =>
      request<AccountabilityComment>('/api/accountability/comments', { method: 'POST', body: { commitmentId, body } }),
    listSuggestions: ({ connectionId }: { connectionId: string }) =>
      request<AccountabilitySuggestion[]>('/api/accountability/suggestions', { query: { connectionId } }),
    createSuggestion: ({ commitmentId, priority, note }: { commitmentId: string; priority: 'high' | 'medium' | 'low'; note?: string }) =>
      request<AccountabilitySuggestion>('/api/accountability/suggestions', {
        method: 'POST', body: { commitmentId, priority, ...(note ? { note } : {}) },
      }),
    respondToSuggestion: ({ suggestionId, approved }: { suggestionId: string; approved: boolean }) =>
      request<{ updated: boolean }>('/api/accountability/suggestions/respond', {
        method: 'POST', body: { suggestionId, approved },
      }),
    listRewards: ({ connectionId }: { connectionId: string }) =>
      request<AccountabilityReward[]>('/api/accountability/rewards', { query: { connectionId } }),
    setReward: ({ commitmentId, description }: { commitmentId: string; description: string }) =>
      request<AccountabilityReward>('/api/accountability/rewards', {
        method: 'POST', body: { commitmentId, description },
      }),
    getScopeControl: ({ connectionId }: { connectionId: string }) =>
      request<ScopeControl>('/api/accountability/scope-control', { query: { connectionId } }),
    updateScopeControl: (input: ScopeControl) =>
      request<ScopeControl>('/api/accountability/scope-control', { method: 'POST', body: { ...input } }),
    cancelInvite: ({ connectionId }: { connectionId: string }) =>
      request<{ cancelled: boolean }>(`/api/accountability/invites/${encodeURIComponent(connectionId)}`, { method: 'DELETE' }),
  };
}

export type AccountabilityClient = ReturnType<typeof createAccountabilityClient>;
