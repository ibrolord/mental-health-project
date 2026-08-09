import { Platform } from 'react-native';
import { supabase } from './supabase';

export const IOS_OPERATIONAL_EVENT_TYPES = [
  'render_error',
  'notification_permission_granted',
  'notification_permission_denied',
  'notification_registration_succeeded',
  'notification_registration_failed',
  'notification_scheduling_succeeded',
  'notification_scheduling_failed',
  'notification_response_received',
  'notification_response_failed',
] as const;

export type IosOperationalEventType =
  (typeof IOS_OPERATIONAL_EVENT_TYPES)[number];

const IOS_OPERATIONAL_EVENTS = new Set<string>(IOS_OPERATIONAL_EVENT_TYPES);

export async function recordOperationalEvent(
  eventType: IosOperationalEventType
): Promise<void> {
  if (Platform.OS !== 'ios' || !IOS_OPERATIONAL_EVENTS.has(eventType)) return;

  try {
    await supabase.rpc('record_operational_event', {
      p_event_type: eventType,
      p_source: 'ios',
    });
  } catch {
    // Observability is best-effort and must never interrupt recovery UI.
  }
}
