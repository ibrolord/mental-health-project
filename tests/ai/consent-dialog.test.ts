import fs from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  grantAiDataSharingConsent,
  hasAiDataSharingConsent,
  resetAiDataSharingConsent,
} from '../../lib/ai-consent';

const originalWindow = globalThis.window;

afterEach(() => {
  vi.restoreAllMocks();
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: originalWindow,
  });
});

describe('AI data sharing consent', () => {
  it('persists and resets consent without using a blocking browser prompt', () => {
    const values = new Map<string, string>();
    const confirm = vi.fn();
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: {
        confirm,
        localStorage: {
          getItem: (key: string) => values.get(key) ?? null,
          removeItem: (key: string) => values.delete(key),
          setItem: (key: string, value: string) => values.set(key, value),
        },
      },
    });

    expect(hasAiDataSharingConsent('user_id:owner-a')).toBe(false);
    expect(grantAiDataSharingConsent('user_id:owner-a')).toBe(true);
    expect(hasAiDataSharingConsent('user_id:owner-a')).toBe(true);
    expect(hasAiDataSharingConsent('user_id:owner-b')).toBe(false);
    expect(confirm).not.toHaveBeenCalled();

    resetAiDataSharingConsent('user_id:owner-a');
    expect(hasAiDataSharingConsent('user_id:owner-a')).toBe(false);
  });

  it('renders one accessible, dismissible consent dialog at the app root', () => {
    const root = path.resolve(process.cwd());
    const provider = fs.readFileSync(
      path.join(root, 'components/ai-consent-provider.tsx'),
      'utf8'
    );
    const layout = fs.readFileSync(path.join(root, 'app/layout.tsx'), 'utf8');

    expect(provider).toContain('role="dialog"');
    expect(provider).toContain('aria-modal="true"');
    expect(provider).toContain('Continue with AI');
    expect(provider).toContain('Not now');
    expect(provider).toContain('aria-label="Close AI data sharing consent"');
    expect(layout).toContain('<AiConsentProvider>');
  });
});
