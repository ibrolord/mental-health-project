/**
 * react-native-webrtc references camera APIs even when MHtoolkit uses only its
 * audio path. Expo evaluates Info.plist mods in reverse registration order, so
 * app.json registers this disclosure-restoring mod before the generic plugin.
 */
const { withInfoPlist } = require('@expo/config-plugins');

module.exports = function audioOnlyWebRtc(config) {
  const cameraDisclosure = config.ios?.infoPlist?.NSCameraUsageDescription;
  if (!cameraDisclosure) {
    throw new Error('NSCameraUsageDescription is required for the WebRTC binary');
  }

  return withInfoPlist(config, (modConfig) => {
    modConfig.modResults.NSCameraUsageDescription = cameraDisclosure;
    return modConfig;
  });
};
