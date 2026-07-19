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
