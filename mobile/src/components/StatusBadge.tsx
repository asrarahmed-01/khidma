import { StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import type { BookingStatus } from "@/api/types";
import { font, radius, space, statusColor } from "@/theme";
import { AppText } from "./AppText";

export function StatusBadge({ status }: { status: BookingStatus }) {
  const { t } = useTranslation();
  const tone = statusColor[status];
  return (
    <View style={[styles.badge, { backgroundColor: tone.bg }]}>
      <View style={[styles.dot, { backgroundColor: tone.fg }]} />
      <AppText variant="caption" color={tone.fg} style={styles.text}>
        {t(`status.${status}`)}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: space.xs + 2,
    paddingHorizontal: space.sm + 2,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  text: { fontFamily: font.medium },
});
