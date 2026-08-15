import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '../lib/constants';
import {
  createWeeklyInsight,
  type WeeklyOwnerSummary,
} from '../lib/weekly-insights';

type WeeklyInsightProps = {
  summary: WeeklyOwnerSummary;
};

export function WeeklyInsight({ summary }: WeeklyInsightProps) {
  const router = useRouter();
  const insight = createWeeklyInsight(summary);
  if (insight.totalObservations === 0) return null;

  return (
    <View
      accessibilityLabel={`${insight.heading}, ${insight.periodLabel}`}
      style={styles.card}
    >
      <Text style={styles.eyebrow}>WEEKLY INSIGHT</Text>
      <Text style={styles.title}>{insight.heading}</Text>
      <Text style={styles.period}>{insight.periodLabel}</Text>

      <View style={styles.counts}>
        {insight.counts.map((count) => (
          <View key={count.feature} style={styles.countCard}>
            <Text style={styles.countValue}>{count.value}</Text>
            <Text style={styles.countLabel}>{count.label}</Text>
          </View>
        ))}
      </View>

      {insight.question ? (
        <View style={styles.questionCard}>
          <Text style={styles.question}>{insight.question}</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() =>
              router.push({
                pathname: '/reflect',
                params: { mode: 'weekly-patterns' },
              })
            }
          >
            <Text style={styles.reflectLink}>Reflect on this week</Text>
          </Pressable>
        </View>
      ) : null}

    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.card,
    borderColor: Colors.border,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 16,
    overflow: 'hidden',
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  eyebrow: {
    color: Colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.4,
  },
  title: {
    color: Colors.text,
    fontSize: 21,
    fontWeight: '700',
    marginTop: 4,
  },
  period: {
    color: Colors.textSecondary,
    fontSize: 12,
    marginTop: 3,
  },
  counts: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 16,
  },
  countCard: {
    backgroundColor: Colors.background,
    borderColor: Colors.border,
    borderRadius: 12,
    borderWidth: 1,
    minWidth: '47%',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  countValue: {
    color: Colors.text,
    fontSize: 20,
    fontWeight: '700',
  },
  countLabel: {
    color: Colors.textSecondary,
    fontSize: 12,
    lineHeight: 16,
    marginTop: 1,
  },
  questionCard: {
    backgroundColor: Colors.primaryLight,
    borderRadius: 12,
    marginTop: 14,
    padding: 12,
  },
  question: { color: Colors.text, fontSize: 14, lineHeight: 20 },
  reflectLink: {
    color: Colors.primary,
    fontSize: 13,
    fontWeight: '700',
    marginTop: 8,
    textDecorationLine: 'underline',
  },
});
