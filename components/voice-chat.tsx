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

async function getLocalSpeechVoice(): Promise<SpeechSynthesisVoice | undefined> {
  const findVoice = () => {
    const localVoices = window.speechSynthesis
      .getVoices()
      .filter((voice) => voice.localService);
    const language = navigator.language.toLowerCase();
    const languageBase = language.split('-', 1)[0];
    return localVoices.find((voice) => voice.lang.toLowerCase() === language)
      || localVoices.find((voice) => (
        voice.lang.toLowerCase().split('-', 1)[0] === languageBase
      ))
      || localVoices[0];
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
  const recordingTimerRef = useRef<number | null>(null);
  const mountedRef = useRef(true);

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
    setVolume(0);
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
    try {
      if (!(await requestAiConsent())) return;

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      await setupAudioVisualization(stream);
      
      const recordingMimeType = getRecordingMimeType();
      const mediaRecorder = recordingMimeType
        ? new MediaRecorder(stream, { mimeType: recordingMimeType })
        : new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
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
      setError('Could not access microphone. Please check permissions.');
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
    try {
      setIsProcessing(true);
      
      // Step 1: Transcribe audio
      const uploadBlob = await convertRecordingToWav(audioBlob);
      if (uploadBlob.size > MAX_VOICE_AUDIO_BYTES) {
        throw new Error('That recording is too long. Please try a shorter message.');
      }
      const formData = new FormData();
      formData.append('audio', uploadBlob, getRecordingFileName(uploadBlob.type));

      const transcribeResponse = await fetch('/api/voice', {
        method: 'POST',
        headers: await getApiAuthHeaders(),
        body: formData,
      });

      if (!transcribeResponse.ok) {
        throw new Error(await getResponseError(transcribeResponse, 'Transcription failed.'));
      }

      const { transcription } = await transcribeResponse.json();
      if (typeof transcription !== 'string' || !transcription.trim()) {
        throw new Error('I could not hear any speech. Please try again.');
      }
      setTranscript(transcription);
      
      // Step 2: Get AI response
      const newMessages = [...messages, { role: 'user' as const, content: transcription }];
      setMessages(newMessages);
      pendingUserMessage = true;
      
      const chatResponse = await fetch('/api/chat', {
        method: 'POST',
        headers: await getApiAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ 
          messages: newMessages,
          userContext 
        }),
      });

      if (!chatResponse.ok) {
        throw new Error(await getResponseError(chatResponse, 'AI response failed.'));
      }

      const { response } = await chatResponse.json();
      if (typeof response !== 'string' || !response.trim()) {
        throw new Error('The AI service returned an empty response.');
      }
      setAiResponse(response);
      setMessages([...newMessages, { role: 'assistant', content: response }]);
      pendingUserMessage = false;
      
      // Step 3: Speak the response
      await speakResponse(response);
      
      setIsProcessing(false);
    } catch (err) {
      console.error('Voice processing error:', err);
      if (pendingUserMessage) {
        setMessages(previousMessages);
      }
      setError(err instanceof Error ? err.message : 'Failed to process your voice. Please try again.');
      setIsProcessing(false);
    }
  };

  const speakResponse = async (text: string) => {
    try {
      setIsSpeaking(true);

      if (!('speechSynthesis' in window)) {
        throw new Error('Spoken playback is not supported by this browser.');
      }

      window.speechSynthesis.cancel();
      const localVoice = await getLocalSpeechVoice();
      if (!localVoice) {
        throw new Error(
          'Spoken playback is unavailable, but the response is shown above.'
        );
      }
      await new Promise<void>((resolve, reject) => {
        const utterance = new SpeechSynthesisUtterance(text);
        speechRef.current = utterance;
        utterance.voice = localVoice;
        utterance.rate = 0.9;
        utterance.onend = () => resolve();
        utterance.onerror = () => reject(new Error('Spoken playback failed.'));
        window.speechSynthesis.speak(utterance);
      });
      speechRef.current = null;
      setIsSpeaking(false);
    } catch (err) {
      console.error('Speech error:', err);
      if (mountedRef.current) {
        setError(
          err instanceof Error ? err.message : 'Spoken playback failed.'
        );
        setIsSpeaking(false);
      }
    }
  };

  useEffect(() => {
    return () => {
      mountedRef.current = false;
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
      if (speechRef.current && 'speechSynthesis' in window) {
        speechRef.current.onend = null;
        speechRef.current.onerror = null;
        window.speechSynthesis.cancel();
        speechRef.current = null;
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
    if (isSpeaking) return 'AI companion is responding';
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
              AI provider for a response. Spoken playback uses a local browser voice when
              one is available.
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
                disabled={isSpeaking || isProcessing}
                size="lg"
                className="gap-2"
              >
                <span className="text-xl">🎤</span>
                Start Talking
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
