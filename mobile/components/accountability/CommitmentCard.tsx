import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors } from '@/lib/constants';
import type { SharedCommitment } from '@/lib/accountability/types';

interface CommitmentCardProps {
  commitment: SharedCommitment;
  onPress: () => void;
}

export function CommitmentCard({ commitment, onPress }: CommitmentCardProps) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={`${commitment.title}, ${commitment.isMine ? 'your commitment' : `${commitment.ownerName}'s commitment`}`}
      accessibilityHint="Opens commitment details and progress"
      style={styles.card}
      onPress={onPress}
    >
      <View style={styles.headingRow}>
        <Text style={styles.title} numberOfLines={2}>{commitment.title}</Text>
        <Text style={[styles.badge, commitment.checkedInToday && styles.badgeDone]}>
          {commitment.checkedInToday ? 'Shown up today' : commitment.cadence}
        </Text>
      </View>
      <Text style={styles.owner}>{commitment.isMine ? 'Mine' : commitment.ownerName}</Text>
      {commitment.progressShared && typeof commitment.daysShownUp === 'number' ? (
        <Text style={styles.progress}>{commitment.daysShownUp} of the last 14 days shown up</Text>
      ) : <Text style={styles.private}>Progress not shared</Text>}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: Colors.card, borderColor: Colors.border, borderRadius: 14, borderWidth: 1, marginBottom: 12, padding: 16 },
  headingRow: { alignItems: 'flex-start', flexDirection: 'row', gap: 10, justifyContent: 'space-between' },
  title: { color: Colors.text, flex: 1, fontSize: 17, fontWeight: '700', lineHeight: 23 },
  owner: { color: Colors.textSecondary, fontSize: 13, marginTop: 8 },
  progress: { color: Colors.primary, fontSize: 14, fontWeight: '600', marginTop: 10 },
  private: { color: Colors.textSecondary, fontSize: 13, fontWeight: '600', marginTop: 10 },
  badge: { backgroundColor: Colors.primaryLight, borderRadius: 999, color: Colors.primary, fontSize: 11, fontWeight: '700', overflow: 'hidden', paddingHorizontal: 9, paddingVertical: 5, textTransform: 'capitalize' },
  badgeDone: { backgroundColor: Colors.successLight, color: '#15803d' },
});
