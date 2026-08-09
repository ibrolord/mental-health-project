export const WEB_OPERATIONAL_EVENT_TYPES = [
  'route_error',
  'global_error',
  'notification_permission_granted',
  'notification_permission_denied',
  'notification_registration_succeeded',
  'notification_registration_failed',
  'notification_scheduling_succeeded',
  'notification_scheduling_failed',
  'notification_response_received',
  'notification_response_failed',
] as const;

export type WebOperationalEventType =
  (typeof WEB_OPERATIONAL_EVENT_TYPES)[number];

const WEB_OPERATIONAL_EVENTS = new Set<string>(WEB_OPERATIONAL_EVENT_TYPES);

export async function recordOperationalEvent(
  eventType: WebOperationalEventType
): Promise<void> {
  if (!WEB_OPERATIONAL_EVENTS.has(eventType)) return;

  try {
    const { supabase } = await import('@/lib/supabase/client');
    await supabase.rpc('record_operational_event', {
      p_event_type: eventType,
      p_source: 'web',
    });
  } catch {
    // Observability is best-effort and must never interrupt recovery UI.
  }
}
