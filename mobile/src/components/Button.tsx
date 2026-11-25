import { ActivityIndicator, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { color, radius, space } from "@/theme";
import { AppText } from "./AppText";
import { Icon, type IconName } from "./Icon";

type Variant = "primary" | "secondary" | "danger" | "quiet";

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: Variant;
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

const VARIANTS: Record<Variant, { bg: string; pressed: string; fg: string; border?: string }> = {
  primary: { bg: color.oasis, pressed: color.oasisPressed, fg: color.white },
  secondary: { bg: color.surface, pressed: color.oasisTint, fg: color.oasis, border: color.line },
  danger: { bg: color.dangerTint, pressed: "#F6D7D3", fg: color.danger },
  quiet: { bg: "transparent", pressed: color.oasisTint, fg: color.oasis },
};

export function Button({
  label,
  onPress,
  variant = "primary",
  icon,
  loading,
  disabled,
  compact,
  style,
  testID,
}: ButtonProps) {
  const v = VARIANTS[variant];
  const inactive = disabled || loading;
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      style={({ pressed }) => [
        styles.base,
        compact && styles.compact,
        { backgroundColor: pressed ? v.pressed : v.bg },
        v.border && { borderWidth: 1, borderColor: v.border },
        disabled && !loading && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={v.fg} />
      ) : (
        <View style={styles.content}>
          {icon && <Icon name={icon} size={compact ? 18 : 20} color={v.fg} />}
          <AppText variant="bodyStrong" color={v.fg} numberOfLines={1}>
            {label}
          </AppText>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 52,
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  compact: { minHeight: 40, paddingHorizontal: space.md },
  content: { flexDirection: "row", alignItems: "center", gap: space.sm },
  disabled: { opacity: 0.45 },
});
