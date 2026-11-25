import { Linking, Platform, StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import type { Contact } from "@/api/types";
import { ltr } from "@/lib/bidi";
import { formatSaudiMobile } from "@/lib/phone";
import { color, font, space } from "@/theme";
import { AppText } from "./AppText";
import { Button } from "./Button";
import { Icon } from "./Icon";

interface ContactCardProps {
  role: "technician" | "customer";
  contact: Contact;
  /** Shown for technicians so they can navigate to the customer. */
  destination?: { lat: number; lng: number; label: string };
  /** Opens the in-app chat for this booking. */
  onMessage?: () => void;
  unread?: number;
}

function openDirections({ lat, lng, label }: { lat: number; lng: number; label: string }) {
  const query = encodeURIComponent(label);
  const url =
    Platform.OS === "ios"
      ? `maps://?daddr=${lat},${lng}&q=${query}`
      : `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
  void Linking.openURL(url);
}

export function ContactCard({ role, contact, destination, onMessage, unread = 0 }: ContactCardProps) {
  const { t } = useTranslation();
  return (
    <View style={styles.card}>
      <View style={styles.who}>
        <View style={styles.avatar}>
          <Icon name={role === "technician" ? "construct-outline" : "person-outline"} size={22} color={color.oasis} />
        </View>
        <View style={styles.flex}>
          <AppText variant="caption" color={color.inkMuted}>
            {t(role === "technician" ? "booking.technician" : "booking.customer")}
          </AppText>
          <AppText variant="bodyStrong">{contact.name ?? ltr(formatSaudiMobile(contact.phone))}</AppText>
          <AppText variant="caption" color={color.inkMuted}>
            {ltr(formatSaudiMobile(contact.phone))}
          </AppText>
        </View>
      </View>
      <View style={styles.actions}>
        {onMessage && (
          <View style={styles.flex}>
            <Button
              testID="open-chat"
              compact
              variant="secondary"
              icon="chatbubble-ellipses-outline"
              label={t("chat.open")}
              onPress={onMessage}
            />
            {unread > 0 && (
              <View style={styles.badge} accessibilityLabel={t("chat.unread", { count: unread })} testID="unread-badge">
                <AppText variant="caption" color={color.white} style={styles.badgeText}>
                  {unread > 9 ? "9+" : String(unread)}
                </AppText>
              </View>
            )}
          </View>
        )}
        <View style={styles.flex}>
          <Button
            compact
            variant="secondary"
            icon="call-outline"
            label={t("booking.call")}
            onPress={() => void Linking.openURL(`tel:${contact.phone}`)}
          />
        </View>
        {destination && (
          <View style={styles.flex}>
            <Button
              compact
              variant="secondary"
              icon="navigate-outline"
              label={t("booking.directions")}
              onPress={() => openDirections(destination)}
            />
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: space.md },
  who: { flexDirection: "row", alignItems: "center", gap: space.md },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: color.oasisTint,
    alignItems: "center",
    justifyContent: "center",
  },
  // Equal-width buttons, however long each label is.
  flex: { flex: 1, flexBasis: 0, minWidth: 0 },
  actions: { flexDirection: "row", gap: space.sm },
  badge: {
    position: "absolute",
    top: -6,
    end: -6,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 5,
    backgroundColor: color.danger,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { fontFamily: font.semibold, lineHeight: 16 },
});
