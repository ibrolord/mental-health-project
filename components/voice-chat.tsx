'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface VoiceChatProps {
  userContext?: any;
  onClose?: () => void;
}

export function VoiceChat({ userContext, onClose }: VoiceChatProps) {
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
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      await setupAudioVisualization(stream);
      
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await processVoiceInput(audioBlob);
        
        stream.getTracks().forEach(track => track.stop());
        if (audioContextRef.current) {
          audioContextRef.current.close();
        }
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }
      };

      mediaRecorder.start();
      setIsListening(true);
      setError('');
    } catch (err) {
      console.error('Microphone error:', err);
      setError('Could not access microphone. Please check permissions.');
    }
  };

  const stopListening = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      setIsListening(false);
      setVolume(0);
    }
  };

  const processVoiceInput = async (audioBlob: Blob) => {
    try {
      setIsProcessing(true);
      
      // Step 1: Transcribe audio
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.webm');

      const transcribeResponse = await fetch('/api/voice', {
        method: 'POST',
        body: formData,
      });

      if (!transcribeResponse.ok) {
        throw new Error('Transcription failed');
      }

      const { transcription } = await transcribeResponse.json();
      setTranscript(transcription);
      
      // Step 2: Get AI response
      const newMessages = [...messages, { role: 'user' as const, content: transcription }];
      setMessages(newMessages);
      
      const chatResponse = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          messages: newMessages,
          userContext 
        }),
      });

      if (!chatResponse.ok) {
        throw new Error('AI response failed');
      }

      const { response } = await chatResponse.json();
      setAiResponse(response);
      setMessages([...newMessages, { role: 'assistant', content: response }]);
      
      // Step 3: Speak the response
      await speakResponse(response);
      
      setIsProcessing(false);
    } catch (err) {
      console.error('Voice processing error:', err);
      setError('Failed to process your voice. Please try again.');
      setIsProcessing(false);
    }
  };

  const speakResponse = async (text: string) => {
    try {
      setIsSpeaking(true);
      
      const response = await fetch('/api/voice', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text, voice: 'nova' }),
      });

      if (!response.ok) {
        throw new Error('Voice generation failed');
      }

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      
      audio.onended = () => {
        setIsSpeaking(false);
        URL.revokeObjectURL(audioUrl);
      };
      
      await audio.play();
    } catch (err) {
      console.error('Speech error:', err);
      setError('Failed to generate voice. Please try again.');
      setIsSpeaking(false);
    }
  };

  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  const getStatusText = () => {
    if (isListening) return 'Listening...';
    if (isProcessing) return 'Processing...';
    if (isSpeaking) return 'AI is speaking...';
    return 'Voice Therapy Session';
  };

  const getSubText = () => {
    if (isListening) return 'Speak naturally, I\'m here to listen';
    if (isProcessing) return 'Transcribing and thinking...';
    if (isSpeaking) return 'AI therapist is responding';
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
                  isListening ? 'bg-blue-500' : isSpeaking ? 'bg-green-500' : isProcessing ? 'bg-yellow-500' : 'bg-gray-300'
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
            <p className="text-sm text-slate-600">{getSubText()}</p>
          </div>

          {/* Conversation Display */}
          {(transcript || aiResponse) && (
            <div className="w-full space-y-3">
              {transcript && (
                <div className="p-4 bg-blue-50 rounded-lg">
                  <p className="text-sm font-medium text-blue-700 mb-1">You said:</p>
                  <p className="text-slate-900">{transcript}</p>
                </div>
              )}
              {aiResponse && (
                <div className="p-4 bg-green-50 rounded-lg">
                  <p className="text-sm font-medium text-green-700 mb-1">AI Therapist:</p>
                  <p className="text-slate-900">{aiResponse}</p>
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
          <div className="text-xs text-slate-500 text-center max-w-md">
            🔒 Your voice is processed securely. Audio is transcribed and not stored permanently.
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
