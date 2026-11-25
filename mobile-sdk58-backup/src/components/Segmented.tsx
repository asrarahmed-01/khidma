import { Pressable, StyleSheet, View } from "react-native";
import { color, radius } from "@/theme";
import { AppText } from "./AppText";

interface SegmentedProps<T extends string> {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}

export function Segmented<T extends string>({ options, value, onChange }: SegmentedProps<T>) {
  return (
    <View style={styles.track} accessibilityRole="tablist">
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            style={[styles.segment, active && styles.active]}
          >
            <AppText variant="label" color={active ? color.ink : color.inkMuted}>
              {option.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: { flexDirection: "row", backgroundColor: "#E4E9E7", borderRadius: radius.md, padding: 3 },
  segment: { flex: 1, minHeight: 38, alignItems: "center", justifyContent: "center", borderRadius: radius.sm + 2 },
  active: {
    backgroundColor: color.surface,
    boxShadow: "0 1px 3px rgba(11, 42, 34, 0.10)",
  },
});
