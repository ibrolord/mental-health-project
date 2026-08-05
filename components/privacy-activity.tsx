'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDown, LockKeyhole, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { USER_DATA_REGISTRY } from '@/lib/data/user-data-registry';
import { supabase } from '@/lib/supabase/client';
import type { PrivacyEventType } from '@/lib/supabase/types';

const PRIVACY_ACTIVITY_UPDATED_EVENT = 'mhtoolkit:privacy-activity-updated';
const PRIVACY_METADATA_KEYS = [
  'policy_version',
  'app_version',
  'setting',
  'method',
] as const;
const PRIVACY_EVENT_TYPES = new Set<PrivacyEventType>([
  'privacy_notice_viewed',
  'consent_granted',
  'consent_withdrawn',
  'sharing_enabled',
  'sharing_disabled',
  'export_requested',
  'deletion_requested',
]);
const PRIVACY_PLATFORMS = new Set(['web', 'ios', 'android']);
const PRIVACY_SETTINGS = new Set([
  'partner_sharing',
  'analytics',
  'crash_reporting',
  'reminders',
]);
const PRIVACY_METHODS = new Set([
  'onboarding',
  'privacy_settings',
  'account_settings',
  'support_request',
]);

type PrivacyMetadataKey = (typeof PRIVACY_METADATA_KEYS)[number];
export type PrivacyEventMetadata = Partial<Record<PrivacyMetadataKey, string>>;

export type PrivacyActivityEvent = {
  id: string;
  eventType: PrivacyEventType;
  platform: 'web' | 'ios' | 'android';
  metadata: PrivacyEventMetadata;
  occurredAt: string;
};

const EVENT_LABELS: Record<PrivacyEventType, string> = {
  privacy_notice_viewed: 'Privacy details viewed',
  consent_granted: 'Consent granted',
  consent_withdrawn: 'Consent withdrawn',
  sharing_enabled: 'Sharing enabled',
  sharing_disabled: 'Sharing disabled',
  export_requested: 'Export requested',
  deletion_requested: 'Deletion requested',
};

const METADATA_LABELS: Record<PrivacyMetadataKey, string> = {
  policy_version: 'Policy',
  app_version: 'App',
  setting: 'Setting',
  method: 'Method',
};

function readableToken(value: string): string {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function sanitizePrivacyMetadata(input: unknown): PrivacyEventMetadata {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {};

  const record = input as Record<string, unknown>;
  const sanitized: PrivacyEventMetadata = {};
  const policyVersion = record.policy_version;
  if (
    typeof policyVersion === 'string' &&
    /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(policyVersion) &&
    policyVersion.length <= 32
  ) sanitized.policy_version = policyVersion;

  const appVersion = record.app_version;
  if (
    typeof appVersion === 'string' &&
    /^[A-Za-z0-9][A-Za-z0-9._+-]*$/.test(appVersion) &&
    appVersion.length <= 32
  ) sanitized.app_version = appVersion;

  const setting = record.setting;
  if (typeof setting === 'string' && PRIVACY_SETTINGS.has(setting)) {
    sanitized.setting = setting;
  }

  const method = record.method;
  if (typeof method === 'string' && PRIVACY_METHODS.has(method)) {
    sanitized.method = method;
  }
  return sanitized;
}

export function normalizePrivacyEvent(input: unknown): PrivacyActivityEvent | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const row = input as Record<string, unknown>;
  if (
    typeof row.id !== 'string' ||
    typeof row.event_type !== 'string' ||
    !PRIVACY_EVENT_TYPES.has(row.event_type as PrivacyEventType) ||
    typeof row.platform !== 'string' ||
    !PRIVACY_PLATFORMS.has(row.platform) ||
    typeof row.occurred_at !== 'string'
  ) {
    return null;
  }

  return {
    id: row.id,
    eventType: row.event_type as PrivacyEventType,
    platform: row.platform as PrivacyActivityEvent['platform'],
    metadata: sanitizePrivacyMetadata(row.metadata),
    occurredAt: row.occurred_at,
  };
}

export async function recordWebPrivacyEvent(
  eventType: PrivacyEventType,
  metadata: PrivacyEventMetadata = {}
): Promise<void> {
  if (
    USER_DATA_REGISTRY.privacy_events.partner !== 'none' ||
    USER_DATA_REGISTRY.privacy_events.ai !== 'never'
  ) {
    throw new Error('Privacy activity policy is invalid.');
  }

  const result = await supabase.rpc('record_privacy_event', {
    p_event_type: eventType,
    p_platform: 'web',
    p_metadata: sanitizePrivacyMetadata(metadata),
  });
  if (result.error) throw result.error;

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(PRIVACY_ACTIVITY_UPDATED_EVENT));
  }
}

function formatOccurredAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Time unavailable';
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

export function PrivacyActivity({ ownerId }: { ownerId: string | null }) {
  const [events, setEvents] = useState<PrivacyActivityEvent[]>([]);
  const [opened, setOpened] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const loggedView = useRef(false);
  const ownerRef = useRef(ownerId);
  const requestGenerationRef = useRef(0);

  const load = async () => {
    if (!ownerId) {
      setEvents([]);
      setError('Sign in to view privacy activity.');
      return;
    }

    const requestedOwner = ownerId;
    const requestGeneration = ++requestGenerationRef.current;
    setLoading(true);
    setError('');
    const result = await supabase
      .from('privacy_events')
      .select('id, event_type, platform, metadata, occurred_at')
      .eq('user_id', requestedOwner)
      .order('occurred_at', { ascending: false })
      .limit(50);

    if (
      ownerRef.current !== requestedOwner ||
      requestGenerationRef.current !== requestGeneration
    ) {
      return;
    }

    if (result.error) {
      setEvents([]);
      setError('Privacy activity could not be loaded.');
    } else {
      setEvents(
        (result.data ?? [])
          .map(normalizePrivacyEvent)
          .filter((event): event is PrivacyActivityEvent => event !== null)
      );
    }
    setLoading(false);
  };

  useEffect(() => {
    ownerRef.current = ownerId;
    requestGenerationRef.current += 1;
    setEvents([]);
    setLoading(false);
    setError('');
    setNotice('');
    loggedView.current = false;
    return () => {
      requestGenerationRef.current += 1;
    };
  }, [ownerId]);

  useEffect(() => {
    if (!opened) return;
    const refresh = () => void load();
    window.addEventListener(PRIVACY_ACTIVITY_UPDATED_EVENT, refresh);
    return () => window.removeEventListener(PRIVACY_ACTIVITY_UPDATED_EVENT, refresh);
    // `load` intentionally follows the current owner without subscribing on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened, ownerId]);

  const openActivity = async () => {
    const requestedOwner = ownerId;
    setOpened(true);
    setNotice('');

    if (requestedOwner && !loggedView.current) {
      loggedView.current = true;
      try {
        await recordWebPrivacyEvent('privacy_notice_viewed', {
          method: 'privacy_settings',
        });
      } catch {
        if (ownerRef.current === requestedOwner) {
          setNotice('Activity loaded, but this view could not be recorded.');
        }
      }
    }
    await load();
  };

  return (
    <Card className="mb-6 overflow-hidden">
      <details
        className="group"
        onToggle={(event) => {
          if (event.currentTarget.open) void openActivity();
          else setOpened(false);
        }}
      >
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset">
          <span className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-secondary">
              <LockKeyhole className="h-5 w-5" aria-hidden="true" />
            </span>
            <span>
              <span className="block text-xl font-semibold">Privacy Activity</span>
              <span className="mt-1 block text-sm font-normal text-muted-foreground">
                See recorded privacy actions. No journal, chat, or wellbeing content appears here.
              </span>
            </span>
          </span>
          <ChevronDown
            className="h-5 w-5 shrink-0 transition-transform group-open:rotate-180"
            aria-hidden="true"
          />
        </summary>

        <CardContent className="border-t border-border pt-6">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">Showing your 50 most recent actions.</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void load()}
              disabled={loading || !ownerId}
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
              Refresh
            </Button>
          </div>

          {loading && events.length === 0 && (
            <p role="status" className="mt-4 text-sm text-muted-foreground">
              Loading privacy activity...
            </p>
          )}
          {error && (
            <p role="alert" className="mt-4 text-sm text-destructive">
              {error}
            </p>
          )}
          {notice && (
            <p role="status" className="mt-4 text-sm text-muted-foreground">
              {notice}
            </p>
          )}

          {!loading && !error && events.length === 0 && (
            <p className="mt-4 rounded-xl border border-border bg-secondary p-4 text-sm text-muted-foreground">
              No privacy activity yet.
            </p>
          )}

          {events.length > 0 && (
            <ol className="mt-4 divide-y divide-border rounded-xl border border-border bg-background">
              {events.map((event) => (
                <li key={event.id} className="p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="font-medium">{EVENT_LABELS[event.eventType]}</p>
                    <time className="text-xs text-muted-foreground" dateTime={event.occurredAt}>
                      {formatOccurredAt(event.occurredAt)}
                    </time>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <span className="rounded-full bg-secondary px-2 py-1">
                      {readableToken(event.platform)}
                    </span>
                    {PRIVACY_METADATA_KEYS.map((key) =>
                      event.metadata[key] ? (
                        <span key={key} className="rounded-full bg-secondary px-2 py-1">
                          {METADATA_LABELS[key]}: {readableToken(event.metadata[key] as string)}
                        </span>
                      ) : null
                    )}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </details>
    </Card>
  );
}
