#!/usr/bin/env node

// Keep exported signatures synchronized with qa-release-gate.d.mts.

import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { lstatSync, readFileSync, readdirSync, realpathSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
export const MOBILE_ROOT = path.resolve(SCRIPT_DIR, '..');
export const REPO_ROOT = path.resolve(MOBILE_ROOT, '..');
export const CHECKLIST_PATH = path.join(MOBILE_ROOT, 'qa', 'ios-release-checklist.json');
export const RUNS_ROOT = path.join(MOBILE_ROOT, 'qa', 'runs');
export const EXPECTED_INVENTORY = Object.freeze({ routes: 28, routeChecks: 543, workflows: 102, total: 645 });
export const EXPECTED_CHECKLIST_SHA256 = '83570838e888e71d95b34be64283e787270f1db5110b71c0bc748c0d7cc09ae5';

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, value) {
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function unique(values) {
  return [...new Set(values)];
}

export function checklistDigest(checklist) {
  return createHash('sha256').update(JSON.stringify(checklist)).digest('hex');
}

function fileSha256(filePath) {
  return createHash('sha256').update(readFileSync(filePath)).digest('hex');
}

function inspectOutputFile(filePath) {
  if (!path.isAbsolute(filePath ?? '')) throw new Error('outputRef is not absolute');
  const output = lstatSync(filePath);
  if (output.isSymbolicLink() || !output.isFile()) {
    throw new Error('outputRef is not a regular non-symlink file');
  }
  if (output.size === 0) throw new Error('outputRef is empty');
  const canonicalPath = realpathSync(filePath);
  const identity = statSync(canonicalPath);
  return {
    canonicalPath,
    dev: String(identity.dev),
    ino: String(identity.ino),
    sha256: fileSha256(canonicalPath),
    size: identity.size,
  };
}

export function gateExecutionReceipt(metadata, result) {
  return createHash('sha256')
    .update(JSON.stringify({
      artifactId: metadata.artifactId,
      artifactSha256: metadata.artifactSha256,
      buildNumber: metadata.buildNumber,
      command: result.command,
      exitCode: result.exitCode,
      id: result.id,
      outputRef: result.outputRef,
      outputSha256: result.outputSha256,
      sourceCommit: metadata.sourceCommit,
    }))
    .digest('hex');
}

function listFiles(directory) {
  return readdirSync(directory).flatMap((name) => {
    const absolute = path.join(directory, name);
    return statSync(absolute).isDirectory() ? listFiles(absolute) : [absolute];
  });
}

function git(args) {
  return execFileSync('git', args, { cwd: REPO_ROOT, encoding: 'utf8' }).trim();
}

function currentGitContext() {
  return {
    currentCommit: git(['rev-parse', 'HEAD']),
    worktreeClean: git(['status', '--porcelain']) === '',
  };
}

function parseArgs(argv) {
  const [command = 'inventory', ...rest] = argv;
  const flags = {};
  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index];
    if (!token.startsWith('--')) throw new Error(`Unexpected argument: ${token}`);
    const key = token.slice(2);
    const value = rest[index + 1];
    if (!value || value.startsWith('--')) throw new Error(`Missing value for --${key}`);
    flags[key] = value;
    index += 1;
  }
  return { command, flags };
}

export function expandChecklist(checklist) {
  const routeItems = checklist.routes.flatMap((route) => {
    const scenarios = checklist.scenarioSets[route.kind];
    if (!Array.isArray(scenarios)) return [];
    const deviceRequirements = route.deviceRequirements ?? checklist.requirements.defaultRouteDeviceRequirements;
    const identityRequirements = route.identityRequirements ?? [];
    return [
      ...scenarios.map((scenario) => ({
        id: `route.${route.id}.${scenario.id}`,
        area: `route:${route.id}`,
        kind: 'manual',
        title: `${route.path}: ${scenario.title}`,
        deviceRequirements,
        identityRequirements,
      })),
      ...route.controls.map((control) => ({
        id: `route.${route.id}.control.${control}`,
        area: `route:${route.id}`,
        kind: 'manual',
        title: `${route.path}: exercise ${control}`,
        deviceRequirements,
        identityRequirements,
      })),
    ];
  });

  const workflowItems = checklist.workflows.map((workflow) => {
    const requirements = checklist.requirements.rows[workflow.id] ?? {};
    return {
      ...workflow,
      deviceRequirements: requirements.deviceRequirements
        ?? (workflow.kind === 'manual' ? checklist.requirements.defaultManualWorkflowDeviceRequirements : []),
      identityRequirements: requirements.identityRequirements ?? [],
      commandPattern: workflow.kind === 'automated' ? checklist.automationCommands[workflow.id] : undefined,
    };
  });

  return [...routeItems, ...workflowItems];
}

export function discoverRouteSources(mobileRoot = MOBILE_ROOT) {
  const appRoot = path.join(mobileRoot, 'app');
  return listFiles(appRoot)
    .filter((file) => file.endsWith('.tsx'))
    .map((file) => path.relative(mobileRoot, file).split(path.sep).join('/'))
    .filter((file) => !file.endsWith('/_layout.tsx') && file !== 'app/_layout.tsx')
    .sort();
}

export function validateChecklist(checklist, mobileRoot = MOBILE_ROOT) {
  const errors = [];
  if (checklist.schemaVersion !== 1) errors.push('Unsupported checklist schemaVersion.');
  if (!checklist.checklistVersion) errors.push('checklistVersion is required.');
  if (checklist.platform !== 'ios') errors.push('Checklist platform must be ios.');
  if (checklistDigest(checklist) !== EXPECTED_CHECKLIST_SHA256) {
    errors.push('Checklist content changed without updating the reviewed SHA-256 baseline.');
  }

  const listedSources = checklist.routes.map((route) => route.source).sort();
  const discoveredSources = discoverRouteSources(mobileRoot);
  const missingSources = discoveredSources.filter((source) => !listedSources.includes(source));
  const staleSources = listedSources.filter((source) => !discoveredSources.includes(source));
  if (missingSources.length) errors.push(`Routes missing from checklist: ${missingSources.join(', ')}`);
  if (staleSources.length) errors.push(`Checklist route files not found: ${staleSources.join(', ')}`);

  for (const route of checklist.routes) {
    if (!checklist.scenarioSets[route.kind]) {
      errors.push(`Route ${route.id} has unknown kind ${route.kind}.`);
    }
    if (!Array.isArray(route.controls) || route.controls.length === 0) {
      errors.push(`Route ${route.id} must list its controls.`);
    }
    for (const role of route.identityRequirements ?? []) {
      if (!checklist.identityRoles.includes(role)) errors.push(`Route ${route.id} has unknown identity role ${role}.`);
    }
  }

  const expanded = expandChecklist(checklist);
  const duplicateIds = unique(
    expanded.map((item) => item.id).filter((id, index, ids) => ids.indexOf(id) !== index)
  );
  if (duplicateIds.length) errors.push(`Duplicate checklist IDs: ${duplicateIds.join(', ')}`);

  const inventory = {
    routes: checklist.routes.length,
    routeChecks: expanded.length - checklist.workflows.length,
    workflows: checklist.workflows.length,
    total: expanded.length,
  };
  for (const [key, expected] of Object.entries(EXPECTED_INVENTORY)) {
    if (inventory[key] !== expected || checklist.expectedInventory?.[key] !== expected) {
      errors.push(`Checklist ${key} must remain at reviewed baseline ${expected}; observed ${inventory[key]}.`);
    }
  }

  const workflowIds = new Set(checklist.workflows.map((workflow) => workflow.id));
  for (const id of Object.keys(checklist.requirements.rows)) {
    if (!workflowIds.has(id)) errors.push(`Requirements reference unknown workflow ${id}.`);
  }
  const automatedIds = checklist.workflows.filter((workflow) => workflow.kind === 'automated').map((workflow) => workflow.id);
  const commandIds = Object.keys(checklist.automationCommands);
  const missingCommands = automatedIds.filter((id) => !commandIds.includes(id));
  const staleCommands = commandIds.filter((id) => !automatedIds.includes(id));
  if (missingCommands.length) errors.push(`Automated workflows missing command contracts: ${missingCommands.join(', ')}`);
  if (staleCommands.length) errors.push(`Command contracts reference non-automated workflows: ${staleCommands.join(', ')}`);
  for (const item of expanded) {
    for (const role of item.identityRequirements) {
      if (!checklist.identityRoles.includes(role)) errors.push(`${item.id} has unknown identity role ${role}.`);
    }
    if (item.kind === 'automated') {
      try {
        new RegExp(item.commandPattern);
      } catch {
        errors.push(`${item.id} has an invalid automated command pattern.`);
      }
    }
  }

  return errors;
}

export function createRun(checklist, metadata = {}) {
  const now = new Date().toISOString();
  return {
    schemaVersion: 1,
    checklistVersion: checklist.checklistVersion,
    metadata: {
      runId: metadata.runId ?? `ios-${now.replace(/[:.]/g, '-')}`,
      platform: 'ios',
      appVersion: metadata.appVersion ?? '',
      buildNumber: metadata.buildNumber ?? '',
      sourceCommit: metadata.sourceCommit ?? '',
      worktreeClean: metadata.worktreeClean ?? false,
      tester: metadata.tester ?? '',
      checklistSha256: metadata.checklistSha256 ?? checklistDigest(checklist),
      artifactId: metadata.artifactId ?? '',
      artifactSha256: metadata.artifactSha256 ?? '',
      artifactPath: metadata.artifactPath ?? '',
      artifactReceipt: metadata.artifactReceipt ?? '',
      installSource: metadata.installSource ?? '',
      startedAt: now,
      completedAt: '',
      devices: metadata.devices ?? [],
      identities: metadata.identities ?? [],
    },
    results: expandChecklist(checklist).map((item) => ({
      id: item.id,
      status: 'pending',
      testedAt: '',
      artifactId: '',
      deviceIds: [],
      actorIds: [],
      evidence: [],
      command: item.kind === 'automated' ? '' : undefined,
      exitCode: item.kind === 'automated' ? null : undefined,
      outputRef: item.kind === 'automated' ? '' : undefined,
      outputSha256: item.kind === 'automated' ? '' : undefined,
      executionMode: item.kind === 'automated' ? '' : undefined,
      executionReceipt: item.kind === 'automated' ? '' : undefined,
    })),
  };
}

function validIsoDate(value) {
  return typeof value === 'string'
    && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)
    && !Number.isNaN(Date.parse(value))
    && new Date(value).toISOString() === value;
}

function deviceMatches(requirement, device) {
  if (requirement === 'physical-iphone') return device.type === 'physical-iphone';
  if (requirement === 'ipad') return device.type === 'physical-ipad';
  if (requirement === 'physical-device') return device.type === 'physical-iphone' || device.type === 'physical-ipad';
  return false;
}

export function validateRunData(checklist, run, context = {}) {
  const errors = [...validateChecklist(checklist, context.mobileRoot ?? MOBILE_ROOT)];
  const expected = expandChecklist(checklist);
  const expectedById = new Map(expected.map((item) => [item.id, item]));
  const results = Array.isArray(run.results) ? run.results : [];
  const resultIds = results.map((result) => result.id);

  if (run.schemaVersion !== 1) errors.push('Run schemaVersion must be 1.');
  if (run.checklistVersion !== checklist.checklistVersion) {
    errors.push('Run checklistVersion does not match the current checklist.');
  }

  const metadata = run.metadata ?? {};
  for (const key of ['runId', 'appVersion', 'buildNumber', 'sourceCommit', 'tester', 'checklistSha256', 'artifactId', 'artifactSha256', 'artifactPath', 'artifactReceipt', 'installSource']) {
    if (typeof metadata[key] !== 'string' || metadata[key].trim() === '') {
      errors.push(`Run metadata.${key} is required.`);
    }
  }
  if (metadata.platform !== 'ios') errors.push('Run metadata.platform must be ios.');
  if (metadata.installSource !== 'TestFlight') errors.push('Run metadata.installSource must be exactly TestFlight.');
  if (!/^\d+\.\d+\.\d+$/.test(metadata.appVersion ?? '')) errors.push('Run metadata.appVersion must be semantic x.y.z format.');
  if (!/^\d+$/.test(metadata.buildNumber ?? '')) errors.push('Run metadata.buildNumber must contain only digits.');
  if (!/^[a-f0-9]{40}$/i.test(metadata.sourceCommit ?? '')) {
    errors.push('Run metadata.sourceCommit must be a full 40-character commit SHA.');
  }
  if (!/^[a-f0-9]{64}$/i.test(metadata.artifactSha256 ?? '')) {
    errors.push('Run metadata.artifactSha256 must be a 64-character SHA-256.');
  }
  if (typeof metadata.artifactPath !== 'string' || !path.isAbsolute(metadata.artifactPath) || !metadata.artifactPath.endsWith('.ipa')) {
    errors.push('Run metadata.artifactPath must be the absolute path to the exact IPA.');
  }
  if (metadata.checklistSha256 !== checklistDigest(checklist)) {
    errors.push('Run metadata.checklistSha256 does not match the current checklist content.');
  }
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(metadata.artifactId ?? '')) {
    errors.push('Run metadata.artifactId must be the full EAS build UUID.');
  }
  let receiptUrl;
  try {
    receiptUrl = new URL(metadata.artifactReceipt);
  } catch {
    receiptUrl = null;
  }
  if (
    receiptUrl?.protocol !== 'https:'
    || receiptUrl.hostname !== 'expo.dev'
    || !receiptUrl.pathname.endsWith(`/builds/${metadata.artifactId}`)
  ) {
    errors.push('Run metadata.artifactReceipt must be the expo.dev build receipt containing the artifactId.');
  }
  if (context.artifactFileError) {
    errors.push(`Exact IPA could not be verified: ${context.artifactFileError}`);
  } else if (context.artifactFileSha256 !== metadata.artifactSha256) {
    errors.push('Exact IPA bytes do not match run metadata.artifactSha256.');
  }
  const actualRunSha256 = checklistDigest(run);
  if (!/^[a-f0-9]{64}$/i.test(context.expectedRunSha256 ?? '')) {
    errors.push('An externally pinned expected run SHA-256 is required.');
  } else if (context.expectedRunSha256 !== actualRunSha256) {
    errors.push('Run contents do not match the externally pinned run SHA-256.');
  }
  if (metadata.worktreeClean !== true) errors.push('Run metadata.worktreeClean must be true.');
  if (!validIsoDate(metadata.startedAt)) errors.push('Run metadata.startedAt must be an ISO date.');
  if (!validIsoDate(metadata.completedAt)) errors.push('Run metadata.completedAt must be an ISO date.');
  if (validIsoDate(metadata.startedAt) && validIsoDate(metadata.completedAt) && Date.parse(metadata.completedAt) < Date.parse(metadata.startedAt)) {
    errors.push('Run metadata.completedAt cannot be before startedAt.');
  }
  const nowMs = context.nowMs ?? Date.now();
  const maxRunAgeMs = 14 * 24 * 60 * 60 * 1000;
  if (validIsoDate(metadata.startedAt) && Date.parse(metadata.startedAt) > nowMs) {
    errors.push('Run metadata.startedAt cannot be in the future.');
  }
  if (validIsoDate(metadata.completedAt) && Date.parse(metadata.completedAt) > nowMs) {
    errors.push('Run metadata.completedAt cannot be in the future.');
  }
  if (validIsoDate(metadata.startedAt) && nowMs - Date.parse(metadata.startedAt) > maxRunAgeMs) {
    errors.push('Run is stale because it started more than 14 days ago.');
  }
  if (
    validIsoDate(metadata.startedAt)
    && validIsoDate(metadata.completedAt)
    && Date.parse(metadata.completedAt) - Date.parse(metadata.startedAt) > maxRunAgeMs
  ) {
    errors.push('Run duration cannot exceed 14 days.');
  }
  if (!Array.isArray(metadata.devices) || metadata.devices.length === 0) {
    errors.push('Run metadata.devices must contain at least one exact test device.');
  } else {
    const validDeviceTypes = ['physical-iphone', 'physical-ipad', 'simulator-iphone', 'simulator-ipad'];
    const duplicateDeviceIds = unique(metadata.devices.map((device) => device?.id).filter((id, index, ids) => id && ids.indexOf(id) !== index));
    if (duplicateDeviceIds.length) errors.push(`Run metadata.devices contains duplicate IDs: ${duplicateDeviceIds.join(', ')}`);
    metadata.devices.forEach((device, index) => {
      for (const key of ['id', 'type', 'model', 'osVersion']) {
        if (typeof device?.[key] !== 'string' || device[key].trim() === '') {
          errors.push(`Run metadata.devices[${index}].${key} is required.`);
        }
      }
      if (device?.type && !validDeviceTypes.includes(device.type)) {
        errors.push(`Run metadata.devices[${index}].type must be one of ${validDeviceTypes.join(', ')}.`);
      }
    });
    if (!metadata.devices.some((device) => device.type === 'physical-iphone')) {
      errors.push('Run metadata.devices must include a physical iPhone.');
    }
    if (!metadata.devices.some((device) => device.type === 'physical-ipad')) {
      errors.push('Run metadata.devices must include physical iPad TestFlight compatibility coverage.');
    }
  }
  if (!Array.isArray(metadata.identities) || metadata.identities.length === 0) {
    errors.push('Run metadata.identities must declare every disposable QA identity.');
  } else {
    const duplicateIdentityIds = unique(metadata.identities.map((identity) => identity?.id).filter((id, index, ids) => id && ids.indexOf(id) !== index));
    if (duplicateIdentityIds.length) errors.push(`Run metadata.identities contains duplicate IDs: ${duplicateIdentityIds.join(', ')}`);
    metadata.identities.forEach((identity, index) => {
      for (const key of ['id', 'role']) {
        if (typeof identity?.[key] !== 'string' || identity[key].trim() === '') {
          errors.push(`Run metadata.identities[${index}].${key} is required.`);
        }
      }
      if (identity?.role && !checklist.identityRoles.includes(identity.role)) {
        errors.push(`Run metadata.identities[${index}].role is not allowed.`);
      }
    });
    for (const role of checklist.identityRoles) {
      if (!metadata.identities.some((identity) => identity.role === role)) {
        errors.push(`Run metadata.identities must include role ${role}.`);
      }
    }
  }

  if (context.currentCommit && metadata.sourceCommit !== context.currentCommit) {
    errors.push(`Run commit ${metadata.sourceCommit} does not match checkout ${context.currentCommit}.`);
  }
  if (context.worktreeClean === false) errors.push('Current checkout is dirty; exact-source verification is impossible.');

  const duplicateIds = unique(resultIds.filter((id, index) => resultIds.indexOf(id) !== index));
  if (duplicateIds.length) errors.push(`Duplicate run result IDs: ${duplicateIds.join(', ')}`);
  const missing = expected.map((item) => item.id).filter((id) => !resultIds.includes(id));
  const unknown = resultIds.filter((id) => !expectedById.has(id));
  if (missing.length) errors.push(`Missing ${missing.length} required result(s): ${missing.slice(0, 8).join(', ')}`);
  if (unknown.length) errors.push(`Unknown result IDs: ${unknown.slice(0, 8).join(', ')}`);

  const evidenceRefs = new Map();
  const automatedOutputRefs = new Map();
  const automatedOutputIdentities = new Map();
  const automatedOutputHashes = new Map();
  for (const result of results) {
    const item = expectedById.get(result.id);
    if (!item) continue;
    if (result.status !== 'pass') {
      errors.push(`${result.id} is ${result.status ?? 'missing status'}; every required check must pass.`);
      continue;
    }
    if (!validIsoDate(result.testedAt)) {
      errors.push(`${result.id} requires an ISO testedAt value.`);
    } else if (
      validIsoDate(metadata.startedAt)
      && validIsoDate(metadata.completedAt)
      && (Date.parse(result.testedAt) < Date.parse(metadata.startedAt) || Date.parse(result.testedAt) > Date.parse(metadata.completedAt))
    ) {
      errors.push(`${result.id} testedAt must fall within the run window.`);
    }
    if (result.artifactId !== metadata.artifactId) {
      errors.push(`${result.id} artifactId does not match the run artifact.`);
    }
    if (!Array.isArray(result.evidence) || result.evidence.length === 0) {
      errors.push(`${result.id} requires structured evidence.`);
    } else {
      result.evidence.forEach((entry, index) => {
        const allowedTypes = ['screenshot', 'video', 'log', 'query', 'receipt', 'observation'];
        if (!entry || typeof entry !== 'object') {
          errors.push(`${result.id} evidence[${index}] must be a structured evidence object.`);
          return;
        }
        if (!allowedTypes.includes(entry.type)) {
          errors.push(`${result.id} evidence[${index}].type must be one of ${allowedTypes.join(', ')}.`);
        }
        if (typeof entry.ref !== 'string' || entry.ref.trim().length < 8) {
          errors.push(`${result.id} evidence[${index}].ref must identify the proof source.`);
        } else {
          const evidenceKey = entry.ref.trim().toLowerCase();
          const previousOwner = evidenceRefs.get(evidenceKey);
          if (previousOwner && previousOwner !== result.id) {
            errors.push(`${result.id} reuses evidence reference already claimed by ${previousOwner}.`);
          } else {
            evidenceRefs.set(evidenceKey, result.id);
          }
        }
        if (typeof entry.observed !== 'string' || entry.observed.trim().length < 20) {
          errors.push(`${result.id} evidence[${index}].observed must state the verified outcome.`);
        }
      });
    }
    if (
      result.id === 'artifact.hash'
      && !result.evidence?.some((entry) => typeof entry?.observed === 'string' && entry.observed.includes(metadata.artifactSha256))
    ) {
      errors.push('artifact.hash evidence must include the exact artifact SHA-256.');
    }
    if (item.kind === 'manual') {
      if (!Array.isArray(result.deviceIds) || result.deviceIds.length === 0) {
        errors.push(`${result.id} must reference declared test devices.`);
      } else {
        const devices = result.deviceIds.map((id) => metadata.devices.find((candidate) => candidate.id === id));
        if (devices.some((device) => !device)) errors.push(`${result.id} references an undeclared device.`);
        for (const requirement of item.deviceRequirements) {
          if (!devices.some((device) => device && deviceMatches(requirement, device))) {
            errors.push(`${result.id} is missing required device coverage: ${requirement}.`);
          }
        }
      }
    } else {
      if (typeof result.command !== 'string' || result.command.trim().length < 3) {
        errors.push(`${result.id} requires the exact automated command.`);
      }
      if (result.exitCode !== 0) errors.push(`${result.id} requires exitCode 0.`);
      if (typeof result.outputRef !== 'string' || result.outputRef.trim().length < 3) {
        errors.push(`${result.id} requires an absolute automated-output file reference.`);
      } else {
        if (!path.isAbsolute(result.outputRef.trim())) {
          errors.push(`${result.id} outputRef must be absolute.`);
        }
        const normalizedOutputRef = path.normalize(result.outputRef.trim()).toLowerCase();
        const previousOwner = automatedOutputRefs.get(normalizedOutputRef);
        if (previousOwner && previousOwner !== result.id) {
          errors.push(`${result.id} reuses automated output already claimed by ${previousOwner}.`);
        } else {
          automatedOutputRefs.set(normalizedOutputRef, result.id);
        }
      }
      if (typeof result.outputSha256 !== 'string' || !/^[a-f0-9]{64}$/.test(result.outputSha256)) {
        errors.push(`${result.id} requires the recorded SHA-256 of its automated output.`);
      }
      const verifiedOutput = context.automatedOutputFiles?.[result.id];
      if (!verifiedOutput) {
        errors.push(`${result.id} automated output was not verified from the filesystem.`);
      } else if (verifiedOutput.error) {
        errors.push(`${result.id} automated output verification failed: ${verifiedOutput.error}.`);
      } else if (!Number.isInteger(verifiedOutput.size) || verifiedOutput.size < 1) {
        errors.push(`${result.id} automated output must be a non-empty file.`);
      } else if (verifiedOutput.sha256 !== result.outputSha256) {
        errors.push(`${result.id} automated output SHA-256 does not match the referenced file.`);
      } else {
        const previousHashOwner = automatedOutputHashes.get(verifiedOutput.sha256);
        if (previousHashOwner && previousHashOwner !== result.id) {
          errors.push(
            `${result.id} reuses automated output content already claimed by ${previousHashOwner}.`
          );
        } else {
          automatedOutputHashes.set(verifiedOutput.sha256, result.id);
        }
        const identityKey = `${verifiedOutput.dev}:${verifiedOutput.ino}`;
        const previousIdentityOwner = automatedOutputIdentities.get(identityKey);
        if (previousIdentityOwner && previousIdentityOwner !== result.id) {
          errors.push(
            `${result.id} reuses automated output bytes already claimed by ${previousIdentityOwner}.`
          );
        } else {
          automatedOutputIdentities.set(identityKey, result.id);
        }
      }
      if (result.executionMode !== 'gate') {
        errors.push(`${result.id} must be executed and captured by the QA gate.`);
      }
      if (result.executionReceipt !== gateExecutionReceipt(metadata, result)) {
        errors.push(`${result.id} has an invalid QA gate execution receipt.`);
      }
      if (typeof result.command === 'string' && !new RegExp(item.commandPattern).test(result.command.trim())) {
        errors.push(`${result.id} command does not match its allowlisted command contract.`);
      }
      const reviewCommand = `npm run review:ios -- --ipa "${metadata.artifactPath}" --build-number ${metadata.buildNumber}`;
      const hashCommand = `shasum -a 256 "${metadata.artifactPath}"`;
      const artifactReviewIds = [
        'artifact.identity',
        'artifact.production-env',
        'artifact.native-modules',
        'artifact.privacy-manifest',
        'regression.ios-notifications',
        'regression.support-url',
      ];
      if (artifactReviewIds.includes(result.id) && result.command !== reviewCommand) {
        errors.push(`${result.id} command must reference the run artifactPath and buildNumber exactly.`);
      }
      if (result.id === 'artifact.hash' && result.command !== hashCommand) {
        errors.push('artifact.hash command must reference the run artifactPath exactly.');
      }
      if (result.id === 'privacy.logs' && !result.command.startsWith('! ')) {
        errors.push('privacy.logs command must invert the sensitive-data search so exitCode 0 means no matches were found.');
      }
    }
    if (!Array.isArray(result.actorIds)) {
      errors.push(`${result.id} actorIds must be an array.`);
    } else {
      const actors = result.actorIds.map((id) => metadata.identities.find((identity) => identity.id === id));
      if (actors.some((identity) => !identity)) errors.push(`${result.id} references an undeclared QA identity.`);
      for (const role of item.identityRequirements) {
        if (!actors.some((identity) => identity?.role === role)) {
          errors.push(`${result.id} is missing required identity role: ${role}.`);
        }
      }
    }
  }

  return errors;
}

function usage() {
  console.log(`Usage:
  npm run qa:ios:inventory
  npm run qa:ios:init -- --output qa/runs/build-35.json --version 1.0.2 --build 35 --tester <name> --artifact <EAS-UUID> --ipa </absolute/path/app.ipa> --sha256 <hash> --receipt <expo.dev-url> --install-source TestFlight
  npm run qa:ios:record -- --run qa/runs/build-35.json --id <check-id> --status pass --devices <id,id> --actors <id,id> --evidence-type <type> --evidence <unique-reference> --observed <outcome>
  npm run qa:ios:run -- --run qa/runs/build-35.json --id <automated-id> --actors <id,id> --evidence-type <type> --evidence <unique-reference> --observed <outcome> --command <allowlisted-command> --output-ref </absolute/path/command-output.log>
  npm run qa:ios:status -- --run qa/runs/build-35.json
  npm run qa:ios:digest -- --run qa/runs/build-35.json
  npm run qa:ios:verify -- --run qa/runs/build-35.json --expected-run-sha256 <externally-pinned-hash>`);
}

export function resolveRunPath(value, flag = '--run', mustNotExist = false) {
  if (!value) throw new Error(`${flag} is required.`);
  const resolved = path.resolve(MOBILE_ROOT, value);
  const realRunsRoot = realpathSync(RUNS_ROOT);
  if (realpathSync(path.dirname(resolved)) !== realRunsRoot) {
    throw new Error(`${flag} must name a direct child of ${path.relative(MOBILE_ROOT, RUNS_ROOT)}.`);
  }
  let file = null;
  try {
    file = lstatSync(resolved);
  } catch (error) {
    if (!(error instanceof Error) || !('code' in error) || error.code !== 'ENOENT') throw error;
  }
  if (file) {
    if (file.isSymbolicLink() || !file.isFile() || path.dirname(realpathSync(resolved)) !== realRunsRoot) {
      throw new Error(`${flag} must reference a regular, non-symlink run file.`);
    }
    if (mustNotExist) throw new Error(`${flag} already exists; runs cannot be overwritten.`);
  }
  return resolved;
}

function verificationContext(run, expectedRunSha256) {
  const context = { ...currentGitContext(), expectedRunSha256, automatedOutputFiles: {} };
  try {
    if (!path.isAbsolute(run.metadata?.artifactPath ?? '')) throw new Error('artifactPath is not absolute');
    const artifact = lstatSync(run.metadata.artifactPath);
    if (artifact.isSymbolicLink() || !artifact.isFile()) throw new Error('artifactPath is not a regular non-symlink file');
    context.artifactFileSha256 = fileSha256(run.metadata.artifactPath);
  } catch (error) {
    context.artifactFileError = error instanceof Error ? error.message : String(error);
  }
  for (const result of run.results ?? []) {
    if (typeof result?.command !== 'string') continue;
    try {
      context.automatedOutputFiles[result.id] = inspectOutputFile(result.outputRef);
    } catch (error) {
      context.automatedOutputFiles[result.id] = {
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
  return context;
}

function main() {
  const checklist = readJson(CHECKLIST_PATH);
  const { command, flags } = parseArgs(process.argv.slice(2));
  const manifestErrors = validateChecklist(checklist);
  if (manifestErrors.length) {
    manifestErrors.forEach((error) => console.error(`FAIL ${error}`));
    process.exitCode = 1;
    return;
  }

  if (command === 'inventory') {
    const expanded = expandChecklist(checklist);
    console.log(`PASS checklist ${checklist.checklistVersion}`);
    console.log(`Routes: ${checklist.routes.length}`);
    console.log(`Route and control checks: ${expanded.length - checklist.workflows.length}`);
    console.log(`Cross-route workflows: ${checklist.workflows.length}`);
    console.log(`Total required evidence rows: ${expanded.length}`);
    return;
  }

  if (command === 'init') {
    if (!flags.output) throw new Error('--output is required.');
    const gitContext = currentGitContext();
    const run = createRun(checklist, {
      appVersion: flags.version,
      buildNumber: flags.build,
      sourceCommit: gitContext.currentCommit,
      worktreeClean: gitContext.worktreeClean,
      tester: flags.tester,
      artifactId: flags.artifact,
      artifactSha256: flags.sha256,
      artifactPath: flags.ipa,
      artifactReceipt: flags.receipt,
      installSource: flags['install-source'],
    });
    const output = resolveRunPath(flags.output, '--output', true);
    writeJson(output, run);
    console.log(`Created ${output}`);
    console.log('Add exact devices and disposable identities, complete every result, set completedAt, then run qa:ios:verify.');
    return;
  }

  if (command === 'record') {
    const runPath = resolveRunPath(flags.run);
    const run = readJson(runPath);
    if (run.metadata?.completedAt) throw new Error('Completed runs are immutable; create a new run instead.');
    const item = expandChecklist(checklist).find((candidate) => candidate.id === flags.id);
    if (!item) throw new Error(`Unknown checklist id: ${flags.id}`);
    const result = run.results.find((candidate) => candidate.id === flags.id);
    if (!result) throw new Error(`Run is missing checklist id: ${flags.id}`);
    if (item.kind === 'automated') {
      throw new Error('Automated checks must use the QA gate run command.');
    }
    result.status = flags.status ?? 'pass';
    result.testedAt = new Date().toISOString();
    result.artifactId = run.metadata.artifactId;
    result.deviceIds = item.kind === 'manual' ? (flags.devices ?? '').split(',').filter(Boolean) : [];
    result.actorIds = (flags.actors ?? '').split(',').filter(Boolean);
    result.evidence = [{
      type: flags['evidence-type'] ?? '',
      ref: flags.evidence ?? '',
      observed: flags.observed ?? '',
    }];
    writeJson(runPath, run);
    console.log(`Recorded ${result.status}: ${result.id}`);
    return;
  }

  if (command === 'run') {
    const runPath = resolveRunPath(flags.run);
    const run = readJson(runPath);
    if (run.metadata?.completedAt) throw new Error('Completed runs are immutable; create a new run instead.');
    const item = expandChecklist(checklist).find((candidate) => candidate.id === flags.id);
    if (!item || item.kind !== 'automated') {
      throw new Error(`Unknown automated checklist id: ${flags.id}`);
    }
    const result = run.results.find((candidate) => candidate.id === flags.id);
    if (!result) throw new Error(`Run is missing checklist id: ${flags.id}`);
    const automationCommand = flags.command ?? '';
    if (!new RegExp(item.commandPattern).test(automationCommand)) {
      throw new Error(`${item.id} command does not match its allowlisted command contract.`);
    }
    const outputRef = flags['output-ref'] ?? '';
    if (!path.isAbsolute(outputRef)) throw new Error('--output-ref must be absolute.');
    try {
      lstatSync(outputRef);
      throw new Error('--output-ref must not already exist.');
    } catch (error) {
      if (!(error instanceof Error) || !('code' in error) || error.code !== 'ENOENT') throw error;
    }

    const execution = spawnSync('/bin/bash', ['-lc', automationCommand], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    });
    const exitCode = execution.status ?? 1;
    const output = [
      `$ ${automationCommand}`,
      `exitCode=${exitCode}`,
      execution.stdout ?? '',
      execution.stderr ?? '',
    ].join('\n');
    writeFileSync(outputRef, `${output.trimEnd()}\n`, { flag: 'wx' });
    const inspected = inspectOutputFile(outputRef);

    result.status = exitCode === 0 ? 'pass' : 'fail';
    result.testedAt = new Date().toISOString();
    result.artifactId = run.metadata.artifactId;
    result.deviceIds = [];
    result.actorIds = (flags.actors ?? '').split(',').filter(Boolean);
    result.evidence = [{
      type: flags['evidence-type'] ?? 'log',
      ref: flags.evidence ?? `qa-gate:${result.id}:${inspected.sha256}`,
      observed: flags.observed ?? `QA gate executed ${result.id}; exit code ${exitCode}.`,
    }];
    result.command = automationCommand;
    result.exitCode = exitCode;
    result.outputRef = outputRef;
    result.outputSha256 = inspected.sha256;
    result.executionMode = 'gate';
    result.executionReceipt = gateExecutionReceipt(run.metadata, result);
    writeJson(runPath, run);
    console.log(`${exitCode === 0 ? 'PASS' : 'FAIL'} executed and captured: ${result.id}`);
    if (exitCode !== 0) process.exitCode = exitCode;
    return;
  }

  if (command === 'status') {
    const run = readJson(resolveRunPath(flags.run));
    const counts = run.results.reduce((values, result) => {
      values[result.status] = (values[result.status] ?? 0) + 1;
      return values;
    }, {});
    console.log(JSON.stringify(counts, null, 2));
    run.results.filter((result) => result.status !== 'pass').slice(0, 30).forEach((result) => {
      console.log(`${result.status.toUpperCase()} ${result.id}`);
    });
    return;
  }

  if (command === 'digest') {
    const run = readJson(resolveRunPath(flags.run));
    if (!validIsoDate(run.metadata?.completedAt)) throw new Error('Set a valid completedAt before pinning the run digest.');
    console.log(checklistDigest(run));
    return;
  }

  if (command === 'verify') {
    const runPath = resolveRunPath(flags.run);
    const run = readJson(runPath);
    const errors = validateRunData(checklist, run, verificationContext(run, flags['expected-run-sha256']));
    if (errors.length) {
      errors.slice(0, 100).forEach((error) => console.error(`FAIL ${error}`));
      if (errors.length > 100) console.error(`FAIL ${errors.length - 100} additional error(s) omitted.`);
      process.exitCode = 1;
      return;
    }
    console.log(`PASS exhaustive iOS QA gate: ${runPath}`);
    console.log(`QA run SHA-256: ${checklistDigest(run)}`);
    return;
  }

  usage();
  process.exitCode = 2;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main();
  } catch (error) {
    console.error(`FAIL ${error instanceof Error ? error.message : String(error)}`);
    usage();
    process.exitCode = 1;
  }
}
