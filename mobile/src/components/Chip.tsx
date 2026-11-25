import { Pressable, StyleSheet, View } from "react-native";
import { color, radius, space } from "@/theme";
import { AppText } from "./AppText";
import { Icon, type IconName } from "./Icon";

interface ChipProps {
  label: string;
  selected?: boolean;
  disabled?: boolean;
  icon?: IconName;
  /** Less side padding, for chips laid out in a grid. */
  dense?: boolean;
  onPress: () => void;
  testID?: string;
}

export function Chip({ label, selected, disabled, icon, dense, onPress, testID }: ChipProps) {
  const fg = selected ? color.white : disabled ? color.inkFaint : color.ink;
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: !!selected, disabled: !!disabled }}
      style={({ pressed }) => [
        styles.chip,
        dense && styles.dense,
        selected ? styles.selected : styles.idle,
        pressed && !selected && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <View style={styles.row}>
        {icon && <Icon name={icon} size={16} color={fg} />}
        <AppText variant="label" color={fg} numberOfLines={1}>
          {label}
        </AppText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: 40,
    paddingHorizontal: space.md + 2,
    borderRadius: radius.pill,
    justifyContent: "center",
    alignItems: "center",
  },
  dense: { paddingHorizontal: space.xs },
  idle: { backgroundColor: color.surface, borderWidth: 1, borderColor: color.line },
  selected: { backgroundColor: color.oasis, borderWidth: 1, borderColor: color.oasis },
  pressed: { backgroundColor: color.oasisTint },
  disabled: { backgroundColor: color.ground, borderStyle: "dashed" },
  row: { flexDirection: "row", alignItems: "center", gap: space.xs + 2 },
});
