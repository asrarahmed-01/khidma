import { Pressable, StyleSheet, View } from "react-native";
import type { Booking } from "@/api/types";
import { useLocale } from "@/i18n/locale";
import { formatSlot } from "@/lib/format";
import { serviceName } from "@/lib/service";
import { color, radius, space } from "@/theme";
import { AppText } from "./AppText";
import { Icon } from "./Icon";
import { ServiceIcon } from "./ServiceIcon";
import { StatusBadge } from "./StatusBadge";

export function BookingRow({ booking, onPress }: { booking: Booking; onPress: () => void }) {
  const { lang } = useLocale();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <ServiceIcon icon={booking.service.icon} size={44} />
      <View style={styles.body}>
        <AppText variant="bodyStrong" numberOfLines={1}>
          {serviceName(booking.service, lang)}
        </AppText>
        <AppText variant="caption" color={color.inkMuted} numberOfLines={1}>
          {formatSlot(booking.scheduledAt, lang)}
        </AppText>
        <StatusBadge status={booking.status} />
      </View>
      <Icon name="chevron-forward" size={18} color={color.inkFaint} directional />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    padding: space.md,
    backgroundColor: color.surface,
    borderRadius: radius.lg,
  },
  pressed: { backgroundColor: color.oasisTint },
  body: { flex: 1, gap: 4 },
});
