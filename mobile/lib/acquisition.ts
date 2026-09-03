import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { supabase } from './supabase';
import type { LocalCheckInFields } from './check-in';

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
  'reddit',
  'unicef_hub',
  'emhic',
  'lova_africa',
  'project_helping',
  'government',
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
  'resource_directory',
  'partnership',
  'reply',
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
  'lvct_health',
  'csvr',
  'camfed',
  'ird_global',
  'aku_brain_mind',
  'stand_out_mental_health',
  'jakes_gerwel_fellowship',
  'refugee_consortium_kenya',
  'chiromo_hospital_group',
  'iosapps_app_shelf_august_2026',
  'therapists_monthly_promo_august_2026',
  'adolescent_mental_health_hub',
  'digital_mental_health_directory',
  'african_youth_wellness',
  'community_request',
  // Legacy compatibility only; no canonical campaign link uses this label.
  'explicit_tool_request',
  'mental_health_tools_directory',
  'public_health_pilot',
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

export interface AttributedCheckIn extends LocalCheckInFields {
  emoji: string;
  note?: string | null;
  tags?: string[];
}

export async function saveCheckInWithAttribution(
  expectedUserId: string,
  checkIn: AttributedCheckIn
): Promise<string> {
  const attribution = await readAttribution();
  const platform = Platform.OS === 'ios' ? 'ios' : 'android';
  const { data, error } = await supabase.rpc('patch_daily_mood_check_in', {
    p_expected_user_id: expectedUserId,
    p_emoji: checkIn.emoji,
    p_note: checkIn.note ?? null,
    p_update_note: Object.prototype.hasOwnProperty.call(checkIn, 'note'),
    p_tags: checkIn.tags ?? [],
    p_update_tags: Object.prototype.hasOwnProperty.call(checkIn, 'tags'),
    p_local_date: checkIn.local_date,
    p_utc_offset_minutes: checkIn.utc_offset_minutes,
    p_source: attribution.source,
    p_medium: attribution.medium,
    p_campaign: attribution.campaign,
    p_content: attribution.content,
    p_platform: platform,
  });

  if (error) throw error;
  if (typeof data !== 'string' || !data) {
    throw new Error('Check-in save did not return a mood entry ID.');
  }
  return data;
}
