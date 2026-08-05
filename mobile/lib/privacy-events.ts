export const PRIVACY_EVENT_TYPES = [
  'privacy_notice_viewed',
  'consent_granted',
  'consent_withdrawn',
  'sharing_enabled',
  'sharing_disabled',
  'export_requested',
  'deletion_requested',
] as const;

export type PrivacyEventType = (typeof PRIVACY_EVENT_TYPES)[number];
export type PrivacyEventPlatform = 'ios' | 'android';

export type PrivacyActivityEvent = {
  id: string;
  eventType: PrivacyEventType;
  platform: 'web' | PrivacyEventPlatform;
  occurredAt: string;
};

const EVENT_TYPES = new Set<string>(PRIVACY_EVENT_TYPES);
const PLATFORMS = new Set(['web', 'ios', 'android']);

export const PRIVACY_EVENT_LABELS: Record<PrivacyEventType, string> = {
  privacy_notice_viewed: 'Privacy details viewed',
  consent_granted: 'Consent granted',
  consent_withdrawn: 'Consent withdrawn',
  sharing_enabled: 'Sharing enabled',
  sharing_disabled: 'Sharing disabled',
  export_requested: 'Export requested',
  deletion_requested: 'Deletion requested',
};

export function normalizePrivacyEvent(input: unknown): PrivacyActivityEvent | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const row = input as Record<string, unknown>;
  if (
    typeof row.id !== 'string' ||
    typeof row.event_type !== 'string' ||
    !EVENT_TYPES.has(row.event_type) ||
    typeof row.platform !== 'string' ||
    !PLATFORMS.has(row.platform) ||
    typeof row.occurred_at !== 'string' ||
    Number.isNaN(Date.parse(row.occurred_at))
  ) {
    return null;
  }

  return {
    id: row.id,
    eventType: row.event_type as PrivacyEventType,
    platform: row.platform as PrivacyActivityEvent['platform'],
    occurredAt: row.occurred_at,
  };
}

export function createPrivacyEventRpcPayload(
  eventType: PrivacyEventType,
  platform: PrivacyEventPlatform
) {
  return Object.freeze({
    p_event_type: eventType,
    p_platform: platform,
    // Privacy events are taxonomy-only. No user content or arbitrary metadata.
    p_metadata: Object.freeze({}),
  });
}
