import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { Colors, Radius } from '@/lib/constants';

export function LeafMark({
  size = 38,
  style,
  accessible = false,
}: {
  size?: number;
  style?: ViewStyle;
  accessible?: boolean;
}) {
  const iconSize = Math.round(size * 0.56);
  return (
    <View
      accessible={accessible}
      accessibilityElementsHidden={!accessible}
      accessibilityLabel={accessible ? 'MHtoolkit leaf' : undefined}
      accessibilityRole={accessible ? 'image' : undefined}
      importantForAccessibility={accessible ? 'yes' : 'no-hide-descendants'}
      style={[
        styles.mark,
        { width: size, height: size, borderRadius: Math.min(Radius.pill, size / 2) },
        style,
      ]}
    >
      <MaterialCommunityIcons
        accessible={false}
        name="leaf"
        size={iconSize}
        color={Colors.primary}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  mark: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primaryLight,
    borderColor: Colors.border,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
