import { useEffect, useRef, useState } from 'react';
import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';
import * as Speech from 'expo-speech';
import {
  Alert,
  Animated,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { ensureAiDataSharingConsent } from '@/lib/ai-consent';
import { apiRequest } from '@/lib/api';
import { Colors } from '@/lib/constants';
import { classifyRealtimeEvent, parseRealtimeEvent } from '@/lib/realtime-events';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface SafetyResponse {
  action: 'crisis' | 'respond';
  response?: string;
}

type SessionStatus =
  | 'checking'
  | 'connecting'
  | 'idle'
  | 'listening'
  | 'processing'
  | 'speaking';
type VoiceMode = 'fallback' | 'realtime';
type WebRtcModule = typeof import('react-native-webrtc');
type RealtimePeerConnection = InstanceType<WebRtcModule['RTCPeerConnection']>;
type RealtimeDataChannel = ReturnType<
  RealtimePeerConnection['createDataChannel']
>;
type RealtimeMediaStream = Awaited<
  ReturnType<WebRtcModule['mediaDevices']['getUserMedia']>
>;
type NativeEventTarget<TEvent = unknown> = {
  addEventListener: (type: string, listener: (event: TEvent) => void) => void;
  removeEventListener: (type: string, listener: (event: TEvent) => void) => void;
};
type NativeMessageEvent = { data: unknown };

const CONNECT_TIMEOUT_MS = 15_000;
const MAX_FALLBACK_RECORDING_MS = 90_000;
const MAX_FALLBACK_AUDIO_BYTES = 4 * 1024 * 1024;
const FALLBACK_RECORDING_OPTIONS: Audio.RecordingOptions = {
  isMeteringEnabled: true,
  android: {
    extension: '.aac',
    outputFormat: Audio.AndroidOutputFormat.AAC_ADTS,
    audioEncoder: Audio.AndroidAudioEncoder.AAC,
    sampleRate: 16_000,
    numberOfChannels: 1,
    bitRate: 64_000,
    maxFileSize: MAX_FALLBACK_AUDIO_BYTES,
  },
  ios: {
    extension: '.wav',
    outputFormat: Audio.IOSOutputFormat.LINEARPCM,
    audioQuality: Audio.IOSAudioQuality.HIGH,
    sampleRate: 16_000,
    numberOfChannels: 1,
    bitRate: 256_000,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
  web: {
    mimeType: 'audio/webm',
    bitsPerSecond: 64_000,
  },
};

function getFallbackUploadMetadata() {
  return Platform.OS === 'ios'
    ? { type: 'audio/wav', name: 'recording.wav' }
    : { type: 'audio/aac', name: 'recording.aac' };
}

function asEventTarget<TEvent>(target: unknown): NativeEventTarget<TEvent> {
  // react-native-webrtc implements EventTarget at runtime, but v124's generated
  // declarations omit the inherited listener methods under TypeScript 5.
  return target as NativeEventTarget<TEvent>;
}

export default function VoiceSupportScreen() {
  const { user } = useAuth();
  const consentSubjectId = user ? `user_id:${user.id}` : '';
  const [status, setStatus] = useState<SessionStatus>('idle');
  const [mode, setMode] = useState<VoiceMode>(
    process.env.EXPO_PUBLIC_REALTIME_VOICE_ENABLED === 'true'
      ? 'realtime'
      : 'fallback'
  );
  const [muted, setMuted] = useState(false);
  const [aiResponse, setAiResponse] = useState('');
  const [error, setError] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [sessionLimitSeconds, setSessionLimitSeconds] = useState(4 * 60);
  const [privacyOpen, setPrivacyOpen] = useState(true);

  const peerRef = useRef<RealtimePeerConnection | null>(null);
  const channelRef = useRef<RealtimeDataChannel | null>(null);
  const streamRef = useRef<RealtimeMediaStream | null>(null);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const fallbackRecordingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const messagesRef = useRef<Message[]>([]);
  const sessionGenerationRef = useRef(0);
  const sessionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const elapsedTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sessionDeadlineRef = useRef<number | null>(null);
  const pendingRealtimeGrantRef = useRef<string | null>(null);
  const pendingRealtimeApiUrlRef = useRef<string | null>(null);
  const cancelPendingRealtimeSessionRef = useRef<() => Promise<void>>(
    async () => {}
  );
  const safetyQueueRef = useRef<Promise<void>>(Promise.resolve());
  const connectInFlightRef = useRef(false);
  const fallbackStartInFlightRef = useRef(false);
  const mutedRef = useRef(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const realtimeActive = peerRef.current !== null;

  function addMessage(message: Message) {
    const next = [...messagesRef.current, message].slice(-12);
    messagesRef.current = next;
    setMessages(next);
  }

  function clearSessionTimers() {
    if (sessionTimerRef.current) clearTimeout(sessionTimerRef.current);
    if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
    sessionTimerRef.current = null;
    elapsedTimerRef.current = null;
  }

  function disposeRealtimeSession(updateState = true) {
    sessionGenerationRef.current += 1;
    clearSessionTimers();
    channelRef.current?.close();
    peerRef.current?.close();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    channelRef.current = null;
    peerRef.current = null;
    streamRef.current = null;
    sessionDeadlineRef.current = null;
    safetyQueueRef.current = Promise.resolve();
    void Audio.setAudioModeAsync({ allowsRecordingIOS: false }).catch(() => {});
    if (updateState) {
      setStatus('idle');
      setMuted(false);
      mutedRef.current = false;
      setElapsedSeconds(0);
    }
  }

  useEffect(() => {
    return () => {
      void cancelPendingRealtimeSessionRef.current();
      sessionGenerationRef.current += 1;
      if (sessionTimerRef.current) clearTimeout(sessionTimerRef.current);
      if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
      if (fallbackRecordingTimerRef.current) {
        clearTimeout(fallbackRecordingTimerRef.current);
      }
      channelRef.current?.close();
      peerRef.current?.close();
      streamRef.current?.getTracks().forEach((track) => track.stop());
      void Audio.setAudioModeAsync({ allowsRecordingIOS: false }).catch(() => {});
      if (recordingRef.current) {
        const recording = recordingRef.current;
        const uri = recording.getURI();
        void recording
          .stopAndUnloadAsync()
          .catch(() => {})
          .finally(() => {
            if (uri) {
              void FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});
            }
          });
      }
      void Speech.stop().catch(() => {});
    };
  }, []);

  useEffect(() => {
    const active = status !== 'idle';
    if (!active) {
      pulseAnim.setValue(1);
      return;
    }
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: status === 'listening' ? 1.14 : 1.06,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 700,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [pulseAnim, status]);

  async function getAuthHeaders(): Promise<Record<string, string>> {
    const headers: Record<string, string> = {};
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session?.access_token) {
      headers.Authorization = `Bearer ${session.access_token}`;
    } else {
      const sessionId = await AsyncStorage.getItem('anonymous_session_id');
      if (sessionId) headers['X-Session-Id'] = sessionId;
    }
    return headers;
  }

  async function cancelPendingRealtimeSession() {
    const grantId = pendingRealtimeGrantRef.current;
    const apiUrl = pendingRealtimeApiUrlRef.current;
    pendingRealtimeGrantRef.current = null;
    pendingRealtimeApiUrlRef.current = null;
    if (!grantId || !apiUrl) return;
    try {
      await fetch(`${apiUrl}/api/realtime/session`, {
        method: 'DELETE',
        headers: {
          ...(await getAuthHeaders()),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ grantId }),
      });
    } catch {
      // The server expiry task remains the hard stop if cleanup cannot connect.
    }
  }
  cancelPendingRealtimeSessionRef.current = cancelPendingRealtimeSession;

  async function confirmRealtimeSession(apiUrl: string, grantId: string) {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const response = await fetch(`${apiUrl}/api/realtime/session`, {
          method: 'PATCH',
          headers: {
            ...(await getAuthHeaders()),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ grantId }),
        });
        if (response.ok) return;
        if (response.status === 400 || response.status === 401 || response.status === 409) {
          break;
        }
      } catch {
        // One idempotent retry covers a lost confirmation response.
      }
    }
    throw new Error('Realtime session confirmation failed');
  }

  async function endRealtimeSession() {
    const cancellation = cancelPendingRealtimeSession();
    disposeRealtimeSession();
    await cancellation;
  }

  function setMicrophoneEnabled(enabled: boolean) {
    streamRef.current?.getAudioTracks().forEach((track) => {
      track.enabled = enabled;
    });
  }

  async function speakText(text: string, returnToListening: boolean) {
    try {
      setStatus('speaking');
      setMicrophoneEnabled(false);
      await Speech.stop();
      await new Promise<void>((resolve, reject) => {
        let settled = false;
        const finish = (error?: Error) => {
          if (settled) return;
          settled = true;
          clearTimeout(timeout);
          if (error) reject(error);
          else resolve();
        };
        const timeout = setTimeout(() => {
          void Speech.stop();
          finish(new Error('Speech playback timed out'));
        }, 60_000);
        Speech.speak(text, {
          language: 'en-US',
          rate: 0.9,
          onDone: () => finish(),
          onStopped: () => finish(),
          onError: () => finish(new Error('Speech playback failed')),
        });
      });
    } finally {
      if (returnToListening && peerRef.current) {
        setMicrophoneEnabled(!mutedRef.current);
        setStatus('listening');
      } else {
        setStatus('idle');
      }
    }
  }

  async function approveRealtimeTurn(transcriptText: string, generation: number) {
    try {
      setError('');
      const safety = await apiRequest<SafetyResponse>(
        '/api/realtime/safety',
        { transcript: transcriptText },
        { timeoutMs: 12_000 }
      );
      if (generation !== sessionGenerationRef.current || !peerRef.current) return;

      if (safety.action === 'crisis') {
        const response = safety.response?.trim();
        if (!response) throw new Error('Missing safety response');
        addMessage({ role: 'assistant', content: response });
        setAiResponse(response);
        await speakText(response, true);
        return;
      }

      setStatus('processing');
      const chatMessages = messagesRef.current.slice(-12);
      const chat = await apiRequest<{ response?: unknown }>(
        '/api/chat',
        { messages: chatMessages },
        { timeoutMs: 20_000 }
      );
      if (generation !== sessionGenerationRef.current || !peerRef.current) return;
      if (typeof chat.response !== 'string' || !chat.response.trim()) {
        throw new Error('AI response was empty');
      }
      const response = chat.response.trim();
      addMessage({ role: 'assistant', content: response });
      setAiResponse(response);
      await speakText(response, true);
    } catch {
      if (generation !== sessionGenerationRef.current) return;
      setError('I could not safely process that turn. Please try again.');
      setMicrophoneEnabled(!mutedRef.current);
      setStatus('listening');
    }
  }

  function handleRealtimeMessage(data: unknown, generation: number) {
    const event = parseRealtimeEvent(data);
    if (!event || generation !== sessionGenerationRef.current) return;
    const action = classifyRealtimeEvent(event);

    switch (action.type) {
      case 'user_transcript':
        setMicrophoneEnabled(false);
        addMessage({ role: 'user', content: action.text });
        setStatus('checking');
        safetyQueueRef.current = safetyQueueRef.current
          .then(() => approveRealtimeTurn(action.text, generation))
          .catch(() => {});
        break;
      case 'speech_started':
        setStatus('listening');
        break;
      case 'speech_stopped':
        // Hold subsequent audio outside the conversation until this turn passes
        // the app's safety gate and the approved response begins.
        setMicrophoneEnabled(false);
        setStatus('checking');
        break;
      case 'transcription_failed':
        setError(action.message);
        setMicrophoneEnabled(!mutedRef.current);
        setStatus('listening');
        break;
      case 'transcription_empty':
        setMicrophoneEnabled(!mutedRef.current);
        setStatus('listening');
        break;
      case 'error':
        setError(action.message);
        if (peerRef.current) {
          setMicrophoneEnabled(!mutedRef.current);
          setStatus('listening');
        }
        break;
      case 'unknown':
        break;
    }
  }

  async function waitForIceGathering(peer: RealtimePeerConnection) {
    if (peer.iceGatheringState === 'complete') return;
    await new Promise<void>((resolve) => {
      const events = asEventTarget(peer);
      const timeout = setTimeout(done, 2_500);
      function done() {
        clearTimeout(timeout);
        events.removeEventListener('icegatheringstatechange', onStateChange);
        resolve();
      }
      function onStateChange() {
        if (peer.iceGatheringState === 'complete') done();
      }
      events.addEventListener('icegatheringstatechange', onStateChange);
    });
  }

  async function waitForDataChannelOpen(channel: RealtimeDataChannel) {
    if (channel.readyState === 'open') return;
    await new Promise<void>((resolve, reject) => {
      const events = asEventTarget(channel);
      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error('Realtime connection timed out'));
      }, CONNECT_TIMEOUT_MS);
      function cleanup() {
        clearTimeout(timeout);
        events.removeEventListener('open', onOpen);
        events.removeEventListener('error', onError);
      }
      function onOpen() {
        cleanup();
        resolve();
      }
      function onError() {
        cleanup();
        reject(new Error('Realtime data channel failed'));
      }
      events.addEventListener('open', onOpen);
      events.addEventListener('error', onError);
    });
  }

  async function connectRealtime() {
    if (connectInFlightRef.current || peerRef.current) return;
    connectInFlightRef.current = true;
    try {
      setError('');
      if (!(await ensureAiDataSharingConsent(consentSubjectId))) return;

      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) {
        setError('Microphone access is needed for live voice.');
        return;
      }

      const generation = sessionGenerationRef.current + 1;
      sessionGenerationRef.current = generation;
      setStatus('connecting');
      try {
        const API_URL =
          process.env.EXPO_PUBLIC_API_URL || 'https://mhtoolkit.vercel.app';
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
          playThroughEarpieceAndroid: false,
        });

        const rtc = await import('react-native-webrtc');
        const stream = await rtc.mediaDevices.getUserMedia({
          audio: true,
          video: false,
        });
        streamRef.current = stream;
        if (generation !== sessionGenerationRef.current) {
          stream.getTracks().forEach((track) => track.stop());
          streamRef.current = null;
          return;
        }

        const peer = new rtc.RTCPeerConnection();
        peerRef.current = peer;
        const channel = peer.createDataChannel('oai-events');
        channelRef.current = channel;
        stream.getTracks().forEach((track) => peer.addTrack(track, stream));

        const channelEvents = asEventTarget<NativeMessageEvent>(channel);
        const peerEvents = asEventTarget(peer);
        channelEvents.addEventListener('message', (message) => {
          handleRealtimeMessage(message.data, generation);
        });
        function finishDisconnectedSession() {
          if (generation !== sessionGenerationRef.current) return;
          const nearServerCap =
            sessionDeadlineRef.current !== null &&
            Date.now() >= sessionDeadlineRef.current - 5_000;
          void cancelPendingRealtimeSession();
          disposeRealtimeSession();
          if (nearServerCap) {
            Alert.alert(
              'Session ended',
              'Live voice reached its time limit. You can start another when ready.'
            );
          } else {
            setMode('fallback');
            setError('Live voice disconnected. Push-to-talk is ready.');
          }
        }
        peerEvents.addEventListener('connectionstatechange', () => {
          if (generation !== sessionGenerationRef.current) return;
          if (
            peer.connectionState === 'failed' ||
            peer.connectionState === 'closed'
          ) {
            finishDisconnectedSession();
          } else if (peer.connectionState === 'disconnected') {
            setTimeout(() => {
              if (
                generation === sessionGenerationRef.current &&
                peer.connectionState === 'disconnected'
              ) {
                finishDisconnectedSession();
              }
            }, 1_500);
          }
        });

        const offer = await peer.createOffer({ offerToReceiveAudio: true });
        await peer.setLocalDescription(offer);
        await waitForIceGathering(peer);
        const localSdp = peer.localDescription?.sdp;
        if (!localSdp) throw new Error('Realtime offer was not created');

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), CONNECT_TIMEOUT_MS);
        let answer: Response;
        try {
          answer = await fetch(`${API_URL}/api/realtime/session`, {
            method: 'POST',
            headers: {
              ...(await getAuthHeaders()),
              Accept: 'application/sdp',
              'Content-Type': 'application/sdp',
            },
            body: localSdp,
            signal: controller.signal,
          });
        } finally {
          clearTimeout(timeout);
        }
        if (!answer.ok) throw new Error('Realtime service rejected the call');
        const answerSdp = (await answer.text()).trim();
        if (!answerSdp.startsWith('v=0') || !answerSdp.includes('m=audio')) {
          throw new Error('Realtime service returned an invalid answer');
        }
        const grantId = answer.headers.get('x-realtime-session-id');
        if (
          !grantId ||
          !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
            grantId
          )
        ) {
          throw new Error('Realtime service returned an invalid session');
        }
        pendingRealtimeGrantRef.current = grantId;
        pendingRealtimeApiUrlRef.current = API_URL;
        const configuredSeconds = Number(
          answer.headers.get('x-realtime-max-seconds') || '240'
        );
        const maxSessionSeconds =
          Number.isFinite(configuredSeconds) && configuredSeconds > 0
            ? Math.min(configuredSeconds, 10 * 60)
            : 4 * 60;
        sessionDeadlineRef.current = Date.now() + maxSessionSeconds * 1_000;
        await peer.setRemoteDescription({
          type: 'answer',
          sdp: answerSdp,
        });
        await waitForDataChannelOpen(channel);
        if (generation !== sessionGenerationRef.current) {
          await cancelPendingRealtimeSession();
          return;
        }

        await confirmRealtimeSession(API_URL, grantId);
        pendingRealtimeGrantRef.current = null;
        pendingRealtimeApiUrlRef.current = null;
        const remainingMilliseconds = Math.max(
          0,
          (sessionDeadlineRef.current || Date.now()) - Date.now()
        );
        if (remainingMilliseconds === 0) {
          throw new Error('Realtime session expired during setup');
        }
        setMode('realtime');
        setStatus('listening');
        setElapsedSeconds(0);
        setSessionLimitSeconds(maxSessionSeconds);
        elapsedTimerRef.current = setInterval(
          () => setElapsedSeconds((value) => value + 1),
          1_000
        );
        sessionTimerRef.current = setTimeout(() => {
          disposeRealtimeSession();
          Alert.alert(
            'Session ended',
            `Live voice sessions stop after ${Math.ceil(maxSessionSeconds / 60)} minutes. You can start another when ready.`
          );
        }, remainingMilliseconds);
      } catch (reason) {
        if (generation !== sessionGenerationRef.current) return;
        console.error('Realtime voice connection error:', reason);
        const cancellation = cancelPendingRealtimeSession();
        disposeRealtimeSession();
        await cancellation;
        setMode('fallback');
        setError('Live voice could not connect. Push-to-talk is ready.');
      }
    } finally {
      connectInFlightRef.current = false;
    }
  }

  function toggleMute() {
    const next = !mutedRef.current;
    mutedRef.current = next;
    setMuted(next);
    setMicrophoneEnabled(!next);
  }

  async function startFallbackRecording() {
    if (fallbackStartInFlightRef.current || recordingRef.current) return;
    fallbackStartInFlightRef.current = true;
    try {
      setError('');
      if (!(await ensureAiDataSharingConsent(consentSubjectId))) return;
      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) {
        setError('Microphone access is needed for voice support.');
        return;
      }
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
      const { recording } = await Audio.Recording.createAsync(
        FALLBACK_RECORDING_OPTIONS
      );
      recordingRef.current = recording;
      fallbackRecordingTimerRef.current = setTimeout(() => {
        if (recordingRef.current === recording) {
          void stopFallbackRecording();
        }
      }, MAX_FALLBACK_RECORDING_MS);
      setStatus('listening');
    } catch {
      setError('Could not start recording. Check microphone access.');
      setStatus('idle');
    } finally {
      fallbackStartInFlightRef.current = false;
    }
  }

  async function stopFallbackRecording() {
    const recording = recordingRef.current;
    if (!recording) return;
    if (fallbackRecordingTimerRef.current) {
      clearTimeout(fallbackRecordingTimerRef.current);
      fallbackRecordingTimerRef.current = null;
    }
    setStatus('processing');
    const uri = recording.getURI();
    try {
      await recording.stopAndUnloadAsync();
    } catch {
      await recording.stopAndUnloadAsync().catch(() => {});
      if (recordingRef.current === recording) recordingRef.current = null;
      if (uri) {
        await FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});
      }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false }).catch(() => {});
      setError('That recording could not be processed. Please try again.');
      setStatus('idle');
      return;
    }
    if (recordingRef.current === recording) recordingRef.current = null;
    if (!uri) {
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false }).catch(() => {});
      setError('That recording could not be processed. Please try again.');
      setStatus('idle');
      return;
    }
    await processFallbackVoice(uri);
  }

  async function processFallbackVoice(audioUri: string) {
    const API_URL =
      process.env.EXPO_PUBLIC_API_URL || 'https://mhtoolkit.vercel.app';
    try {
      const fileInfo = await FileSystem.getInfoAsync(audioUri);
      if (!fileInfo.exists) throw new Error('Audio file not found');
      if (
        typeof fileInfo.size === 'number'
        && fileInfo.size > MAX_FALLBACK_AUDIO_BYTES
      ) {
        throw new Error('Audio file is too large');
      }

      const formData = new FormData();
      const upload = getFallbackUploadMetadata();
      formData.append('audio', {
        uri: audioUri,
        type: upload.type,
        name: upload.name,
      } as never);
      const transcribe = await fetch(`${API_URL}/api/voice`, {
        method: 'POST',
        headers: {
          ...(await getAuthHeaders()),
          Accept: 'application/json',
        },
        body: formData,
      });
      if (!transcribe.ok) throw new Error('Transcription failed');
      const data = (await transcribe.json()) as { transcription?: unknown };
      if (typeof data.transcription !== 'string' || !data.transcription.trim()) {
        throw new Error('Transcription was empty');
      }

      const userText = data.transcription.trim();
      const nextMessages: Message[] = [
        ...messagesRef.current,
        { role: 'user' as const, content: userText },
      ].slice(-12);
      messagesRef.current = nextMessages;
      setMessages(nextMessages);
      const chat = await apiRequest<{ response?: unknown }>('/api/chat', {
        messages: nextMessages,
      });
      if (typeof chat.response !== 'string' || !chat.response.trim()) {
        throw new Error('AI response was empty');
      }
      const responseText = chat.response.trim();
      setAiResponse(responseText);
      addMessage({ role: 'assistant', content: responseText });
      await speakText(responseText, false);
    } catch (reason) {
      console.error('Push-to-talk processing error:', reason);
      setError('Voice support could not answer. Please try again.');
      setStatus('idle');
    } finally {
      await FileSystem.deleteAsync(audioUri, { idempotent: true }).catch(() => {});
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false }).catch(() => {});
    }
  }

  const statusText =
    status === 'connecting'
      ? 'Connecting securely'
      : status === 'checking'
        ? 'Checking your turn'
        : status === 'processing'
          ? 'Thinking'
          : status === 'speaking'
            ? 'AI is speaking'
            : status === 'listening'
              ? muted
                ? 'Microphone paused'
                : 'Listening'
              : mode === 'fallback'
                ? 'Push-to-talk mode'
                : 'Live AI conversation';
  const timer = `${String(Math.floor(elapsedSeconds / 60)).padStart(2, '0')}:${String(elapsedSeconds % 60).padStart(2, '0')}`;
  const statusColor =
    status === 'listening'
      ? Colors.primary
      : status === 'speaking'
        ? Colors.success
        : status === 'idle'
          ? '#d8d1c0'
          : Colors.orange;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>LIVE SUPPORT</Text>
        <Text style={styles.title}>Talk naturally.</Text>
        <Text style={styles.subtitle}>
          The conversation listens for your pauses, checks each turn, and answers
          aloud.
        </Text>
      </View>

      <View style={styles.stage}>
        <Animated.View
          style={[
            styles.orbHalo,
            { backgroundColor: statusColor, transform: [{ scale: pulseAnim }] },
          ]}
        />
        <View style={[styles.orb, { borderColor: statusColor }]}>
          <Feather
            name={muted ? 'mic-off' : status === 'speaking' ? 'volume-2' : 'mic'}
            size={38}
            color={Colors.primary}
          />
        </View>
        <Text style={styles.status}>{statusText}</Text>
        {realtimeActive ? (
          <Text style={styles.timer}>
            {timer} / {String(Math.floor(sessionLimitSeconds / 60)).padStart(2, '0')}:
            {String(sessionLimitSeconds % 60).padStart(2, '0')}
          </Text>
        ) : null}
      </View>

      {privacyOpen ? (
        <View style={styles.disclosure}>
          <View style={styles.disclosureCopy}>
            <Feather name="lock" size={15} color="#675b47" />
            <Text style={styles.disclosureText}>
              Live audio uses OpenAI. Push-to-talk uses Gemini; compatible recordings
              can fall back to OpenAI. Replies use your phone&apos;s speech service.
            </Text>
          </View>
          <TouchableOpacity
            accessibilityLabel="Dismiss live voice privacy note"
            onPress={() => setPrivacyOpen(false)}
            style={styles.dismiss}
          >
            <Feather name="x" size={17} color="#675b47" />
          </TouchableOpacity>
        </View>
      ) : null}

      {error ? (
        <View style={styles.errorBox}>
          <Feather name="alert-circle" size={16} color="#991b1b" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {messages.length > 0 ? (
        <View style={styles.conversation}>
          <Text style={styles.conversationTitle}>This session</Text>
          {messages.slice(-6).map((message, index) => (
            <View
              key={`${message.role}-${index}-${message.content.slice(0, 12)}`}
              style={
                message.role === 'user' ? styles.userBubble : styles.aiBubble
              }
            >
              <Text style={styles.bubbleLabel}>
                {message.role === 'user' ? 'You' : 'MHtoolkit AI'}
              </Text>
              <Text style={styles.bubbleText}>{message.content}</Text>
            </View>
          ))}
          {status === 'speaking' &&
          aiResponse &&
          messages.at(-1)?.content !== aiResponse ? (
            <View style={styles.aiBubble}>
              <Text style={styles.bubbleLabel}>MHtoolkit AI</Text>
              <Text style={styles.bubbleText}>{aiResponse}</Text>
            </View>
          ) : null}
        </View>
      ) : null}

      <View style={styles.controls}>
        {realtimeActive ? (
          <>
            <TouchableOpacity style={styles.secondaryButton} onPress={toggleMute}>
              <Feather name={muted ? 'mic' : 'mic-off'} size={19} color={Colors.primary} />
              <Text style={styles.secondaryButtonText}>
                {muted ? 'Resume mic' : 'Pause mic'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.endButton}
              onPress={() => void endRealtimeSession()}
            >
              <Feather name="square" size={18} color="#fff" />
              <Text style={styles.endButtonText}>End</Text>
            </TouchableOpacity>
          </>
        ) : mode === 'fallback' ? (
          <>
            {status === 'listening' ? (
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={() => void stopFallbackRecording()}
              >
                <Feather name="send" size={19} color="#fff" />
                <Text style={styles.primaryButtonText}>Finish turn</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[
                  styles.primaryButton,
                  status !== 'idle' && styles.disabledButton,
                ]}
                disabled={status !== 'idle'}
                onPress={() => void startFallbackRecording()}
              >
                <Feather name="mic" size={19} color="#fff" />
                <Text style={styles.primaryButtonText}>Hold a conversation</Text>
              </TouchableOpacity>
            )}
            {status === 'idle' ? (
              <TouchableOpacity
                style={styles.textButton}
                onPress={() => {
                  setMode('realtime');
                  void connectRealtime();
                }}
              >
                <Text style={styles.textButtonText}>Try live mode again</Text>
              </TouchableOpacity>
            ) : null}
          </>
        ) : (
          <TouchableOpacity
            style={[
              styles.primaryButton,
              status !== 'idle' && styles.disabledButton,
            ]}
            disabled={status !== 'idle'}
            onPress={() => void connectRealtime()}
          >
            <Feather name="headphones" size={19} color="#fff" />
            <Text style={styles.primaryButtonText}>Start live conversation</Text>
          </TouchableOpacity>
        )}
      </View>

      <TouchableOpacity
        style={styles.supportLink}
        onPress={() => Alert.alert(
          'Need urgent help?',
          'If you may act on thoughts of harming yourself or someone else, contact local emergency services now. In the U.S. or Canada, call or text 988.'
        )}
      >
        <Feather name="life-buoy" size={15} color={Colors.textSecondary} />
        <Text style={styles.supportLinkText}>Urgent support</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 20, paddingBottom: 48 },
  hero: { paddingTop: 8, paddingHorizontal: 4 },
  eyebrow: {
    color: Colors.primary,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 2.1,
  },
  title: {
    color: Colors.text,
    fontSize: 34,
    fontWeight: '700',
    letterSpacing: -1,
    marginTop: 8,
  },
  subtitle: {
    color: Colors.textSecondary,
    fontSize: 15,
    lineHeight: 22,
    marginTop: 8,
    maxWidth: 360,
  },
  stage: { alignItems: 'center', paddingVertical: 36 },
  orbHalo: {
    position: 'absolute',
    top: 42,
    width: 132,
    height: 132,
    borderRadius: 66,
    opacity: 0.15,
  },
  orb: {
    width: 112,
    height: 112,
    borderRadius: 56,
    borderWidth: 2,
    backgroundColor: '#fffdf7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  status: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: '700',
    marginTop: 20,
  },
  timer: { color: Colors.textSecondary, fontSize: 13, marginTop: 5 },
  disclosure: {
    backgroundColor: '#eee9dc',
    borderRadius: 14,
    padding: 13,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  disclosureCopy: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  disclosureText: { flex: 1, color: '#675b47', fontSize: 12, lineHeight: 18 },
  dismiss: { padding: 2 },
  errorBox: {
    backgroundColor: Colors.dangerLight,
    borderColor: '#fecaca',
    borderWidth: 1,
    borderRadius: 14,
    padding: 13,
    marginTop: 14,
    flexDirection: 'row',
    gap: 8,
  },
  errorText: { flex: 1, color: '#991b1b', fontSize: 13, lineHeight: 18 },
  conversation: { marginTop: 22, gap: 10 },
  conversationTitle: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  userBubble: {
    alignSelf: 'flex-end',
    maxWidth: '88%',
    backgroundColor: '#dcece5',
    borderRadius: 16,
    borderBottomRightRadius: 5,
    padding: 13,
  },
  aiBubble: {
    alignSelf: 'flex-start',
    maxWidth: '92%',
    backgroundColor: '#fffdf7',
    borderColor: '#ded7c6',
    borderWidth: 1,
    borderRadius: 16,
    borderBottomLeftRadius: 5,
    padding: 13,
  },
  bubbleLabel: {
    color: Colors.primary,
    fontSize: 11,
    fontWeight: '800',
    marginBottom: 4,
  },
  bubbleText: { color: Colors.text, fontSize: 15, lineHeight: 21 },
  controls: {
    marginTop: 26,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  primaryButton: {
    minHeight: 52,
    borderRadius: 16,
    paddingHorizontal: 24,
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
  },
  primaryButtonText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  secondaryButton: {
    minHeight: 50,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: Colors.primary,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  secondaryButtonText: { color: Colors.primary, fontSize: 14, fontWeight: '700' },
  endButton: {
    minHeight: 50,
    borderRadius: 15,
    backgroundColor: Colors.danger,
    paddingHorizontal: 21,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  endButtonText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  disabledButton: { opacity: 0.5 },
  textButton: { paddingHorizontal: 14, paddingVertical: 10 },
  textButtonText: { color: Colors.primary, fontSize: 13, fontWeight: '700' },
  supportLink: {
    alignSelf: 'center',
    marginTop: 28,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 8,
  },
  supportLinkText: { color: Colors.textSecondary, fontSize: 12, fontWeight: '600' },
});
