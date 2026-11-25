import { StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import type { Booking } from "@/api/types";
import { useLocale } from "@/i18n/locale";
import { formatPrice, formatStamp } from "@/lib/format";
import { color, space } from "@/theme";
import { AppText } from "./AppText";
import { Icon } from "./Icon";
import { Section } from "./Section";
import { Banner } from "./States";

const KNOWN_METHODS = ["mada", "visa", "mastercard", "amex", "applepay", "stcpay"] as const;

export function usePaymentMethodLabel() {
  const { t } = useTranslation();
  return (method: string | null) =>
    KNOWN_METHODS.includes(method as (typeof KNOWN_METHODS)[number])
      ? t(`payment.method.${method as (typeof KNOWN_METHODS)[number]}`)
      : t("payment.method.card");
}

/** Payment state of a completed job. The Pay button itself sits in the screen footer. */
export function PaymentSection({ booking, viewer, checking }: { booking: Booking; viewer: "customer" | "technician"; checking?: boolean }) {
  const { t } = useTranslation();
  const { lang } = useLocale();
  const methodLabel = usePaymentMethodLabel();
  const payment = booking.payment;
  const price = formatPrice(payment?.amountHalalas ?? booking.priceHalalas, lang);

  if (payment?.status === "PAID" || payment?.status === "REFUNDED") {
    const refunded = payment.status === "REFUNDED";
    return (
      <Section title={t("payment.title")}>
        <View style={styles.paid} testID="payment-paid">
          <View style={[styles.check, refunded && styles.checkMuted]}>
            <Icon name={refunded ? "return-down-back" : "checkmark"} size={20} color={color.white} />
          </View>
          <View style={styles.flex}>
            <AppText variant="bodyStrong">
              {refunded
                ? t("payment.refunded")
                : viewer === "technician"
                  ? t("payment.paidByCustomer")
                  : t("payment.paidWith", { method: methodLabel(payment.method) })}
            </AppText>
            <AppText variant="caption" color={color.inkMuted}>
              {payment.paidAt ? `${price} · ${formatStamp(payment.paidAt, lang)}` : price}
            </AppText>
          </View>
        </View>
      </Section>
    );
  }

  if (viewer === "technician") {
    return (
      <Section title={t("payment.title")}>
        <View style={styles.paid}>
          <Icon name="time-outline" size={22} color={color.inkMuted} />
          <AppText style={styles.flex}>{t("payment.awaiting")}</AppText>
          <AppText variant="bodyStrong">{price}</AppText>
        </View>
      </Section>
    );
  }

  return (
    <Section title={t("payment.title")}>
      <View style={styles.due}>
        <AppText variant="caption" color={color.inkMuted}>
          {t("payment.due")}
        </AppText>
        <AppText variant="display" testID="amount-due">
          {price}
        </AppText>
        <AppText color={color.inkMuted}>{t("payment.methods")}</AppText>
      </View>
      {checking ? (
        <Banner>{t("payment.checking")}</Banner>
      ) : payment?.status === "INITIATED" && payment.failureMessage ? (
        // A declined card leaves the checkout open for another try.
        <Banner tone="error">{t("payment.declined")}</Banner>
      ) : payment ? (
        <Banner>{t("payment.notFinished")}</Banner>
      ) : null}
      <View style={styles.secure}>
        <Icon name="lock-closed-outline" size={16} color={color.inkMuted} />
        <AppText variant="caption" color={color.inkMuted} style={styles.flex}>
          {t("payment.secure")}
        </AppText>
      </View>
    </Section>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  due: { gap: 2 },
  paid: { flexDirection: "row", alignItems: "center", gap: space.md },
  check: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#1D6B3A",
    alignItems: "center",
    justifyContent: "center",
  },
  checkMuted: { backgroundColor: color.inkMuted },
  secure: { flexDirection: "row", alignItems: "flex-start", gap: space.sm },
});
