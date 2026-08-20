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

export const AFRICA_COUNTRIES = [
  { name: 'Algeria', code: 'dz' },
  { name: 'Angola', code: 'ao' },
  { name: 'Benin', code: 'bj' },
  { name: 'Botswana', code: 'bw' },
  { name: 'Burkina Faso', code: 'bf' },
  { name: 'Burundi', code: 'bi' },
  { name: 'Cabo Verde', code: 'cv' },
  { name: 'Cameroon', code: 'cm' },
  { name: 'Central African Republic', code: 'cf' },
  { name: 'Chad', code: 'td' },
  { name: 'Comoros', code: 'km' },
  { name: 'Republic of the Congo', code: 'cg' },
  { name: 'Democratic Republic of the Congo', code: 'cd' },
  { name: "Côte d'Ivoire", code: 'ci' },
  { name: 'Djibouti', code: 'dj' },
  { name: 'Egypt', code: 'eg' },
  { name: 'Equatorial Guinea', code: 'gq' },
  { name: 'Eritrea', code: 'er' },
  { name: 'Eswatini', code: 'sz' },
  { name: 'Ethiopia', code: 'et' },
  { name: 'Gabon', code: 'ga' },
  { name: 'Gambia', code: 'gm' },
  { name: 'Ghana', code: 'gh' },
  { name: 'Guinea', code: 'gn' },
  { name: 'Guinea-Bissau', code: 'gw' },
  { name: 'Kenya', code: 'ke' },
  { name: 'Lesotho', code: 'ls' },
  { name: 'Liberia', code: 'lr' },
  { name: 'Libya', code: 'ly' },
  { name: 'Madagascar', code: 'mg' },
  { name: 'Malawi', code: 'mw' },
  { name: 'Mali', code: 'ml' },
  { name: 'Mauritania', code: 'mr' },
  { name: 'Mauritius', code: 'mu' },
  { name: 'Morocco', code: 'ma' },
  { name: 'Mozambique', code: 'mz' },
  { name: 'Namibia', code: 'na' },
  { name: 'Niger', code: 'ne' },
  { name: 'Nigeria', code: 'ng' },
  { name: 'Rwanda', code: 'rw' },
  { name: 'São Tomé and Príncipe', code: 'st' },
  { name: 'Senegal', code: 'sn' },
  { name: 'Seychelles', code: 'sc' },
  { name: 'Sierra Leone', code: 'sl' },
  { name: 'Somalia', code: 'so' },
  { name: 'South Africa', code: 'za' },
  { name: 'South Sudan', code: 'ss' },
  { name: 'Sudan', code: 'sd' },
  { name: 'Tanzania', code: 'tz' },
  { name: 'Togo', code: 'tg' },
  { name: 'Tunisia', code: 'tn' },
  { name: 'Uganda', code: 'ug' },
  { name: 'Zambia', code: 'zm' },
  { name: 'Zimbabwe', code: 'zw' },
] as const;

export type AfricaCountry = (typeof AFRICA_COUNTRIES)[number]['name'];

export type Region =
  | 'US'
  | 'Canada'
  | 'US & Canada'
  | AfricaCountry
  | 'Africa'
  | 'UK'
  | 'International';

/** Used to group cards so nobody scrolls past four US numbers to find theirs. */
export type RegionGroup = 'Africa' | 'North America' | 'Global';

const AFRICA_COUNTRY_NAMES = new Set<string>(
  AFRICA_COUNTRIES.map(({ name }) => name)
);

export function regionGroup(region: Region): RegionGroup {
  if (region === 'US' || region === 'Canada' || region === 'US & Canada') {
    return 'North America';
  }
  if (region === 'Africa' || AFRICA_COUNTRY_NAMES.has(region)) return 'Africa';
  return 'Global';
}

export type CrisisLine = {
  name: string;
  region: Region;
  /** Short, calm description. No urgency language beyond what is factual. */
  description: string;
  /** Human-readable number. Never derive a URI from this display value. */
  phone?: string;
  /** Explicit actions verified from the service's official source. */
  callUri?: `tel:${string}`;
  textUri?: `sms:${string}`;
  callInstructions?: string;
  /**
   * Stated plainly because it is NOT uniform. Befrienders Kenya is weekday
   * office hours, not 24/7, and telling someone in crisis otherwise is worse
   * than telling them nothing. Never render a blanket "always open" claim
   * across this list.
   */
  hours: string;
  url: string;
  verifiedAt: string;
};

export type ResourceLink = {
  name: string;
  region: Region;
  description: string;
  url: string;
  /** Optional flag surfaced as a chip, e.g. free or low cost. */
  note?: string;
  /** Important eligibility or moderation limit shown on the card. */
  caveat?: string;
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
    name: '9-8-8 Suicide Crisis Helpline',
    region: 'Canada',
    description:
      'Canada-wide suicide crisis support in English and French. Call or text any time.',
    phone: '9-8-8',
    callUri: 'tel:988',
    textUri: 'sms:988',
    hours: '24/7',
    url: 'https://988.ca',
    verifiedAt: '2026-08-11',
  },
  {
    name: '988 Suicide & Crisis Lifeline',
    region: 'US',
    description:
      'Free and confidential crisis support across the United States and its territories. Call or text any time.',
    phone: '988',
    callUri: 'tel:988',
    textUri: 'sms:988',
    hours: '24/7',
    url: 'https://988lifeline.org/get-help/',
    verifiedAt: '2026-08-11',
  },
  {
    name: 'Suicide Crisis Helpline (SADAG)',
    region: 'South Africa',
    description:
      'Run by the South African Depression and Anxiety Group, the country’s largest mental health non-profit. Toll free.',
    phone: '0800 567 567',
    callUri: 'tel:0800567567',
    hours: '24/7',
    url: 'https://www.sadag.org',
    verifiedAt: '2026-07-27',
  },
  {
    name: 'Befrienders Kenya',
    region: 'Kenya',
    description:
      'Emotional support by phone, SMS, or WhatsApp. Free and confidential.',
    phone: '+254 722 178 177',
    callUri: 'tel:+254722178177',
    textUri: 'sms:+254722178177',
    hours: 'Mon to Fri, 9am to 5pm',
    url: 'https://befrienderske.org',
    verifiedAt: '2026-07-27',
  },
  {
    name: 'The Trevor Project',
    region: 'US',
    description:
      'Crisis support for LGBTQ+ young people, by phone, chat, or text.',
    phone: '1-866-488-7386',
    callUri: 'tel:+18664887386',
    hours: '24/7',
    url: 'https://www.thetrevorproject.org/get-help/',
    verifiedAt: '2026-07-27',
  },
  {
    name: 'Veterans Crisis Line',
    region: 'US',
    description:
      'Confidential support for veterans, service members, and their families. Dial 988, then press 1.',
    phone: '988, then 1',
    callUri: 'tel:988',
    textUri: 'sms:838255',
    callInstructions: 'After the call connects, press 1.',
    hours: '24/7',
    url: 'https://www.veteranscrisisline.net',
    verifiedAt: '2026-08-11',
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
    url: 'https://helplinefaqs.nami.org/article/63-online-support',
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
  {
    name: 'SADAG Support Groups',
    region: 'South Africa',
    description:
      'Free groups from the South African Depression and Anxiety Group, including online and condition-specific options.',
    url: 'https://www.sadag.org',
    note: 'Free',
  },
  {
    name: 'Friendship Bench',
    region: 'Zimbabwe',
    description:
      'Free, anonymous WhatsApp sessions and community-based support delivered by trained peer counsellors.',
    url: 'https://www.friendshipbenchzimbabwe.org/need-help',
    note: 'Free',
  },
  {
    name: 'Mental 360',
    region: 'Kenya',
    description:
      'A Kenyan peer-led mental health organization with community support and recovery programming.',
    url: 'https://csoplatform.africa/search/cso/mental-360',
  },
  {
    name: 'Mental Health Uganda',
    region: 'Uganda',
    description:
      'A national user-led organization supporting peer groups, advocacy, and community mental health programs.',
    url: 'https://mhu.ug',
  },
];

export const ONLINE_COMMUNITIES: ResourceLink[] = [
  {
    name: 'Mind Side by Side',
    region: 'UK',
    description:
      'A moderated, 24/7 peer community from the mental health charity Mind.',
    url: 'https://sidebyside.mind.org.uk',
    note: 'Moderated',
    caveat:
      'For adults 18+. Designed for England and Wales, so local signposting may not fit other countries.',
  },
  {
    name: '7 Cups Community',
    region: 'International',
    description:
      'Topic-based forums and group chats with community guidelines and trained volunteer listeners.',
    url: 'https://www.7cups.com/forum/',
    note: 'Global',
    caveat:
      'Peer support, not crisis or clinical care. Avoid sharing names, addresses, or other identifying details.',
  },
  {
    name: 'HealthUnlocked',
    region: 'International',
    description:
      'Health communities moderated by charities, patient organizations, and trained community teams.',
    url: 'https://healthunlocked.com',
    note: 'Moderated',
    caveat:
      'Community quality and eligibility vary. Check the rules and moderators listed for the specific group.',
  },
  {
    name: 'SANE Community',
    region: 'UK',
    description:
      'A free, anonymous, moderated peer-support forum operated by the UK charity SANE.',
    url: 'https://www.sane.org.uk/how-we-help/sane-community',
    note: 'Moderated',
    caveat:
      'For adults 18+. UK-oriented and not a crisis response service.',
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
  {
    name: 'Mental 360',
    region: 'Kenya',
    description:
      'Peer-led community support, prevention, and recovery programs developed in Kenya.',
    url: 'https://csoplatform.africa/search/cso/mental-360',
    note: 'Peer-led',
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
  {
    name: 'Mental Health Uganda',
    region: 'Uganda',
    description:
      'A national user-led organization supporting peer groups, rights advocacy, and community services.',
    url: 'https://mhu.ug',
    note: 'User-led',
  },
];

/**
 * Deep links into Find A Helpline's per-country pages. Cheap to extend: the
 * path is the ISO 3166-1 alpha-2 code in lower case.
 */
const FIND_A_HELPLINE_COUNTRY_BASE =
  'https://findahelpline.com/countries/';
const FIND_A_HELPLINE_DEDICATED_CODES = new Set([
  'dz',
  'bj',
  'bw',
  'bf',
  'bi',
  'cv',
  'ci',
  'dj',
  'sz',
  'ga',
  'gm',
  'gh',
  'ke',
  'lr',
  'mg',
  'mw',
  'mr',
  'mu',
  'ma',
  'mz',
  'na',
  'ne',
  'ng',
  'rw',
  'sc',
  'sl',
  'za',
  'ss',
  'tz',
  'tg',
  'tn',
  'ug',
  'zm',
  'zw',
]);

export const AFRICA_COUNTRY_LOOKUPS: ResourceLink[] = AFRICA_COUNTRIES.map(
  ({ name, code }) => {
    const hasDedicatedPage = FIND_A_HELPLINE_DEDICATED_CODES.has(code);
    return {
      name: `${name} helplines`,
      region: name,
      description: hasDedicatedPage
        ? `Verified crisis and support lines for ${name}.`
        : `Open Find A Helpline's country picker to check current options for ${name}.`,
      url: hasDedicatedPage
        ? `${FIND_A_HELPLINE_COUNTRY_BASE}${code}`
        : 'https://findahelpline.com',
      note: hasDedicatedPage ? 'Country page' : 'Global lookup',
    };
  }
);

/**
 * Shown wherever these directories appear. Kept consistent with the medical
 * disclaimer in the App Store description so the two never drift apart.
 */
export const RESOURCES_DISCLAIMER =
  'These are public directories, not referrals. MHtoolkit does not screen, endorse, or have any relationship with the organizations or providers listed. MHtoolkit does not provide medical diagnoses or treatment advice. Seek a doctor’s advice in addition to using this app and before making medical decisions.';

export const CRISIS_NOTE =
  'Hours differ by line, so check before you rely on one. If your country is not listed, Find A Helpline covers over 130 countries. In an immediate emergency, contact your local emergency number or nearest emergency department.';
