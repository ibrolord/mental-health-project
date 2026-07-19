'use client';

import {
  ACQUISITION_STORAGE_KEY,
  campaignFromSearchParams,
  isCampaignLink,
  parseStoredCampaign,
  type CampaignAttribution,
} from './acquisition-taxonomy';
import { supabase } from './supabase/client';

const ATTRIBUTION_DEADLINE_MS = 1500;
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

export function clearStoredAcquisitionAttribution(): void {
  if (typeof window === 'undefined') return;

  window.localStorage.removeItem(ACQUISITION_STORAGE_KEY);
}

async function recordActivationAttribution(userId: string): Promise<void> {
  try {
    const attribution = readAttribution();
    const { error } = await supabase
      .from('acquisition_attribution')
      .upsert(
        {
          user_id: userId,
          ...attribution,
          platform: 'web',
        },
        { onConflict: 'user_id', ignoreDuplicates: true }
      );

    if (error) {
      console.warn('Unable to record aggregate acquisition source:', error.message);
    }
  } catch (error) {
    // Measurement must never interfere with a user's check-in.
    console.warn('Unable to record aggregate acquisition source:', error);
  }
}

export function queueActivationAttribution(userId: string): void {
  const deadline = new Promise<void>((resolve) => {
    window.setTimeout(resolve, ATTRIBUTION_DEADLINE_MS);
  });

  // Attribution is best-effort telemetry and must not delay a successful check-in.
  void Promise.race([recordActivationAttribution(userId), deadline]);
}
