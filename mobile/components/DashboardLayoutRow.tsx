import { useCallback, useMemo, useRef, useState, type ComponentProps } from 'react';
import {
  AccessibilityInfo,
  Animated,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Colors, LARGE_TEXT_SCALE, Radius, Spacing, Typography } from '@/lib/constants';
import {
  dashboardDestinationForDrag,
  type DashboardModule,
} from '@/lib/dashboard-layout';

type FeatherName = ComponentProps<typeof Feather>['name'];

export function DashboardLayoutRow({
  title,
  description,
  icon,
  index,
  total,
  locked = false,
  disabled = false,
  onMove,
  onRemove,
  onDragStateChange,
}: {
  title: string;
  description?: string;
  icon: FeatherName | null;
  index: number;
  total: number;
  locked?: boolean;
  disabled?: boolean;
  onMove: (fromIndex: number, toIndex: number, method: 'drag' | 'button') => void;
  onRemove?: () => void;
  onDragStateChange?: (dragging: boolean) => void;
}) {
  const { fontScale } = useWindowDimensions();
  const rowPitchRef = useRef(fontScale >= LARGE_TEXT_SCALE ? 150 : 126);
  const translateY = useRef(new Animated.Value(0)).current;
  const armedRef = useRef(false);
  const [dragging, setDragging] = useState(false);
  const [targetIndex, setTargetIndex] = useState(index);

  const finishDrag = useCallback((dy: number) => {
    const destination = dashboardDestinationForDrag(
      index,
      dy,
      rowPitchRef.current,
      total
    );
    armedRef.current = false;
    setDragging(false);
    setTargetIndex(index);
    onDragStateChange?.(false);
    Animated.spring(translateY, {
      toValue: 0,
      useNativeDriver: true,
      speed: 24,
      bounciness: 0,
    }).start();
    if (destination !== index) onMove(index, destination, 'drag');
  }, [index, onDragStateChange, onMove, total, translateY]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) =>
          armedRef.current && Math.abs(gesture.dy) > 3,
        onPanResponderGrant: () => {
          setDragging(true);
          onDragStateChange?.(true);
        },
        onPanResponderMove: (_, gesture) => {
          translateY.setValue(gesture.dy);
          setTargetIndex(
            dashboardDestinationForDrag(
              index,
              gesture.dy,
              rowPitchRef.current,
              total
            )
          );
        },
        onPanResponderRelease: (_, gesture) => finishDrag(gesture.dy),
        onPanResponderTerminate: (_, gesture) => finishDrag(gesture.dy),
        onPanResponderTerminationRequest: () => false,
      }),
    [finishDrag, index, onDragStateChange, total, translateY]
  );

  const measureRow = (event: LayoutChangeEvent) => {
    if (dragging) return;
    rowPitchRef.current = event.nativeEvent.layout.height + Spacing.sm;
  };

  const move = (destination: number) => {
    if (disabled) return;
    onMove(index, destination, 'button');
    AccessibilityInfo.announceForAccessibility(
      `${title}, position ${destination + 1} of ${total}`
    );
  };

  const armDrag = () => {
    if (locked || disabled) return;
    armedRef.current = true;
    AccessibilityInfo.announceForAccessibility(
      `Reordering ${title}. Drag up or down.`
    );
  };

  return (
    <Animated.View
      {...(locked || disabled ? {} : panResponder.panHandlers)}
      onLayout={measureRow}
      style={[
        styles.row,
        fontScale >= LARGE_TEXT_SCALE && styles.rowLargeText,
        disabled && styles.disabledRow,
        dragging && styles.rowDragging,
        dragging && { transform: [{ translateY }], zIndex: 2 },
      ]}
    >
      <Pressable
        accessibilityRole={locked ? 'text' : 'adjustable'}
        accessibilityLabel={locked ? title : `${title}, draggable`}
        accessibilityHint={
          locked
            ? 'Advisor always stays first.'
            : 'Long press and drag, or use the move buttons.'
        }
        accessibilityValue={{ text: `position ${index + 1} of ${total}` }}
        accessibilityState={{ disabled }}
        accessibilityActions={locked ? undefined : [
          { name: 'increment', label: `Move ${title} down` },
          { name: 'decrement', label: `Move ${title} up` },
        ]}
        delayLongPress={220}
        onLongPress={disabled ? undefined : armDrag}
        onPressOut={() => {
          if (armedRef.current && !dragging) {
            armedRef.current = false;
          }
        }}
        onAccessibilityAction={(event) => {
          if (disabled) return;
          if (event.nativeEvent.actionName === 'increment' && index < total - 1) {
            move(index + 1);
          }
          if (event.nativeEvent.actionName === 'decrement' && index > 1) {
            move(index - 1);
          }
        }}
        style={styles.rowMain}
      >
        <View style={styles.icon}>
          <Feather
            name={icon ?? 'compass'}
            size={19}
            color={locked ? Colors.textSecondary : Colors.primary}
          />
        </View>
        <View style={styles.copy}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.description}>
            {dragging
              ? `Move to position ${targetIndex + 1}`
              : locked
                ? 'Always first'
                : description}
          </Text>
        </View>
        {!locked ? <Feather name="menu" size={20} color={Colors.textSecondary} /> : null}
      </Pressable>

      {!locked ? (
        <View style={styles.controls}>
          <MoveButton
            icon="chevron-up"
            label={`Move ${title} up`}
            disabled={disabled || index <= 1}
            onPress={() => move(index - 1)}
          />
          <MoveButton
            icon="chevron-down"
            label={`Move ${title} down`}
            disabled={disabled || index >= total - 1}
            onPress={() => move(index + 1)}
          />
          {onRemove ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Remove ${title} from Today`}
              accessibilityState={{ disabled }}
              disabled={disabled}
              onPress={onRemove}
              style={({ pressed }) => [styles.removeButton, pressed && styles.pressed]}
            >
              <Feather name="x" size={18} color={Colors.accent} />
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </Animated.View>
  );
}

export function dashboardLayoutRowFromModule(module: DashboardModule) {
  return {
    title: module.title,
    description: module.description,
    icon: module.icon,
  };
}

function MoveButton({
  icon,
  label,
  disabled,
  onPress,
}: {
  icon: 'chevron-up' | 'chevron-down';
  label: string;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.moveButton,
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
      ]}
    >
      <Feather name={icon} size={18} color={Colors.primary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    borderWidth: 1,
    borderColor: Colors.borderTinted,
    borderRadius: Radius.md,
    backgroundColor: Colors.card,
    marginBottom: Spacing.sm,
    overflow: 'visible',
  },
  rowLargeText: { paddingBottom: Spacing.xs },
  rowDragging: {
    borderColor: Colors.primary,
    shadowColor: Colors.text,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
  },
  rowMain: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  icon: {
    width: 36,
    height: 36,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primaryLight,
  },
  copy: { flex: 1, minWidth: 0 },
  title: { color: Colors.text, ...Typography.label },
  description: { color: Colors.textSecondary, ...Typography.bodySmall },
  controls: {
    minHeight: 48,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.borderTinted,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: Spacing.xs,
  },
  moveButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: Spacing.xs,
  },
  disabled: { opacity: 0.3 },
  disabledRow: { opacity: 0.55 },
  pressed: { opacity: 0.7 },
});
