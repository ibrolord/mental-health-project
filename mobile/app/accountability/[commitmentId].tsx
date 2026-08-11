import { useCallback, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '@/lib/constants';
import { accountabilityClient } from '@/lib/accountability/runtime';
import type {
  AccountabilityComment,
  AccountabilityReward,
  AccountabilitySuggestion,
  SharedCommitment,
} from '@/lib/accountability/types';
import { ScreenState } from '@/components/accountability/ScreenState';

function today(): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function CommitmentDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ commitmentId: string | string[] }>();
  const commitmentId = Array.isArray(params.commitmentId) ? params.commitmentId[0] : params.commitmentId;
  const [commitment, setCommitment] = useState<SharedCommitment | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkingIn, setCheckingIn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [comments, setComments] = useState<AccountabilityComment[]>([]);
  const [suggestions, setSuggestions] = useState<AccountabilitySuggestion[]>([]);
  const [reward, setReward] = useState<AccountabilityReward | null>(null);
  const [checkInNote, setCheckInNote] = useState('');
  const [shareCheckInNote, setShareCheckInNote] = useState(false);
  const [comment, setComment] = useState('');
  const [rewardText, setRewardText] = useState('');
  const [priority, setPriority] = useState<'high' | 'medium' | 'low'>('high');
  const [working, setWorking] = useState(false);

  const load = useCallback(async () => {
    if (!commitmentId) {
      setError('This commitment link is invalid.');
      setLoading(false);
      return;
    }
    setError(null);
    try {
      const next = await accountabilityClient.getCommitment({ commitmentId });
      setCommitment(next);
      const [nextComments, nextSuggestions, nextRewards] = await Promise.all([
        accountabilityClient.listComments({ commitmentId: next.id }),
        accountabilityClient.listSuggestions({ connectionId: next.connectionId }),
        accountabilityClient.listRewards({ connectionId: next.connectionId }),
      ]);
      setComments(nextComments);
      setSuggestions(nextSuggestions.filter((item) => item.commitmentId === next.id));
      const nextReward = nextRewards.find((item) => item.commitmentId === next.id) ?? null;
      setReward(nextReward);
      setRewardText(nextReward?.label ?? '');
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'This commitment could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [commitmentId]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const checkIn = async () => {
    if (!commitment || !commitment.isMine || commitment.checkedInToday) return;
    setCheckingIn(true);
    try {
      await accountabilityClient.createCheckIn({
        commitmentId: commitment.id,
        checkInDate: today(),
        ...(checkInNote.trim() ? { note: checkInNote.trim(), shareNote: shareCheckInNote } : {}),
      });
      setCheckInNote('');
      setShareCheckInNote(false);
      await load();
      Alert.alert('You showed up', 'That counts. No streak required.');
    } catch (checkInError) {
      Alert.alert('Check-in not saved', checkInError instanceof Error ? checkInError.message : 'Please try again.');
    } finally {
      setCheckingIn(false);
    }
  };

  const perform = async (action: () => Promise<unknown>, success: string) => {
    if (working) return;
    setWorking(true);
    try {
      await action();
      await load();
      Alert.alert(success);
    } catch (actionError) {
      Alert.alert('Action not completed', actionError instanceof Error ? actionError.message : 'Please try again.');
    } finally {
      setWorking(false);
    }
  };

  if (loading) return <SafeAreaView style={styles.safe} edges={['bottom']}><ScreenState kind="loading" title="Loading commitment" message="Getting the latest shared details…" /></SafeAreaView>;
  if (error || !commitment) return <SafeAreaView style={styles.safe} edges={['bottom']}><ScreenState kind="error" title="Commitment unavailable" message={error || 'This item is no longer shared.'} actionLabel="Try again" onAction={() => void load()} /></SafeAreaView>;

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.kicker}>{commitment.isMine ? 'My commitment' : `${commitment.ownerName}'s commitment`}</Text>
        <Text style={styles.title}>{commitment.title}</Text>
        <Text style={styles.cadence}>{commitment.cadence === 'daily' ? 'Daily rhythm' : commitment.cadence === 'weekly' ? 'Weekly rhythm' : 'Custom rhythm'}</Text>

        {commitment.isMine ? (
          <TouchableOpacity accessibilityRole="button" style={styles.stopSharingButton} disabled={working} onPress={() => {
            Alert.alert('Stop sharing this commitment?', 'Your check-ins and notes will be kept privately.', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Stop sharing', style: 'destructive', onPress: () => {
                setWorking(true);
                void accountabilityClient.archiveCommitment({ commitmentId: commitment.id })
                  .then(() => router.back())
                  .catch((cause: unknown) => Alert.alert('Sharing not changed', cause instanceof Error ? cause.message : 'Please try again.'))
                  .finally(() => setWorking(false));
              } },
            ]);
          }}><Text style={styles.stopSharingText}>Stop sharing</Text></TouchableOpacity>
        ) : null}

        <View style={styles.progressCard} accessibilityLabel={commitment.progressShared ? `${commitment.daysShownUp ?? 0} of the last 14 days shown up for this commitment` : 'Progress is not shared'}>
          <Text style={styles.progressNumber}>{commitment.progressShared ? commitment.daysShownUp ?? 0 : 'Private'}</Text>
          <Text style={styles.progressLabel}>{commitment.progressShared ? 'days shown up in the last 14' : 'progress not shared'}</Text>
          <Text style={styles.progressBody}>{commitment.progressShared ? 'A gentle record of showing up, not a streak or a score.' : 'Your partner chose to keep progress counts private.'}</Text>
        </View>

        {commitment.note && (commitment.isMine || commitment.notesShared) ? (
          <View style={styles.noteCard}>
            <Text style={styles.noteLabel}>{commitment.notesShared ? 'Shared note' : 'Private note'}</Text>
            <Text style={styles.note}>{commitment.note}</Text>
            {commitment.isMine && commitment.notesShared ? (
              <TouchableOpacity accessibilityRole="button" disabled={working} style={styles.privateNoteButton} onPress={() => void perform(
                () => accountabilityClient.setCommitmentNoteSharing({ commitmentId: commitment.id, shared: false }),
                'Note is private'
              )}>
                <Text style={styles.privateNoteText}>Keep this note private</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}

        {commitment.lastCheckInNote ? (
          <View style={styles.noteCard}>
            <Text style={styles.noteLabel}>Latest shared check-in note</Text>
            <Text style={styles.note}>{commitment.lastCheckInNote}</Text>
            {commitment.isMine && commitment.lastCheckInId ? (
              <TouchableOpacity accessibilityRole="button" disabled={working} style={styles.privateNoteButton} onPress={() => void perform(
                () => accountabilityClient.setCheckInNoteSharing({ checkInId: commitment.lastCheckInId!, shared: false }),
                'Check-in note is private'
              )}>
                <Text style={styles.privateNoteText}>Keep this check-in note private</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}

        {commitment.isMine ? (
          <View style={styles.toolCard}>
            <Text style={styles.toolTitle}>Check in</Text>
            <TextInput
              accessibilityLabel="Optional check-in note"
              multiline
              placeholder="Add a note for yourself (optional)"
              placeholderTextColor={Colors.textSecondary}
              style={[styles.input, styles.multiline]}
              value={checkInNote}
              onChangeText={setCheckInNote}
            />
            {checkInNote.trim() ? (
              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Share this note</Text>
                <Switch accessibilityLabel="Share this check-in note" value={shareCheckInNote} onValueChange={setShareCheckInNote} trackColor={{ false: Colors.border, true: Colors.primary }} />
              </View>
            ) : null}
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityHint="Records that you showed up for this commitment today"
              disabled={checkingIn || commitment.checkedInToday}
              style={[styles.button, (checkingIn || commitment.checkedInToday) && styles.disabled]}
              onPress={() => void checkIn()}
            >
              <Text style={styles.buttonText}>{commitment.checkedInToday ? 'Shown up today' : checkingIn ? 'Saving check-in…' : 'I showed up today'}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.toolCard}>
            <Text style={styles.toolTitle}>Support your partner</Text>
            <Text style={styles.toolBody}>Send one gentle prompt. Nudges are rate-limited.</Text>
            <View style={styles.choiceRow}>
              {([
                ['encouragement', 'Encourage'],
                ['check_in', 'Check in'],
                ['celebrate', 'Celebrate'],
              ] as const).map(([kind, label]) => (
                <TouchableOpacity
                  key={kind}
                  accessibilityRole="button"
                  disabled={working}
                  style={styles.choiceButton}
                  onPress={() => void perform(
                    () => accountabilityClient.sendNudge({ connectionId: commitment.connectionId, commitmentId: commitment.id, kind }),
                    'Nudge sent'
                  )}
                >
                  <Text style={styles.choiceText}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.label}>Suggest priority</Text>
            <View style={styles.choiceRow}>
              {(['high', 'medium', 'low'] as const).map((item) => (
                <TouchableOpacity key={item} accessibilityRole="radio" accessibilityState={{ checked: priority === item }} style={[styles.choiceButton, priority === item && styles.choiceActive]} onPress={() => setPriority(item)}>
                  <Text style={[styles.choiceText, priority === item && styles.choiceTextActive]}>{item}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity accessibilityRole="button" disabled={working} style={styles.outlineButton} onPress={() => void perform(
              () => accountabilityClient.createSuggestion({ commitmentId: commitment.id, priority }),
              'Suggestion sent'
            )}>
              <Text style={styles.outlineButtonText}>Send suggestion</Text>
            </TouchableOpacity>
          </View>
        )}

        {commitment.isMine ? (
          <View style={styles.toolCard}>
            <Text style={styles.toolTitle}>Reward to work toward</Text>
            <TextInput accessibilityLabel="Reward" placeholder="A movie night, a favorite meal…" placeholderTextColor={Colors.textSecondary} style={styles.input} value={rewardText} onChangeText={setRewardText} />
            <TouchableOpacity accessibilityRole="button" disabled={working || !rewardText.trim()} style={[styles.outlineButton, (!rewardText.trim() || working) && styles.disabled]} onPress={() => void perform(
              () => accountabilityClient.setReward({ commitmentId: commitment.id, description: rewardText.trim() }),
              'Reward saved'
            )}>
              <Text style={styles.outlineButtonText}>{reward ? 'Update reward' : 'Save reward'}</Text>
            </TouchableOpacity>
          </View>
        ) : reward ? (
          <View style={styles.noteCard}>
            <Text style={styles.noteLabel}>Reward they chose</Text>
            <Text style={styles.note}>{reward.label}</Text>
          </View>
        ) : null}

        {commitment.isMine && suggestions.some((item) => item.status === 'pending') ? (
          <View style={styles.toolCard}>
            <Text style={styles.toolTitle}>Partner suggestions</Text>
            {suggestions.filter((item) => item.status === 'pending').map((item) => (
              <View key={item.id} style={styles.suggestionRow}>
                <Text style={styles.toolBody}>Suggested priority: {item.suggestedPriority}{item.body ? ` · ${item.body}` : ''}</Text>
                <View style={styles.choiceRow}>
                  <TouchableOpacity accessibilityRole="button" disabled={working} style={styles.choiceButton} onPress={() => void perform(() => accountabilityClient.respondToSuggestion({ suggestionId: item.id, approved: true }), 'Priority updated')}><Text style={styles.choiceText}>Accept</Text></TouchableOpacity>
                  <TouchableOpacity accessibilityRole="button" disabled={working} style={styles.choiceButton} onPress={() => void perform(() => accountabilityClient.respondToSuggestion({ suggestionId: item.id, approved: false }), 'Suggestion declined')}><Text style={styles.choiceText}>Decline</Text></TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        ) : null}

        <View style={styles.toolCard}>
          <Text style={styles.toolTitle}>Conversation</Text>
          {comments.length === 0 ? <Text style={styles.toolBody}>No comments yet.</Text> : comments.map((item) => (
            <View key={item.id} style={styles.commentRow}>
              <Text style={styles.commentAuthor}>{item.authorName}</Text>
              <Text style={styles.commentBody}>{item.body}</Text>
            </View>
          ))}
          <TextInput accessibilityLabel="Add a comment" multiline placeholder="Write a supportive comment" placeholderTextColor={Colors.textSecondary} style={[styles.input, styles.multiline]} value={comment} onChangeText={setComment} />
          <TouchableOpacity accessibilityRole="button" disabled={working || !comment.trim()} style={[styles.outlineButton, (!comment.trim() || working) && styles.disabled]} onPress={() => void perform(async () => {
            await accountabilityClient.createComment({ commitmentId: commitment.id, body: comment.trim() });
            setComment('');
          }, 'Comment added')}>
            <Text style={styles.outlineButtonText}>Add comment</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { backgroundColor: Colors.background, flex: 1 },
  content: { padding: 20, paddingBottom: 40 },
  kicker: { color: Colors.primary, fontSize: 13, fontWeight: '700', textTransform: 'uppercase' },
  title: { color: Colors.text, fontSize: 28, fontWeight: '700', lineHeight: 35, marginTop: 8 },
  cadence: { color: Colors.textSecondary, fontSize: 15, marginTop: 8, textTransform: 'capitalize' },
  stopSharingButton: { alignSelf: 'flex-start', justifyContent: 'center', marginTop: 12, minHeight: 44, paddingVertical: 8 },
  stopSharingText: { color: Colors.danger, fontSize: 14, fontWeight: '700' },
  progressCard: { alignItems: 'center', backgroundColor: Colors.primaryLight, borderRadius: 16, marginTop: 24, padding: 24 },
  progressNumber: { color: Colors.primary, fontSize: 44, fontWeight: '800' },
  progressLabel: { color: Colors.text, fontSize: 16, fontWeight: '700', marginTop: 2 },
  progressBody: { color: Colors.textSecondary, fontSize: 13, lineHeight: 19, marginTop: 8, textAlign: 'center' },
  noteCard: { backgroundColor: Colors.card, borderColor: Colors.border, borderRadius: 14, borderWidth: 1, marginTop: 18, padding: 16 },
  noteLabel: { color: Colors.textSecondary, fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  note: { color: Colors.text, fontSize: 15, lineHeight: 22, marginTop: 7 },
  privateNoteButton: { alignSelf: 'flex-start', justifyContent: 'center', minHeight: 44, marginTop: 8 },
  privateNoteText: { color: Colors.primary, fontSize: 14, fontWeight: '700' },
  button: { alignItems: 'center', backgroundColor: Colors.primary, borderRadius: 12, marginTop: 24, paddingVertical: 16 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  disabled: { opacity: 0.55 },
  partnerNotice: { backgroundColor: Colors.card, borderRadius: 12, marginTop: 20, padding: 14 },
  partnerNoticeText: { color: Colors.textSecondary, fontSize: 14, lineHeight: 20, textAlign: 'center' },
  toolCard: { backgroundColor: Colors.card, borderColor: Colors.border, borderRadius: 14, borderWidth: 1, marginTop: 18, padding: 16 },
  toolTitle: { color: Colors.text, fontSize: 17, fontWeight: '700' },
  toolBody: { color: Colors.textSecondary, fontSize: 13, lineHeight: 19, marginTop: 5 },
  input: { backgroundColor: Colors.background, borderColor: Colors.border, borderRadius: 10, borderWidth: 1, color: Colors.text, fontSize: 15, marginTop: 12, padding: 12 },
  multiline: { minHeight: 72, textAlignVertical: 'top' },
  switchRow: { alignItems: 'center', flexDirection: 'row', marginTop: 8 },
  switchLabel: { color: Colors.textSecondary, flex: 1, fontSize: 13 },
  choiceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  choiceButton: { backgroundColor: Colors.background, borderColor: Colors.border, borderRadius: 999, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 9 },
  choiceActive: { backgroundColor: Colors.primaryLight, borderColor: Colors.primary },
  choiceText: { color: Colors.textSecondary, fontSize: 13, fontWeight: '600', textTransform: 'capitalize' },
  choiceTextActive: { color: Colors.primary },
  label: { color: Colors.text, fontSize: 13, fontWeight: '600', marginTop: 18 },
  outlineButton: { alignItems: 'center', borderColor: Colors.primary, borderRadius: 10, borderWidth: 1, marginTop: 12, paddingVertical: 11 },
  outlineButtonText: { color: Colors.primary, fontSize: 14, fontWeight: '700' },
  suggestionRow: { borderTopColor: Colors.border, borderTopWidth: 1, marginTop: 12, paddingTop: 12 },
  commentRow: { backgroundColor: Colors.background, borderRadius: 10, marginTop: 10, padding: 11 },
  commentAuthor: { color: Colors.textSecondary, fontSize: 11, fontWeight: '700' },
  commentBody: { color: Colors.text, fontSize: 14, lineHeight: 20, marginTop: 3 },
});
