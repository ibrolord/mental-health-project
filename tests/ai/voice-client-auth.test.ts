import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const source = fs.readFileSync(
  path.join(process.cwd(), 'components/voice-chat.tsx'),
  'utf8'
);

describe('web voice client boundaries', () => {
  it('authenticates transcription and chat requests', () => {
    expect(source).toMatch(
      /fetch\('\/api\/voice',[\s\S]*?headers: await getApiAuthHeaders\(\)/
    );
    expect(source).toMatch(
      /fetch\('\/api\/chat',[\s\S]*?headers: await getApiAuthHeaders\(\{ 'Content-Type': 'application\/json' \}\)/
    );
  });

  it('normalizes browser recordings to WAV before upload', () => {
    expect(source).toContain('await convertRecordingToWav(audioBlob)');
    expect(source).toContain("formData.append('audio', uploadBlob");
  });

  it('uses a local browser voice instead of the paid server TTS route', () => {
    expect(source).toContain('.filter((voice) => voice.localService)');
    expect(source).toContain("addEventListener('voiceschanged'");
    expect(source).toContain('window.speechSynthesis.speak(utterance)');
    expect(source.match(/fetch\('\/api\/voice'/g)).toHaveLength(1);
  });

  it('releases capture before processing and bounds recording duration and size', () => {
    const stopHandler = source.slice(
      source.indexOf('mediaRecorder.onstop'),
      source.indexOf('mediaRecorder.start()')
    );
    expect(stopHandler.indexOf('await teardownCapture()')).toBeLessThan(
      stopHandler.indexOf('await processVoiceInput(audioBlob)')
    );
    const manualStop = source.slice(
      source.indexOf('const stopListening'),
      source.indexOf('const processVoiceInput')
    );
    expect(manualStop).toContain('void teardownCapture()');
    expect(source).toMatch(
      /MAX_VOICE_RECORDING_MS[\s\S]*mediaRecorder\.stop\(\);[\s\S]*void teardownCapture\(\)/
    );
    expect(source).toContain('MAX_VOICE_RECORDING_MS');
    expect(source).toContain('uploadBlob.size > MAX_VOICE_AUDIO_BYTES');
  });
});
