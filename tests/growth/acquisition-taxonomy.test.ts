import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  campaignFromSearchParams,
  isCampaignLink,
  parseStoredCampaign,
} from '../../lib/acquisition-taxonomy';
import { getLocalCheckInFields } from '../../lib/check-in';

/**
 * Some checks below validate internal outreach data that is deliberately not
 * committed. prospects.csv, outreach-log.csv and partner-share-kit.md hold
 * named contacts and outreach history, so they are gitignored and were purged
 * from history. campaign-links.csv is the exception: it is campaign taxonomy
 * with no personal data and is tracked.
 *
 * Those checks still run for maintainers who have the files locally, and skip
 * on a clean clone rather than failing it.
 */
function hasLaunchFile(relativePath: string): boolean {
  return existsSync(resolve(process.cwd(), relativePath));
}

const hasProspects = hasLaunchFile('docs/launch/prospects.csv');
const hasOutreachLog = hasLaunchFile('docs/launch/outreach-log.csv');
const hasShareKit = hasLaunchFile('docs/launch/partner-share-kit.md');

function extractSetValues(source: string, name: string): Set<string> {
  const match = source.match(
    new RegExp(`const ${name} = new Set\\(\\[([\\s\\S]*?)\\]\\);`)
  );
  if (!match) throw new Error(`Unable to find ${name} allowlist`);

  return new Set(
    Array.from(match[1].matchAll(/'([^']+)'/g), (value) => value[1])
  );
}

function extractSqlAllowedValues(
  source: string,
  constraintName: string,
  columnName: string
): Set<string> {
  const match = source.match(
    new RegExp(
      `CONSTRAINT ${constraintName} CHECK \\(\\s*${columnName} IN \\(([\\s\\S]*?)\\)\\s*\\)`
    )
  );
  if (!match) throw new Error(`Unable to find ${constraintName} allowlist`);

  return new Set(
    Array.from(match[1].matchAll(/'([^']+)'/g), (value) => value[1])
  );
}

interface ConstraintDefinition {
  migrationName: string;
  source: string;
  values: Set<string>;
}

function readConstraintDefinitions(
  constraintName: string,
  columnName: string
): ConstraintDefinition[] {
  const migrationsDirectory = resolve(process.cwd(), 'supabase/migrations');
  const definitionPattern = new RegExp(
    `CONSTRAINT\\s+${constraintName}\\s+CHECK\\s*\\(`
  );
  const migrationNames = readdirSync(migrationsDirectory)
    .filter((name) => name.endsWith('.sql'))
    .sort();

  return migrationNames.flatMap((migrationName) => {
    const source = readFileSync(resolve(migrationsDirectory, migrationName), 'utf8');
    if (!definitionPattern.test(source)) return [];

    return [{
      migrationName,
      source,
      values: extractSqlAllowedValues(source, constraintName, columnName),
    }];
  });
}

function readLatestConstraintMigration(
  constraintName: string,
  columnName: string
): string {
  const definitions = readConstraintDefinitions(constraintName, columnName);
  const latest = definitions[definitions.length - 1];
  if (latest) return latest.source;

  throw new Error(`Unable to find a migration defining ${constraintName}`);
}

function sorted(values: Iterable<string>): string[] {
  return Array.from(values).sort();
}

describe('campaign attribution taxonomy', () => {
  it('uses the direct challenge defaults without campaign parameters', () => {
    const params = new URLSearchParams();

    expect(campaignFromSearchParams(params)).toEqual({
      source: 'direct',
      medium: 'direct',
      campaign: 'seven_day_check_in',
      content: 'unspecified',
    });
    expect(isCampaignLink(params)).toBe(false);
  });

  it('keeps only the allowlisted launch taxonomy', () => {
    const params = new URLSearchParams({
      utm_source: 'Campus',
      utm_medium: 'Partner',
      utm_campaign: 'seven-day-check-in',
      utm_content: 'student group',
    });

    expect(campaignFromSearchParams(params)).toEqual({
      source: 'campus',
      medium: 'partner',
      campaign: 'seven_day_check_in',
      content: 'student_group',
    });
  });

  it('collapses arbitrary or potentially identifying values to other', () => {
    const params = new URLSearchParams({
      utm_source: 'person@example.com',
      utm_medium: 'private-club-4819',
      utm_campaign: 'jane-doe-campaign',
      utm_content: 'phone-416-555-0199',
    });

    expect(campaignFromSearchParams(params)).toEqual({
      source: 'other',
      medium: 'other',
      campaign: 'other',
      content: 'other',
    });
  });

  it('keeps unknown iOS campaign labels measurable as other', () => {
    const mobileSource = readFileSync(
      resolve(process.cwd(), 'mobile/lib/acquisition.ts'),
      'utf8'
    );
    const databaseValues = extractSqlAllowedValues(
      readLatestConstraintMigration('acquisition_content_allowed', 'content'),
      'acquisition_content_allowed',
      'content'
    );

    expect(mobileSource).toContain(
      "return allowed.has(normalized) ? normalized : 'other';"
    );
    expect(databaseValues.has('other')).toBe(true);
  });

  it('fails closed when stored attribution is invalid', () => {
    expect(parseStoredCampaign('{not-json')).toBeNull();
  });

  it('normalizes stored attribution through the same allowlist', () => {
    expect(
      parseStoredCampaign(
        JSON.stringify({
          source: 'referral',
          medium: 'referral',
          campaign: 'seven_day_check_in',
          content: 'member_share',
        })
      )
    ).toEqual({
      source: 'referral',
      medium: 'referral',
      campaign: 'seven_day_check_in',
      content: 'member_share',
    });
  });

  it('keeps every published campaign link inside the taxonomy', () => {
    const csv = readFileSync(
      resolve(process.cwd(), 'docs/launch/campaign-links.csv'),
      'utf8'
    );
    const rows = csv.trim().split(/\r?\n/).slice(1);

    expect(rows.length).toBeGreaterThan(0);

    for (const row of rows) {
      const columns = row.split(',');
      expect(columns).toHaveLength(4);

      const url = new URL(columns[3]);
      const attribution = campaignFromSearchParams(url.searchParams);

      expect(url.origin).toBe('https://mhtoolkit.vercel.app');
      expect(isCampaignLink(url.searchParams)).toBe(true);
      expect(attribution).toEqual({
        source: url.searchParams.get('utm_source'),
        medium: url.searchParams.get('utm_medium'),
        campaign: url.searchParams.get('utm_campaign'),
        content: url.searchParams.get('utm_content'),
      });
      expect(Object.values(attribution)).not.toContain('other');
    }
  });

  it('keeps published attribution labels aligned across web, mobile, and SQL', () => {
    const campaignCsv = readFileSync(
      resolve(process.cwd(), 'docs/launch/campaign-links.csv'),
      'utf8'
    );
    const mobileSource = readFileSync(
      resolve(process.cwd(), 'mobile/lib/acquisition.ts'),
      'utf8'
    );
    const webSource = readFileSync(
      resolve(process.cwd(), 'lib/acquisition-taxonomy.ts'),
      'utf8'
    );
    const campaignUrls = campaignCsv
      .trim()
      .split(/\r?\n/)
      .slice(1)
      .map((row) => new URL(row.split(',')[3]));
    const dimensions = [
      {
        clientSetName: 'SOURCES',
        queryParam: 'utm_source',
        constraintName: 'acquisition_source_allowed',
        columnName: 'source',
        migration: readLatestConstraintMigration(
          'acquisition_source_allowed',
          'source'
        ),
        maxLength: 32,
      },
      {
        clientSetName: 'MEDIUMS',
        queryParam: 'utm_medium',
        constraintName: 'acquisition_medium_allowed',
        columnName: 'medium',
        migration: readLatestConstraintMigration(
          'acquisition_medium_allowed',
          'medium'
        ),
        maxLength: 32,
      },
      {
        clientSetName: 'CAMPAIGNS',
        queryParam: 'utm_campaign',
        constraintName: 'acquisition_campaign_allowed',
        columnName: 'campaign',
        migration: readLatestConstraintMigration(
          'acquisition_campaign_allowed',
          'campaign'
        ),
        maxLength: 48,
      },
      {
        clientSetName: 'CONTENT',
        queryParam: 'utm_content',
        constraintName: 'acquisition_content_allowed',
        columnName: 'content',
        migration: readLatestConstraintMigration(
          'acquisition_content_allowed',
          'content'
        ),
        maxLength: 48,
      },
    ] as const;

    for (const dimension of dimensions) {
      const publishedValues = new Set(
        campaignUrls
          .map((url) => url.searchParams.get(dimension.queryParam))
          .filter((value): value is string => value !== null)
      );
      const webValues = extractSetValues(
        webSource,
        dimension.clientSetName
      );
      const mobileValues = extractSetValues(
        mobileSource,
        dimension.clientSetName
      );
      const databaseValues = extractSqlAllowedValues(
        dimension.migration,
        dimension.constraintName,
        dimension.columnName
      );

      for (const value of publishedValues) {
        expect(webValues.has(value)).toBe(true);
      }

      expect(sorted(mobileValues)).toEqual(sorted(webValues));
      expect(sorted(databaseValues)).toEqual(
        sorted(new Set([...webValues, 'other']))
      );
      for (const value of databaseValues) {
        expect(value).toMatch(/^[a-z0-9][a-z0-9_-]*$/);
        expect(value.length).toBeLessThanOrEqual(dimension.maxLength);
      }
    }
  });

  it('never removes a previously accepted database attribution label', () => {
    const dimensions = [
      ['acquisition_source_allowed', 'source'],
      ['acquisition_medium_allowed', 'medium'],
      ['acquisition_campaign_allowed', 'campaign'],
      ['acquisition_content_allowed', 'content'],
    ] as const;

    for (const [constraintName, columnName] of dimensions) {
      const definitions = readConstraintDefinitions(constraintName, columnName);
      expect(definitions.length).toBeGreaterThan(0);

      for (let index = 1; index < definitions.length; index += 1) {
        const previous = definitions[index - 1];
        const current = definitions[index];

        for (const value of previous.values) {
          expect(
            current.values.has(value),
            `${current.migrationName} removed ${constraintName} value ${value}`
          ).toBe(true);
        }
      }
    }
  });

  it.skipIf(!hasProspects)('keeps every researched prospect link in the canonical campaign file', () => {
    const canonicalCsv = readFileSync(
      resolve(process.cwd(), 'docs/launch/campaign-links.csv'),
      'utf8'
    );
    const canonicalUrls = new Set(
      canonicalCsv
        .trim()
        .split(/\r?\n/)
        .slice(1)
        .map((row) => row.split(',')[3])
    );
    const prospectsCsv = readFileSync(
      resolve(process.cwd(), 'docs/launch/prospects.csv'),
      'utf8'
    );
    const prospectUrls =
      prospectsCsv.match(
        /https:\/\/mhtoolkit\.vercel\.app\/\?utm_source=[^,\r\n]+/g
      ) ?? [];

    expect(prospectUrls.length).toBeGreaterThan(0);
    for (const url of prospectUrls) {
      expect(canonicalUrls.has(url)).toBe(true);
    }
  });

  it.skipIf(!hasOutreachLog)('keeps every outreach link canonical and reconciles the first wave', () => {
    const canonicalCsv = readFileSync(
      resolve(process.cwd(), 'docs/launch/campaign-links.csv'),
      'utf8'
    );
    const canonicalUrls = new Set(
      canonicalCsv
        .trim()
        .split(/\r?\n/)
        .slice(1)
        .map((row) => row.split(',')[3])
    );
    const outreachCsv = readFileSync(
      resolve(process.cwd(), 'docs/launch/outreach-log.csv'),
      'utf8'
    );
    const rows = outreachCsv
      .trim()
      .split(/\r?\n/)
      .slice(1)
      .map((row) => row.split(','));

    for (const row of rows) {
      expect(row).toHaveLength(9);
      expect(canonicalUrls.has(row[4])).toBe(true);
    }

    const july19EmailAttempts = rows.filter(
      (row) =>
        row[0].startsWith('2026-07-19') &&
        row[1] === 'email' &&
        row[6] !== 'draft_prepared_not_sent'
    );
    const bounced = july19EmailAttempts.filter((row) =>
      row[6].startsWith('bounced_')
    );
    const withoutObservedBounce = july19EmailAttempts.filter(
      (row) => !row[6].startsWith('bounced_')
    );
    const founderPosts = rows.filter(
      (row) => ['linkedin', 'x'].includes(row[1]) && row[3] === 'Founder network'
    );

    // The private ledger contains the original 40 attempts plus five later,
    // separately reconciled same-day sends. It is intentionally gitignored.
    expect(july19EmailAttempts).toHaveLength(45);
    expect(bounced).toHaveLength(3);
    expect(withoutObservedBounce).toHaveLength(42);
    expect(founderPosts).toHaveLength(2);
  });

  it.skipIf(!hasShareKit)('keeps every partner share-kit link canonical and channel matched', () => {
    const canonicalCsv = readFileSync(
      resolve(process.cwd(), 'docs/launch/campaign-links.csv'),
      'utf8'
    );
    const canonicalUrls = new Set(
      canonicalCsv
        .trim()
        .split(/\r?\n/)
        .slice(1)
        .map((row) => row.split(',')[3])
    );
    const shareKit = readFileSync(
      resolve(process.cwd(), 'docs/launch/partner-share-kit.md'),
      'utf8'
    );
    const shareKitUrls = Array.from(
      shareKit.matchAll(
        /`(https:\/\/mhtoolkit\.vercel\.app\/\?utm_source=[^`]+)`/g
      ),
      (match) => match[1]
    );

    expect(shareKitUrls).toHaveLength(4);
    expect(
      new Set(
        shareKitUrls.map(
          (url) => new URL(url).searchParams.get('utm_medium')
        )
      )
    ).toEqual(new Set(['newsletter', 'email', 'organic', 'dm']));
    for (const url of shareKitUrls) {
      expect(canonicalUrls.has(url)).toBe(true);
    }
  });

  it('keeps web and mobile member shares canonical and anonymous', () => {
    const campaignCsv = readFileSync(
      resolve(process.cwd(), 'docs/launch/campaign-links.csv'),
      'utf8'
    );
    const referralRow = campaignCsv
      .trim()
      .split(/\r?\n/)
      .find((row) => row.startsWith('member_referral,'));
    expect(referralRow).toBeDefined();

    const canonicalReferralUrl = referralRow!.split(',')[3];
    const sources = [
      readFileSync(
        resolve(
          process.cwd(),
          'components/launch/share-challenge-button.tsx'
        ),
        'utf8'
      ),
      readFileSync(
        resolve(process.cwd(), 'mobile/app/(tabs)/more.tsx'),
        'utf8'
      ),
    ];

    for (const source of sources) {
      const urls =
        source.match(
          /https:\/\/mhtoolkit\.vercel\.app\/\?utm_source=[^'"\s]+/g
        ) ?? [];
      expect(urls).toContain(canonicalReferralUrl);

      const referralUrl = new URL(canonicalReferralUrl);
      expect([...referralUrl.searchParams.keys()].sort()).toEqual([
        'utm_campaign',
        'utm_content',
        'utm_medium',
        'utm_source',
      ]);
      expect(referralUrl.searchParams.get('utm_source')).toBe('referral');
      expect(referralUrl.searchParams.get('utm_medium')).toBe('referral');
      expect(referralUrl.searchParams.get('utm_content')).toBe('member_share');
      expect(canonicalReferralUrl).not.toMatch(
        /user|email|mood|note|assessment|chat|session/i
      );
    }
  });

  it('records the device-local calendar date and UTC offset', () => {
    const localDate = new Date(2026, 0, 2, 15, 30);

    expect(getLocalCheckInFields(localDate)).toEqual({
      local_date: '2026-01-02',
      utc_offset_minutes: -localDate.getTimezoneOffset(),
    });
  });

  it('commits attribution and every check-in through one owned transaction', () => {
    const migration = readFileSync(
      resolve(
        process.cwd(),
        'supabase/migrations/20260719201000_atomic_check_in_attribution.sql'
      ),
      'utf8'
    );
    const attributionInsert = migration.match(
      /INSERT INTO public\.acquisition_attribution([\s\S]*?)ON CONFLICT/
    )?.[1];

    expect(migration).toContain(
      'CREATE OR REPLACE FUNCTION public.save_check_in_with_attribution'
    );
    expect(migration).toContain('SECURITY INVOKER');
    expect(migration).toContain('v_user_id UUID := auth.uid()');
    expect(migration).toMatch(
      /INSERT INTO public\.acquisition_attribution[\s\S]*ON CONFLICT \(user_id\) DO NOTHING;[\s\S]*INSERT INTO public\.moods/
    );
    expect(migration).toMatch(
      /REVOKE ALL ON FUNCTION public\.save_check_in_with_attribution\([\s\S]*FROM PUBLIC, anon, authenticated;/
    );
    expect(migration).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.save_check_in_with_attribution\([\s\S]*TO authenticated;/
    );
    expect(attributionInsert).toBeDefined();
    expect(attributionInsert).not.toMatch(/p_emoji|p_note|p_tags/);

    const saveSurfaces = [
      'app/onboarding/page.tsx',
      'components/mood/inline-mood-check-in.tsx',
      'app/dashboard/page.tsx',
      'mobile/app/(tabs)/tracker.tsx',
      'mobile/app/(tabs)/index.tsx',
    ];

    for (const path of saveSurfaces) {
      const source = readFileSync(resolve(process.cwd(), path), 'utf8');
      expect(source).toContain('saveCheckInWithAttribution');
      expect(source).not.toMatch(
        /\.from\(['"]moods['"]\)\s*\.insert/
      );
      expect(source).not.toContain('queueActivationAttribution');
    }

    for (const path of ['lib/acquisition.ts', 'mobile/lib/acquisition.ts']) {
      const source = readFileSync(resolve(process.cwd(), path), 'utf8');
      expect(source).toContain(
        ".rpc('patch_daily_mood_check_in'"
      );
      expect(source).toContain('p_expected_user_id: expectedUserId');
      expect(source).toContain("hasOwnProperty.call(checkIn, 'note')");
      expect(source).toContain("hasOwnProperty.call(checkIn, 'tags')");
      expect(source).not.toContain("from('acquisition_attribution')");
      expect(source).not.toContain('queueActivationAttribution');
    }
  });

  it('provides a read-only production gate for the atomic RPC', () => {
    const preflight = readFileSync(
      resolve(
        process.cwd(),
        'scripts/verify-atomic-attribution-deployment.mjs'
      ),
      'utf8'
    );

    expect(preflight).toContain(
      ".rpc('save_check_in_with_attribution'"
    );
    expect(preflight).toContain("error.code === 'PGRST202'");
    expect(preflight).toContain("error.code !== '42501'");
    expect(preflight).not.toContain('SUPABASE_SERVICE_ROLE_KEY');
    expect(preflight).not.toContain('signInAnonymously');
  });
});
