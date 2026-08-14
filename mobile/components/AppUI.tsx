import { useEffect, useId, useState, type ComponentProps, type ReactNode } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  InputAccessoryView,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, LARGE_TEXT_SCALE, Radius, Spacing, Typography } from '@/lib/constants';

type FeatherName = ComponentProps<typeof Feather>['name'];

export function AppScreen({
  children,
  scroll = true,
  contentStyle,
}: {
  children: ReactNode;
  scroll?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
}) {
  const content = (
    <View style={[styles.content, contentStyle]}>{children}</View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
      {scroll ? (
        <ScrollView
          style={styles.screen}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {content}
        </ScrollView>
      ) : (
        <View style={styles.screen}>{content}</View>
      )}
    </SafeAreaView>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  icon,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  icon?: FeatherName;
  action?: ReactNode;
}) {
  const { fontScale } = useWindowDimensions();
  const usesStackedHeader = fontScale >= LARGE_TEXT_SCALE;

  return (
    <View style={styles.header}>
      <View style={[styles.headerTop, usesStackedHeader && styles.headerTopStacked]}>
        <View style={[styles.headerCopy, usesStackedHeader && styles.headerCopyStacked]}>
          {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
          <Text accessibilityRole="header" style={styles.title}>{title}</Text>
        </View>
        {action ? <View style={styles.headerAction}>{action}</View> : null}
      </View>
      {description ? <Text style={styles.description}>{description}</Text> : null}
    </View>
  );
}

export function AppCard({
  children,
  style,
  quiet = false,
  tone = 'default',
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  quiet?: boolean;
  tone?: 'default' | 'tinted' | 'outline';
}) {
  return (
    <View
      style={[
        styles.card,
        quiet && styles.quietCard,
        tone === 'tinted' && styles.tintedCard,
        tone === 'outline' && styles.outlineCard,
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function DisclosureCard({
  title,
  description,
  icon,
  expanded,
  onToggle,
  children,
}: {
  title: string;
  description?: string;
  icon?: FeatherName;
  expanded: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <View style={styles.disclosureSection}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={title}
        accessibilityState={{ expanded }}
        onPress={onToggle}
        style={({ pressed }) => [
          styles.disclosureHeader,
          pressed && styles.pressed,
        ]}
      >
        {icon ? (
          <View style={styles.disclosureIcon}>
            <Feather name={icon} size={17} color={Colors.primary} />
          </View>
        ) : null}
        <View style={styles.disclosureCopy}>
          <Text style={styles.disclosureTitle}>{title}</Text>
          {description ? (
            <Text style={styles.disclosureDescription}>{description}</Text>
          ) : null}
        </View>
        <Feather
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={19}
          color={Colors.textSecondary}
        />
      </Pressable>
      {expanded ? <View style={styles.disclosureBody}>{children}</View> : null}
    </View>
  );
}

export function ActionRow({
  actions,
}: {
  actions: readonly {
    label: string;
    icon?: FeatherName;
    onPress: () => void;
    disabled?: boolean;
  }[];
}) {
  return (
    <View style={styles.actionRow}>
      {actions.map((action, index) => (
        <View key={action.label} style={styles.actionRowItem}>
          {index > 0 ? <Text style={styles.actionSeparator}>·</Text> : null}
          <AppButton
            label={action.label}
            icon={action.icon}
            onPress={action.onPress}
            disabled={action.disabled}
            variant="text"
            style={styles.actionRowButton}
          />
        </View>
      ))}
    </View>
  );
}

export function RowGroup({ children }: { children: ReactNode }) {
  return <View style={styles.rowGroup}>{children}</View>;
}

export function SectionHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionCopy}>
        <Text accessibilityRole="header" style={styles.sectionTitle}>{title}</Text>
        {description ? (
          <Text style={styles.sectionDescription}>{description}</Text>
        ) : null}
      </View>
      {action}
    </View>
  );
}

export function SupportAction({ onPress, label = 'Support' }: { onPress: () => void; label?: string }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Open urgent and local support"
      onPress={onPress}
      style={({ pressed }) => [styles.supportAction, pressed && styles.pressed]}
    >
      <Feather name="life-buoy" size={17} color={Colors.accent} />
      <Text style={styles.supportActionText}>{label}</Text>
    </Pressable>
  );
}

export function ListRow({
  title,
  description,
  icon,
  onPress,
  trailing,
  destructive = false,
}: {
  title: string;
  description?: string;
  icon?: FeatherName;
  onPress?: () => void;
  trailing?: ReactNode;
  destructive?: boolean;
}) {
  const content = (
    <>
      {icon ? (
        <View style={[styles.rowIcon, destructive && styles.rowIconDanger]}>
          <Feather
            name={icon}
            size={19}
            color={destructive ? Colors.danger : Colors.primary}
          />
        </View>
      ) : null}
      <View style={styles.rowCopy}>
        <Text style={[styles.rowTitle, destructive && styles.rowTitleDanger]}>
          {title}
        </Text>
        {description ? <Text style={styles.rowDescription}>{description}</Text> : null}
      </View>
      {trailing ?? (onPress ? (
        <Feather name="chevron-right" size={19} color={Colors.textSecondary} />
      ) : null)}
    </>
  );

  if (!onPress) return <View style={styles.listRow}>{content}</View>;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={description}
      onPress={onPress}
      style={({ pressed }) => [styles.listRow, pressed && styles.pressed]}
    >
      {content}
    </Pressable>
  );
}

export function InlineStatus({
  message,
  tone = 'success',
  action,
}: {
  message: string;
  tone?: 'success' | 'error' | 'info';
  action?: ReactNode;
}) {
  const icon = tone === 'error' ? 'alert-circle' : tone === 'success' ? 'check-circle' : 'info';

  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(message);
  }, [message]);

  return (
    <View
      accessibilityRole={tone === 'error' ? 'alert' : 'text'}
      style={[
        styles.inlineStatus,
        tone === 'error' && styles.inlineStatusError,
        tone === 'info' && styles.inlineStatusInfo,
      ]}
    >
      <Feather
        name={icon}
        size={17}
        color={tone === 'error' ? Colors.danger : Colors.primary}
      />
      <Text style={[styles.inlineStatusText, tone === 'error' && styles.inlineStatusTextError]}>
        {message}
      </Text>
      {action}
    </View>
  );
}

export function AppButton({
  label,
  onPress,
  icon,
  variant = 'primary',
  disabled = false,
  loading = false,
  style,
  accessibilityLabel,
}: {
  label: string;
  onPress: () => void;
  icon?: FeatherName;
  variant?: 'primary' | 'secondary' | 'quiet' | 'text' | 'danger';
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}) {
  const foreground =
    variant === 'primary'
      ? Colors.onPrimary
      : variant === 'danger'
        ? Colors.danger
        : Colors.primary;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled, busy: loading }}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        variant === 'primary' && styles.primaryButton,
        variant === 'secondary' && styles.secondaryButton,
        (variant === 'quiet' || variant === 'text') && styles.textButton,
        variant === 'danger' && styles.dangerButton,
        (disabled || loading) && styles.disabled,
        pressed && !(disabled || loading) && styles.pressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={foreground} />
      ) : icon ? (
        <Feather name={icon} size={16} color={foreground} />
      ) : null}
      <Text style={[styles.buttonText, { color: foreground }]}>{label}</Text>
    </Pressable>
  );
}

export function ChoiceChip({
  label,
  accessibilityLabel,
  selected,
  onPress,
  icon,
  disabled = false,
}: {
  label: string;
  accessibilityLabel?: string;
  selected: boolean;
  onPress: () => void;
  icon?: FeatherName;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        selected && styles.chipSelected,
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
      ]}
    >
      {icon ? (
        <Feather
          name={icon}
          size={14}
          color={selected ? Colors.onPrimary : Colors.primary}
        />
      ) : null}
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
        {label}
      </Text>
    </Pressable>
  );
}

export function AppInput({
  label,
  helper,
  error,
  inputStyle,
  ...props
}: ComponentProps<typeof TextInput> & {
  label?: string;
  helper?: string;
  error?: string;
  inputStyle?: StyleProp<TextStyle>;
}) {
  const [focused, setFocused] = useState(false);
  const generatedAccessoryId = `app-input-${useId().replace(/:/g, '')}`;
  const usesNumericKeyboard = [
    'decimal-pad',
    'number-pad',
    'numeric',
    'phone-pad',
  ].includes(props.keyboardType ?? '');
  const needsKeyboardDismiss =
    Platform.OS === 'ios' && (usesNumericKeyboard || props.multiline === true);
  const accessoryId =
    props.inputAccessoryViewID ??
    (needsKeyboardDismiss ? generatedAccessoryId : undefined);

  return (
    <View style={styles.inputGroup}>
      {label ? <Text style={styles.inputLabel}>{label}</Text> : null}
      <TextInput
        {...props}
        onBlur={(event) => {
          setFocused(false);
          props.onBlur?.(event);
        }}
        onFocus={(event) => {
          setFocused(true);
          props.onFocus?.(event);
        }}
        inputAccessoryViewID={accessoryId}
        accessibilityLabel={props.accessibilityLabel ?? label}
        placeholderTextColor={Colors.textSecondary}
        style={[
          styles.input,
          focused && styles.inputFocused,
          error && styles.inputError,
          props.multiline && styles.multiline,
          inputStyle,
        ]}
      />
      {needsKeyboardDismiss && !props.inputAccessoryViewID ? (
        <InputAccessoryView nativeID={generatedAccessoryId}>
          <View style={styles.keyboardToolbar}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Dismiss keyboard"
              onPress={Keyboard.dismiss}
              style={({ pressed }) => [
                styles.keyboardDone,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.keyboardDoneText}>Done</Text>
            </Pressable>
          </View>
        </InputAccessoryView>
      ) : null}
      {helper ? <Text style={styles.helper}>{helper}</Text> : null}
      {error ? (
        <Text accessibilityLiveRegion="polite" style={styles.errorText}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

export function Stat({
  label,
  value,
  suffix,
}: {
  label: string;
  value: string | number;
  suffix?: string;
}) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>
        {value}
        {suffix ? <Text style={styles.statSuffix}> {suffix}</Text> : null}
      </Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: FeatherName;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <AppCard style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Feather name={icon} size={22} color={Colors.primary} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyDescription}>{description}</Text>
      {action ? <View style={styles.emptyAction}>{action}</View> : null}
    </AppCard>
  );
}

export const appUiStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  muted: { color: Colors.textSecondary, fontSize: 13, lineHeight: 19 },
  body: { color: Colors.text, fontSize: 15, lineHeight: 22 },
  label: {
    color: Colors.textSecondary,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  error: { color: Colors.danger, fontSize: 13, lineHeight: 19 },
  success: { color: Colors.success, fontSize: 13, lineHeight: 19 },
});

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  screen: { flex: 1, backgroundColor: Colors.background },
  scrollContent: { flexGrow: 1 },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: 44,
  },
  header: { marginBottom: Spacing.lg },
  headerTop: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  headerTopStacked: {
    flexDirection: 'column',
    alignItems: 'stretch',
  },
  headerCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 220, minWidth: 0 },
  headerCopyStacked: { flexBasis: 'auto', width: '100%' },
  headerAction: { alignSelf: 'flex-start', flexShrink: 0 },
  eyebrow: {
    color: Colors.accent,
    ...Typography.eyebrow,
    textTransform: 'uppercase',
    marginBottom: Spacing.xs,
  },
  title: {
    color: Colors.text,
    ...Typography.display,
  },
  description: {
    color: Colors.textSecondary,
    ...Typography.body,
    marginTop: Spacing.xxs,
    maxWidth: 620,
  },
  card: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  quietCard: {
    backgroundColor: Colors.surfaceMuted,
  },
  tintedCard: {
    backgroundColor: Colors.primaryLight,
    borderColor: Colors.borderTinted,
  },
  outlineCard: {
    backgroundColor: 'transparent',
    borderColor: Colors.borderStrong,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  sectionCopy: { flex: 1 },
  sectionTitle: {
    color: Colors.text,
    ...Typography.sectionTitle,
  },
  sectionDescription: {
    color: Colors.textSecondary,
    ...Typography.bodySmall,
    marginTop: 4,
  },
  supportAction: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: Radius.pill,
    backgroundColor: 'transparent',
    paddingHorizontal: 12,
  },
  supportActionText: { color: Colors.accent, fontSize: 12, fontWeight: '700' },
  listRow: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  rowIcon: {
    width: 42,
    height: 42,
    borderRadius: Radius.pill,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowIconDanger: { backgroundColor: Colors.dangerLight },
  rowCopy: { flex: 1, minWidth: 0 },
  rowTitle: { color: Colors.text, ...Typography.cardTitle },
  rowTitleDanger: { color: Colors.danger },
  rowDescription: {
    color: Colors.textSecondary,
    ...Typography.bodySmall,
    lineHeight: 18,
    marginTop: 2,
  },
  inlineStatus: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    borderRadius: Radius.md,
    backgroundColor: Colors.successLight,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  inlineStatusError: { backgroundColor: Colors.dangerLight },
  inlineStatusInfo: { backgroundColor: Colors.primaryLight },
  inlineStatusText: { flex: 1, color: Colors.text, ...Typography.bodySmall },
  inlineStatusTextError: { color: Colors.danger },
  button: {
    minHeight: 48,
    borderRadius: Radius.md,
    paddingHorizontal: 17,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
  },
  primaryButton: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  secondaryButton: {
    backgroundColor: Colors.card,
    borderColor: Colors.borderStrong,
  },
  textButton: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
  },
  dangerButton: {
    backgroundColor: Colors.dangerLight,
    borderColor: Colors.borderDanger,
  },
  buttonText: { fontSize: 14, fontWeight: '700' },
  disabled: { opacity: 0.48 },
  pressed: { opacity: 0.72 },
  chip: {
    minHeight: 44,
    minWidth: 44,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.borderStrong,
    backgroundColor: Colors.card,
    paddingHorizontal: 13,
    paddingVertical: 7,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  chipSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  chipText: { color: Colors.primary, fontSize: 12, fontWeight: '600' },
  chipTextSelected: { color: Colors.onPrimary },
  inputGroup: { marginBottom: 14 },
  inputLabel: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 7,
  },
  input: {
    minHeight: 48,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.borderStrong,
    backgroundColor: Colors.card,
    color: Colors.text,
    paddingHorizontal: 13,
    paddingVertical: 11,
    fontSize: 15,
  },
  multiline: { minHeight: 112, textAlignVertical: 'top' },
  inputFocused: { borderColor: Colors.primary, borderWidth: 2 },
  inputError: { borderColor: Colors.danger },
  helper: {
    color: Colors.textSecondary,
    fontSize: 12,
    lineHeight: 16,
    marginTop: 5,
  },
  errorText: {
    color: Colors.danger,
    ...Typography.caption,
    marginTop: Spacing.xxs,
  },
  keyboardToolbar: {
    minHeight: 44,
    alignItems: 'flex-end',
    justifyContent: 'center',
    backgroundColor: Colors.surfaceKeyboard,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
    paddingHorizontal: 12,
  },
  keyboardDone: {
    minWidth: 64,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
  },
  keyboardDoneText: { color: Colors.primary, fontSize: 15, fontWeight: '700' },
  stat: { flex: 1, minWidth: 86 },
  statValue: {
    color: Colors.text,
    fontSize: 25,
    lineHeight: 29,
    fontWeight: '700',
  },
  statSuffix: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '500',
  },
  statLabel: { color: Colors.textSecondary, fontSize: 12, lineHeight: 16, marginTop: 3 },
  empty: { alignItems: 'center', paddingVertical: 28 },
  emptyIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: '700',
    marginTop: 13,
  },
  emptyDescription: {
    color: Colors.textSecondary,
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: 6,
    maxWidth: 320,
  },
  emptyAction: { marginTop: 16 },
  disclosureSection: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  disclosureHeader: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  disclosureIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disclosureCopy: { flex: 1, minWidth: 0 },
  disclosureTitle: {
    color: Colors.text,
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '700',
  },
  disclosureDescription: {
    color: Colors.textSecondary,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2,
  },
  disclosureBody: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.md,
  },
  actionRow: {
    minHeight: 44,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionRowItem: { flexDirection: 'row', alignItems: 'center' },
  actionSeparator: { color: Colors.borderStrong, ...Typography.body },
  actionRowButton: { minHeight: 44, paddingHorizontal: Spacing.sm },
  rowGroup: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
});
