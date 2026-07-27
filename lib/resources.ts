/**
 * Curated directories for finding professional help and peer support.
 *
 * Rules for anything added here:
 * 1. Directories and non-profits only. No individual providers, no clinics,
 *    no affiliate or referral relationships. MHtoolkit does not screen, vet,
 *    or endorse anyone listed.
 * 2. No wording that implies MHtoolkit matches, recommends, or refers users
 *    to a provider. That framing is what draws App Store Guideline 1.4.1.
 * 3. Crisis entries stay in CRISIS_LINES and are rendered separately and
 *    above everything else. They must never be mixed into the directory list.
 * 4. Do not add Crisis Text Line's keyword instructions here. The pre-submit
 *    gate (mobile/scripts/verify-ios-review-build.sh) fails the build on that
 *    phrasing.
 */

export type Region =
  | 'US'
  | 'Canada'
  | 'US & Canada'
  | 'Nigeria'
  | 'Kenya'
  | 'South Africa'
  | 'Ghana'
  | 'Zimbabwe'
  | 'Uganda'
  | 'Tanzania'
  | 'Africa'
  | 'International';

/** Used to group cards so nobody scrolls past four US numbers to find theirs. */
export type RegionGroup = 'Africa' | 'North America' | 'Global';

export const REGION_GROUP: Record<Region, RegionGroup> = {
  US: 'North America',
  Canada: 'North America',
  'US & Canada': 'North America',
  Nigeria: 'Africa',
  Kenya: 'Africa',
  'South Africa': 'Africa',
  Ghana: 'Africa',
  Zimbabwe: 'Africa',
  Uganda: 'Africa',
  Tanzania: 'Africa',
  Africa: 'Africa',
  International: 'Global',
};

export type CrisisLine = {
  name: string;
  region: Region;
  /** Short, calm description. No urgency language beyond what is factual. */
  description: string;
  /** Displayed dial string, omitted for web-only services. */
  phone?: string;
  /**
   * Stated plainly because it is NOT uniform. Befrienders Kenya is weekday
   * office hours, not 24/7, and telling someone in crisis otherwise is worse
   * than telling them nothing. Never render a blanket "always open" claim
   * across this list.
   */
  hours: string;
  url: string;
};

export type ResourceLink = {
  name: string;
  region: Region;
  description: string;
  url: string;
  /** Optional flag surfaced as a chip, e.g. free or low cost. */
  note?: string;
};

/**
 * Every phone number below was verified against the operating organisation's
 * own site or a vetting federation (LifeLine International, Befrienders
 * Worldwide) on 2026-07-27. Do NOT add a number sourced from a listicle, a
 * business directory, or recall. If you cannot confirm a number from the
 * organisation itself, add the organisation to AFRICA_SUPPORT with its URL and
 * no phone field, and let GLOBAL_DIRECTORIES carry the lookup.
 */
export const CRISIS_LINES: CrisisLine[] = [
  {
    name: '988 Suicide & Crisis Lifeline',
    region: 'US & Canada',
    description:
      'Free and confidential support for anyone in distress. Call or text 988 from the United States or Canada.',
    phone: '988',
    hours: '24/7',
    url: 'https://988lifeline.org',
  },
  {
    name: 'Talk Suicide Canada',
    region: 'Canada',
    description: 'Bilingual crisis support across Canada, by phone.',
    phone: '1-833-456-4566',
    hours: '24/7',
    url: 'https://talksuicide.ca',
  },
  {
    name: 'Suicide Crisis Helpline (SADAG)',
    region: 'South Africa',
    description:
      'Run by the South African Depression and Anxiety Group, the country’s largest mental health non-profit. Toll free.',
    phone: '0800 567 567',
    hours: '24/7',
    url: 'https://www.sadag.org',
  },
  {
    name: 'Befrienders Kenya',
    region: 'Kenya',
    description:
      'Emotional support by phone, SMS, or WhatsApp. Free and confidential.',
    phone: '+254 722 178 177',
    hours: 'Mon to Fri, 9am to 5pm',
    url: 'https://befrienderske.org',
  },
  {
    name: 'The Trevor Project',
    region: 'US',
    description:
      'Crisis support for LGBTQ+ young people, by phone, chat, or text.',
    phone: '1-866-488-7386',
    hours: '24/7',
    url: 'https://www.thetrevorproject.org/get-help/',
  },
  {
    name: 'Veterans Crisis Line',
    region: 'US',
    description:
      'Confidential support for veterans, service members, and their families. Dial 988, then press 1.',
    phone: '988, then 1',
    hours: '24/7',
    url: 'https://www.veteranscrisisline.net',
  },
];

/**
 * Country-by-country lookups maintained by organisations whose job is keeping
 * them current. These are the backbone for every country we do not list
 * directly, and they stay correct when a national number changes.
 */
export const GLOBAL_DIRECTORIES: ResourceLink[] = [
  {
    name: 'Find A Helpline',
    region: 'International',
    description:
      'Verified crisis lines for over 130 countries. Pick your country and it shows what is free, what is open now, and how to reach it.',
    url: 'https://findahelpline.com',
    note: 'Start here',
  },
  {
    name: 'Befrienders Worldwide',
    region: 'International',
    description:
      'A global network of emotional support centres, searchable by country.',
    url: 'https://befrienders.org',
  },
  {
    name: 'LifeLine International',
    region: 'International',
    description:
      'Federation of national crisis lines, with member organisations listed per country.',
    url: 'https://lifeline-international.com',
  },
];

export const THERAPIST_DIRECTORIES: ResourceLink[] = [
  {
    name: 'Psychology Today',
    region: 'US & Canada',
    description:
      'The largest searchable directory of therapists, filterable by location, insurance, specialty, and fee.',
    url: 'https://www.psychologytoday.com/us/therapists',
  },
  {
    name: 'Open Path Collective',
    region: 'US',
    description:
      'A non-profit network of therapists offering sessions at reduced rates for people without adequate insurance.',
    url: 'https://openpathcollective.org',
    note: 'Reduced cost',
  },
  {
    name: 'Inclusive Therapists',
    region: 'US & Canada',
    description:
      'Directory centering the needs of BIPOC, LGBTQ+, disabled, and neurodivergent people seeking care.',
    url: 'https://www.inclusivetherapists.com',
  },
  {
    name: 'FindTreatment.gov',
    region: 'US',
    description:
      'The federal treatment locator from SAMHSA, covering mental health and substance use services.',
    url: 'https://findtreatment.gov',
    note: 'Government run',
  },
  {
    name: 'Canadian Mental Health Association',
    region: 'Canada',
    description:
      'Find your local CMHA branch for counselling, programs, and navigation help in your province.',
    url: 'https://cmha.ca/find-help/find-cmha-in-your-area/',
  },
];

export const SUPPORT_GROUPS: ResourceLink[] = [
  {
    name: 'NAMI Support Groups',
    region: 'US',
    description:
      'Free peer-led groups for people living with mental health conditions, and separate groups for family members.',
    url: 'https://www.nami.org/Support-Education/Support-Groups/',
    note: 'Free',
  },
  {
    name: 'DBSA Support Groups',
    region: 'US & Canada',
    description:
      'Peer groups from the Depression and Bipolar Support Alliance, offered both online and in person.',
    url: 'https://www.dbsalliance.org/support/chapters-and-support-groups/',
    note: 'Free',
  },
  {
    name: 'Mental Health America',
    region: 'US',
    description:
      'Screening tools, local affiliates, and peer support programs from a long-standing non-profit.',
    url: 'https://mhanational.org/find-affiliate',
  },
  {
    name: 'SMART Recovery',
    region: 'International',
    description:
      'Self-directed meetings for people working on addictive behaviors, available worldwide and online.',
    url: 'https://meetings.smartrecovery.org',
    note: 'Free',
  },
];

export const COMMUNITY_HELP: ResourceLink[] = [
  {
    name: '211 (United States)',
    region: 'US',
    description:
      'Dial 211 to reach a local navigator for housing, food, utilities, and mental health services.',
    url: 'https://www.211.org',
  },
  {
    name: '211 (Canada)',
    region: 'Canada',
    description:
      'Free, confidential navigation to community and social services across Canada.',
    url: 'https://211.ca',
  },
];

/**
 * African national organisations.
 *
 * These are listed WITHOUT phone numbers on purpose. Their numbers could not
 * be confirmed from the organisation's own site at the time of writing, and a
 * wrong crisis number is the most harmful error this file could contain. Each
 * entry links the organisation directly, and the per-country Find A Helpline
 * pages below carry verified, actively maintained numbers.
 *
 * If you later verify a number from an organisation's own page, move it into
 * CRISIS_LINES with its real hours rather than adding a phone field here.
 */
export const AFRICA_SUPPORT: ResourceLink[] = [
  {
    name: 'Mentally Aware Nigeria Initiative',
    region: 'Nigeria',
    description:
      'Nigeria’s largest provider of crisis support, offering free and confidential help plus mental health advocacy.',
    url: 'https://mentallyaware.org',
  },
  {
    name: 'Nigerian Mental Health',
    region: 'Nigeria',
    description:
      'Maintains a current list of Nigerian helplines, clinics, and practitioners by state.',
    url: 'https://www.nigerianmentalhealth.org/helplines',
    note: 'Helpline list',
  },
  {
    name: 'SADAG',
    region: 'South Africa',
    description:
      'The South African Depression and Anxiety Group runs multiple toll-free lines, support groups, and a clinician directory.',
    url: 'https://www.sadag.org',
    note: 'Support groups',
  },
  {
    name: 'Befrienders Kenya',
    region: 'Kenya',
    description:
      'Suicide prevention and emotional support, plus community awareness work across Kenya.',
    url: 'https://befrienderske.org',
  },
  // Ghana's Mental Health Authority site (mhaghana.com) did not resolve
  // reliably when checked on 2026-07-27, so it is intentionally omitted rather
  // than shipped as a dead link. Ghana is still covered by the country lookup
  // below. Re-add here if the domain becomes stable.
  {
    name: 'Friendship Bench',
    region: 'Zimbabwe',
    description:
      'Free community talk therapy delivered by trained health workers on benches at local clinics, now part of Zimbabwe’s national mental health plan.',
    url: 'https://www.friendshipbenchzimbabwe.org',
    note: 'Free',
  },
];

/**
 * Deep links into Find A Helpline's per-country pages. Cheap to extend: the
 * path is the ISO 3166-1 alpha-2 code in lower case.
 */
export const AFRICA_COUNTRY_LOOKUPS: ResourceLink[] = [
  {
    name: 'Nigeria helplines',
    region: 'Nigeria',
    description: 'Verified crisis and support lines for Nigeria.',
    url: 'https://findahelpline.com/countries/ng',
  },
  {
    name: 'Kenya helplines',
    region: 'Kenya',
    description: 'Verified crisis and support lines for Kenya.',
    url: 'https://findahelpline.com/countries/ke',
  },
  {
    name: 'South Africa helplines',
    region: 'South Africa',
    description: 'Verified crisis and support lines for South Africa.',
    url: 'https://findahelpline.com/countries/za',
  },
  {
    name: 'Ghana helplines',
    region: 'Ghana',
    description: 'Verified crisis and support lines for Ghana.',
    url: 'https://findahelpline.com/countries/gh',
  },
  {
    name: 'Tanzania helplines',
    region: 'Tanzania',
    description: 'Verified crisis and support lines for Tanzania.',
    url: 'https://findahelpline.com/countries/tz',
  },
  {
    name: 'Uganda helplines',
    region: 'Uganda',
    description: 'Verified crisis and support lines for Uganda.',
    url: 'https://findahelpline.com/countries/ug',
  },
  {
    name: 'Zimbabwe helplines',
    region: 'Zimbabwe',
    description: 'Verified crisis and support lines for Zimbabwe.',
    url: 'https://findahelpline.com/countries/zw',
  },
];

/**
 * Shown wherever these directories appear. Kept consistent with the medical
 * disclaimer in the App Store description so the two never drift apart.
 */
export const RESOURCES_DISCLAIMER =
  'These are public directories, not referrals. MHtoolkit does not screen, endorse, or have any relationship with the organizations or providers listed. MHtoolkit does not provide medical diagnoses or treatment advice. Seek a doctor’s advice in addition to using this app and before making medical decisions.';

export const CRISIS_NOTE =
  'Hours differ by line, so check before you rely on one. If your country is not listed, Find A Helpline covers over 130 countries. In an immediate emergency, contact your local emergency number or nearest emergency department.';
