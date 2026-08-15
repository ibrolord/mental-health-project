import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const root = process.cwd();

function mobileSource(relativePath: string) {
  return fs.readFileSync(path.join(root, 'mobile', relativePath), 'utf8');
}

describe('mobile feedback entry points', () => {
  it('builds a dedicated feedback email with useful prompts', () => {
    const support = mobileSource('lib/support.ts');

    expect(support).toContain("encodeURIComponent('MHtoolkit feedback')");
    expect(support).toContain('What would you like us to improve?');
    expect(support).toContain('What were you trying to do?');
  });

  it('keeps feedback distinct from app help in Settings', () => {
    const settings = mobileSource('app/settings.tsx');

    expect(settings).toContain('title="Send feedback"');
    expect(settings).toContain('FEEDBACK_EMAIL_URL,');
    expect(settings).toContain('`Send feedback to ${SUPPORT_EMAIL}`');
    expect(settings).toContain('title="Get app help"');
    expect(settings).toContain('SUPPORT_EMAIL_URL,');
    expect(settings).toContain('`Contact ${SUPPORT_EMAIL}`');
  });

  it('offers the same feedback action from the Support screen', () => {
    const supportScreen = mobileSource('app/support.tsx');

    expect(supportScreen).toContain('accessibilityLabel="Send product feedback"');
    expect(supportScreen).toContain('Linking.openURL(FEEDBACK_EMAIL_URL)');
  });
});
