import { StyleSheet, View } from "react-native";
import { color, font } from "@/theme";
import { AppText } from "./AppText";

/** The logotype: the Arabic name is the mark; the Latin name sits underneath. */
export function Wordmark({ onDark }: { onDark?: boolean }) {
  return (
    <View style={styles.wrap} accessibilityRole="header" accessibilityLabel="Khidma خدمة">
      <AppText style={styles.arabic} color={onDark ? color.white : color.oasis}>
        خدمة
      </AppText>
      <AppText variant="caption" color={onDark ? color.oasisOnDark : color.inkMuted} style={styles.latin}>
        Khidma
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "flex-start" },
  arabic: { fontFamily: font.bold, fontSize: 44, lineHeight: 60 },
  latin: { fontFamily: font.medium, marginTop: -6, letterSpacing: 0.5 },
});
