import { Linking, StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useTechnicianLocation } from "@/api/hooks";
import type { Booking } from "@/api/types";
import { useLocale } from "@/i18n/locale";
import { formatDistance, secondsSince } from "@/lib/format";
import { distanceKm } from "@/lib/geo";
import { MAPBOX_TOKEN } from "@/lib/mapbox";
import { useNow } from "@/lib/use-now";
import { useRealtime } from "@/realtime/store";
import { color, radius, space } from "@/theme";
import { AppText } from "./AppText";
import { Button } from "./Button";
import { LiveMap } from "./LiveMap";
import { Section } from "./Section";
import { Banner } from "./States";

/** A position older than this probably means the technician's app is closed or offline. */
const STALE_AFTER_S = 180;

/** The customer's view while the technician is on the way: map, distance, freshness. */
export function LiveTracking({ booking }: { booking: Booking }) {
  const { t } = useTranslation();
  const { lang } = useLocale();
  const connected = useRealtime((s) => s.connected);
  const location = useTechnicianLocation(booking);
  const now = useNow(5000);
  const name = booking.technician?.name ?? t("statusDetail.someone");

  const age = location ? secondsSince(location.at, now) : null;
  const km = location ? distanceKm(location.lat, location.lng, booking.address.lat, booking.address.lng) : null;

  return (
    <Section>
      <View style={styles.head}>
        <AppText variant="heading" accessibilityRole="header" style={styles.flex}>
          {t("tracking.title")}
        </AppText>
        {connected ? (
          <View style={styles.live}>
            <View style={styles.dot} />
            <AppText variant="label" color={color.oasis}>
              {t("tracking.live")}
            </AppText>
          </View>
        ) : (
          <AppText variant="caption" color={color.inkMuted}>
            {t("tracking.reconnecting")}
          </AppText>
        )}
      </View>

      <LiveMap home={booking.address} technician={location} />

      {location && km !== null && age !== null ? (
        <View style={styles.facts} testID="tracking-facts">
          <AppText variant="bodyStrong">{t("tracking.away", { distance: formatDistance(km, lang) })}</AppText>
          <AppText variant="caption" color={color.inkMuted}>
            {age < 10
              ? t("tracking.updatedNow")
              : age < 60
                ? t("tracking.updatedSeconds", { count: age })
                : t("tracking.updatedMinutes", { count: Math.floor(age / 60) })}
          </AppText>
        </View>
      ) : (
        <AppText color={color.inkMuted}>{t("tracking.waiting", { name })}</AppText>
      )}
      {age !== null && age > STALE_AFTER_S && <Banner>{t("tracking.stale", { name })}</Banner>}
      {!MAPBOX_TOKEN && (
        <AppText variant="caption" color={color.inkFaint}>
          {t("tracking.diagramNote")}
        </AppText>
      )}
    </Section>
  );
}

/** The technician's side: whether the customer can currently see them. */
export function SharingStatus({ booking }: { booking: Booking }) {
  const { t } = useTranslation();
  const sharing = useRealtime((s) => (s.sharing?.bookingId === booking.id ? s.sharing.state : null));
  const name = booking.customer.name ?? t("booking.customer");

  if (!sharing) return null;
  if (sharing === "denied") {
    return (
      <View style={styles.sharing}>
        <Banner tone="error">{t("tracking.sharingDenied", { name })}</Banner>
        <Button compact variant="secondary" label={t("tracking.openSettings")} onPress={() => void Linking.openSettings()} />
      </View>
    );
  }
  if (sharing === "error") return <Banner tone="error">{t("tracking.sharingError", { name })}</Banner>;
  return (
    <Banner tone="success">
      {sharing === "starting" ? t("tracking.sharingStarting") : t("tracking.sharing", { name })}
    </Banner>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "center", gap: space.sm },
  flex: { flex: 1 },
  live: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.xs,
    backgroundColor: color.oasisTint,
    borderRadius: radius.pill,
    paddingHorizontal: space.sm,
    paddingVertical: 2,
  },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: color.oasis },
  facts: { gap: 2 },
  sharing: { gap: space.sm },
});
