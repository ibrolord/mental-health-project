import { describe, expect, it } from 'vitest';
import appConfig from '../../mobile/app.json';

describe('Android release configuration', () => {
  const android = appConfig.expo.android;

  it('prevents Android from backing up app data', () => {
    expect(android.allowBackup).toBe(false);
  });

  it('keeps only the intentional sensitive permissions', () => {
    expect(android.permissions).toEqual(
      expect.arrayContaining([
        'android.permission.RECORD_AUDIO',
        'android.permission.MODIFY_AUDIO_SETTINGS',
        'android.permission.POST_NOTIFICATIONS',
      ])
    );
    expect(android.blockedPermissions).toEqual(
      expect.arrayContaining([
        'android.permission.READ_EXTERNAL_STORAGE',
        'android.permission.WRITE_EXTERNAL_STORAGE',
        'android.permission.SYSTEM_ALERT_WINDOW',
      ])
    );
  });

  it('uses the production application id', () => {
    expect(android.package).toBe('com.mhtoolkit.app');
  });
});
