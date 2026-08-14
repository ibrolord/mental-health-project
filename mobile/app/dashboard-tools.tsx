import { StyleSheet, Text, View, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '@/lib/auth-context';
import { AppScreen, InlineStatus, PageHeader } from '@/components/AppUI';
import {
  DASHBOARD_MODULES,
  MAX_DASHBOARD_MODULES,
  MIN_DASHBOARD_MODULES,
  setDashboardModuleEnabled,
} from '@/lib/dashboard-layout';
import { useDashboardLayout } from '@/lib/use-dashboard-layout';
import { Colors, Radius, Spacing, Typography } from '@/lib/constants';

export default function DashboardToolsScreen() {
  const { user, sessionId, isAuthenticated } = useAuth();
  const queryValue = isAuthenticated ? user?.id : sessionId;
  const ownerKey = queryValue
    ? `${isAuthenticated ? 'user_id' : 'session_id'}:${queryValue}`
    : null;
  const { layout, ready, loading, error, updateLayout } = useDashboardLayout(ownerKey);
  const atLimit = layout.moduleIds.length >= MAX_DASHBOARD_MODULES;
  const atMinimum = layout.moduleIds.length <= MIN_DASHBOARD_MODULES;

  return (
    <AppScreen>
      <PageHeader
        eyebrow="YOUR DAY"
        title="Add tools"
        description={`Choose up to ${MAX_DASHBOARD_MODULES - 1} tools. Advisor always stays first.`}
      />

      {error ? <InlineStatus tone="error" message={error} /> : null}
      {loading ? <InlineStatus tone="info" message="Loading your tools…" /> : null}
      {atLimit ? (
        <InlineStatus
          tone="info"
          message="Your Today page is full. Remove a tool before adding another."
        />
      ) : null}
      {atMinimum ? (
        <InlineStatus
          tone="info"
          message="Keep at least one tool with Advisor. Add another before removing this one."
        />
      ) : null}

      <View style={styles.catalog}>
        {DASHBOARD_MODULES.map((module) => {
          const selected = layout.moduleIds.includes(module.id);
          const disabled =
            !ready ||
            (!selected && atLimit) ||
            (selected && atMinimum);
          return (
            <Pressable
              key={module.id}
              accessibilityRole="checkbox"
              accessibilityLabel={module.title}
              accessibilityHint={module.description}
              accessibilityState={{ checked: selected, disabled }}
              disabled={disabled}
              onPress={() => {
                void updateLayout(
                  setDashboardModuleEnabled(layout, module.id, !selected)
                );
              }}
              style={({ pressed }) => [
                styles.toolRow,
                disabled && styles.disabled,
                pressed && !disabled && styles.pressed,
              ]}
            >
              <View style={styles.icon}>
                <Feather name={module.icon} size={19} color={Colors.primary} />
              </View>
              <View style={styles.copy}>
                <Text style={styles.title}>{module.title}</Text>
                <Text style={styles.description}>{module.description}</Text>
              </View>
              <View style={[styles.check, selected && styles.checkSelected]}>
                {selected ? (
                  <Feather name="check" size={16} color={Colors.onPrimary} />
                ) : null}
              </View>
            </Pressable>
          );
        })}
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  catalog: {
    borderWidth: 1,
    borderColor: Colors.borderTinted,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    marginBottom: Spacing.xl,
  },
  toolRow: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderTinted,
    backgroundColor: Colors.card,
  },
  icon: {
    width: 38,
    height: 38,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primaryLight,
  },
  copy: { flex: 1, minWidth: 0 },
  title: { color: Colors.text, ...Typography.label },
  description: { color: Colors.textSecondary, ...Typography.bodySmall },
  check: {
    width: 28,
    height: 28,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.72 },
});
