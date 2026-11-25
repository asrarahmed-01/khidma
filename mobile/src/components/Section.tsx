import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { color, radius, space } from "@/theme";
import { AppText } from "./AppText";

/** A titled group of content on a white surface. */
export function Section({ title, hint, children }: { title?: string; hint?: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      {title && (
        <View style={styles.head}>
          <AppText variant="heading" accessibilityRole="header">
            {title}
          </AppText>
          {hint && (
            <AppText variant="caption" color={color.inkMuted}>
              {hint}
            </AppText>
          )}
        </View>
      )}
      {children}
    </View>
  );
}

/** One label/value pair inside a Section. */
export function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detail}>
      <AppText variant="caption" color={color.inkMuted}>
        {label}
      </AppText>
      <AppText>{value}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { backgroundColor: color.surface, borderRadius: radius.lg, padding: space.lg, gap: space.md },
  head: { gap: 2 },
  detail: { gap: 2 },
});
