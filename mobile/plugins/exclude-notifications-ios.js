/**
 * Expo config plugin: exclude expo-notifications and expo-device from iOS
 * auto-linking so their native modules are never loaded on iPad (or iPhone).
 *
 * Why: React Native old-arch auto-initialises native modules at bridge startup,
 * BEFORE any JS runs. expo-notifications' native init crashes on iPad Air /
 * iPadOS 26 with SIGABRT. JS-level lazy-loading (Build 17) cannot prevent this.
 * Excluding the native module from the iOS binary is the only reliable fix.
 *
 * Notifications still work on Android. On iOS the JS try/catch in _layout.tsx
 * and lib/notifications.ts gracefully handles the missing native module.
 */
const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

function excludeNotificationsIOS(config) {
  return withDangerousMod(config, [
    'ios',
    (config) => {
      const podfilePath = path.join(
        config.modRequest.platformProjectRoot,
        'Podfile'
      );
      let podfile = fs.readFileSync(podfilePath, 'utf8');

      // Replace the bare use_expo_modules! call with one that excludes
      // the notification and device modules from CocoaPods linking.
      const replaced = podfile.replace(
        /use_expo_modules!\s*$/m,
        "use_expo_modules!(exclude: ['expo-notifications', 'expo-device'])"
      );

      if (replaced === podfile) {
        throw new Error(
          'exclude-notifications-ios: failed to patch use_expo_modules! in Podfile. ' +
          'The Podfile template may have changed — update the regex in this plugin.'
        );
      }

      fs.writeFileSync(podfilePath, replaced);
      return config;
    },
  ]);
}

module.exports = excludeNotificationsIOS;
