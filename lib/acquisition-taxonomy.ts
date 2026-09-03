export const ACQUISITION_STORAGE_KEY = 'mhtoolkit_acquisition_v1';

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

export interface CampaignAttribution {
  source: string;
  medium: string;
  campaign: string;
  content: string;
}

interface SearchParamsReader {
  get: (name: string) => string | null;
}

function normalizeToken(value: string | null): string {
  return (value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function allowlisted(
  value: string | null,
  allowed: Set<string>,
  fallback: string
): string {
  const normalized = normalizeToken(value);
  if (!normalized) return fallback;
  return allowed.has(normalized) ? normalized : 'other';
}

export function campaignFromSearchParams(
  searchParams: SearchParamsReader
): CampaignAttribution {
  return {
    source: allowlisted(searchParams.get('utm_source'), SOURCES, 'direct'),
    medium: allowlisted(searchParams.get('utm_medium'), MEDIUMS, 'direct'),
    campaign: allowlisted(
      searchParams.get('utm_campaign'),
      CAMPAIGNS,
      'seven_day_check_in'
    ),
    content: allowlisted(
      searchParams.get('utm_content'),
      CONTENT,
      'unspecified'
    ),
  };
}

export function isCampaignLink(searchParams: SearchParamsReader): boolean {
  return searchParams.get('utm_source') !== null;
}

export function parseStoredCampaign(value: string | null): CampaignAttribution | null {
  if (!value) return null;

  try {
    const parsed = JSON.parse(value) as Partial<CampaignAttribution>;
    const searchParams = new URLSearchParams({
      utm_source: parsed.source ?? '',
      utm_medium: parsed.medium ?? '',
      utm_campaign: parsed.campaign ?? '',
      utm_content: parsed.content ?? '',
    });
    return campaignFromSearchParams(searchParams);
  } catch {
    return null;
  }
}
