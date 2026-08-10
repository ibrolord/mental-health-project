import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import appConfig from '../../mobile/app.json';
import mobilePackage from '../../mobile/package.json';
import appStoreBaseline from '../../mobile/qa/app-store-release-baseline.json';

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

  it('scans binary symbols without a pipefail-sensitive strings pipeline', () => {
    expect(reviewScript).toContain(
      "grep -aEq 'EXNotifications|ExpoNotifications|ExpoNotificationsEmitter'"
    );
    expect(reviewScript).toContain(
      "grep -aEq 'expo-device|ExpoDevice|EXDeviceModule'"
    );
    expect(reviewScript).not.toContain(
      'strings "$APP_DIR/$EXECUTABLE" | grep'
    );
  });

  it('blocks release when social providers or Apple entitlements are unverified', () => {
    expect(reviewScript).toContain('npm run verify:social-auth');
    expect(reviewScript).toContain('com.apple.developer.applesignin');
    expect(reviewScript).toContain('IPA contains the Sign in with Apple entitlement');
    expect(reviewScript).toContain('mhtoolkit://auth/callback');
  });

  it('requires the WebRTC camera API disclosure in source and the signed IPA', () => {
    expect(reviewScript).toContain('CAMERA_PERMISSION=');
    expect(reviewScript).toContain('NSCameraUsageDescription');
    expect(reviewScript).toContain(
      'IPA includes the required honest WebRTC camera API disclosure'
    );
  });

  it('blocks closed release trains and verifies the signed marketing version', () => {
    const toParts = (version: string) => version.split('.').map(Number);
    const compareVersions = (left: string, right: string) => {
      const leftParts = toParts(left);
      const rightParts = toParts(right);
      for (let index = 0; index < 3; index += 1) {
        if (leftParts[index] !== rightParts[index]) {
          return leftParts[index] - rightParts[index];
        }
      }
      return 0;
    };

    expect(appConfig.expo.version).toBe(mobilePackage.version);
    expect(appConfig.expo.version).toBe(appStoreBaseline.candidateVersion);
    expect(compareVersions(appConfig.expo.version, appStoreBaseline.lastApprovedVersion)).toBeGreaterThan(0);
    expect(reviewScript).toContain('CFBundleShortVersionString');
    expect(reviewScript).toContain('IPA marketing version matches source');
    expect(reviewScript).toContain('must be higher than approved version');
    expect(reviewScript).toContain(
      'Generated iOS plist contains the release version and required privacy disclosures'
    );
  });

  it('fails closed unless the signed IPA and expected build are supplied', () => {
    expect(reviewScript).toContain('--source-only');
    expect(reviewScript).toContain(
      'Release verification requires both --ipa and --build-number'
    );
    expect(reviewScript).not.toContain('WARN IPA inspection skipped');
  });
});
