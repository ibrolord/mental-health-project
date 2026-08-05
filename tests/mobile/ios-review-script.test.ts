import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const reviewScript = readFileSync(
  resolve(process.cwd(), 'mobile/scripts/verify-ios-review-build.sh'),
  'utf8'
);

describe('iOS review artifact checks', () => {
  it('checks actual excluded module symbols without matching Expo installation keys', () => {
    expect(reviewScript).toContain('ExpoNotifications');
    expect(reviewScript).toContain('ExpoDevice');
    expect(reviewScript).toContain('EXDeviceModule');
    expect(reviewScript).not.toContain('|EXDevice|');
  });

  it('blocks release when social providers or Apple entitlements are unverified', () => {
    expect(reviewScript).toContain('npm run verify:social-auth');
    expect(reviewScript).toContain('com.apple.developer.applesignin');
    expect(reviewScript).toContain('IPA contains the Sign in with Apple entitlement');
    expect(reviewScript).toContain('mhtoolkit://auth/callback');
  });
});
