'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useAiConsent } from '@/components/ai-consent-provider';
import type { UserContext } from '@/lib/ai/context';
import { getApiAuthHeaders } from '@/lib/api/auth-headers';
import { convertRecordingToWav } from '@/lib/ai/browser-audio';
import {
  MAX_VOICE_AUDIO_BYTES,
  MAX_VOICE_RECORDING_MS,
} from '@/lib/ai/voice-limits';

interface VoiceChatProps {
  userContext?: UserContext;
  onClose?: () => void;
}

const RECORDING_MIME_TYPES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/mp4',
] as const;
const MAX_SPOKEN_RESPONSE_CHARACTERS = 1_200;
const MAX_GENERATED_SPEECH_REQUEST_MS = 30_000;
const MAX_SPEECH_PLAYBACK_MS = 90_000;
const MAX_TRANSCRIPTION_REQUEST_MS = 30_000;
const MAX_CHAT_REQUEST_MS = 30_000;

function getSpeakableResponse(text: string) {
  if (text.length <= MAX_SPOKEN_RESPONSE_CHARACTERS) return text;

  const suffix = ' More is shown on screen.';
  const available = MAX_SPOKEN_RESPONSE_CHARACTERS - suffix.length;
  const prefix = text.slice(0, available);
  const sentenceEnd = Math.max(
    prefix.lastIndexOf('. '),
    prefix.lastIndexOf('! '),
    prefix.lastIndexOf('? ')
  );
  const naturalCut = sentenceEnd >= Math.floor(available * 0.6)
    ? prefix.slice(0, sentenceEnd + 1)
    : prefix.trimEnd();
  return `${naturalCut}${suffix}`;
}

function getRecordingMimeType() {
  if (typeof MediaRecorder === 'undefined') return undefined;
  return RECORDING_MIME_TYPES.find((type) => MediaRecorder.isTypeSupported(type));
}

function getRecordingFileName(mimeType: string) {
  if (mimeType.startsWith('audio/mp4') || mimeType.startsWith('audio/m4a')) {
    return 'recording.m4a';
  }
  if (mimeType.startsWith('audio/ogg')) return 'recording.ogg';
  if (mimeType.startsWith('audio/wav')) return 'recording.wav';
  return 'recording.webm';
}

async function getResponseError(response: Response, fallback: string) {
  const body = await response.json().catch(() => null) as { error?: unknown } | null;
  return typeof body?.error === 'string' && body.error.trim()
    ? body.error
    : fallback;
}

async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit,
  timeoutMs: number
) {
  const controller = new AbortController();
  const callerSignal = init.signal;
  let timedOut = false;
  const forwardAbort = () => controller.abort(callerSignal?.reason);
  if (callerSignal?.aborted) {
    forwardAbort();
  } else {
    callerSignal?.addEventListener('abort', forwardAbort, { once: true });
  }
  const timeout = window.setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (error) {
    if (timedOut && !callerSignal?.aborted) {
      throw new Error('The request timed out. Please try again.');
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
    callerSignal?.removeEventListener('abort', forwardAbort);
  }
}

async function getLocalSpeechVoice(): Promise<SpeechSynthesisVoice | undefined> {
  const findVoice = () => {
    const localVoices = window.speechSynthesis
      .getVoices()
      .filter((voice) => voice.localService);
    const language = navigator.language.toLowerCase();
    const languageBase = language.split('-', 1)[0];
    return [...localVoices].sort((left, right) => {
      const score = (voice: SpeechSynthesisVoice) => {
        const voiceLanguage = voice.lang.toLowerCase();
        return (voiceLanguage === language ? 4 : 0)
          + (voiceLanguage.split('-', 1)[0] === languageBase ? 2 : 0)
          + (voice.default ? 3 : 0);
      };
      return score(right) - score(left);
    })[0];
  };
  const available = findVoice();
  if (available) return available;

  await new Promise<void>((resolve) => {
    let timeout = 0;
    const finish = () => {
      window.clearTimeout(timeout);
      window.speechSynthesis.removeEventListener('voiceschanged', finish);
      resolve();
    };
    timeout = window.setTimeout(finish, 500);
    window.speechSynthesis.addEventListener('voiceschanged', finish, { once: true });
  });
  return findVoice();
}

export function VoiceChat({ userContext, onClose }: VoiceChatProps) {
  const requestAiConsent = useAiConsent();
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [error, setError] = useState('');
  const [volume, setVolume] = useState(0);
  const [messages, setMessages] = useState<Array<{role: 'user' | 'assistant', content: string}>>([]);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | undefined>(undefined);
  const streamRef = useRef<MediaStream | null>(null);
  const speechRef = useRef<SpeechSynthesisUtterance | null>(null);
  const generatedAudioRef = useRef<HTMLAudioElement | null>(null);
  const generatedAudioUrlRef = useRef<string | null>(null);
  const speechFetchAbortRef = useRef<AbortController | null>(null);
  const speechCompletionRef = useRef<(() => void) | null>(null);
  const speechPlaybackGenerationRef = useRef(0);
  const turnAbortRef = useRef<AbortController | null>(null);
  const turnGenerationRef = useRef(0);
  const recordingTimerRef = useRef<number | null>(null);
  const captureStartInFlightRef = useRef(false);
  const captureGenerationRef = useRef(0);
  const mountedRef = useRef(true);

  const cancelSpeechPlayback = () => {
    speechPlaybackGenerationRef.current += 1;
    const utterance = speechRef.current;
    const generatedAudio = generatedAudioRef.current;
    const generatedAudioUrl = generatedAudioUrlRef.current;
    const fetchAbort = speechFetchAbortRef.current;
    const complete = speechCompletionRef.current;
    speechRef.current = null;
    generatedAudioRef.current = null;
    generatedAudioUrlRef.current = null;
    speechFetchAbortRef.current = null;
    speechCompletionRef.current = null;
    if (utterance) {
      utterance.onend = null;
      utterance.onerror = null;
    }
    complete?.();
    fetchAbort?.abort();
    if (generatedAudio) {
      generatedAudio.onended = null;
      generatedAudio.onerror = null;
      generatedAudio.pause();
      generatedAudio.removeAttribute('src');
      generatedAudio.load();
    }
    if (generatedAudioUrl) URL.revokeObjectURL(generatedAudioUrl);
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    if (mountedRef.current) {
      setIsSpeaking(false);
    }
  };

  const teardownCapture = async () => {
    if (recordingTimerRef.current !== null) {
      window.clearTimeout(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    if (animationFrameRef.current !== undefined) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = undefined;
    }
    analyserRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    const context = audioContextRef.current;
    audioContextRef.current = null;
    if (context && context.state !== 'closed') {
      await context.close();
    }
    if (mountedRef.current) setVolume(0);
  };

  const setupAudioVisualization = async (stream: MediaStream) => {
    const audioContext = new AudioContext();
    const analyser = audioContext.createAnalyser();
    const microphone = audioContext.createMediaStreamSource(stream);
    
    analyser.fftSize = 256;
    microphone.connect(analyser);
    
    audioContextRef.current = audioContext;
    analyserRef.current = analyser;
    
    visualizeAudio();
  };

  const visualizeAudio = () => {
    if (!analyserRef.current) return;
    
    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(dataArray);
    
    const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
    setVolume(average / 255);
    
    animationFrameRef.current = requestAnimationFrame(visualizeAudio);
  };

  const startListening = async () => {
    if (captureStartInFlightRef.current || mediaRecorderRef.current) return;
    captureStartInFlightRef.current = true;
    const captureGeneration = captureGenerationRef.current + 1;
    captureGenerationRef.current = captureGeneration;
    const captureIsCurrent = () => (
      mountedRef.current && captureGeneration === captureGenerationRef.current
    );
    try {
      cancelSpeechPlayback();
      if (!(await requestAiConsent())) return;
      if (!captureIsCurrent()) return;

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!captureIsCurrent()) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;
      
      await setupAudioVisualization(stream);
      if (!captureIsCurrent()) {
        await teardownCapture();
        return;
      }
      
      const recordingMimeType = getRecordingMimeType();
      const mediaRecorder = recordingMimeType
        ? new MediaRecorder(stream, { mimeType: recordingMimeType })
        : new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const mimeType = mediaRecorder.mimeType || audioChunksRef.current[0]?.type || 'audio/webm';
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        mediaRecorderRef.current = null;
        await teardownCapture();
        if (mountedRef.current) {
          await processVoiceInput(audioBlob);
        }
      };

      mediaRecorder.start();
      mediaRecorderRef.current = mediaRecorder;
      recordingTimerRef.current = window.setTimeout(() => {
        if (mediaRecorder.state === 'recording') {
          mediaRecorder.stop();
          void teardownCapture();
          setIsListening(false);
        }
      }, MAX_VOICE_RECORDING_MS);
      setIsListening(true);
      setError('');
    } catch (err) {
      console.error('Microphone error:', err);
      await teardownCapture();
      if (captureIsCurrent()) {
        setError('Could not access microphone. Please check permissions.');
      }
    } finally {
      captureStartInFlightRef.current = false;
    }
  };

  const stopListening = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      void teardownCapture();
      setIsListening(false);
    }
  };

  const processVoiceInput = async (audioBlob: Blob) => {
    const previousMessages = messages;
    let pendingUserMessage = false;
    turnAbortRef.current?.abort();
    const turnAbort = new AbortController();
    turnAbortRef.current = turnAbort;
    const turnGeneration = turnGenerationRef.current + 1;
    turnGenerationRef.current = turnGeneration;
    const turnIsCurrent = () => (
      mountedRef.current
      && !turnAbort.signal.aborted
      && turnGeneration === turnGenerationRef.current
    );
    try {
      if (turnIsCurrent()) setIsProcessing(true);
      
      // Step 1: Transcribe audio
      const uploadBlob = await convertRecordingToWav(audioBlob);
      if (!turnIsCurrent()) return;
      if (uploadBlob.size > MAX_VOICE_AUDIO_BYTES) {
        throw new Error('That recording is too long. Please try a shorter message.');
      }
      const formData = new FormData();
      formData.append('audio', uploadBlob, getRecordingFileName(uploadBlob.type));

      const transcribeHeaders = await getApiAuthHeaders();
      if (!turnIsCurrent()) return;
      const transcribeResponse = await fetchWithTimeout('/api/voice', {
        method: 'POST',
        headers: transcribeHeaders,
        body: formData,
        signal: turnAbort.signal,
      }, MAX_TRANSCRIPTION_REQUEST_MS);
      if (!turnIsCurrent()) return;

      if (!transcribeResponse.ok) {
        throw new Error(await getResponseError(transcribeResponse, 'Transcription failed.'));
      }

      const { transcription } = await transcribeResponse.json();
      if (!turnIsCurrent()) return;
      if (typeof transcription !== 'string' || !transcription.trim()) {
        throw new Error('I could not hear any speech. Please try again.');
      }
      setTranscript(transcription);
      
      // Step 2: Get AI response
      const newMessages = [...messages, { role: 'user' as const, content: transcription }];
      setMessages(newMessages);
      pendingUserMessage = true;
      
      const chatHeaders = await getApiAuthHeaders({ 'Content-Type': 'application/json' });
      if (!turnIsCurrent()) return;
      const chatResponse = await fetchWithTimeout('/api/chat', {
        method: 'POST',
        headers: chatHeaders,
        body: JSON.stringify({ 
          messages: newMessages,
          userContext 
        }),
        signal: turnAbort.signal,
      }, MAX_CHAT_REQUEST_MS);
      if (!turnIsCurrent()) return;

      if (!chatResponse.ok) {
        throw new Error(await getResponseError(chatResponse, 'AI response failed.'));
      }

      const { response } = await chatResponse.json();
      if (!turnIsCurrent()) return;
      if (typeof response !== 'string' || !response.trim()) {
        throw new Error('The AI service returned an empty response.');
      }
      setAiResponse(response);
      setMessages([...newMessages, { role: 'assistant', content: response }]);
      pendingUserMessage = false;

      // Step 3: Speak the response
      setIsProcessing(false);
      await speakResponse(response);
    } catch (err) {
      if (!turnIsCurrent()) return;
      console.error('Voice processing error:', err);
      if (pendingUserMessage) {
        setMessages(previousMessages);
      }
      setError(err instanceof Error ? err.message : 'Failed to process your voice. Please try again.');
    } finally {
      if (turnAbortRef.current === turnAbort) {
        turnAbortRef.current = null;
      }
      if (turnIsCurrent()) setIsProcessing(false);
    }
  };

  const speakResponse = async (text: string) => {
    cancelSpeechPlayback();
    const playbackGeneration = speechPlaybackGenerationRef.current + 1;
    speechPlaybackGenerationRef.current = playbackGeneration;
    try {
      setIsSpeaking(true);
      const spokenText = getSpeakableResponse(text);
      const fetchAbort = new AbortController();
      speechFetchAbortRef.current = fetchAbort;
      const generatedSpeechRequestTimer = window.setTimeout(
        () => fetchAbort.abort(),
        MAX_GENERATED_SPEECH_REQUEST_MS
      );

      try {
        const response = await fetch('/api/voice', {
          method: 'POST',
          headers: await getApiAuthHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ text: spokenText }),
          signal: fetchAbort.signal,
        });
        if (!response.ok) {
          throw new Error(await getResponseError(response, 'Natural voice is unavailable.'));
        }
        const audioBlob = await response.blob();
        window.clearTimeout(generatedSpeechRequestTimer);
        if (playbackGeneration !== speechPlaybackGenerationRef.current) return;

        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);
        generatedAudioRef.current = audio;
        generatedAudioUrlRef.current = audioUrl;
        speechFetchAbortRef.current = null;
        await new Promise<void>((resolve, reject) => {
          let settled = false;
          const finish = (failure?: Error) => {
            if (settled) return;
            settled = true;
            window.clearTimeout(timeout);
            audio.onended = null;
            audio.onerror = null;
            if (speechCompletionRef.current === cancel) {
              speechCompletionRef.current = null;
            }
            if (failure) reject(failure);
            else resolve();
          };
          const cancel = () => finish();
          const timeout = window.setTimeout(() => {
            finish(new Error('Natural voice playback timed out.'));
          }, MAX_SPEECH_PLAYBACK_MS);
          speechCompletionRef.current = cancel;
          audio.onended = () => finish();
          audio.onerror = () => finish(new Error('Natural voice playback failed.'));
          if (playbackGeneration !== speechPlaybackGenerationRef.current) {
            finish();
            return;
          }
          void audio.play().catch(() => {
            finish(new Error('Natural voice playback failed.'));
          });
        });
        if (generatedAudioRef.current === audio) {
          generatedAudioRef.current = null;
          audio.pause();
          audio.removeAttribute('src');
          audio.load();
        }
        if (generatedAudioUrlRef.current === audioUrl) {
          generatedAudioUrlRef.current = null;
          URL.revokeObjectURL(audioUrl);
        }
      } catch (generatedVoiceError) {
        window.clearTimeout(generatedSpeechRequestTimer);
        if (playbackGeneration !== speechPlaybackGenerationRef.current) return;
        speechFetchAbortRef.current = null;
        const failedAudio = generatedAudioRef.current;
        const failedAudioUrl = generatedAudioUrlRef.current;
        generatedAudioRef.current = null;
        generatedAudioUrlRef.current = null;
        if (failedAudio) {
          failedAudio.onended = null;
          failedAudio.onerror = null;
          failedAudio.pause();
          failedAudio.removeAttribute('src');
          failedAudio.load();
        }
        if (failedAudioUrl) URL.revokeObjectURL(failedAudioUrl);
        console.warn('Generated speech unavailable; using device voice.', generatedVoiceError);
        if (!('speechSynthesis' in window)) {
          throw new Error('Spoken playback is unavailable, but the response is shown above.');
        }

        window.speechSynthesis.cancel();
        const localVoice = await getLocalSpeechVoice();
        if (playbackGeneration !== speechPlaybackGenerationRef.current) return;
        if (!localVoice) {
          throw new Error('Spoken playback is unavailable, but the response is shown above.');
        }
        await new Promise<void>((resolve, reject) => {
          const utterance = new SpeechSynthesisUtterance(spokenText);
          let settled = false;
          const finish = (failure?: Error) => {
            if (settled) return;
            settled = true;
            window.clearTimeout(timeout);
            utterance.onend = null;
            utterance.onerror = null;
            if (speechRef.current === utterance) speechRef.current = null;
            if (speechCompletionRef.current === cancel) {
              speechCompletionRef.current = null;
            }
            if (failure) reject(failure);
            else resolve();
          };
          const cancel = () => finish();
          const timeout = window.setTimeout(() => {
            window.speechSynthesis.cancel();
            finish(new Error('Spoken playback timed out.'));
          }, MAX_SPEECH_PLAYBACK_MS);
          speechRef.current = utterance;
          speechCompletionRef.current = cancel;
          utterance.voice = localVoice;
          utterance.rate = 0.96;
          utterance.onend = () => finish();
          utterance.onerror = () => finish(new Error('Spoken playback failed.'));
          if (playbackGeneration !== speechPlaybackGenerationRef.current) {
            finish();
            return;
          }
          window.speechSynthesis.speak(utterance);
        });
      }
      if (
        mountedRef.current
        && playbackGeneration === speechPlaybackGenerationRef.current
      ) {
        setIsSpeaking(false);
      }
    } catch (err) {
      console.error('Speech error:', err);
      if (
        mountedRef.current
        && playbackGeneration === speechPlaybackGenerationRef.current
      ) {
        setError(
          err instanceof Error ? err.message : 'Spoken playback failed.'
        );
        setIsSpeaking(false);
      }
    }
  };

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      speechPlaybackGenerationRef.current += 1;
      captureGenerationRef.current += 1;
      turnGenerationRef.current += 1;
      turnAbortRef.current?.abort();
      turnAbortRef.current = null;
      const recorder = mediaRecorderRef.current;
      if (recordingTimerRef.current !== null) {
        window.clearTimeout(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
      if (recorder?.state === 'recording') {
        recorder.ondataavailable = null;
        recorder.onstop = null;
        recorder.stop();
      }
      streamRef.current?.getTracks().forEach((track) => track.stop());
      if (animationFrameRef.current !== undefined) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (audioContextRef.current?.state !== 'closed') {
        void audioContextRef.current?.close();
      }
      const utterance = speechRef.current;
      const generatedAudio = generatedAudioRef.current;
      const generatedAudioUrl = generatedAudioUrlRef.current;
      speechFetchAbortRef.current?.abort();
      speechFetchAbortRef.current = null;
      const completeSpeech = speechCompletionRef.current;
      speechRef.current = null;
      generatedAudioRef.current = null;
      generatedAudioUrlRef.current = null;
      speechCompletionRef.current = null;
      if (utterance) {
        utterance.onend = null;
        utterance.onerror = null;
      }
      completeSpeech?.();
      if (generatedAudio) {
        generatedAudio.onended = null;
        generatedAudio.onerror = null;
        generatedAudio.pause();
        generatedAudio.removeAttribute('src');
        generatedAudio.load();
      }
      if (generatedAudioUrl) URL.revokeObjectURL(generatedAudioUrl);
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const getStatusText = () => {
    if (isListening) return 'Listening...';
    if (isProcessing) return 'Processing...';
    if (isSpeaking) return 'AI is speaking...';
    return 'Voice Support Session';
  };

  const getSubText = () => {
    if (isListening) return 'Speak naturally, I\'m here to listen';
    if (isProcessing) return 'Transcribing and thinking...';
    if (isSpeaking) return 'Tap the microphone whenever you want to respond';
    return 'Click the microphone to start talking';
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardContent className="p-8">
        <div className="flex flex-col items-center gap-6">
          {/* Voice Visualization */}
          <div className="relative w-64 h-64">
            <div className="absolute inset-0 flex items-center justify-center">
              <div
                className={`rounded-full transition-all duration-300 ${
                  isListening ? 'bg-primary' : isSpeaking ? 'bg-green-500' : isProcessing ? 'bg-yellow-500' : 'bg-gray-300'
                }`}
                style={{
                  width: `${100 + volume * 150}px`,
                  height: `${100 + volume * 150}px`,
                  opacity: 0.3 + volume * 0.7,
                }}
              />
            </div>
            
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-6xl">
                {isListening ? '🎤' : isSpeaking ? '🔊' : isProcessing ? '⏳' : '💬'}
              </div>
            </div>
          </div>

          {/* Status Text */}
          <div className="text-center">
            <h3 className="text-xl font-semibold mb-2">{getStatusText()}</h3>
            <p className="text-sm text-muted-foreground">{getSubText()}</p>
          </div>

          <div className="w-full p-4 bg-orange-50 border border-orange-200 rounded-lg">
            <p className="text-sm font-semibold text-orange-900 mb-1">Voice AI data sharing</p>
            <p className="text-xs text-orange-900">
              Voice Support sends your recording through MHtoolkit to Google Gemini for
              transcription, with OpenAI used as a fallback. The transcript is sent to an
              AI provider for a response. The response is sent to Gemini for natural
              spoken playback, with OpenAI or your browser voice used as a fallback.
            </p>
          </div>

          {/* Conversation Display */}
          {(transcript || aiResponse) && (
            <div className="w-full space-y-3">
              {transcript && (
                <div className="p-4 bg-secondary rounded-lg">
                  <p className="text-sm font-medium text-primary mb-1">You said:</p>
                  <p className="text-foreground">{transcript}</p>
                </div>
              )}
              {aiResponse && (
                <div className="p-4 bg-green-50 rounded-lg">
                  <p className="text-sm font-medium text-green-700 mb-1">AI Companion:</p>
                  <p className="text-foreground">{aiResponse}</p>
                </div>
              )}
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="w-full p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Controls */}
          <div className="flex gap-4">
            {!isListening ? (
              <Button
                onClick={startListening}
                disabled={isProcessing}
                size="lg"
                className="gap-2"
                aria-label={isSpeaking ? 'Interrupt AI and start talking' : 'Start talking'}
              >
                <span className="text-xl">🎤</span>
                {isSpeaking ? 'Interrupt & talk' : 'Start Talking'}
              </Button>
            ) : (
              <Button
                onClick={stopListening}
                variant="destructive"
                size="lg"
                className="gap-2"
              >
                <span className="text-xl">⏹️</span>
                Stop
              </Button>
            )}

            {onClose && (
              <Button
                onClick={onClose}
                variant="outline"
                size="lg"
                disabled={isListening || isSpeaking || isProcessing}
              >
                Close
              </Button>
            )}
          </div>

          {/* Privacy Notice */}
          <div className="text-xs text-muted-foreground text-center max-w-md">
            Use Voice Support only if you agree to this AI processing. MHtoolkit does not sell your data or share it for advertising.
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
