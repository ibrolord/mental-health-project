import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import ts from 'typescript';
import { describe, expect, it, vi } from 'vitest';
import * as storage from '../../mobile/lib/tool-completion-storage';

const USER = '11111111-1111-4111-8111-111111111111';
const ROW: storage.ToolCompletion = {
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', kind: 'grounding', itemId: 'overwhelmed',
  startedAt: '2026-09-25T14:55:00Z', completedAt: '2026-09-25T15:00:00Z',
  sourceStepId: null, partial: false, synced: false,
};

function runtime(confirmedIds: string[]) {
  const query = {
    upsert: vi.fn(async () => ({ error: null })),
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    in: vi.fn(async () => ({ data: confirmedIds.map((id) => ({ id })), error: null })),
  };
  const getSession = vi.fn(async () => ({ data: { session: { user: { id: USER } } }, error: null }));
  let adapter!: { upload(owner: string, rows: storage.ToolCompletion[]): Promise<void> };
  const imports: Record<string, unknown> = {
    '@react-native-async-storage/async-storage': { default: {} },
    'expo-crypto': {},
    './supabase': { supabase: { auth: { getSession }, from: () => query } },
    './advisor-brief-storage': { advisorBriefStorage: {} },
    './advisor-lifecycle-runtime': {},
    './tool-completion-storage': storage,
    './tool-completion-core': { createToolCompletionCoordinator: (deps: typeof adapter) => {
      adapter = deps;
      return {};
    } },
  };
  const source = readFileSync(resolve(process.cwd(), 'mobile/lib/tool-completion-runtime.ts'), 'utf8');
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const evaluated = { exports: {} };
  new Function('require', 'module', 'exports', code)((name: string) => {
    if (name === './advisor-client-events') return { emitAdvisorClient: () => {} };
    if (!(name in imports)) throw new Error(`Unmocked dependency: ${name}`);
    return imports[name];
  }, evaluated, evaluated.exports);
  return { adapter, query, getSession };
}

describe('completion remote acknowledgement', () => {
  it('accepts a retry only after the same UUID is confirmed for this owner', async () => {
    const h = runtime([ROW.id]);
    await h.adapter.upload(`user_id:${USER}`, [ROW]);
    expect(h.query.upsert).toHaveBeenCalledWith([
      expect.objectContaining({ id: ROW.id, user_id: USER, session_id: null }),
    ], { onConflict: 'id', ignoreDuplicates: true });
    expect(h.query.eq).toHaveBeenCalledWith('user_id', USER);
    expect(h.query.in).toHaveBeenCalledWith('id', [ROW.id]);
  });
  it('does not treat an ignored foreign-owner UUID collision as successful synchronization', async () => {
    const h = runtime([]);
    await expect(h.adapter.upload(`user_id:${USER}`, [ROW])).rejects.toThrow('ownership');
  });
  it('rejects upload after the current profile changes', async () => {
    const h = runtime([ROW.id]);
    await expect(h.adapter.upload('user_id:another-profile', [ROW])).rejects.toThrow('profile changed');
    expect(h.query.upsert).not.toHaveBeenCalled();
  });
});
