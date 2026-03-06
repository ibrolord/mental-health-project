import { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Animated } from 'react-native';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';
import { useRouter } from 'expo-router';
import { Colors } from '@/lib/constants';
import { apiRequest } from '@/lib/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export default function VoiceTherapyScreen() {
  const router = useRouter();
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [error, setError] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);

  const recordingRef = useRef<Audio.Recording | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    return () => {
      // Cleanup on unmount
      if (recordingRef.current) {
        recordingRef.current.stopAndUnloadAsync().catch(() => {});
      }
      if (soundRef.current) {
        soundRef.current.unloadAsync().catch(() => {});
      }
    };
  }, []);

  useEffect(() => {
    if (isListening) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.3, duration: 800, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isListening]);

  const startListening = async () => {
    try {
      setError('');
      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) {
        setError('Microphone permission is required for voice therapy.');
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      recordingRef.current = recording;
      setIsListening(true);
    } catch (err) {
      console.error('Recording error:', err);
      setError('Could not start recording. Please check microphone permissions.');
    }
  };

  const stopListening = async () => {
    if (!recordingRef.current) return;

    try {
      setIsListening(false);
      setIsProcessing(true);

      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      recordingRef.current = null;

      if (!uri) {
        setError('No audio recorded.');
        setIsProcessing(false);
        return;
      }

      await processVoiceInput(uri);
    } catch (err) {
      console.error('Stop recording error:', err);
      setError('Failed to process recording.');
      setIsProcessing(false);
    }
  };

  const getAuthHeaders = async (): Promise<Record<string, string>> => {
    const headers: Record<string, string> = {};
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`;
    } else {
      const sessionId = await AsyncStorage.getItem('anonymous_session_id');
      if (sessionId) headers['X-Session-Id'] = sessionId;
    }
    return headers;
  };

  const processVoiceInput = async (audioUri: string) => {
    try {
      const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://mhtoolkit.vercel.app';
      const authHeaders = await getAuthHeaders();

      // Step 1: Transcribe — send audio as multipart form data
      const fileInfo = await FileSystem.getInfoAsync(audioUri);
      if (!fileInfo.exists) {
        setError('Audio file not found.');
        setIsProcessing(false);
        return;
      }

      const formData = new FormData();
      formData.append('audio', {
        uri: audioUri,
        type: 'audio/m4a',
        name: 'recording.m4a',
      } as any);

      const transcribeRes = await fetch(`${API_URL}/api/voice`, {
        method: 'POST',
        headers: authHeaders,
        body: formData,
      });

      if (!transcribeRes.ok) throw new Error('Transcription failed');

      const { transcription } = await transcribeRes.json();
      setTranscript(transcription);

      // Step 2: Get AI chat response
      const newMessages: Message[] = [...messages, { role: 'user', content: transcription }];
      setMessages(newMessages);

      const chatData = await apiRequest('/api/chat', {
        messages: newMessages,
      });

      if (chatData.response) {
        setAiResponse(chatData.response);
        setMessages([...newMessages, { role: 'assistant', content: chatData.response }]);

        // Step 3: Speak the response (TTS)
        setIsProcessing(false);
        await speakResponse(chatData.response);
      }
    } catch (err) {
      console.error('Voice processing error:', err);
      setError('Failed to process your voice. Please try again.');
      setIsProcessing(false);
    }
  };

  const speakResponse = async (text: string) => {
    try {
      setIsSpeaking(true);
      const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://mhtoolkit.vercel.app';
      const authHeaders = await getAuthHeaders();

      const res = await fetch(`${API_URL}/api/voice`, {
        method: 'POST',
        headers: {
          ...authHeaders,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text, voice: 'nova' }),
      });

      if (!res.ok) throw new Error('TTS failed');

      // Save audio to temp file and play
      const audioData = await res.arrayBuffer();
      const base64 = btoa(String.fromCharCode(...new Uint8Array(audioData)));
      const tempPath = `${FileSystem.cacheDirectory}tts_response.mp3`;
      await FileSystem.writeAsStringAsync(tempPath, base64, {
        encoding: FileSystem.EncodingType.Base64,
      });

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
      });

      if (soundRef.current) {
        await soundRef.current.unloadAsync();
      }

      const { sound } = await Audio.Sound.createAsync({ uri: tempPath });
      soundRef.current = sound;

      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          setIsSpeaking(false);
        }
      });

      await sound.playAsync();
    } catch (err) {
      console.error('TTS error:', err);
      setIsSpeaking(false);
    }
  };

  const getStatusIcon = () => {
    if (isListening) return '🎤';
    if (isProcessing) return '⏳';
    if (isSpeaking) return '🔊';
    return '💬';
  };

  const getStatusText = () => {
    if (isListening) return 'Listening...';
    if (isProcessing) return 'Processing...';
    if (isSpeaking) return 'AI is speaking...';
    return 'Voice Therapy Session';
  };

  const getSubText = () => {
    if (isListening) return "Speak naturally, I'm here to listen";
    if (isProcessing) return 'Transcribing and thinking...';
    if (isSpeaking) return 'AI therapist is responding';
    return 'Tap the microphone to start talking';
  };

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      {/* Visualization */}
      <View style={s.vizContainer}>
        <Animated.View
          style={[
            s.vizCircle,
            {
              transform: [{ scale: pulseAnim }],
              backgroundColor: isListening
                ? Colors.primary
                : isSpeaking
                ? Colors.success
                : isProcessing
                ? Colors.orange
                : Colors.border,
            },
          ]}
        />
        <Text style={s.vizIcon}>{getStatusIcon()}</Text>
      </View>

      <Text style={s.statusText}>{getStatusText()}</Text>
      <Text style={s.subText}>{getSubText()}</Text>

      {/* Conversation display */}
      {(transcript || aiResponse) && (
        <View style={{ marginTop: 24, width: '100%' }}>
          {transcript ? (
            <View style={s.bubbleUser}>
              <Text style={s.bubbleLabel}>You said:</Text>
              <Text style={s.bubbleText}>{transcript}</Text>
            </View>
          ) : null}
          {aiResponse ? (
            <View style={s.bubbleAi}>
              <Text style={[s.bubbleLabel, { color: Colors.success }]}>AI Therapist:</Text>
              <Text style={s.bubbleText}>{aiResponse}</Text>
            </View>
          ) : null}
        </View>
      )}

      {/* Error */}
      {error ? (
        <View style={s.errorBox}>
          <Text style={s.errorText}>{error}</Text>
        </View>
      ) : null}

      {/* Controls */}
      <View style={s.controls}>
        {!isListening ? (
          <TouchableOpacity
            style={[s.micBtn, (isSpeaking || isProcessing) && { opacity: 0.4 }]}
            onPress={startListening}
            disabled={isSpeaking || isProcessing}
          >
            <Text style={s.micBtnIcon}>🎤</Text>
            <Text style={s.micBtnText}>Start Talking</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={s.stopBtn} onPress={stopListening}>
            <Text style={s.micBtnIcon}>⏹️</Text>
            <Text style={s.stopBtnText}>Stop</Text>
          </TouchableOpacity>
        )}
      </View>

      <Text style={s.privacyNote}>
        Your voice is processed securely. Audio is transcribed and not stored permanently.
      </Text>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 20, alignItems: 'center', paddingBottom: 40 },
  vizContainer: { width: 180, height: 180, alignItems: 'center', justifyContent: 'center', marginTop: 20 },
  vizCircle: { position: 'absolute', width: 140, height: 140, borderRadius: 70, opacity: 0.3 },
  vizIcon: { fontSize: 56 },
  statusText: { fontSize: 22, fontWeight: '600', color: Colors.text, marginTop: 16 },
  subText: { fontSize: 14, color: Colors.textSecondary, marginTop: 6, textAlign: 'center' },
  bubbleUser: { backgroundColor: '#eff6ff', borderRadius: 12, padding: 14, marginBottom: 10 },
  bubbleAi: { backgroundColor: '#f0fdf4', borderRadius: 12, padding: 14, marginBottom: 10 },
  bubbleLabel: { fontSize: 12, fontWeight: '600', color: Colors.primary, marginBottom: 4 },
  bubbleText: { fontSize: 15, color: Colors.text, lineHeight: 22 },
  errorBox: { backgroundColor: Colors.dangerLight, borderWidth: 1, borderColor: '#fecaca', borderRadius: 12, padding: 14, marginTop: 16, width: '100%' },
  errorText: { fontSize: 13, color: '#991b1b' },
  controls: { marginTop: 28, flexDirection: 'row', gap: 12 },
  micBtn: { backgroundColor: Colors.primary, borderRadius: 16, paddingVertical: 16, paddingHorizontal: 32, flexDirection: 'row', alignItems: 'center', gap: 8 },
  micBtnIcon: { fontSize: 22 },
  micBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  stopBtn: { backgroundColor: Colors.danger, borderRadius: 16, paddingVertical: 16, paddingHorizontal: 32, flexDirection: 'row', alignItems: 'center', gap: 8 },
  stopBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  privacyNote: { marginTop: 24, fontSize: 12, color: Colors.textSecondary, textAlign: 'center', maxWidth: 300 },
});
