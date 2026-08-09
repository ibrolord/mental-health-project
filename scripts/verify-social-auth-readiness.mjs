import { readFile } from 'node:fs/promises';
import { isAbsolute, resolve } from 'node:path';
import {
  validateSocialAuthDashboardEvidence,
} from './lib/social-auth-evidence.mjs';

const MOBILE_REDIRECT = 'mhtoolkit://auth/callback';
const WEB_CALLBACK = 'https://mhtoolkit.vercel.app/auth/callback';
const MOBILE_CONFIRMATION = 'https://mhtoolkit.vercel.app/auth/mobile-confirmed';
const IOS_BUNDLE_ID = 'com.mhtoolkit.app';
const REQUEST_TIMEOUT_MS = 10_000;
const failures = [];

function parseArgs(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    if (!key.startsWith('--')) continue;
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) {
      values[key.slice(2)] = true;
      continue;
    }
    values[key.slice(2)] = value;
    index += 1;
  }
  return values;
}

const args = parseArgs(process.argv.slice(2));
const publicOnly = Boolean(args['public-only']);

function report(ok, message) {
  console.log(`${ok ? 'PASS' : 'BLOCKED'} ${message}`);
  if (!ok) failures.push(message);
}

function parseEnv(raw) {
  return Object.fromEntries(
    raw
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#') && line.includes('='))
      .map((line) => {
        const separator = line.indexOf('=');
        return [
          line.slice(0, separator),
          line.slice(separator + 1).replace(/^['"]|['"]$/g, ''),
        ];
      })
  );
}

async function readOptionalEnv(path) {
  try {
    return parseEnv(await readFile(path, 'utf8'));
  } catch (error) {
    if (error?.code === 'ENOENT') return {};
    throw error;
  }
}

async function fetchJson(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    if (!response.ok) {
      throw new Error(`${new URL(url).pathname} returned ${response.status}`);
    }
    return response.json();
  } finally {
    clearTimeout(timeout);
  }
}

function splitConfigList(value) {
  return typeof value === 'string'
    ? value.split(',').map((item) => item.trim()).filter(Boolean)
    : [];
}

function reportManagementChecks(checks) {
  report(checks.redirectMobile, `redirect allowlist includes ${MOBILE_REDIRECT}`);
  report(checks.redirectWeb, `redirect allowlist includes ${WEB_CALLBACK}`);
  report(
    checks.redirectConfirmation,
    `redirect allowlist includes ${MOBILE_CONFIRMATION}`
  );
  report(
    checks.manualLinking,
    'manual identity linking is enabled for anonymous-profile upgrades'
  );
  report(
    checks.appleNativeAudience,
    `Apple client IDs accept native audience ${IOS_BUNDLE_ID}`
  );
  report(checks.googleClientIdConfigured, 'Google OAuth client ID is configured');
}

const fileEnv = await readOptionalEnv(resolve('.env.local'));
const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? fileEnv.NEXT_PUBLIC_SUPABASE_URL;
const anonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  fileEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY;

report(Boolean(supabaseUrl && anonKey), 'production Supabase URL and anon key are available');

const appConfig = JSON.parse(
  await readFile(resolve('mobile/app.json'), 'utf8')
).expo;
const plugins = appConfig.plugins.map((plugin) =>
  Array.isArray(plugin) ? plugin[0] : plugin
);

report(appConfig.scheme === 'mhtoolkit', 'mobile deep-link scheme is mhtoolkit');
report(
  appConfig.ios?.bundleIdentifier === IOS_BUNDLE_ID,
  `iOS bundle identifier is ${IOS_BUNDLE_ID}`
);
report(appConfig.ios?.usesAppleSignIn === true, 'Expo enables Sign in with Apple');
report(
  plugins.includes('expo-apple-authentication'),
  'Expo Apple authentication plugin is configured'
);
report(
  plugins.includes('expo-web-browser'),
  'Expo web-browser plugin is configured for Google OAuth'
);

if (supabaseUrl && anonKey) {
  try {
    const settings = await fetchJson(`${supabaseUrl}/auth/v1/settings`, {
      headers: { apikey: anonKey },
    });
    report(settings?.external?.google === true, 'Google provider is enabled in Supabase');
    report(settings?.external?.apple === true, 'Apple provider is enabled in Supabase');
    report(
      settings?.external?.anonymous_users === true,
      'anonymous profiles remain enabled for safe account upgrades'
    );
  } catch (error) {
    report(
      false,
      `production Supabase auth settings are reachable (${error.message})`
    );
  }
}

if (publicOnly) {
  console.log('SKIP management-only redirect, client ID, and identity-linking checks');
} else {
  const accessToken =
    process.env.SUPABASE_ACCESS_TOKEN ?? fileEnv.SUPABASE_ACCESS_TOKEN;
  const evidenceArgument =
    args['dashboard-evidence'] ??
    process.env.SUPABASE_AUTH_DASHBOARD_EVIDENCE ??
    fileEnv.SUPABASE_AUTH_DASHBOARD_EVIDENCE;
  const evidencePath = evidenceArgument
    ? (isAbsolute(evidenceArgument)
        ? evidenceArgument
        : resolve(evidenceArgument))
    : '';

  if (accessToken && supabaseUrl) {
    try {
      const projectRef = new URL(supabaseUrl).hostname.split('.')[0];
      const config = await fetchJson(
        `https://api.supabase.com/v1/projects/${projectRef}/config/auth`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      const redirects = splitConfigList(config.uri_allow_list);
      const appleClientIds = splitConfigList(config.external_apple_client_id);
      report(true, 'scoped Supabase management credential was accepted');
      reportManagementChecks({
        redirectMobile: redirects.includes(MOBILE_REDIRECT),
        redirectWeb: redirects.includes(WEB_CALLBACK),
        redirectConfirmation: redirects.some((redirect) =>
          redirect.startsWith(MOBILE_CONFIRMATION)
        ),
        manualLinking: config.security_manual_linking_enabled === true,
        appleNativeAudience: appleClientIds.includes(IOS_BUNDLE_ID),
        googleClientIdConfigured:
          typeof config.external_google_client_id === 'string' &&
          config.external_google_client_id.trim().length > 0,
      });
    } catch (error) {
      report(
        false,
        `Supabase management auth settings are reachable (${error.message})`
      );
    }
  } else if (evidencePath && supabaseUrl) {
    try {
      const projectRef = new URL(supabaseUrl).hostname.split('.')[0];
      const evidence = JSON.parse(await readFile(evidencePath, 'utf8'));
      const evidenceErrors = validateSocialAuthDashboardEvidence(evidence, {
        projectRef,
      });
      report(
        evidenceErrors.length === 0,
        evidenceErrors.join(' ') ||
          'fresh Supabase dashboard evidence matches the production project'
      );
      if (evidenceErrors.length === 0) {
        reportManagementChecks(evidence.checks);
      }
    } catch (error) {
      report(false, `Supabase dashboard evidence is readable (${error.message})`);
    }
  } else {
    report(
      false,
      'Provide a scoped Supabase OAuth credential with auth:read or --dashboard-evidence with a fresh ignored attestation.'
    );
  }
}

if (failures.length > 0) {
  console.error(`Social auth readiness failed with ${failures.length} blocker(s).`);
  process.exit(1);
}

console.log('Social auth readiness passed. Complete signed-device login tests before release.');
