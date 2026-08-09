import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const MOBILE_ROOT = resolve(SCRIPT_DIR, '..');
const REPO_ROOT = resolve(MOBILE_ROOT, '..');

export const REQUIRED_IDENTITY_ROLES = [
  'fresh-anonymous',
  'saved-anonymous',
  'email-owner',
  'google-owner',
  'apple-owner',
  'partner',
  'revoked-partner',
];

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

function parseEnvFile(path) {
  if (!existsSync(path)) return {};
  return Object.fromEntries(
    readFileSync(path, 'utf8')
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

function sha256(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

function scalarValues(value, output = []) {
  if (Array.isArray(value)) {
    for (const item of value) scalarValues(item, output);
  } else if (value && typeof value === 'object') {
    for (const item of Object.values(value)) scalarValues(item, output);
  } else if (value !== null && value !== undefined) {
    output.push(String(value));
  }
  return output;
}

function findBundleRecord(value, bundleId) {
  if (Array.isArray(value)) {
    for (const item of value) {
      const match = findBundleRecord(item, bundleId);
      if (match) return match;
    }
    return null;
  }
  if (!value || typeof value !== 'object') return null;
  if (Object.values(value).some((item) => item === bundleId)) return value;
  for (const item of Object.values(value)) {
    const match = findBundleRecord(item, bundleId);
    if (match) return match;
  }
  return null;
}

export function evaluateDeviceInventory(devices) {
  const physical = devices.filter(
    (device) => device?.simulator === false &&
      device?.platform === 'com.apple.platform.iphoneos'
  );
  const iphones = physical.filter((device) =>
    String(device.modelName ?? '').startsWith('iPhone')
  );
  const ipads = physical.filter((device) =>
    String(device.modelName ?? '').startsWith('iPad')
  );
  return {
    iphones,
    ipads,
    availableIphones: iphones.filter((device) => device.available === true),
    availableIpads: ipads.filter((device) => device.available === true),
  };
}

export function validateIdentityRoles(run) {
  const identities = run?.metadata?.identities;
  if (!Array.isArray(identities)) {
    return ['Run metadata.identities is missing.'];
  }
  const ids = identities.map((identity) => identity?.id).filter(Boolean);
  const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index);
  const errors = duplicateIds.length > 0
    ? [`Duplicate identity IDs: ${[...new Set(duplicateIds)].join(', ')}`]
    : [];
  for (const role of REQUIRED_IDENTITY_ROLES) {
    if (!identities.some((identity) => identity?.role === role)) {
      errors.push(`Missing identity role ${role}.`);
    }
  }
  return errors;
}

function inspectInstalledApp(device, bundleId, expectedVersion, expectedBuild) {
  const outputDir = mkdtempSync(resolve(tmpdir(), 'mhtoolkit-device-apps-'));
  const outputPath = resolve(outputDir, 'apps.json');
  try {
    execFileSync(
      'xcrun',
      [
        'devicectl',
        'device',
        'info',
        'apps',
        '--device',
        device.identifier,
        '--bundle-id',
        bundleId,
        '--include-all-apps',
        '--json-output',
        outputPath,
        '--timeout',
        '30',
      ],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
    );
    const record = findBundleRecord(JSON.parse(readFileSync(outputPath, 'utf8')), bundleId);
    if (!record) return { ok: false, reason: `${bundleId} is not installed.` };
    const values = scalarValues(record);
    if (expectedVersion && !values.includes(String(expectedVersion))) {
      return { ok: false, reason: `Installed app is not version ${expectedVersion}.` };
    }
    if (expectedBuild && !values.includes(String(expectedBuild))) {
      return { ok: false, reason: `Installed app is not build ${expectedBuild}.` };
    }
    return { ok: true };
  } catch (error) {
    const details = `${error?.stderr ?? ''} ${error?.message ?? ''}`;
    if (/Developer Mode is disabled/i.test(details)) {
      return {
        ok: false,
        code: 'developer-mode-disabled',
        reason: 'Developer Mode is disabled. Enable it in Settings > Privacy & Security, then restart the device.',
      };
    }
    return { ok: false, reason: details.trim().split('\n').at(-1) || 'Device inspection failed.' };
  } finally {
    rmSync(outputDir, { recursive: true, force: true });
  }
}

export function classifyInstalledAppInspection(result, installSource) {
  if (result.ok) return { blocker: false, manual: false };
  if (
    result.code === 'developer-mode-disabled' &&
    installSource === 'TestFlight'
  ) {
    return {
      blocker: false,
      manual: true,
      reason: 'Developer Mode is off, so Xcode cannot inspect the install. TestFlight execution remains available; verify the installed version and build in TestFlight and record the install.testflight checklist row.',
    };
  }
  return { blocker: true, manual: false, reason: result.reason };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const bundleId = String(args['bundle-id'] ?? 'com.mhtoolkit.app');
  const runPath = args.run
    ? (isAbsolute(args.run) ? args.run : resolve(process.cwd(), args.run))
    : '';
  let run = null;
  const failures = [];
  const manualChecks = [];
  const report = (ok, message) => {
    console.log(`${ok ? 'PASS' : 'BLOCKED'} ${message}`);
    if (!ok) failures.push(message);
  };
  const reportManual = (message) => {
    console.log(`MANUAL ${message}`);
    manualChecks.push(message);
  };

  if (runPath && existsSync(runPath)) {
    run = JSON.parse(readFileSync(runPath, 'utf8'));
    const identityErrors = validateIdentityRoles(run);
    report(identityErrors.length === 0, identityErrors.join(' ') || 'all seven QA identity roles are declared');
  } else {
    report(false, 'Provide --run with the current artifact-bound QA run.');
  }

  const ipaPath = run?.metadata?.artifactPath;
  const expectedSha = run?.metadata?.artifactSha256;
  if (ipaPath && expectedSha && isAbsolute(ipaPath) && existsSync(ipaPath)) {
    report(sha256(ipaPath) === expectedSha, 'exact IPA bytes match the QA run SHA-256');
  } else {
    report(false, 'The QA run must reference an existing absolute IPA path and SHA-256.');
  }

  let devices = [];
  try {
    devices = JSON.parse(
      execFileSync('xcrun', ['xcdevice', 'list', '--timeout', '10'], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      })
    );
  } catch (error) {
    report(false, `Xcode device discovery failed: ${error.message}`);
  }
  const inventory = evaluateDeviceInventory(devices);
  report(
    inventory.availableIphones.length > 0,
    inventory.availableIphones.length > 0
      ? `physical iPhone available: ${inventory.availableIphones.map((device) => `${device.modelName} ${device.operatingSystemVersion}`).join(', ')}`
      : 'No unlocked, paired physical iPhone is available.'
  );
  report(
    inventory.availableIpads.length > 0,
    inventory.availableIpads.length > 0
      ? `physical iPad available: ${inventory.availableIpads.map((device) => `${device.modelName} ${device.operatingSystemVersion}`).join(', ')}`
      : `No unlocked, paired physical iPad is available.${inventory.ipads[0]?.error?.recoverySuggestion ? ` ${inventory.ipads[0].error.recoverySuggestion.replace(/\s+/g, ' ')}` : ''}`
  );

  const expectedVersion = run?.metadata?.appVersion;
  const expectedBuild = run?.metadata?.buildNumber;
  const installSource = run?.metadata?.installSource;
  for (const device of [
    ...inventory.availableIphones,
    ...inventory.availableIpads,
  ]) {
    const installed = inspectInstalledApp(
      device,
      bundleId,
      expectedVersion,
      expectedBuild
    );
    const classification = classifyInstalledAppInspection(installed, installSource);
    if (installed.ok) {
      report(true, `${device.modelName} has ${bundleId} ${expectedVersion} (${expectedBuild}) installed`);
    } else if (classification.manual) {
      reportManual(`${device.modelName}: ${classification.reason}`);
    } else {
      report(false, `${device.modelName}: ${classification.reason}`);
    }
  }

  const env = {
    ...parseEnvFile(resolve(REPO_ROOT, '.env.local')),
    ...parseEnvFile(resolve(MOBILE_ROOT, '.env.local')),
    ...process.env,
  };
  report(
    Boolean(env.SUPABASE_ACCESS_TOKEN),
    env.SUPABASE_ACCESS_TOKEN
      ? 'scoped SUPABASE_ACCESS_TOKEN is available without printing it'
      : 'Add a scoped SUPABASE_ACCESS_TOKEN with auth_config_read access to the ignored .env.local file.'
  );

  if (failures.length > 0) {
    console.error(`Physical iOS preflight has ${failures.length} blocker(s).`);
    process.exit(1);
  }
  console.log(
    `Physical iOS preflight passed${manualChecks.length > 0 ? ` with ${manualChecks.length} required manual check(s)` : ''}. Execute and record every QA_PROTOCOL.md row next.`
  );
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
