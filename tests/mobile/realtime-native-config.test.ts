import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const appConfig = JSON.parse(
  readFileSync(resolve(process.cwd(), 'mobile/app.json'), 'utf8')
) as {
  expo: {
    android: { blockedPermissions: string[] };
    plugins: unknown[];
  };
};
const audioOnlyPlugin = readFileSync(
  resolve(process.cwd(), 'mobile/plugins/audio-only-webrtc.js'),
  'utf8'
);
const voiceScreen = readFileSync(
  resolve(process.cwd(), 'mobile/app/voice.tsx'),
  'utf8'
);

describe('audio-only Realtime native config', () => {
  it('registers the audio-only cleanup so it runs after the WebRTC plist mod', () => {
    const plugins = appConfig.expo.plugins;
    const webRtcIndex = plugins.findIndex(
      (entry) => Array.isArray(entry) && entry[0] === '@config-plugins/react-native-webrtc'
    );
    const audioOnlyIndex = plugins.indexOf('./plugins/audio-only-webrtc');

    expect(webRtcIndex).toBeGreaterThanOrEqual(0);
    // Expo evaluates mods for the same plist in reverse registration order.
    expect(audioOnlyIndex).toBeLessThan(webRtcIndex);
    expect(audioOnlyPlugin).toContain(
      'delete modConfig.modResults.NSCameraUsageDescription'
    );
  });

  it('blocks the generic WebRTC camera and overlay permissions on Android', () => {
    expect(appConfig.expo.android.blockedPermissions).toContain(
      'android.permission.CAMERA'
    );
    expect(appConfig.expo.android.blockedPermissions).toContain(
      'android.permission.SYSTEM_ALERT_WINDOW'
    );
  });

  it('serializes connection attempts and freezes new audio during the safety gate', () => {
    expect(voiceScreen).toContain(
      'if (connectInFlightRef.current || peerRef.current) return'
    );
    expect(voiceScreen).toMatch(
      /case 'speech_stopped':[\s\S]*setMicrophoneEnabled\(false\)/
    );
    expect(voiceScreen).toMatch(
      /case 'transcription_empty':[\s\S]*setMicrophoneEnabled\(!mutedRef\.current\)/
    );
    expect(voiceScreen).toContain("case 'transcription_failed':");
    expect(voiceScreen).toContain("'/api/chat'");
    expect(voiceScreen).not.toContain("type: 'response.create'");
    expect(voiceScreen).not.toContain('clientSecret');
    expect(voiceScreen).not.toContain('api.openai.com/v1/realtime/calls');
    expect(voiceScreen).toContain(
      "process.env.EXPO_PUBLIC_REALTIME_VOICE_ENABLED === 'true'"
    );
  });
});
