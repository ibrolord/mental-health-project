import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import appConfig from '../../mobile/app.json';
import mobilePackage from '../../mobile/package.json';

const mobileRoot = resolve(process.cwd(), 'mobile');
const layout = readFileSync(resolve(mobileRoot, 'app/_layout.tsx'), 'utf8');
const settings = readFileSync(resolve(mobileRoot, 'app/settings.tsx'), 'utf8');
const buildPlugin = readFileSync(
  resolve(mobileRoot, 'plugins/ios-build-fixes.js'),
  'utf8'
);

describe('iOS local notification configuration', () => {
  it('restores the fixed SDK 54 notification module without expo-device', () => {
    expect(mobilePackage.dependencies['expo-notifications']).toBe('~0.32.17');
    expect(mobilePackage.dependencies).not.toHaveProperty('expo-device');
    expect(appConfig.expo.plugins).toContainEqual([
      'expo-notifications',
      expect.objectContaining({ enableBackgroundRemoteNotifications: false }),
    ]);
    expect(appConfig.expo.plugins).not.toContain('./plugins/exclude-notifications-ios');
  });

  it('keeps the Xcode fmt workaround without excluding notifications', () => {
    expect(buildPlugin).toContain('FMT_USE_CONSTEVAL=0');
    expect(buildPlugin).not.toContain('use_expo_modules!(exclude:');
    expect(buildPlugin).not.toContain("delete modConfig.modResults['aps-environment']");
  });

  it('enables notification setup and testing on iOS', () => {
    expect(layout).not.toContain("if (Platform.OS === 'ios')");
    expect(layout).toContain('const router = useRouter();');
    expect(layout).toContain('router.navigate(screen as any)');
    expect(layout).not.toContain('RouterCapture');
    expect(layout).toContain('clearLastNotificationResponseAsync');
    expect(settings).toContain('Send Test Notification');
    expect(settings).toContain('reminders cycle through a plan, affirmation, and library pick.');
    expect(settings).not.toContain('iPhone reminders are not available');
  });
});
