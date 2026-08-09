// This file mirrors the exports in qa-release-gate.mjs for test type-checking.
export type QaDeviceType =
  | 'physical-iphone'
  | 'physical-ipad'
  | 'simulator-iphone'
  | 'simulator-ipad';

export type QaDevice = {
  id: string;
  type: QaDeviceType;
  model: string;
  osVersion: string;
};

export type QaIdentity = {
  id: string;
  role: string;
};

export type QaEvidence = {
  type: 'screenshot' | 'video' | 'log' | 'query' | 'receipt' | 'observation';
  ref: string;
  observed: string;
};

export type QaRunResult = {
  id: string;
  status: 'pending' | 'pass' | 'fail' | 'blocked';
  testedAt: string;
  artifactId: string;
  deviceIds: string[];
  actorIds: string[];
  evidence: QaEvidence[];
  command?: string;
  exitCode?: number | null;
  outputRef?: string;
  outputSha256?: string;
  executionMode?: string;
  executionReceipt?: string;
};

export type QaRunMetadata = {
  runId: string;
  platform: 'ios' | string;
  appVersion: string;
  buildNumber: string;
  sourceCommit: string;
  worktreeClean: boolean;
  tester: string;
  checklistSha256: string;
  artifactId: string;
  artifactSha256: string;
  artifactPath: string;
  artifactReceipt: string;
  installSource: string;
  startedAt: string;
  completedAt: string;
  devices: QaDevice[];
  identities: QaIdentity[];
};

export type QaRun = {
  schemaVersion: number;
  checklistVersion: string;
  metadata: QaRunMetadata;
  results: QaRunResult[];
};

export type QaChecklistItem = {
  id: string;
  area: string;
  kind: 'manual' | 'automated';
  title: string;
  deviceRequirements: string[];
  identityRequirements: string[];
  commandPattern?: string;
};

export type QaChecklist = {
  schemaVersion: number;
  checklistVersion: string;
  platform: string;
  identityRoles: string[];
  [key: string]: unknown;
};

export type QaRunContext = {
  mobileRoot?: string;
  currentCommit?: string;
  worktreeClean?: boolean;
  artifactFileSha256?: string;
  artifactFileError?: string;
  automatedOutputFiles?: Record<string, {
    canonicalPath?: string;
    dev?: string;
    ino?: string;
    sha256?: string;
    size?: number;
    error?: string;
  }>;
  expectedRunSha256?: string;
  nowMs?: number;
};

export const MOBILE_ROOT: string;
export const REPO_ROOT: string;
export const CHECKLIST_PATH: string;
export const RUNS_ROOT: string;
export const EXPECTED_INVENTORY: Readonly<{
  routes: number;
  routeChecks: number;
  workflows: number;
  total: number;
}>;
export const EXPECTED_CHECKLIST_SHA256: string;

export function checklistDigest(value: unknown): string;
export function gateExecutionReceipt(
  metadata: QaRunMetadata,
  result: QaRunResult,
): string;
export function expandChecklist(checklist: QaChecklist): QaChecklistItem[];
export function discoverRouteSources(mobileRoot?: string): string[];
export function validateChecklist(checklist: QaChecklist, mobileRoot?: string): string[];
export function createRun(
  checklist: QaChecklist,
  metadata?: Partial<Omit<QaRunMetadata, 'platform' | 'startedAt' | 'completedAt'>>,
): QaRun;
export function validateRunData(
  checklist: QaChecklist,
  run: QaRun,
  context?: QaRunContext,
): string[];
export function resolveRunPath(value: string, flag?: string, mustNotExist?: boolean): string;
