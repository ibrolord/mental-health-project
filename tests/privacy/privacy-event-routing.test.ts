import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('privacy activity routing', () => {
  it('labels web and mobile requests without user-supplied metadata', () => {
    expect(read('lib/api/client.ts')).toContain("'X-Client-Platform': 'web'");
    const mobile = read('mobile/lib/api.ts');
    expect(mobile).toContain("'X-Client-Platform'");
    expect(mobile).toContain("Platform.OS === 'android' ? 'android' : 'ios'");
  });

  it('records export and deletion requests only after authentication', () => {
    const exportRoute = read('app/api/data/export/route.ts');
    const deleteRoute = read('app/api/data/delete/route.ts');
    expect(exportRoute.indexOf('verifyAuth(request)')).toBeLessThan(
      exportRoute.indexOf("eventType: 'export_requested'")
    );
    expect(deleteRoute.indexOf('verifyAuth(request)')).toBeLessThan(
      deleteRoute.indexOf("eventType: 'deletion_requested'")
    );
  });

  it('keeps the server helper taxonomy-only', () => {
    const helper = read('lib/privacy-events/server.ts');
    expect(helper).toContain("import 'server-only'");
    expect(helper).not.toMatch(/notes?|content|email|url|device/i);
  });
});
