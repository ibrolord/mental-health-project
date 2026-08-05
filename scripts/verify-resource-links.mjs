#!/usr/bin/env node
/**
 * Safety resources, sourced quotations, and lived-experience profiles all need
 * working source links. A dead link there is a real failure, not a cosmetic
 * one, so this checks them rather than trusting that they were right when
 * written.
 *
 * Some hosts reject HEAD or bot-like requests but serve real browsers fine, so
 * a HEAD failure falls back to GET before anything is reported as broken.
 */
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const resourceSource = await readFile(join(root, 'lib', 'resources.ts'), 'utf8');
const storySource = await readFile(
  join(root, 'lib', 'library', 'stories.ts'),
  'utf8'
);
const quoteMigrationSource = await readFile(
  join(
    root,
    'supabase',
    'migrations',
    '20260729121123_add_attributed_quotes_and_library_stories.sql'
  ),
  'utf8'
);
const source = [resourceSource, storySource, quoteMigrationSource].join('\n');

const rawStaticUrls = source.match(/https:\/\/[^\s'"`$]+/g) ?? [];
const countryBase =
  resourceSource.match(
    /FIND_A_HELPLINE_COUNTRY_BASE\s*=\s*\n?\s*'(https:\/\/[^']+)'/
  )?.[1] ?? null;
const dedicatedCodesBlock =
  resourceSource.match(
    /FIND_A_HELPLINE_DEDICATED_CODES\s*=\s*new Set\(\[([\s\S]*?)\]\)/
  )?.[1] ?? '';
const africaCountryCodes = [
  ...dedicatedCodesBlock.matchAll(/'([a-z]{2})'/g),
].map((match) => match[1]);
const generatedCountryUrls = countryBase
  ? africaCountryCodes.map((code) => `${countryBase}${code}`)
  : [];
const staticUrls = rawStaticUrls.filter((candidate) => {
  if (candidate === countryBase) return false;
  try {
    const parsed = new URL(candidate);
    return parsed.protocol === 'https:' && Boolean(parsed.hostname);
  } catch {
    return false;
  }
});
const urls = [...new Set([...staticUrls, ...generatedCountryUrls])];
if (urls.length === 0) {
  console.error('FAIL no resource, story, or quotation URLs found');
  process.exit(1);
}

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36';
const PROBE_CONCURRENCY = 8;
const TRANSIENT_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// These pages were opened and checked in a browser on the recorded dates. Keep
// this list explicit so an auth/content-negotiation response is never silently
// promoted to a passing link.
const BROWSER_VERIFIED_URLS = new Set([
  'https://www.mind.org.uk/information-support/your-stories/workplace-wellbeing/',
  'https://www.mind.org.uk/information-support/your-stories/my-mental-health-as-an-entrepreneur-success-failure-recovery/',
  'https://www.mind.org.uk/information-support/your-stories/how-i-overcame-adversity-in-the-midst-of-crisis/',
  'https://www.mind.org.uk/information-support/your-stories/sharing-experiences-with-others/',
  'https://www.nami.org/personal-stories/hope-and-help/',
  'https://www.nami.org/personal-stories/pursuing-my-dream-career-while-in-recovery/',
  'https://www.nami.org/personal-stories/what-a-life-i-live/',
  // Browser-verified on 2026-08-03; TIME returns 406 to automated probes.
  'https://time.com/6077128/naomi-osaka-essay-tokyo-olympics/',
  'https://time.com/5402066/michael-phelps-mental-health-activism/',
  'https://time.com/4295181/arianna-huffingtons-rules-for-better-sleep/',
  // Browser-verified on 2026-08-05; CMHA serves the locator but intermittently
  // terminates Node fetches before returning an HTTP status.
  'https://cmha.ca/find-help/find-cmha-in-your-area/',
]);

async function probe(url) {
  let lastStatus = 'unknown';

  for (const method of ['HEAD', 'GET']) {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 20000);
        try {
          const res = await fetch(url, {
            method,
            redirect: 'follow',
            signal: controller.signal,
            headers: { 'user-agent': UA, accept: '*/*' },
          });
          lastStatus = res.status;
          if (res.ok) {
            return { url, status: res.status, state: 'reachable' };
          }
          if (
            method === 'GET' &&
            (res.status === 401 || res.status === 403 || res.status === 406)
          ) {
            return {
              url,
              status: res.status,
              state: BROWSER_VERIFIED_URLS.has(url)
                ? 'browser-verified'
                : 'browser-unverified',
            };
          }
          if (!TRANSIENT_STATUSES.has(res.status)) {
            break;
          }
        } finally {
          clearTimeout(timer);
        }
      } catch (error) {
        lastStatus = error.name === 'AbortError' ? 'timeout' : 'error';
        if (attempt === 1) {
          break;
        }
      }

      await sleep(500 * (attempt + 1));
    }
  }

  return {
    url,
    status: lastStatus,
    state: BROWSER_VERIFIED_URLS.has(url) ? 'browser-verified' : 'broken',
  };
}

async function probeAll(inputUrls) {
  const results = new Array(inputUrls.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < inputUrls.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await probe(inputUrls[index]);
    }
  }

  await Promise.all(
    Array.from(
      { length: Math.min(PROBE_CONCURRENCY, inputUrls.length) },
      worker
    )
  );
  return results;
}

const results = await probeAll(urls);
const broken = results.filter((result) => result.state === 'broken');
const browserVerified = results.filter(
  (result) => result.state === 'browser-verified'
);
const browserUnverified = results.filter(
  (result) => result.state === 'browser-unverified'
);
const directlyReachable = results.filter(
  (result) => result.state === 'reachable'
);

for (const r of results.sort((a, b) => a.state.localeCompare(b.state))) {
  const label =
    r.state === 'broken'
      ? 'BROKEN'
      : r.state === 'browser-unverified'
        ? 'UNVERIFIED'
        : r.state === 'browser-verified'
          ? 'BROWSER VERIFIED'
          : 'OK';
  console.log(`${label.padEnd(15)} ${String(r.status).padEnd(8)} ${r.url}`);
}

console.log(
  `\n${directlyReachable.length}/${results.length} directly reachable`
);
if (browserVerified.length > 0) {
  console.log(`${browserVerified.length} source(s) verified in a browser`);
}

if (broken.length > 0 || browserUnverified.length > 0) {
  console.error(
    `FAIL ${broken.length} unreachable and ${browserUnverified.length} browser-only unverified link(s)`
  );
  process.exit(1);
}
console.log('PASS all resource links verified');
