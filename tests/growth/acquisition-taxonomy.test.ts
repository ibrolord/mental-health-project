import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  campaignFromSearchParams,
  isCampaignLink,
  parseStoredCampaign,
} from '../../lib/acquisition-taxonomy';
import { getLocalCheckInFields } from '../../lib/check-in';

function extractSetValues(source: string, name: string): Set<string> {
  const match = source.match(
    new RegExp(`const ${name} = new Set\\(\\[([\\s\\S]*?)\\]\\);`)
  );
  if (!match) throw new Error(`Unable to find ${name} allowlist`);

  return new Set(
    Array.from(match[1].matchAll(/'([^']+)'/g), (value) => value[1])
  );
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

  it('keeps published content labels aligned across web, mobile, and SQL', () => {
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
    const databaseMigration = readFileSync(
      resolve(
        process.cwd(),
        'supabase/migrations/20260719182000_allow_partner_attribution_content.sql'
      ),
      'utf8'
    );
    const contentLabels = new Set(
      campaignCsv
        .trim()
        .split(/\r?\n/)
        .slice(1)
        .map((row) =>
          new URL(row.split(',')[3]).searchParams.get('utm_content')
        )
        .filter((value): value is string => value !== null)
    );
    const webValues = extractSetValues(webSource, 'CONTENT');
    const mobileValues = extractSetValues(mobileSource, 'CONTENT');
    const databaseValues = new Set(
      Array.from(
        databaseMigration.matchAll(/'([a-z0-9][a-z0-9_-]*)'/g),
        (value) => value[1]
      )
    );

    for (const content of contentLabels) {
      expect(webValues.has(content)).toBe(true);
    }

    expect(sorted(mobileValues)).toEqual(sorted(webValues));
    expect(sorted(databaseValues)).toEqual(sorted(new Set([...webValues, 'other'])));
    for (const content of databaseValues) {
      expect(content).toMatch(/^[a-z0-9][a-z0-9_-]*$/);
      expect(content.length).toBeLessThanOrEqual(48);
    }
  });

  it('keeps every researched prospect link in the canonical campaign file', () => {
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

  it('keeps every outreach link canonical and reconciles the first wave', () => {
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

    const emailAttempts = rows.filter(
      (row) => row[1] === 'email' && row[6] !== 'draft_prepared_not_sent'
    );
    const bounced = emailAttempts.filter((row) => row[6].startsWith('bounced_'));
    const withoutObservedBounce = emailAttempts.filter(
      (row) => !row[6].startsWith('bounced_')
    );
    const founderPosts = rows.filter(
      (row) => ['linkedin', 'x'].includes(row[1]) && row[3] === 'Founder network'
    );

    expect(emailAttempts).toHaveLength(40);
    expect(bounced).toHaveLength(3);
    expect(withoutObservedBounce).toHaveLength(37);
    expect(founderPosts).toHaveLength(2);
  });

  it('records the device-local calendar date and UTC offset', () => {
    const localDate = new Date(2026, 0, 2, 15, 30);

    expect(getLocalCheckInFields(localDate)).toEqual({
      local_date: '2026-01-02',
      utc_offset_minutes: -localDate.getTimezoneOffset(),
    });
  });
});
