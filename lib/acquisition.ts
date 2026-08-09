'use client';

import {
  ACQUISITION_STORAGE_KEY,
  campaignFromSearchParams,
  isCampaignLink,
  parseStoredCampaign,
  type CampaignAttribution,
} from './acquisition-taxonomy';
import type { LocalCheckInFields } from './check-in';
import { supabase } from './supabase/client';

const DIRECT_ATTRIBUTION: CampaignAttribution = {
  source: 'direct',
  medium: 'direct',
  campaign: 'seven_day_check_in',
  content: 'unspecified',
};

export function captureCampaignFromLocation(search: string): void {
  if (typeof window === 'undefined') return;

  const searchParams = new URLSearchParams(search);
  if (!isCampaignLink(searchParams)) return;

  try {
    if (window.localStorage.getItem(ACQUISITION_STORAGE_KEY)) return;
    window.localStorage.setItem(
      ACQUISITION_STORAGE_KEY,
      JSON.stringify(campaignFromSearchParams(searchParams))
    );
  } catch {
    // Storage can be unavailable in hardened browser modes. Activation still works.
  }
}

function readAttribution(): CampaignAttribution {
  if (typeof window === 'undefined') return DIRECT_ATTRIBUTION;

  try {
    return (
      parseStoredCampaign(window.localStorage.getItem(ACQUISITION_STORAGE_KEY)) ??
      DIRECT_ATTRIBUTION
    );
  } catch {
    return DIRECT_ATTRIBUTION;
  }
}

export function clearStoredAcquisitionAttribution(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    window.localStorage.removeItem(ACQUISITION_STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}

export interface AttributedCheckIn extends LocalCheckInFields {
  emoji: string;
  note?: string | null;
  tags?: string[];
}

export async function saveCheckInWithAttribution(
  expectedUserId: string,
  checkIn: AttributedCheckIn
): Promise<string> {
  const attribution = readAttribution();
  const { data, error } = await supabase.rpc('save_check_in_with_attribution', {
    p_expected_user_id: expectedUserId,
    p_emoji: checkIn.emoji,
    p_note: checkIn.note ?? null,
    p_tags: checkIn.tags ?? [],
    p_local_date: checkIn.local_date,
    p_utc_offset_minutes: checkIn.utc_offset_minutes,
    p_source: attribution.source,
    p_medium: attribution.medium,
    p_campaign: attribution.campaign,
    p_content: attribution.content,
    p_platform: 'web',
  });

  if (error) throw error;
  if (typeof data !== 'string' || data.length === 0) {
    throw new Error('Check-in was saved without a record identifier');
  }
  return data;
}
