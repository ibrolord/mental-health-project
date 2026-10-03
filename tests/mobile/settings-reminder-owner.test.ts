import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { describe, expect, it, vi } from 'vitest';

const source = readFileSync('mobile/app/settings.tsx', 'utf8');
const ast = ts.createSourceFile('settings.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let guard: ts.Expression | undefined;
function visit(node: ts.Node) {
  if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'clearAllReminders') {
    guard = node.arguments[0];
  }
  ts.forEachChild(node, visit);
}
visit(ast);

// Execute the actual Settings callback, not a parallel implementation of it.
type SessionResult = { data: {session: {user:{id:string}} | null}; error: Error | null };
function loadGuard(getSession: () => Promise<SessionResult>) {
  if (!guard || !ts.isArrowFunction(guard)) throw new Error('Settings must pass a deferred owner guard');
  const compiled = ts.transpileModule(`const guard = ${guard.getText(ast)};`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  return new Function('supabase', 'expectedOwnerId', `${compiled}\nreturn guard;`)(
    {auth:{getSession}}, 'deleting-owner'
  ) as () => Promise<boolean>;
}

describe('Settings reminder deletion owner guard', () => {
  it('checks the session when cleanup executes, not when it was requested', async () => {
    let currentOwner = 'deleting-owner';
    const capture = vi.fn(async () => ({data:{session:{user:{id:currentOwner}}},error:null}));
    const current = loadGuard(capture);
    expect(capture).not.toHaveBeenCalled();
    currentOwner = 'new-owner';
    await expect(current()).resolves.toBe(false);
    expect(capture).toHaveBeenCalledOnce();
  });

  it('allows cleanup for the same profile', async () => {
    await expect(loadGuard(async () => ({data:{session:{user:{id:'deleting-owner'}}},error:null}))()).resolves.toBe(true);
  });

  it('skips global cleanup after sign-out', async () => {
    await expect(loadGuard(async () => ({data:{session:null},error:null}))()).resolves.toBe(false);
  });

  it('reports incomplete cleanup when the session cannot be read', async () => {
    await expect(loadGuard(async () => { throw new Error('Keychain unavailable'); })()).rejects.toThrow('Keychain unavailable');
    await expect(loadGuard(async () => ({data:{session:null},error:new Error('Session unavailable')}))()).rejects.toThrow('Session unavailable');
  });
});
