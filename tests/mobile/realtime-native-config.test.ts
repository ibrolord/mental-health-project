import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const appConfig = JSON.parse(
  readFileSync(resolve(process.cwd(), 'mobile/app.json'), 'utf8')
) as {
  expo: {
    android: { blockedPermissions: string[] };
    ios: { infoPlist: { NSCameraUsageDescription: string } };
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
  it('restores an honest camera disclosure after the WebRTC plist mod', () => {
    const plugins = appConfig.expo.plugins;
    const webRtcIndex = plugins.findIndex(
      (entry) => Array.isArray(entry) && entry[0] === '@config-plugins/react-native-webrtc'
    );
    const audioOnlyIndex = plugins.indexOf('./plugins/audio-only-webrtc');

    expect(webRtcIndex).toBeGreaterThanOrEqual(0);
    // Expo evaluates mods for the same plist in reverse registration order.
    expect(audioOnlyIndex).toBeLessThan(webRtcIndex);
    expect(appConfig.expo.ios.infoPlist.NSCameraUsageDescription).toContain(
      'live voice sessions are audio-only'
    );
    expect(appConfig.expo.ios.infoPlist.NSCameraUsageDescription).toContain(
      'never requests, captures, or transmits camera data'
    );
    expect(audioOnlyPlugin).toContain(
      'modConfig.modResults.NSCameraUsageDescription = cameraDisclosure'
    );
    expect(audioOnlyPlugin).not.toContain(
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
    expect(voiceScreen).toContain(
      "status === 'idle' && REALTIME_VOICE_ENABLED"
    );
    expect(voiceScreen).toMatch(
      /REALTIME_VOICE_ENABLED \? 'realtime' : 'fallback'/
    );
  });

  it('uses generated speech with an authenticated device-voice fallback', () => {
    expect(voiceScreen).toContain("import * as Speech from 'expo-speech'");
    expect(voiceScreen).toContain('Speech.speak(spokenText');
    expect(voiceScreen).toContain('Speech.VoiceQuality.Enhanced');
    expect(voiceScreen).toContain('voice: deviceVoice?.identifier');
    expect(voiceScreen).toContain('body: JSON.stringify({ text: spokenText })');
    expect(voiceScreen).toContain("Accept: 'audio/*'");
    expect(voiceScreen).toContain('...(await getAuthHeaders())');
    expect(voiceScreen).toContain('Audio.Sound.createAsync({ uri: path })');
    expect(voiceScreen).toContain('speechFetchAbortRef.current?.abort()');
    expect(voiceScreen).toContain('fallbackTurnAbortRef.current?.abort()');
    expect(voiceScreen).toContain('realtimeTurnAbortRef.current?.abort()');
    expect(voiceScreen).toContain('unownedGeneratedSpeechPath');
    expect(voiceScreen).toContain('generatedSpeechReleaseRef.current = trackedRelease');
    expect(voiceScreen).toContain('MAX_GENERATED_SPEECH_REQUEST_MS');
    expect(voiceScreen).toContain('MAX_TRANSCRIPTION_REQUEST_MS');
    expect(voiceScreen).toContain('MAX_CHAT_REQUEST_MS');
    expect(voiceScreen).toContain('MAX_REALTIME_CONTROL_REQUEST_MS');
    expect(voiceScreen).toContain('const connectIsCurrent');
    expect(voiceScreen).toMatch(
      /await confirmRealtimeSession\(API_URL, grantId\);[\s\S]*if \(!connectIsCurrent\(\)\)/
    );
    expect(voiceScreen).toContain("extension: '.wav'");
    expect(voiceScreen).toContain('Audio.IOSOutputFormat.LINEARPCM');
    expect(voiceScreen).toContain("extension: '.aac'");
    expect(voiceScreen).toContain('Audio.AndroidOutputFormat.AAC_ADTS');
    expect(voiceScreen).toContain('MAX_FALLBACK_RECORDING_MS');
    expect(voiceScreen).toMatch(
      /catch \{[\s\S]*recording\.stopAndUnloadAsync\(\)\.catch[\s\S]*Audio\.setAudioModeAsync/
    );
  });
});
