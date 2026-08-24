import { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { ensureAiDataSharingConsent } from '@/lib/ai-consent';
import { Colors } from '@/lib/constants';
import {
  formatJournalAudioDuration,
  MAX_JOURNAL_AUDIO_BYTES,
  MAX_JOURNAL_AUDIO_DURATION_MS,
  type JournalAudioDraft,
  type JournalAudioRecording,
  validateJournalAudio,
} from '@/lib/journal-audio';
import { fetchWithTimeout } from '@/lib/request';
import { supabase } from '@/lib/supabase';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://mhtoolkit.vercel.app';
const TRANSCRIPTION_TIMEOUT_MS = 45_000;
const AUTO_STOP_SAFETY_MARGIN_MS = 2_000;

const RECORDING_OPTIONS: Audio.RecordingOptions = {
  isMeteringEnabled: true,
  android: {
    extension: '.m4a',
    outputFormat: Audio.AndroidOutputFormat.MPEG_4,
    audioEncoder: Audio.AndroidAudioEncoder.AAC,
    sampleRate: 44_100,
    numberOfChannels: 1,
    bitRate: 48_000,
    maxFileSize: MAX_JOURNAL_AUDIO_BYTES,
  },
  ios: {
    extension: '.m4a',
    outputFormat: Audio.IOSOutputFormat.MPEG4AAC,
    audioQuality: Audio.IOSAudioQuality.HIGH,
    sampleRate: 44_100,
    numberOfChannels: 1,
    bitRate: 48_000,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
  web: {
    mimeType: 'audio/webm',
    bitsPerSecond: 48_000,
  },
};

type Props = {
  userId: string;
  draftRecording: JournalAudioDraft | null;
  savedRecording: JournalAudioRecording | null;
  disabled?: boolean;
  canDeleteSavedRecording: boolean;
  onDraftRecordingChange: (recording: JournalAudioDraft | null) => void;
  onTranscript: (transcript: string) => void;
  onDeleteSavedRecording: () => Promise<void>;
  onError: (message: string) => void;
};

export function JournalAudioPlaybackButton({
  recording,
  onError,
}: {
  recording: JournalAudioRecording;
  onError: (message: string) => void;
}) {
  const soundRef = useRef<Audio.Sound | null>(null);
  const mountedRef = useRef(true);
  const playbackGenerationRef = useRef(0);
  const playbackLoadingRef = useRef(false);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      playbackGenerationRef.current += 1;
      const sound = soundRef.current;
      soundRef.current = null;
      if (sound) void sound.unloadAsync().catch(() => {});
    };
  }, [recording.local_uri]);

  const toggle = async () => {
    if (soundRef.current) {
      playbackGenerationRef.current += 1;
      const sound = soundRef.current;
      soundRef.current = null;
      if (mountedRef.current) setPlaying(false);
      await sound.unloadAsync().catch(() => {});
      return;
    }
    if (playbackLoadingRef.current) return;
    const generation = ++playbackGenerationRef.current;
    playbackLoadingRef.current = true;
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
      });
      const { sound } = await Audio.Sound.createAsync(
        { uri: recording.local_uri },
        { shouldPlay: true }
      );
      if (!mountedRef.current || generation !== playbackGenerationRef.current) {
        await sound.unloadAsync().catch(() => {});
        return;
      }
      soundRef.current = sound;
      setPlaying(true);
      sound.setOnPlaybackStatusUpdate((status) => {
        if (!status.isLoaded || !status.didJustFinish) return;
        if (soundRef.current !== sound) return;
        soundRef.current = null;
        if (mountedRef.current) setPlaying(false);
        void sound.unloadAsync().catch(() => {});
      });
    } catch {
      if (mountedRef.current && generation === playbackGenerationRef.current) {
        setPlaying(false);
        onError('That recording could not be played. Please try again.');
      }
    } finally {
      if (generation === playbackGenerationRef.current) {
        playbackLoadingRef.current = false;
      }
    }
  };

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={playing ? 'Stop voice journal playback' : 'Play voice journal recording'}
      onPress={() => void toggle()}
      style={styles.entryPlayback}
    >
      <Feather name={playing ? 'square' : 'play'} size={14} color={Colors.primary} />
      <Text style={styles.entryPlaybackText}>
        {playing ? 'Stop' : formatJournalAudioDuration(recording.duration_ms)} voice note
      </Text>
    </TouchableOpacity>
  );
}

export function JournalVoiceRecorder({
  userId,
  draftRecording,
  savedRecording,
  disabled = false,
  canDeleteSavedRecording,
  onDraftRecordingChange,
  onTranscript,
  onDeleteSavedRecording,
  onError,
}: Props) {
  const recordingRef = useRef<Audio.Recording | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);
  const draftRecordingRef = useRef(draftRecording);
  const autoStopRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);
  const playbackGenerationRef = useRef(0);
  const playbackLoadingRef = useRef(false);
  const transcriptionGenerationRef = useRef(0);
  const recordingGenerationRef = useRef(0);
  const stopPromiseRef = useRef<Promise<void> | null>(null);
  const [recording, setRecording] = useState(false);
  const [recordedDurationMs, setRecordedDurationMs] = useState(0);
  const [transcribing, setTranscribing] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [deleting, setDeleting] = useState(false);
  draftRecordingRef.current = draftRecording;

  const stopPlayback = async () => {
    playbackGenerationRef.current += 1;
    playbackLoadingRef.current = false;
    const sound = soundRef.current;
    soundRef.current = null;
    if (mountedRef.current) setPlaying(false);
    if (sound) await sound.unloadAsync().catch(() => {});
  };

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      recordingGenerationRef.current += 1;
      if (autoStopRef.current) clearTimeout(autoStopRef.current);
      const activeRecording = recordingRef.current;
      if (activeRecording && !stopPromiseRef.current) {
        recordingRef.current = null;
        const uri = activeRecording.getURI();
        void activeRecording.stopAndUnloadAsync().finally(() => {
          if (uri) {
            void FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});
          }
        });
      }
      if (draftRecordingRef.current?.uri) {
        void FileSystem.deleteAsync(draftRecordingRef.current.uri, {
          idempotent: true,
        }).catch(() => {});
      }
      void stopPlayback();
      void Audio.setAudioModeAsync({ allowsRecordingIOS: false }).catch(() => {});
    };
  }, []);

  useEffect(() => {
    transcriptionGenerationRef.current += 1;
    setTranscribing(false);
    void stopPlayback();
  }, [draftRecording?.uri, savedRecording?.local_uri, userId]);

  const transcribe = async (audio: JournalAudioDraft) => {
    const generation = ++transcriptionGenerationRef.current;
    const audioUri = audio.uri;
    const hasConsent = await ensureAiDataSharingConsent(`user_id:${userId}`);
    if (
      !hasConsent ||
      !mountedRef.current ||
      generation !== transcriptionGenerationRef.current ||
      draftRecordingRef.current?.uri !== audioUri
    ) return;

    setTranscribing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('No active session');
      const formData = new FormData();
      formData.append('audio', {
        uri: audio.uri,
        type: audio.mimeType,
        name: audio.fileName,
      } as never);
      const response = await fetchWithTimeout(`${API_URL}/api/voice`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          Accept: 'application/json',
        },
        body: formData,
      }, TRANSCRIPTION_TIMEOUT_MS);
      if (!response.ok) throw new Error('Transcription failed');
      const payload = (await response.json()) as { transcription?: unknown };
      if (typeof payload.transcription !== 'string' || !payload.transcription.trim()) {
        throw new Error('Transcription was empty');
      }
      if (
        !mountedRef.current ||
        generation !== transcriptionGenerationRef.current ||
        draftRecordingRef.current?.uri !== audioUri
      ) return;
      onTranscript(payload.transcription.trim());
      AccessibilityInfo.announceForAccessibility('Transcript added to your journal entry.');
    } catch {
      if (
        mountedRef.current &&
        generation === transcriptionGenerationRef.current &&
        draftRecordingRef.current?.uri === audioUri
      ) {
        onError('The recording is ready, but transcription failed. Retry or add your own notes.');
      }
    } finally {
      if (mountedRef.current && generation === transcriptionGenerationRef.current) {
        setTranscribing(false);
      }
    }
  };

  const stopRecording = async () => {
    if (stopPromiseRef.current) return stopPromiseRef.current;
    const activeRecording = recordingRef.current;
    if (!activeRecording) return;
    const generation = recordingGenerationRef.current;
    if (autoStopRef.current) {
      clearTimeout(autoStopRef.current);
      autoStopRef.current = null;
    }
    setRecording(false);
    const uri = activeRecording.getURI();
    const stopOperation = (async () => {
      let durationMs = recordedDurationMs;
      try {
        const status = await activeRecording.getStatusAsync();
        if (
          (status.isRecording || status.isDoneRecording) &&
          typeof status.durationMillis === 'number'
        ) {
          durationMs = Math.max(durationMs, status.durationMillis);
        }
        const finalStatus = await activeRecording.stopAndUnloadAsync();
        // The iOS Simulator can report zero here after the file is finalized. Keep
        // the duration observed while recording instead of discarding a valid clip.
        if (typeof finalStatus.durationMillis === 'number') {
          durationMs = Math.max(durationMs, finalStatus.durationMillis);
        }
        await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
        if (!uri) throw new Error('Missing recording');
        if (!mountedRef.current || generation !== recordingGenerationRef.current) {
          await FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});
          return;
        }
        const info = await FileSystem.getInfoAsync(uri);
        if (!info.exists || typeof info.size !== 'number') {
          throw new Error('Missing recording');
        }
        const nextRecording: JournalAudioDraft = {
          uri,
          mimeType: 'audio/m4a',
          fileName: `voice-journal-${Date.now()}.m4a`,
          sizeBytes: info.size,
          durationMs,
        };
        const validationError = validateJournalAudio(nextRecording);
        if (validationError) throw new Error(validationError);
        if (draftRecordingRef.current?.uri && draftRecordingRef.current.uri !== uri) {
          await FileSystem.deleteAsync(draftRecordingRef.current.uri, {
            idempotent: true,
          }).catch(() => {});
        }
        if (mountedRef.current && generation === recordingGenerationRef.current) {
          onDraftRecordingChange(nextRecording);
        } else {
          await FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});
        }
      } catch (reason) {
        if (uri) {
          await FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});
        }
        if (mountedRef.current && generation === recordingGenerationRef.current) {
          onError(reason instanceof Error && reason.message
            ? reason.message
            : 'That recording could not be saved. Please try again.');
        }
        await Audio.setAudioModeAsync({ allowsRecordingIOS: false }).catch(() => {});
      } finally {
        if (recordingRef.current === activeRecording) recordingRef.current = null;
      }
    })();
    stopPromiseRef.current = stopOperation;
    try {
      await stopOperation;
    } finally {
      if (stopPromiseRef.current === stopOperation) stopPromiseRef.current = null;
    }
  };

  const startRecording = async () => {
    if (disabled || recording || transcribing || stopPromiseRef.current) return;
    const generation = ++recordingGenerationRef.current;
    await stopPlayback();
    try {
      const { granted } = await Audio.requestPermissionsAsync();
      if (!mountedRef.current || generation !== recordingGenerationRef.current) return;
      if (!granted) {
        onError('Microphone access is needed to record a voice journal.');
        return;
      }
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
      if (!mountedRef.current || generation !== recordingGenerationRef.current) {
        await Audio.setAudioModeAsync({ allowsRecordingIOS: false }).catch(() => {});
        return;
      }
      const { recording: nextRecording } = await Audio.Recording.createAsync(
        RECORDING_OPTIONS,
        (status) => {
          if (status.isRecording && mountedRef.current) {
            setRecordedDurationMs(status.durationMillis);
            if (
              status.durationMillis >=
              MAX_JOURNAL_AUDIO_DURATION_MS - AUTO_STOP_SAFETY_MARGIN_MS
            ) {
              void stopRecording();
            }
          }
        },
        250
      );
      if (!mountedRef.current || generation !== recordingGenerationRef.current) {
        const uri = nextRecording.getURI();
        await nextRecording.stopAndUnloadAsync().catch(() => {});
        if (uri) {
          await FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});
        }
        await Audio.setAudioModeAsync({ allowsRecordingIOS: false }).catch(() => {});
        return;
      }
      recordingRef.current = nextRecording;
      setRecordedDurationMs(0);
      setRecording(true);
      autoStopRef.current = setTimeout(() => {
        if (recordingRef.current === nextRecording) void stopRecording();
      }, MAX_JOURNAL_AUDIO_DURATION_MS - AUTO_STOP_SAFETY_MARGIN_MS);
      AccessibilityInfo.announceForAccessibility('Voice journal recording started.');
    } catch {
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false }).catch(() => {});
      if (mountedRef.current && generation === recordingGenerationRef.current) {
        onError('Could not start recording. Check microphone access and try again.');
      }
    }
  };

  const play = async () => {
    if (playing) {
      await stopPlayback();
      return;
    }
    if (playbackLoadingRef.current) return;
    const generation = ++playbackGenerationRef.current;
    playbackLoadingRef.current = true;
    try {
      let uri = draftRecording?.uri;
      if (!uri && savedRecording) {
        uri = savedRecording.local_uri;
      }
      if (!uri) return;
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
      });
      const { sound } = await Audio.Sound.createAsync({ uri }, { shouldPlay: true });
      if (!mountedRef.current || generation !== playbackGenerationRef.current) {
        await sound.unloadAsync().catch(() => {});
        return;
      }
      soundRef.current = sound;
      setPlaying(true);
      sound.setOnPlaybackStatusUpdate((status) => {
        if (!status.isLoaded || !status.didJustFinish) return;
        if (soundRef.current !== sound) return;
        void stopPlayback();
      });
    } catch {
      if (mountedRef.current && generation === playbackGenerationRef.current) {
        onError('That recording could not be played. Please try again.');
      }
      if (generation === playbackGenerationRef.current) await stopPlayback();
    } finally {
      if (generation === playbackGenerationRef.current) {
        playbackLoadingRef.current = false;
      }
    }
  };

  const removeDraft = () => {
    if (!draftRecording || disabled) return;
    Alert.alert(
      'Remove new recording?',
      savedRecording
        ? 'Your saved recording will stay.'
        : 'This unsaved recording will be discarded.',
      [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          void stopPlayback();
          void FileSystem.deleteAsync(draftRecording.uri, { idempotent: true }).catch(() => {});
          onDraftRecordingChange(null);
        },
      },
      ]
    );
  };

  const removeSaved = () => {
    if (!savedRecording || disabled || deleting) return;
    if (!canDeleteSavedRecording) {
      onError('Save a transcript or written note before deleting the recording.');
      return;
    }
    Alert.alert('Delete voice recording?', 'The transcript and written entry will stay.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete recording',
        style: 'destructive',
        onPress: () => {
          setDeleting(true);
          void stopPlayback();
          void onDeleteSavedRecording().finally(() => {
            if (mountedRef.current) setDeleting(false);
          });
        },
      },
    ]);
  };

  const shareRecording = async () => {
    const uri = draftRecording?.uri ?? savedRecording?.local_uri;
    if (!uri || disabled || recording || transcribing || deleting) return;
    try {
      if (!(await Sharing.isAvailableAsync())) {
        throw new Error('Sharing is unavailable');
      }
      await Sharing.shareAsync(uri, {
        mimeType: 'audio/m4a',
        dialogTitle: 'Save or share voice journal recording',
      });
    } catch {
      onError('This recording could not be shared. Please try again.');
    }
  };

  const availableRecording = draftRecording ?? savedRecording;
  const durationMs = draftRecording?.durationMs ?? savedRecording?.duration_ms ?? 0;

  return (
    <View style={styles.card}>
      <View style={styles.headingRow}>
        <View style={styles.icon}>
          <Feather name="mic" size={18} color={Colors.primary} />
        </View>
        <View style={styles.headingCopy}>
          <Text style={styles.title}>Voice note</Text>
          <Text style={styles.subtitle}>
            {recording
              ? `Recording ${formatJournalAudioDuration(recordedDurationMs)}`
              : draftRecording
                ? `New recording · ${formatJournalAudioDuration(durationMs)}`
                : savedRecording
                  ? `Saved on this iPhone · ${formatJournalAudioDuration(durationMs)}`
                  : 'Record and keep the original audio on this iPhone.'}
          </Text>
        </View>
      </View>

      {recording ? (
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Stop voice journal recording"
          onPress={() => void stopRecording()}
          style={[styles.primaryAction, styles.stopAction]}
        >
          <Feather name="square" size={16} color="#fff" />
          <Text style={styles.primaryActionText}>Stop recording</Text>
        </TouchableOpacity>
      ) : availableRecording ? (
        <View style={styles.actions}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={playing ? 'Stop voice journal playback' : 'Play voice journal recording'}
            disabled={disabled || transcribing || deleting}
            onPress={() => void play()}
            style={styles.secondaryAction}
          >
            <Feather name={playing ? 'square' : 'play'} size={15} color={Colors.primary} />
            <Text style={styles.secondaryActionText}>{playing ? 'Stop' : 'Play'}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Save a copy of voice journal recording"
            disabled={disabled || recording || transcribing || deleting}
            onPress={() => void shareRecording()}
            style={styles.secondaryAction}
          >
            <Feather name="share-2" size={15} color={Colors.primary} />
            <Text style={styles.secondaryActionText}>Save a copy</Text>
          </TouchableOpacity>
          {draftRecording ? (
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Transcribe voice journal recording"
              disabled={disabled || transcribing || deleting}
              onPress={() => void transcribe(draftRecording)}
              style={styles.secondaryAction}
            >
              {transcribing ? (
                <ActivityIndicator size="small" color={Colors.primary} />
              ) : (
                <Feather name="type" size={15} color={Colors.primary} />
              )}
              <Text style={styles.secondaryActionText}>
                {transcribing ? 'Transcribing' : 'Transcribe'}
              </Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Replace voice journal recording"
            disabled={disabled || transcribing || deleting}
            onPress={() => void startRecording()}
            style={styles.secondaryAction}
          >
            <Feather name="refresh-cw" size={15} color={Colors.primary} />
            <Text style={styles.secondaryActionText}>Replace</Text>
          </TouchableOpacity>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Delete voice journal recording"
            disabled={disabled || transcribing || deleting}
            onPress={draftRecording ? removeDraft : removeSaved}
            style={styles.deleteAction}
          >
            {deleting ? (
              <ActivityIndicator size="small" color="#b91c1c" />
            ) : (
              <Feather name="trash-2" size={15} color="#b91c1c" />
            )}
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Start voice journal recording"
          disabled={disabled}
          onPress={() => void startRecording()}
          style={[styles.primaryAction, disabled && styles.disabled]}
        >
          <Feather name="mic" size={16} color="#fff" />
          <Text style={styles.primaryActionText}>Record voice note</Text>
        </TouchableOpacity>
      )}
      {draftRecording ? (
        <Text style={styles.pendingText}>
          Save this entry to keep the new recording on this iPhone.
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    backgroundColor: '#f4f8f4',
    padding: 14,
    marginTop: 14,
  },
  headingRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headingCopy: { flex: 1 },
  icon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#e7f1e8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { color: Colors.text, fontSize: 14, fontWeight: '700' },
  subtitle: { color: Colors.textSecondary, fontSize: 12, lineHeight: 17, marginTop: 2 },
  primaryAction: {
    minHeight: 48,
    borderRadius: 11,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  stopAction: { backgroundColor: '#9f2d2d' },
  primaryActionText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  secondaryAction: {
    minHeight: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.borderStrong,
    paddingHorizontal: 11,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  secondaryActionText: { color: Colors.primary, fontSize: 12, fontWeight: '700' },
  deleteAction: {
    width: 44,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#fecaca',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pendingText: { color: Colors.textSecondary, fontSize: 11, marginTop: 10 },
  disabled: { opacity: 0.55 },
  entryPlayback: {
    alignSelf: 'flex-start',
    minHeight: 44,
    borderRadius: 22,
    backgroundColor: '#e7f1e8',
    paddingHorizontal: 13,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 7,
    marginTop: 11,
  },
  entryPlaybackText: { color: Colors.primary, fontSize: 12, fontWeight: '700' },
});
