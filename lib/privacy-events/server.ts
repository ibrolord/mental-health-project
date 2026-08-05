import 'server-only';

import { supabaseAdmin } from '@/lib/supabase/server';

export type PrivacyEventType =
  | 'privacy_notice_viewed'
  | 'consent_granted'
  | 'consent_withdrawn'
  | 'sharing_enabled'
  | 'sharing_disabled'
  | 'export_requested'
  | 'deletion_requested';

export type PrivacyPlatform = 'web' | 'ios' | 'android';

type PrivacyEventMetadata = Partial<{
  policy_version: string;
  app_version: string;
  setting: 'partner_sharing' | 'analytics' | 'crash_reporting' | 'reminders';
  method:
    | 'onboarding'
    | 'privacy_settings'
    | 'account_settings'
    | 'support_request';
}>;

export function privacyPlatformFromRequest(request: Request): PrivacyPlatform {
  const requested = request.headers.get('x-client-platform');
  return requested === 'ios' || requested === 'android' ? requested : 'web';
}

export async function recordServerPrivacyEvent(input: {
  userId: string;
  eventType: PrivacyEventType;
  platform: PrivacyPlatform;
  metadata?: PrivacyEventMetadata;
}): Promise<void> {
  const { error } = await supabaseAdmin.from('privacy_events').insert({
    user_id: input.userId,
    event_type: input.eventType,
    platform: input.platform,
    metadata: input.metadata ?? {},
  });

  if (error) {
    throw new Error(`Privacy activity could not be recorded: ${error.message}`);
  }
}
