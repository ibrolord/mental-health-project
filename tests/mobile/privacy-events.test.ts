import { describe, expect, it } from 'vitest';
import {
  createPrivacyEventRpcPayload,
  normalizePrivacyEvent,
} from '../../mobile/lib/privacy-events';

describe('mobile privacy events', () => {
  it('normalizes only allowlisted taxonomy fields and ignores arbitrary metadata', () => {
    expect(
      normalizePrivacyEvent({
        id: 'event-1',
        event_type: 'export_requested',
        platform: 'ios',
        occurred_at: '2026-08-05T12:00:00.000Z',
        metadata: { note: 'must not be returned' },
      })
    ).toEqual({
      id: 'event-1',
      eventType: 'export_requested',
      platform: 'ios',
      occurredAt: '2026-08-05T12:00:00.000Z',
    });
  });

  it('fails closed for unknown event types and malformed timestamps', () => {
    expect(
      normalizePrivacyEvent({
        id: 'event-1',
        event_type: 'journal_viewed',
        platform: 'ios',
        occurred_at: '2026-08-05T12:00:00.000Z',
      })
    ).toBeNull();
    expect(
      normalizePrivacyEvent({
        id: 'event-1',
        event_type: 'export_requested',
        platform: 'ios',
        occurred_at: 'not-a-date',
      })
    ).toBeNull();
  });

  it('creates taxonomy-only RPC payloads with no content metadata', () => {
    expect(createPrivacyEventRpcPayload('export_requested', 'ios')).toEqual({
      p_event_type: 'export_requested',
      p_platform: 'ios',
      p_metadata: {},
    });
  });
});
