import { readFileSync, symlinkSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  CHECKLIST_PATH,
  MOBILE_ROOT,
  RUNS_ROOT,
  createRun,
  checklistDigest,
  expandChecklist,
  gateExecutionReceipt,
  resolveRunPath,
  validateChecklist,
  validateRunData,
} from '../../mobile/scripts/qa-release-gate.mjs';

const checklist = JSON.parse(readFileSync(CHECKLIST_PATH, 'utf8'));

function completeRun() {
  const commit = 'a'.repeat(40);
  const artifactId = '12345678-1234-1234-9234-123456789abc';
  const identities = checklist.identityRoles.map((role: string) => ({ id: `identity-${role}`, role }));
  const run = createRun(checklist, {
    appVersion: '1.0.2',
    buildNumber: '35',
    sourceCommit: commit,
    worktreeClean: true,
    tester: 'QA Engineer',
    artifactId,
    artifactSha256: 'b'.repeat(64),
    artifactPath: '/tmp/app.ipa',
    artifactReceipt: `https://expo.dev/accounts/test/projects/mhtoolkit/builds/${artifactId}`,
    installSource: 'TestFlight',
    devices: [
      { id: 'iphone-1', type: 'physical-iphone', model: 'iPhone 17', osVersion: '26.5' },
      { id: 'ipad-1', type: 'physical-ipad', model: 'iPad Air 11-inch (M3)', osVersion: '26.5' },
    ],
    identities,
  });
  const items = new Map(expandChecklist(checklist).map((item) => [item.id, item]));
  for (const [resultIndex, result] of run.results.entries()) {
    const item = items.get(result.id)!;
    result.status = 'pass';
    result.testedAt = new Date().toISOString();
    result.artifactId = artifactId;
    result.evidence = [{
      type: item.kind === 'manual' ? 'observation' : 'log',
      ref: `run-log:${result.id}`,
      observed: result.id === 'artifact.hash'
        ? `Observed exact artifact SHA-256 ${'b'.repeat(64)} in the command output.`
        : `Observed the expected outcome for ${result.id} on the exact artifact.`,
    }];
    if (item.kind === 'manual') {
      result.deviceIds = item.deviceRequirements.includes('ipad') ? ['iphone-1', 'ipad-1'] : ['iphone-1'];
    } else {
      const commands: Record<string, string> = {
        'artifact.clean-commit': 'git status --porcelain',
        'artifact.identity': 'npm run review:ios -- --ipa "/tmp/app.ipa" --build-number 35',
        'artifact.hash': 'shasum -a 256 "/tmp/app.ipa"',
        'artifact.production-env': 'npm run review:ios -- --ipa "/tmp/app.ipa" --build-number 35',
        'artifact.native-modules': 'npm run review:ios -- --ipa "/tmp/app.ipa" --build-number 35',
        'artifact.privacy-manifest': 'npm run review:ios -- --ipa "/tmp/app.ipa" --build-number 35',
        'artifact.tests': 'npm test -- --run tests && cd mobile && npx tsc --noEmit && npm run lint -- --max-warnings=0',
        'artifact.prebuild': 'npx expo prebuild --clean && xcodebuild -workspace ios/MHtoolkit.xcworkspace -scheme MHtoolkit -configuration Release build',
        'partner.aggregate-only': 'npm run verify:partner-rls',
        'partner.raw-data-denied': 'npm run verify:partner-rls',
        'privacy.logs': "! log show --archive /tmp/app.logarchive --style compact | rg -i '(token|secret|authorization|journal|assessment)'",
        'privacy.rls': 'npm run verify:partner-rls',
        'external.links': 'npm run verify:resource-links',
        'regression.ios-notifications': 'npm run review:ios -- --ipa "/tmp/app.ipa" --build-number 35',
        'regression.support-url': 'npm run review:ios -- --ipa "/tmp/app.ipa" --build-number 35',
      };
      result.command = commands[result.id];
      result.exitCode = 0;
      result.outputRef = `/tmp/qa-output-${result.id}.log`;
      result.outputSha256 = resultIndex.toString(16).padStart(64, '0');
      result.executionMode = 'gate';
      result.executionReceipt = gateExecutionReceipt(run.metadata, result);
    }
    result.actorIds = item.identityRequirements.map((role: string) => `identity-${role}`);
  }
  run.metadata.completedAt = new Date().toISOString();
  return { run, commit };
}

function exactContext(run: ReturnType<typeof completeRun>['run'], commit: string, overrides = {}) {
  const automatedOutputFiles = Object.fromEntries(
    run.results
      .filter((result) => typeof result.command === 'string')
      .map((result, index) => [
        result.id,
        {
          canonicalPath: result.outputRef,
          dev: '1',
          ino: String(index + 1),
          sha256: result.outputSha256,
          size: 100,
        },
      ])
  );
  return {
    mobileRoot: MOBILE_ROOT,
    currentCommit: commit,
    worktreeClean: true,
    artifactFileSha256: 'b'.repeat(64),
    automatedOutputFiles,
    expectedRunSha256: checklistDigest(run),
    ...overrides,
  };
}

describe('exhaustive mobile QA release gate', () => {
  it('covers every native route file and has unique evidence rows', () => {
    expect(validateChecklist(checklist, MOBILE_ROOT)).toEqual([]);
    const ids = expandChecklist(checklist).map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(checklist.expectedInventory).toEqual({ routes: 38, routeChecks: 759, workflows: 121, total: 880 });
    expect(checklist.routes).toHaveLength(38);
    expect(checklist.workflows).toHaveLength(121);
    expect(ids).toHaveLength(880);
    expect(checklistDigest(checklist)).toMatch(/^[a-f0-9]{64}$/);
  });

  it('keeps the written protocol aligned with the enforced inventory and simulator preflight', () => {
    const protocol = readFileSync(path.join(MOBILE_ROOT, 'QA_PROTOCOL.md'), 'utf8');
    const { routes, routeChecks, workflows, total } = checklist.expectedInventory;

    expect(protocol).toContain(
      `${routes}-route, ${routeChecks} route/control, ${workflows} workflow, and ${total} total-row inventory`
    );
    expect(protocol).toContain(
      'curl --fail --silent http://127.0.0.1:8081/status'
    );
    expect(protocol).toContain('packager-status:running');
    expect(protocol).toContain('cached JavaScript');
  });

  it('accepts only a complete exact-artifact run', () => {
    const { run, commit } = completeRun();
    expect(
      validateRunData(checklist, run, exactContext(run, commit))
    ).toEqual([]);
  });

  it('fails closed on pending, missing, stale, dirty, or evidence-free results', () => {
    const { run } = completeRun();
    run.results[0].status = 'pending';
    run.results[1].evidence = [];
    run.results.pop();

    const errors = validateRunData(checklist, run, exactContext(run, 'c'.repeat(40), { worktreeClean: false }));

    expect(errors.some((error) => error.includes('every required check must pass'))).toBe(true);
    expect(errors.some((error) => error.includes('requires structured evidence'))).toBe(true);
    expect(errors.some((error) => error.includes('Missing 1 required result'))).toBe(true);
    expect(errors.some((error) => error.includes('does not match checkout'))).toBe(true);
    expect(errors.some((error) => error.includes('Current checkout is dirty'))).toBe(true);
  });

  it('rejects weak evidence, undeclared testers, and missing physical-device coverage', () => {
    const { run, commit } = completeRun();
    run.metadata.tester = '';
    run.metadata.devices = [
      { id: 'iphone-sim', type: 'simulator-iphone', model: 'iPhone 17', osVersion: '26.5' },
    ];
    run.results[0].evidence = [{ type: 'observation', ref: 'shortref', observed: 'looks good' }];

    const errors = validateRunData(checklist, run, exactContext(run, commit));

    expect(errors).toContain('Run metadata.tester is required.');
    expect(errors).toContain('Run metadata.devices must include a physical iPhone.');
    expect(errors).toContain('Run metadata.devices must include physical iPad TestFlight compatibility coverage.');
    expect(errors.some((error) => error.includes('must state the verified outcome'))).toBe(true);
  });

  it('rejects non-TestFlight, wrong-platform, duplicate-device, and future runs', () => {
    const { run, commit } = completeRun();
    run.metadata.platform = 'android';
    run.metadata.installSource = 'Local Debug';
    run.metadata.completedAt = '2099-01-01T00:00:00.000Z';
    run.metadata.devices.push({ ...run.metadata.devices[0] });

    const errors = validateRunData(checklist, run, exactContext(run, commit, {
      nowMs: Date.parse('2026-08-02T22:00:00.000Z'),
    }));

    expect(errors).toContain('Run metadata.platform must be ios.');
    expect(errors).toContain('Run metadata.installSource must be exactly TestFlight.');
    expect(errors).toContain('Run metadata.completedAt cannot be in the future.');
    expect(errors.some((error) => error.includes('duplicate IDs'))).toBe(true);
  });

  it('rejects simulator-only iPad coverage for the signed TestFlight release gate', () => {
    const { run, commit } = completeRun();
    run.metadata.devices[1].type = 'simulator-ipad';

    const errors = validateRunData(checklist, run, exactContext(run, commit));

    expect(errors).toContain('Run metadata.devices must include physical iPad TestFlight compatibility coverage.');
    expect(errors.some((error) => error.includes('missing required device coverage: ipad'))).toBe(true);
  });

  it('rejects privacy log searches where exitCode 0 would mean sensitive matches were found', () => {
    const { run, commit } = completeRun();
    const privacyLogs = run.results.find((result) => result.id === 'privacy.logs')!;
    privacyLogs.command = "log show --archive /tmp/app.logarchive --style compact | rg -i '(token|secret)'";

    const errors = validateRunData(checklist, run, exactContext(run, commit));

    expect(errors).toContain('privacy.logs command must invert the sensitive-data search so exitCode 0 means no matches were found.');
  });

  it('rejects checklist rebinding, reused evidence, wrong commands, and missing role actors', () => {
    const { run, commit } = completeRun();
    run.metadata.checklistSha256 = 'c'.repeat(64);
    run.results[1].evidence = run.results[0].evidence;
    const automated = run.results.find((result) => result.id === 'privacy.rls')!;
    automated.command = 'true';
    automated.actorIds = [];

    const errors = validateRunData(checklist, run, exactContext(run, commit));

    expect(errors).toContain('Run metadata.checklistSha256 does not match the current checklist content.');
    expect(errors.some((error) => error.includes('reuses evidence reference'))).toBe(true);
    expect(errors).toContain('privacy.rls command does not match its allowlisted command contract.');
    expect(errors).toContain('privacy.rls is missing required identity role: email-owner.');
  });

  it('binds artifact commands and bytes to the declared IPA and build', () => {
    const { run, commit } = completeRun();
    run.results.find((result) => result.id === 'artifact.identity')!.command =
      'npm run review:ios -- --ipa "/tmp/unrelated.ipa" --build-number 999';

    const errors = validateRunData(checklist, run, exactContext(run, commit, {
      artifactFileSha256: 'c'.repeat(64),
    }));

    expect(errors).toContain('Exact IPA bytes do not match run metadata.artifactSha256.');
    expect(errors).toContain('artifact.identity command must reference the run artifactPath and buildNumber exactly.');
  });

  it('binds automated checks to unique, non-empty output files by SHA-256', () => {
    const { run, commit } = completeRun();
    const tests = run.results.find((result) => result.id === 'artifact.tests')!;
    const prebuild = run.results.find((result) => result.id === 'artifact.prebuild')!;
    const links = run.results.find((result) => result.id === 'external.links')!;
    prebuild.outputRef = tests.outputRef;
    links.outputRef = 'relative-output.log';

    const errors = validateRunData(checklist, run, exactContext(run, commit, {
      automatedOutputFiles: {
        ...exactContext(run, commit).automatedOutputFiles,
        'artifact.tests': { sha256: 'e'.repeat(64), size: 100 },
        'artifact.prebuild': { error: 'outputRef is empty' },
        'external.links': { sha256: links.outputSha256, size: 0 },
      },
    }));

    expect(errors).toContain('artifact.prebuild reuses automated output already claimed by artifact.tests.');
    expect(errors).toContain('artifact.tests automated output SHA-256 does not match the referenced file.');
    expect(errors).toContain('artifact.prebuild automated output verification failed: outputRef is empty.');
    expect(errors).toContain('external.links outputRef must be absolute.');
    expect(errors).toContain('external.links automated output must be a non-empty file.');
  });

  it('rejects hard-linked output reuse and forged gate execution receipts', () => {
    const { run, commit } = completeRun();
    const tests = run.results.find((result) => result.id === 'artifact.tests')!;
    const prebuild = run.results.find((result) => result.id === 'artifact.prebuild')!;
    prebuild.outputSha256 = tests.outputSha256;
    prebuild.executionReceipt = 'f'.repeat(64);
    const context = exactContext(run, commit);
    context.automatedOutputFiles![prebuild.id] = {
      canonicalPath: prebuild.outputRef,
      dev: context.automatedOutputFiles![tests.id].dev,
      ino: context.automatedOutputFiles![tests.id].ino,
      sha256: tests.outputSha256,
      size: 100,
    };

    const errors = validateRunData(checklist, run, context);

    expect(errors).toContain(
      'artifact.prebuild reuses automated output bytes already claimed by artifact.tests.'
    );
    expect(errors).toContain(
      'artifact.prebuild reuses automated output content already claimed by artifact.tests.'
    );
    expect(errors).toContain('artifact.prebuild has an invalid QA gate execution receipt.');
  });

  it('does not let the manual record command attest automated checks', () => {
    const source = readFileSync(
      path.join(MOBILE_ROOT, 'scripts/qa-release-gate.mjs'),
      'utf8'
    );
    expect(source).toContain(
      "throw new Error('Automated checks must use the QA gate run command.')"
    );
    expect(source).toContain("spawnSync('/bin/bash', ['-lc', automationCommand]");
    expect(source).toContain("result.executionMode = 'gate'");
  });

  it('rejects future timestamps and runs lasting longer than 14 days', () => {
    const { run, commit } = completeRun();
    run.metadata.startedAt = '2026-07-19T18:00:00.000Z';
    run.metadata.completedAt = '2026-08-02T18:00:00.001Z';
    run.results.forEach((result) => { result.testedAt = '2026-08-02T18:00:00.000Z'; });

    const errors = validateRunData(checklist, run, exactContext(run, commit, {
      nowMs: Date.parse('2026-08-02T17:59:59.999Z'),
    }));

    expect(errors).toContain('Run metadata.completedAt cannot be in the future.');
    expect(errors).toContain('Run duration cannot exceed 14 days.');
  });

  it('rejects a completed run changed after its digest was pinned', () => {
    const { run, commit } = completeRun();
    const pinned = checklistDigest(run);
    run.results[0].evidence[0].observed = 'Changed after the completed run digest was pinned externally.';

    const errors = validateRunData(checklist, run, exactContext(run, commit, {
      expectedRunSha256: pinned,
    }));

    expect(errors).toContain('Run contents do not match the externally pinned run SHA-256.');
  });

  it('treats an evidence reference as unique regardless of evidence type and requires route actors', () => {
    const { run, commit } = completeRun();
    run.results[0].evidence[0] = { type: 'screenshot', ref: 'same-proof-reference', observed: 'Observed first expected result on exact artifact.' };
    run.results[1].evidence[0] = { type: 'video', ref: 'same-proof-reference', observed: 'Observed second expected result on exact artifact.' };
    const moodSave = run.results.find((result) => result.id === 'route.mood-tracker.control.save')!;
    moodSave.actorIds = [];

    const errors = validateRunData(checklist, run, exactContext(run, commit));

    expect(errors.some((error) => error.includes('reuses evidence reference'))).toBe(true);
    expect(errors).toContain('route.mood-tracker.control.save is missing required identity role: saved-anonymous.');
  });

  it('rejects symlink run files even when they are direct children of qa/runs', () => {
    const linkName = `.qa-gate-symlink-${process.pid}.json`;
    const linkPath = path.join(RUNS_ROOT, linkName);
    symlinkSync('/tmp/outside-qa-run.json', linkPath);
    try {
      expect(() => resolveRunPath(`qa/runs/${linkName}`)).toThrow('regular, non-symlink run file');
    } finally {
      unlinkSync(linkPath);
    }
  });
});
