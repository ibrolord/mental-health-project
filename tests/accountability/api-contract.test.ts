import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const routeSource = readFileSync(
  resolve(process.cwd(), 'app/api/accountability/[...path]/route.ts'),
  'utf8'
);

const paths = [
  'connections', 'connections/join', 'connections/revoke', 'connections/block',
  'commitments', 'commitments/detail', 'check-ins', 'progress', 'nudges',
  'comments', 'suggestions', 'rewards', 'scope-control',
  'notes/commitment-sharing', 'notes/check-in-sharing',
] as const;

describe('accountability API contract', () => {
  it.each(paths)('dispatches /api/accountability/%s through the authenticated catch-all', (path) => {
    expect(routeSource).toContain(path);
    expect(routeSource).not.toContain('X-Session-Id');
  });

  it('exposes only the supported catch-all methods', () => {
    for (const method of ['GET', 'POST', 'DELETE', 'OPTIONS']) {
      expect(routeSource).toContain(`function ${method}`);
    }
    expect(routeSource).not.toContain('function PUT');
  });

  it('uses a caller-scoped Supabase client instead of the service role', () => {
    const source = `${readFileSync(resolve(process.cwd(), 'lib/accountability/auth.ts'), 'utf8')}\n${routeSource}`;
    expect(source).toContain('is_anonymous');
    expect(source).toContain('Authorization');
    expect(source).not.toContain('supabaseAdmin');
    expect(source).not.toContain('SUPABASE_SERVICE_ROLE_KEY');
  });

  it('never queries sensitive mental-health tables from the accountability service', () => {
    const source = `${readFileSync(resolve(process.cwd(), 'lib/accountability/service.ts'), 'utf8')}\n${routeSource}`;
    expect(source).not.toMatch(/from\(['"](moods|assessments|chat_history|goals)['"]\)/);
    expect(source).not.toContain('reflection');
  });

  it('keeps owner approval in the priority suggestion API contract', () => {
    expect(routeSource).toContain("key === 'suggestions/respond'");
    expect(routeSource).toContain('p_approved: input.approved');
  });

  it('uses one canonical route so exact paths cannot shadow derived mobile responses', () => {
    const collect = (directory: string): string[] => readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
      const path = resolve(directory, entry.name);
      return entry.isDirectory() ? collect(path) : [path];
    });
    const routes = collect(resolve(process.cwd(), 'app/api/accountability'))
      .filter((path) => path.endsWith('route.ts'));
    expect(routes).toEqual([resolve(process.cwd(), 'app/api/accountability/[...path]/route.ts')]);
  });

  it('archives a shared commitment instead of deleting its history', () => {
    expect(routeSource).toContain("key === 'commitments/archive'");
    expect(routeSource).toContain("'archive_accountability_commitment'");
    expect(routeSource).not.toMatch(/from\('accountability_commitments'\)\.delete/);
  });

  it('checks actual body size and does not expose raw database errors', () => {
    expect(routeSource).toContain('request.body?.getReader()');
    expect(routeSource).toContain('totalBytes > MAX_BODY_BYTES');
    expect(routeSource).toContain('await reader.cancel()');
    expect(routeSource).not.toContain('await request.text()');
    expect(routeSource).toContain("console.error('Together API error:'");
    expect(routeSource).not.toContain('NextResponse.json({ error: message }');
  });

  it('keeps progress sharing independent from commitment-title sharing', () => {
    const start = routeSource.indexOf("if (key === 'progress')");
    const end = routeSource.indexOf("if (key === 'comments')", start);
    const progressHandler = routeSource.slice(start, end);
    expect(progressHandler).toContain("'get_accountability_check_in_dates'");
    expect(progressHandler).not.toContain('listCommitments');
  });
});
