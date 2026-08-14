import { useState } from 'react';
import {
  type DimensionValue,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import {
  type AdvisorTrendArea,
  type AdvisorTrendSummary,
} from '@/lib/advisor-core';
import { Colors, Radius, Spacing, Typography } from '@/lib/constants';

type AdvisorTrendCardProps = {
  trend: AdvisorTrendSummary;
  onTalkThrough: () => void;
};

const MILESTONE_SIZE = 25;
const SEGMENT_SIZE = 5;

function comparisonLabel(trend: AdvisorTrendSummary): string {
  const { delta, weeklyPoints } = trend.momentum;
  if (delta === null) return 'Weekly XP comparison forming';
  if (delta > 0) return `${weeklyPoints} XP latest week · ${delta} more than prior`;
  if (delta < 0) return `${weeklyPoints} XP latest week · ${Math.abs(delta)} fewer than prior`;
  return `${weeklyPoints} XP latest week · level with prior`;
}

function comparisonIcon(delta: number | null): 'clock' | 'trending-up' | 'trending-down' | 'minus' {
  if (delta === null) return 'clock';
  if (delta > 0) return 'trending-up';
  if (delta < 0) return 'trending-down';
  return 'minus';
}

function baselineState(area: AdvisorTrendArea): string {
  if (!area.meter) return 'No data yet';
  if (area.level === 'similar') return 'Typical for you';
  return area.meter.position < 0.5
    ? 'Lower than your baseline'
    : 'Higher than your baseline';
}

function segmentFill(pointsInLevel: number, index: number): DimensionValue {
  const segmentStart = index * SEGMENT_SIZE;
  const fill = Math.max(0, Math.min(SEGMENT_SIZE, pointsInLevel - segmentStart));
  return `${Math.round((fill / SEGMENT_SIZE) * 100)}%` as DimensionValue;
}

export function AdvisorTrendCard({ trend, onTalkThrough }: AdvisorTrendCardProps) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const momentumAvailable = trend.momentum.availability === 'available';
  const habitArea = trend.areas.find((area) => area.id === 'habits');
  const checkInArea = trend.areas.find((area) => area.id === 'check-ins');
  const contextAreas = trend.areas.filter(
    (area) => area.id === 'sleep' || area.id === 'movement'
  );
  const pointsInLevel = Math.round(trend.momentum.milestoneProgress * MILESTONE_SIZE);

  return (
    <View style={styles.card}>
      <View style={styles.hero}>
        <View style={styles.heroTopRow}>
          <View style={styles.heroCopy}>
            <Text style={styles.eyebrow}>YOUR MOMENTUM</Text>
            <Text accessibilityRole="header" style={styles.status}>
              {trend.momentum.status}
            </Text>
          </View>
          <View
            accessible
            accessibilityLabel={momentumAvailable
              ? `${trend.momentum.points} lifetime experience points`
              : trend.momentum.status}
            style={styles.pointsBlock}
          >
            <Text style={styles.points}>
              {momentumAvailable ? trend.momentum.points : '—'}
            </Text>
            <Text style={styles.pointsLabel}>TOTAL XP</Text>
          </View>
        </View>

        {momentumAvailable ? (
          <View
            accessible
            accessibilityLabel={`${trend.momentum.pointsToNextMilestone} experience points to level ${trend.momentum.level + 1}`}
            accessibilityValue={{
              min: 0,
              max: MILESTONE_SIZE,
              now: pointsInLevel,
              text: `${trend.momentum.pointsToNextMilestone} experience points to go`,
            }}
            style={styles.levelBlock}
          >
            <View style={styles.levelHeader}>
              <Text style={styles.levelLabel}>Progress to Level {trend.momentum.level + 1}</Text>
              <Text style={styles.levelValue}>{trend.momentum.pointsToNextMilestone} XP to go</Text>
            </View>
            <View style={styles.segmentRow}>
              {Array.from({ length: MILESTONE_SIZE / SEGMENT_SIZE }).map((_, index) => (
                <View key={index} style={styles.segmentTrack}>
                  <View
                    style={[
                      styles.segmentFill,
                      { width: segmentFill(pointsInLevel, index) },
                    ]}
                  />
                </View>
              ))}
            </View>
          </View>
        ) : (
          <Text style={styles.unavailableText}>
            {trend.momentum.availability === 'signed-out'
              ? 'Start a private session or sign in to build a level.'
              : 'Your saved activity is unchanged. Try again later.'}
          </Text>
        )}

        {momentumAvailable && trend.momentum.unlockedMilestone > 0 ? (
          <View style={styles.unlockedRow}>
            <Feather color={Colors.accent} name="award" size={16} />
            <Text style={styles.unlockedText}>
              {trend.momentum.unlockedMilestone} XP unlocked
            </Text>
          </View>
        ) : null}

        {momentumAvailable ? <View style={styles.comparisonPill}>
          <Feather
            accessibilityElementsHidden
            importantForAccessibility="no"
            color={Colors.primary}
            name={comparisonIcon(trend.momentum.delta)}
            size={16}
          />
          <Text style={styles.comparisonText}>{comparisonLabel(trend)}</Text>
        </View> : null}
      </View>

      <View style={styles.statsSection}>
        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>Latest complete week</Text>
            <Text style={styles.sectionDescription}>Actions and reflection, kept separate</Text>
          </View>
        </View>

        {[habitArea, checkInArea].filter(Boolean).map((area, index) => {
          const safeArea = area!;
          const progress = safeArea.meter?.position ?? 0;
          const width = `${Math.round(progress * 100)}%` as DimensionValue;
          const isHabit = safeArea.id === 'habits';
          return (
            <View
              key={safeArea.id}
              accessible
              accessibilityLabel={`${safeArea.label}. ${safeArea.meter?.label ?? 'No recent data'}. ${isHabit ? 'Habit check-offs earn experience points.' : 'Check-ins do not affect experience points.'}`}
              accessibilityValue={{
                min: 0,
                max: 100,
                now: Math.round(progress * 100),
                text: safeArea.meter?.label ?? 'No recent data',
              }}
              style={[styles.statRow, index > 0 && styles.divider]}
            >
              <View style={styles.statIcon}>
                <Feather
                  color={isHabit ? Colors.primary : Colors.textSecondary}
                  name={isHabit ? 'check-circle' : 'edit-3'}
                  size={18}
                />
              </View>
              <View style={styles.statMain}>
                <View style={styles.statHeader}>
                  <Text style={styles.statLabel}>{safeArea.label}</Text>
                  <Text style={styles.statValue}>{safeArea.meter?.label ?? 'Not started'}</Text>
                </View>
                <View style={styles.statTrack}>
                  <View
                    style={[
                      styles.statFill,
                      !isHabit && styles.contextFill,
                      { width },
                    ]}
                  />
                </View>
              </View>
              <Text style={isHabit ? styles.xpChip : styles.contextChip}>
                {isHabit && momentumAvailable ? '10 XP each' : 'Context'}
              </Text>
            </View>
          );
        })}
      </View>

      <View style={styles.signalSection}>
        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>Body signals</Text>
            <Text style={styles.sectionDescription}>Compared with your personal baseline</Text>
          </View>
          <Text style={styles.contextLabel}>CONTEXT</Text>
        </View>
        {contextAreas.map((area, index) => {
          const position = `${Math.round((area.meter?.position ?? 0.5) * 100)}%` as DimensionValue;
          return (
            <View
              key={area.id}
              accessible
              accessibilityLabel={`${area.label}. ${baselineState(area)}. ${area.meter?.label ?? 'No recent data'}. Does not affect experience points.`}
              style={[styles.signalRow, index > 0 && styles.divider]}
            >
              <View style={styles.statIcon}>
                <Feather
                  color={Colors.textSecondary}
                  name={area.id === 'sleep' ? 'moon' : 'activity'}
                  size={18}
                />
              </View>
              <View style={styles.statMain}>
                <View style={styles.statHeader}>
                  <Text style={styles.statLabel}>{area.label}</Text>
                  <Text style={styles.signalValue}>{baselineState(area)}</Text>
                </View>
                <View style={styles.baselineTrack}>
                  <View style={styles.baselineMark} />
                  {area.meter ? <View style={[styles.currentMark, { left: position }]} /> : null}
                </View>
              </View>
            </View>
          );
        })}
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="How momentum works"
        accessibilityHint={detailsOpen ? 'Collapses explanation' : 'Expands explanation'}
        accessibilityState={{ expanded: detailsOpen }}
        onPress={() => setDetailsOpen((current) => !current)}
        style={({ pressed }) => [styles.disclosure, pressed && styles.pressed]}
      >
        <Text style={styles.disclosureTitle}>How momentum works</Text>
        <Feather
          accessibilityElementsHidden
          importantForAccessibility="no"
          color={Colors.textSecondary}
          name={detailsOpen ? 'chevron-up' : 'chevron-down'}
          size={21}
        />
      </Pressable>

      {detailsOpen ? (
        <View style={styles.details}>
          <Text style={styles.detailText}>
            Saved habit check-offs earn XP. Check-ins, feelings, sleep, and movement never raise or lower your level.
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open AI support"
            onPress={onTalkThrough}
            style={({ pressed }) => [styles.talkAction, pressed && styles.pressed]}
          >
            <Feather color={Colors.primary} name="message-circle" size={18} />
            <Text style={styles.talkLabel}>Ask Advisor about these signals</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: Colors.card, borderColor: Colors.borderTinted, borderRadius: Radius.lg, borderWidth: 1, marginBottom: Spacing.md, overflow: 'hidden' },
  hero: { backgroundColor: Colors.primaryLight, padding: Spacing.md },
  heroTopRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  heroCopy: { flex: 1, minWidth: 0 },
  eyebrow: { color: Colors.accent, ...Typography.eyebrow },
  status: { color: Colors.text, fontFamily: 'Georgia', fontSize: 25, fontWeight: '700', marginTop: 3 },
  pointsBlock: { alignItems: 'flex-end', marginLeft: Spacing.sm },
  points: { color: Colors.primary, fontFamily: 'Georgia', fontSize: 40, fontWeight: '700', lineHeight: 42 },
  pointsLabel: { color: Colors.textSecondary, ...Typography.eyebrow },
  levelBlock: { marginTop: Spacing.md },
  unavailableText: { color: Colors.textSecondary, ...Typography.bodySmall, lineHeight: 20, marginTop: Spacing.md },
  levelHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  levelLabel: { color: Colors.text, ...Typography.label },
  levelValue: { color: Colors.primary, ...Typography.label },
  segmentRow: { flexDirection: 'row', gap: 5, marginTop: Spacing.xs },
  segmentTrack: { backgroundColor: Colors.card, borderRadius: Radius.pill, flex: 1, height: 15, overflow: 'hidden' },
  segmentFill: { backgroundColor: Colors.accent, borderRadius: Radius.pill, height: '100%' },
  unlockedRow: { alignItems: 'center', flexDirection: 'row', gap: Spacing.xs, marginTop: Spacing.sm },
  unlockedText: { color: Colors.primary, ...Typography.caption, fontWeight: '700' },
  comparisonPill: { alignItems: 'center', alignSelf: 'flex-start', backgroundColor: Colors.card, borderRadius: Radius.pill, flexDirection: 'row', gap: Spacing.xs, marginTop: Spacing.sm, paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs },
  comparisonText: { color: Colors.primary, ...Typography.caption, fontWeight: '700' },
  statsSection: { padding: Spacing.md },
  signalSection: { borderTopColor: Colors.borderTinted, borderTopWidth: StyleSheet.hairlineWidth, padding: Spacing.md },
  sectionHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  sectionTitle: { color: Colors.text, ...Typography.cardTitle },
  sectionDescription: { color: Colors.textSecondary, ...Typography.caption, marginTop: 2 },
  contextLabel: { color: Colors.textSecondary, ...Typography.eyebrow },
  statRow: { alignItems: 'center', flexDirection: 'row', gap: Spacing.sm, paddingTop: Spacing.sm },
  signalRow: { alignItems: 'center', flexDirection: 'row', gap: Spacing.sm, paddingTop: Spacing.sm },
  divider: { borderTopColor: Colors.border, borderTopWidth: StyleSheet.hairlineWidth, marginTop: Spacing.sm },
  statIcon: { alignItems: 'center', backgroundColor: Colors.surfaceMuted, borderRadius: Radius.pill, height: 36, justifyContent: 'center', width: 36 },
  statMain: { flex: 1, minWidth: 0 },
  statHeader: { alignItems: 'center', flexDirection: 'row', gap: Spacing.xs, justifyContent: 'space-between' },
  statLabel: { color: Colors.text, ...Typography.label },
  statValue: { color: Colors.textSecondary, ...Typography.caption },
  statTrack: { backgroundColor: Colors.surfaceMuted, borderRadius: Radius.pill, height: 9, marginTop: 6, overflow: 'hidden' },
  statFill: { backgroundColor: Colors.primary, borderRadius: Radius.pill, height: '100%' },
  contextFill: { backgroundColor: Colors.sage },
  xpChip: { backgroundColor: Colors.primaryLight, borderRadius: Radius.pill, color: Colors.primary, ...Typography.caption, fontWeight: '700', overflow: 'hidden', paddingHorizontal: Spacing.xs, paddingVertical: 3 },
  contextChip: { backgroundColor: Colors.surfaceMuted, borderRadius: Radius.pill, color: Colors.textSecondary, ...Typography.caption, overflow: 'hidden', paddingHorizontal: Spacing.xs, paddingVertical: 3 },
  signalValue: { color: Colors.textSecondary, ...Typography.caption },
  baselineTrack: { backgroundColor: Colors.surfaceMuted, borderRadius: Radius.pill, height: 9, marginTop: 6, overflow: 'visible', position: 'relative' },
  baselineMark: { backgroundColor: Colors.borderStrong, height: 15, left: '50%', position: 'absolute', top: -3, width: 2 },
  currentMark: { backgroundColor: Colors.primary, borderColor: Colors.card, borderRadius: 6, borderWidth: 2, height: 12, marginLeft: -6, position: 'absolute', top: -2, width: 12 },
  disclosure: { alignItems: 'center', borderTopColor: Colors.borderTinted, borderTopWidth: StyleSheet.hairlineWidth, flexDirection: 'row', justifyContent: 'space-between', minHeight: 56, paddingHorizontal: Spacing.md },
  disclosureTitle: { color: Colors.text, ...Typography.label },
  details: { borderTopColor: Colors.border, borderTopWidth: StyleSheet.hairlineWidth, padding: Spacing.md },
  detailText: { color: Colors.textSecondary, ...Typography.bodySmall, lineHeight: 20 },
  talkAction: { alignItems: 'center', flexDirection: 'row', gap: Spacing.xs, marginTop: Spacing.sm, minHeight: 44 },
  talkLabel: { color: Colors.primary, ...Typography.label },
  pressed: { opacity: 0.72 },
});
