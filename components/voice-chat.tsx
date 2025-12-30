'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface VoiceChatProps {
  onTranscript?: (text: string) => void;
  onClose?: () => void;
}

export function VoiceChat({ onTranscript, onClose }: VoiceChatProps) {
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState('');
  const [volume, setVolume] = useState(0);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number>();

  // Initialize audio visualization
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
        await transcribeAudio(audioBlob);
        
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

  const transcribeAudio = async (audioBlob: Blob) => {
    try {
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.webm');

      const response = await fetch('/api/voice', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Transcription failed');
      }

      const data = await response.json();
      setTranscript(data.transcription);
      if (onTranscript) {
        onTranscript(data.transcription);
      }
    } catch (err) {
      console.error('Transcription error:', err);
      setError('Failed to transcribe audio. Please try again.');
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

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardContent className="p-8">
        <div className="flex flex-col items-center gap-6">
          {/* Voice Visualization */}
          <div className="relative w-64 h-64">
            <div className="absolute inset-0 flex items-center justify-center">
              <div
                className={`rounded-full transition-all duration-300 ${
                  isListening ? 'bg-blue-500' : isSpeaking ? 'bg-green-500' : 'bg-gray-300'
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
                {isListening ? '🎤' : isSpeaking ? '🔊' : '💬'}
              </div>
            </div>
          </div>

          {/* Status Text */}
          <div className="text-center">
            <h3 className="text-xl font-semibold mb-2">
              {isListening
                ? 'Listening...'
                : isSpeaking
                ? 'AI is speaking...'
                : 'Voice Therapy Session'}
            </h3>
            <p className="text-sm text-slate-600">
              {isListening
                ? 'Speak naturally, I\'m here to listen'
                : isSpeaking
                ? 'AI therapist is responding'
                : 'Click the microphone to start talking'}
            </p>
          </div>

          {/* Transcript Display */}
          {transcript && (
            <div className="w-full p-4 bg-slate-50 rounded-lg">
              <p className="text-sm font-medium text-slate-700 mb-1">You said:</p>
              <p className="text-slate-900">{transcript}</p>
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
                disabled={isSpeaking}
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
                disabled={isListening || isSpeaking}
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
