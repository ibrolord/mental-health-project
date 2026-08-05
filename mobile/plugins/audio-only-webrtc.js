/**
 * react-native-webrtc's generic Expo plugin enables camera permission even for
 * audio-only apps. Expo evaluates Info.plist mods in reverse registration
 * order, so app.json registers this cleanup before the generic plugin.
 */
const { withInfoPlist } = require('@expo/config-plugins');

module.exports = function audioOnlyWebRtc(config) {
  return withInfoPlist(config, (modConfig) => {
    delete modConfig.modResults.NSCameraUsageDescription;
    return modConfig;
  });
};
