import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth-context';
import {
  AppButton,
  AppScreen,
  ChoiceChip,
  InlineStatus,
  ListRow,
  PageHeader,
  SectionHeader,
} from '@/components/AppUI';
import { DashboardLayoutRow } from '@/components/DashboardLayoutRow';
import {
  DASHBOARD_PRESET_OPTIONS,
  MAX_DASHBOARD_MODULES,
  MIN_DASHBOARD_MODULES,
  applyDashboardPreset,
  dashboardModuleById,
  moveDashboardModule,
  setDashboardModuleEnabled,
} from '@/lib/dashboard-layout';
import { useDashboardLayout } from '@/lib/use-dashboard-layout';
import { Colors, Spacing, Typography } from '@/lib/constants';

export default function DashboardLayoutScreen() {
  const router = useRouter();
  const { user, sessionId, isAuthenticated } = useAuth();
  const queryValue = isAuthenticated ? user?.id : sessionId;
  const ownerKey = queryValue
    ? `${isAuthenticated ? 'user_id' : 'session_id'}:${queryValue}`
    : null;
  const { layout, ready, loading, error, updateLayout } = useDashboardLayout(ownerKey);
  const [dragging, setDragging] = useState(false);

  const moveModule = (
    fromIndex: number,
    toIndex: number,
    _method: 'drag' | 'button'
  ) => {
    void updateLayout(moveDashboardModule(layout, fromIndex, toIndex));
  };

  const applyPreset = (presetId: 'mixed' | 'productivity' | 'mental_health' | 'growth') => {
    void updateLayout(applyDashboardPreset(presetId));
  };

  return (
    <AppScreen scrollEnabled={!dragging}>
      <PageHeader
        eyebrow="YOUR DAY"
        title="Make Today yours"
        description="Choose a starting point, then add and arrange the tools that help."
      />

      {error ? <InlineStatus tone="error" message={error} /> : null}
      {loading ? <InlineStatus tone="info" message="Loading your layout…" /> : null}

      <View style={styles.section}>
        <SectionHeader
          title="Start with a template"
          description="Applying one replaces the current order. You can change it afterward."
        />
        <View style={styles.presetGrid}>
          {DASHBOARD_PRESET_OPTIONS.map((preset) => (
            <ChoiceChip
              key={preset.id}
              label={preset.title}
              accessibilityLabel={`${preset.title}. ${preset.description}`}
              selected={layout.presetId === preset.id}
              disabled={!ready}
              onPress={() => applyPreset(preset.id)}
            />
          ))}
        </View>
        <Text style={styles.presetDescription}>
          {layout.presetId === 'custom'
            ? 'Custom layout'
            : DASHBOARD_PRESET_OPTIONS.find((option) => option.id === layout.presetId)?.description}
        </Text>
      </View>

      <View style={styles.section}>
        <SectionHeader
          title="On your Today page"
          description="Long press and drag, or use the arrows."
          action={(
            <Text style={styles.count}>
              {layout.moduleIds.length} of {MAX_DASHBOARD_MODULES}
            </Text>
          )}
        />

        <View>
          {layout.moduleIds.map((moduleId, index) => {
            const module = dashboardModuleById(moduleId);
            const isAdvisor = moduleId === 'advisor';
            return (
              <DashboardLayoutRow
                key={moduleId}
                title={isAdvisor ? 'Advisor' : module?.title ?? moduleId}
                description={
                  isAdvisor
                    ? 'Your next useful step.'
                    : module?.description
                }
                icon={isAdvisor ? null : module?.icon ?? null}
                index={index}
                total={layout.moduleIds.length}
                locked={isAdvisor}
                disabled={!ready}
                onMove={moveModule}
                onRemove={
                  !isAdvisor && layout.moduleIds.length > MIN_DASHBOARD_MODULES
                    ? () => {
                        void updateLayout(
                          setDashboardModuleEnabled(layout, moduleId, false)
                        );
                      }
                    : undefined
                }
                onDragStateChange={setDragging}
              />
            );
          })}
        </View>

        <ListRow
          icon="plus-circle"
          title="Add tools"
          description="Choose from all available MHtoolkit tools."
          onPress={() => router.push('/dashboard-tools' as never)}
        />
      </View>

      <AppButton
        label="Reset to Mixed"
        icon="rotate-ccw"
        variant="text"
        disabled={!ready || layout.presetId === 'mixed'}
        onPress={() => {
          Alert.alert(
            'Reset your Today page?',
            'This replaces your current tool order with the Mixed template.',
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Reset',
                onPress: () => void updateLayout(applyDashboardPreset('mixed')),
              },
            ]
          );
        }}
      />
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: Spacing.xl },
  presetGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginTop: Spacing.sm,
  },
  presetDescription: {
    color: Colors.textSecondary,
    ...Typography.bodySmall,
    marginTop: Spacing.sm,
  },
  count: { color: Colors.textSecondary, ...Typography.caption },
});
