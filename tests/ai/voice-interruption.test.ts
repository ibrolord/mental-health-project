import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const webVoice = fs.readFileSync(
  path.join(process.cwd(), 'components/voice-chat.tsx'),
  'utf8'
);
const mobileVoice = fs.readFileSync(
  path.join(process.cwd(), 'mobile/app/voice.tsx'),
  'utf8'
);

describe('voice response interruption', () => {
  it('settles web playback before canceling speech and opening the microphone', () => {
    const cancelPlayback = webVoice.slice(
      webVoice.indexOf('const cancelSpeechPlayback'),
      webVoice.indexOf('const teardownCapture')
    );
    expect(cancelPlayback.indexOf('complete?.()')).toBeLessThan(
      cancelPlayback.indexOf('window.speechSynthesis.cancel()')
    );

    const startListening = webVoice.slice(
      webVoice.indexOf('const startListening'),
      webVoice.indexOf('const stopListening')
    );
    expect(startListening.indexOf('cancelSpeechPlayback()')).toBeLessThan(
      startListening.indexOf('requestAiConsent()')
    );
    expect(startListening).toContain('captureStartInFlightRef.current');
    expect(startListening).toContain('const captureIsCurrent');
    expect(startListening).toContain('stream.getTracks().forEach((track) => track.stop())');
    expect(startListening.indexOf('mediaRecorder.start()')).toBeLessThan(
      startListening.indexOf('mediaRecorderRef.current = mediaRecorder')
    );
  });

  it('exposes web interruption only after response generation is complete', () => {
    const processVoice = webVoice.slice(
      webVoice.indexOf('const processVoiceInput'),
      webVoice.indexOf('const speakResponse')
    );
    expect(processVoice.indexOf('setIsProcessing(false)')).toBeLessThan(
      processVoice.indexOf('await speakResponse(response)')
    );
    expect(webVoice).toContain("{isSpeaking ? 'Interrupt & talk' : 'Start Talking'}");
    expect(webVoice).toContain('disabled={isProcessing}');
    expect(webVoice).toContain("aria-label={isSpeaking ? 'Interrupt AI and start talking'");

    const speakResponse = webVoice.slice(
      webVoice.indexOf('const speakResponse'),
      webVoice.indexOf('useEffect(() =>')
    );
    expect(speakResponse).toContain('speechPlaybackGenerationRef.current = playbackGeneration');
    expect(speakResponse).toContain('speechFetchAbortRef.current = fetchAbort');
    expect(speakResponse).toContain('body: JSON.stringify({ text: spokenText })');
    expect(speakResponse).toContain('audio.pause()');
    expect(speakResponse).toContain('failedAudio.pause()');
    expect(speakResponse).toContain('window.speechSynthesis.speak(utterance)');
    expect(speakResponse).toContain('playbackGeneration !== speechPlaybackGenerationRef.current');
    const cleanup = webVoice.slice(webVoice.indexOf('useEffect(() =>'));
    expect(cleanup).toContain('mountedRef.current = true');
    expect(cleanup.indexOf('mountedRef.current = false')).toBeLessThan(
      cleanup.indexOf('speechPlaybackGenerationRef.current += 1')
    );
    expect(cleanup).toContain('turnAbortRef.current?.abort()');
    expect(processVoice).toContain('const turnIsCurrent');
    expect(processVoice.match(/signal: turnAbort\.signal/g)).toHaveLength(2);
    expect(processVoice).toContain('if (!turnIsCurrent()) return');
  });

  it('invalidates stale native playback before restoring the microphone', () => {
    const speakText = mobileVoice.slice(
      mobileVoice.indexOf('async function speakText'),
      mobileVoice.indexOf('async function approveRealtimeTurn')
    );
    expect(speakText).toContain('speechPlaybackGenerationRef.current = playbackGeneration');
    expect(speakText).toContain('speechFetchAbortRef.current = fetchAbort');
    expect(speakText).toContain('body: JSON.stringify({ text: spokenText })');
    expect(speakText).toContain('Audio.Sound.createAsync({ uri: path })');
    expect(speakText).toContain('Speech.speak(spokenText');
    expect(speakText).toContain('playbackGeneration !== speechPlaybackGenerationRef.current');

    const interrupt = mobileVoice.slice(
      mobileVoice.indexOf('async function interruptSpeechAndListen'),
      mobileVoice.indexOf('const statusText')
    );
    expect(interrupt.indexOf('speechPlaybackGenerationRef.current += 1')).toBeLessThan(
      interrupt.indexOf('await stopActiveSpeech()')
    );
    expect(interrupt).toContain('setMicrophoneEnabled(true)');
    expect(interrupt).toContain('await activeFallbackTurn.catch');
    expect(interrupt).toContain('await startFallbackRecording()');
    expect(interrupt).toContain('const wasRealtime = peerRef.current !== null');
    expect(interrupt.match(/interruptionGeneration !== sessionGenerationRef\.current/g)?.length)
      .toBeGreaterThanOrEqual(2);
    expect(interrupt).toContain("setError('Could not stop playback. Please try again.')");
    expect(interrupt).not.toContain('await Speech.stop().catch');
    expect(interrupt).toContain('speechInterruptInFlightRef.current');
    expect(speakText).toContain('speechCompletionRef.current = cancel');
    expect(speakText).toContain('unownedGeneratedSpeechPath');
    expect(speakText.indexOf('unownedGeneratedSpeechPath = path')).toBeLessThan(
      speakText.indexOf('await FileSystem.writeAsStringAsync(path')
    );
    expect(mobileVoice).toContain('generatedSpeechReleaseRef.current = trackedRelease');
    expect(mobileVoice).toContain('return stopSucceeded || unloadSucceeded');
    expect(mobileVoice).toContain('if (unloadSucceeded && generatedSpeechRef.current === sound)');
    expect(mobileVoice).toContain('if (pathDeleted && generatedSpeechPathRef.current === path)');
    expect(interrupt).toContain('await releaseGeneratedSpeech(true)');
    expect(interrupt).toContain('await Speech.stop()');

    const fallbackStart = mobileVoice.slice(
      mobileVoice.indexOf('async function startFallbackRecording'),
      mobileVoice.indexOf('async function stopFallbackRecording')
    );
    expect(fallbackStart).toContain('const startupIsCurrent');
    expect(fallbackStart).toContain('await recording.stopAndUnloadAsync().catch');
    const fallbackStop = mobileVoice.slice(
      mobileVoice.indexOf('async function stopFallbackRecording'),
      mobileVoice.indexOf('async function processFallbackVoice')
    );
    expect(fallbackStop.indexOf('const stopGeneration')).toBeLessThan(
      fallbackStop.indexOf('await recording.stopAndUnloadAsync()')
    );
    expect(fallbackStop).toContain('if (!stopIsCurrent())');
    expect(fallbackStop).toContain('processFallbackVoice(uri, stopGeneration)');
    const fallbackTurn = mobileVoice.slice(
      mobileVoice.indexOf('async function processFallbackVoice'),
      mobileVoice.indexOf('async function interruptSpeechAndListen')
    );
    expect(fallbackTurn).toContain('const turnIsCurrent');
    expect(fallbackTurn.match(/signal: turnAbort\.signal/g)).toHaveLength(2);
    expect(fallbackTurn).toContain('fallbackTurnAbortRef.current = turnAbort');
    expect(fallbackTurn.match(/fetchWithTimeout/g)).toHaveLength(2);

    const realtimeTurn = mobileVoice.slice(
      mobileVoice.indexOf('async function approveRealtimeTurn'),
      mobileVoice.indexOf('function handleRealtimeMessage')
    );
    expect(realtimeTurn).toContain('realtimeTurnAbortRef.current = turnAbort');
    expect(realtimeTurn.match(/signal: turnAbort\.signal/g)).toHaveLength(2);
    expect(mobileVoice.match(/realtimeTurnAbortRef\.current\?\.abort\(\)/g)?.length)
      .toBeGreaterThanOrEqual(2);
  });

  it('offers an accessible interrupt action in both native voice modes', () => {
    expect(mobileVoice.match(/Interrupt &amp; talk/g)).toHaveLength(2);
    expect(mobileVoice.match(/accessibilityLabel="Interrupt AI and start talking"/g))
      .toHaveLength(2);
  });
});
