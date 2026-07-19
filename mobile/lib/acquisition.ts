import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { supabase } from './supabase';

const ATTRIBUTION_DEADLINE_MS = 1500;
const STORAGE_KEY = 'mhtoolkit_acquisition_v1';
const SOURCES = new Set([
  'direct',
  'founder',
  'referral',
  'campus',
  'practitioner',
  'creator',
  'community',
  'producthunt',
  'linkedin',
  'x',
  'instagram',
  'newsletter',
]);
const MEDIUMS = new Set([
  'direct',
  'dm',
  'email',
  'organic',
  'partner',
  'referral',
  'social',
  'qr',
  'newsletter',
]);
const CAMPAIGNS = new Set([
  'seven_day_check_in',
  'closed_test',
  'focused_launch',
]);
const CONTENT = new Set([
  'unspecified',
  'founder_note',
  'student_group',
  'practitioner_intro',
  'creator_demo',
  'member_share',
  'launch_post',
  'qr_card',
  'algoma_student_success',
  'algoma_wellness_coordinator',
  'bcit_student_life',
  'carleton_student_affairs',
  'cbu_student_experience',
  'concordia_cu_wellness',
  'dalhousie_be_well',
  'guelph_wellness_education',
  'lakehead_student_success',
  'laurier_wellness',
  'manitoba_student_wellness',
  'mcgill_student_services',
  'memorial_student_wellness',
  'queens_health_promotion',
  'sfu_health_promotion',
  'sfu_health_promotion_reroute',
  'trent_student_affairs',
  'ualberta_wellness_supports',
  'ubc_wellbeing',
  'ucalgary_campus_wellbeing',
  'ulethbridge_wellness_outreach',
  'unb_student_affairs',
  'uottawa_peer_wellness',
  'upei_student_experience',
  'uregina_student_wellness',
  'usask_peer_health',
  'uvic_student_life_reroute',
  'uvic_wellness_promotion',
  'uwinnipeg_student_wellness',
  'waterloo_health_promotion',
  'western_wellness',
  'windsor_student_experience',
]);

interface CampaignAttribution {
  source: string;
  medium: string;
  campaign: string;
  content: string;
}

const DIRECT_ATTRIBUTION: CampaignAttribution = {
  source: 'direct',
  medium: 'direct',
  campaign: 'seven_day_check_in',
  content: 'unspecified',
};

function allowlisted(
  value: string | null,
  allowed: Set<string>,
  fallback: string
): string {
  const normalized = (value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  if (!normalized) return fallback;
  return allowed.has(normalized) ? normalized : 'other';
}

function campaignFromUrl(url: string): CampaignAttribution | null {
  const parsed = new URL(url);
  if (!parsed.searchParams.has('utm_source')) return null;

  return {
    source: allowlisted(parsed.searchParams.get('utm_source'), SOURCES, 'direct'),
    medium: allowlisted(parsed.searchParams.get('utm_medium'), MEDIUMS, 'direct'),
    campaign: allowlisted(
      parsed.searchParams.get('utm_campaign'),
      CAMPAIGNS,
      'seven_day_check_in'
    ),
    content: allowlisted(
      parsed.searchParams.get('utm_content'),
      CONTENT,
      'unspecified'
    ),
  };
}

export async function captureCampaignFromUrl(url: string | null): Promise<void> {
  if (!url) return;

  try {
    if (await AsyncStorage.getItem(STORAGE_KEY)) return;
    const attribution = campaignFromUrl(url);
    if (attribution) {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(attribution));
    }
  } catch (error) {
    console.warn('Unable to capture aggregate acquisition source:', error);
  }
}

async function readAttribution(): Promise<CampaignAttribution> {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    if (!stored) return DIRECT_ATTRIBUTION;
    const parsed = JSON.parse(stored) as CampaignAttribution;
    return {
      source: allowlisted(parsed.source, SOURCES, 'direct'),
      medium: allowlisted(parsed.medium, MEDIUMS, 'direct'),
      campaign: allowlisted(parsed.campaign, CAMPAIGNS, 'seven_day_check_in'),
      content: allowlisted(parsed.content, CONTENT, 'unspecified'),
    };
  } catch {
    return DIRECT_ATTRIBUTION;
  }
}

export async function clearStoredAcquisitionAttribution(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
}

async function recordActivationAttribution(userId: string): Promise<void> {
  try {
    const attribution = await readAttribution();
    const platform = Platform.OS === 'ios' ? 'ios' : 'android';
    const { error } = await supabase
      .from('acquisition_attribution')
      .upsert(
        {
          user_id: userId,
          ...attribution,
          platform,
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
    setTimeout(resolve, ATTRIBUTION_DEADLINE_MS);
  });

  // Attribution is best-effort telemetry and must not delay a successful check-in.
  void Promise.race([recordActivationAttribution(userId), deadline]);
}
