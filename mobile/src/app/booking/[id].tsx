import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import { ApiError } from "@/api/client";
import { useAdvanceJob, useBooking, useCancelBooking, useMe } from "@/api/hooks";
import type { Booking } from "@/api/types";
import { AppText } from "@/components/AppText";
import { Button } from "@/components/Button";
import { Chip } from "@/components/Chip";
import { ContactCard } from "@/components/ContactCard";
import { LiveTracking, SharingStatus } from "@/components/LiveTracking";
import { PaymentSection } from "@/components/PaymentSection";
import { Screen } from "@/components/Screen";
import { DetailRow, Section } from "@/components/Section";
import { Banner, EmptyState, ErrorState, LoadingState } from "@/components/States";
import { Timeline } from "@/components/Timeline";
import { TopBar } from "@/components/TopBar";
import { useLocale } from "@/i18n/locale";
import { canCustomerCancel, nextTechnicianStep, showsContact } from "@/lib/booking";
import { ltr } from "@/lib/bidi";
import { errorMessage } from "@/lib/errors";
import { bookingRef, formatPrice, formatSlot } from "@/lib/format";
import { serviceName } from "@/lib/service";
import { usePayBooking, useVerifyPayment } from "@/payments/checkout";
import { useRealtime } from "@/realtime/store";
import { radius, space, statusColor } from "@/theme";

export default function BookingDetailScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  // `payment` is set when the browser comes back from checkout on the web (?payment=paid).
  const { id, payment: returnedFromCheckout } = useLocalSearchParams<{ id: string; payment?: string }>();
  const booking = useBooking(id);
  const { data: me } = useMe();
  const verify = useVerifyPayment(id);
  const verified = useRef(false);

  useEffect(() => {
    if (!returnedFromCheckout || verified.current) return;
    verified.current = true;
    verify.mutate(undefined, { onSettled: () => router.setParams({ payment: undefined }) });
  }, [returnedFromCheckout, verify, router]);

  const header = <TopBar title={t("booking.title", { ref: ltr(bookingRef(id)) })} />;

  if (booking.isPending) {
    return (
      <Screen header={header} scroll={false}>
        <LoadingState />
      </Screen>
    );
  }
  if (booking.isError) {
    const missing = booking.error instanceof ApiError && booking.error.status === 404;
    return (
      <Screen header={header} scroll={false}>
        {missing ? (
          <EmptyState icon="search-outline" title={t("booking.notFound")} />
        ) : (
          <ErrorState error={booking.error} onRetry={() => void booking.refetch()} />
        )}
      </Screen>
    );
  }

  const viewer = me?.user.role === "TECHNICIAN" ? "technician" : "customer";
  return (
    <BookingDetail
      booking={booking.data}
      viewer={viewer}
      header={header}
      refreshing={booking.isRefetching}
      onRefresh={() => void booking.refetch()}
      checkingPayment={verify.isPending}
    />
  );
}

interface DetailProps {
  booking: Booking;
  viewer: "customer" | "technician";
  header: ReactNode;
  refreshing: boolean;
  onRefresh: () => void;
  checkingPayment: boolean;
}

function BookingDetail({ booking, viewer, header, refreshing, onRefresh, checkingPayment }: DetailProps) {
  const { t } = useTranslation();
  const { lang } = useLocale();
  const router = useRouter();
  const unread = useRealtime((s) => s.unread[booking.id] ?? 0);
  const tone = statusColor[booking.status];
  const otherParty = viewer === "customer" ? booking.technician : booking.customer;
  const name = booking.technician?.name ?? t("statusDetail.someone");
  const owesPayment = viewer === "customer" && booking.status === "COMPLETED" && !isSettled(booking);
  const hasActions =
    viewer === "customer"
      ? canCustomerCancel(booking.status) || owesPayment
      : nextTechnicianStep(booking.status) !== null;

  return (
    <Screen
      header={header}
      refreshing={refreshing}
      onRefresh={onRefresh}
      footer={
        !hasActions ? undefined : owesPayment ? (
          <PayButton booking={booking} disabled={checkingPayment} />
        ) : viewer === "customer" ? (
          <CustomerActions booking={booking} />
        ) : (
          <TechnicianActions booking={booking} />
        )
      }
    >
      <View style={[styles.hero, { backgroundColor: tone.bg }]}>
        <AppText variant="title" color={tone.fg}>
          {t(`status.${booking.status}`)}
        </AppText>
        <AppText color={tone.fg}>{t(`statusDetail.${viewer}.${booking.status}`, { name })}</AppText>
        {booking.status === "CANCELLED" && booking.cancelReason && (
          <AppText variant="caption" color={tone.fg}>
            {t("booking.cancelledReason", { reason: booking.cancelReason })}
          </AppText>
        )}
      </View>

      {booking.status === "EN_ROUTE" &&
        (viewer === "customer" ? <LiveTracking booking={booking} /> : <SharingStatus booking={booking} />)}

      {booking.status === "COMPLETED" && <PaymentSection booking={booking} viewer={viewer} checking={checkingPayment} />}

      {otherParty && showsContact(booking.status) && (
        <Section>
          <ContactCard
            role={viewer === "customer" ? "technician" : "customer"}
            contact={otherParty}
            destination={
              viewer === "technician" && booking.status !== "COMPLETED"
                ? { lat: booking.address.lat, lng: booking.address.lng, label: booking.address.line }
                : undefined
            }
            onMessage={() => router.push({ pathname: "/chat/[bookingId]", params: { bookingId: booking.id } })}
            unread={unread}
          />
        </Section>
      )}

      {booking.status !== "CANCELLED" && (
        <Section>
          <Timeline booking={booking} />
        </Section>
      )}

      <Section>
        <DetailRow label={t("booking.service")} value={serviceName(booking.service, lang)} />
        <DetailRow label={t("booking.time")} value={formatSlot(booking.scheduledAt, lang)} />
        <DetailRow label={t("booking.address")} value={booking.address.line} />
        {booking.notes && <DetailRow label={t("booking.notes")} value={booking.notes} />}
        <DetailRow label={t("booking.price")} value={formatPrice(booking.priceHalalas, lang)} />
      </Section>
    </Screen>
  );
}

const isSettled = (b: Booking) => b.payment?.status === "PAID" || b.payment?.status === "REFUNDED";

function PayButton({ booking, disabled }: { booking: Booking; disabled: boolean }) {
  const { t } = useTranslation();
  const { lang } = useLocale();
  const pay = usePayBooking(booking.id);
  return (
    <>
      {pay.isError && <Banner tone="error">{errorMessage(t, pay.error)}</Banner>}
      <Button
        testID="pay"
        icon="card-outline"
        label={t("payment.pay", { price: formatPrice(booking.payment?.amountHalalas ?? booking.priceHalalas, lang) })}
        onPress={() => pay.mutate()}
        loading={pay.isPending}
        disabled={disabled}
      />
    </>
  );
}

const CANCEL_REASONS = ["plansChanged", "fixed", "wrongTime", "other"] as const;

function CustomerActions({ booking }: { booking: Booking }) {
  const { t } = useTranslation();
  const cancel = useCancelBooking(booking.id);
  const [confirming, setConfirming] = useState(false);
  const [reason, setReason] = useState<(typeof CANCEL_REASONS)[number] | null>(null);

  if (!canCustomerCancel(booking.status)) return null;

  if (!confirming) {
    return <Button testID="cancel-booking" variant="danger" label={t("booking.cancelBooking")} onPress={() => setConfirming(true)} />;
  }

  return (
    <View style={styles.panel}>
      <AppText variant="bodyStrong">{t("booking.cancelTitle")}</AppText>
      <View style={styles.wrap}>
        {CANCEL_REASONS.map((key) => (
          <Chip key={key} label={t(`booking.reasons.${key}`)} selected={reason === key} onPress={() => setReason(key)} />
        ))}
      </View>
      {cancel.isError && <Banner tone="error">{errorMessage(t, cancel.error)}</Banner>}
      <View style={styles.buttons}>
        <Button variant="secondary" label={t("booking.keepBooking")} onPress={() => setConfirming(false)} style={styles.flex} />
        <Button
          testID="confirm-cancel"
          variant="danger"
          label={t("booking.confirmCancel")}
          // The reason is stored in the customer's language, so admins see what they actually chose.
          onPress={() => cancel.mutate(reason ? t(`booking.reasons.${reason}`) : undefined)}
          loading={cancel.isPending}
          style={styles.flex}
        />
      </View>
    </View>
  );
}

function TechnicianActions({ booking }: { booking: Booking }) {
  const { t } = useTranslation();
  const advance = useAdvanceJob(booking.id);
  const [confirmingFinish, setConfirmingFinish] = useState(false);
  const step = nextTechnicianStep(booking.status);

  if (!step) return null;

  const error = advance.isError ? <Banner tone="error">{errorMessage(t, advance.error)}</Banner> : null;

  if (step === "COMPLETED" && confirmingFinish) {
    return (
      <View style={styles.panel}>
        <AppText variant="bodyStrong">{t("booking.confirmCompleteTitle")}</AppText>
        {error}
        <View style={styles.buttons}>
          <Button variant="secondary" label={t("booking.notYet")} onPress={() => setConfirmingFinish(false)} style={styles.flex} />
          <Button
            label={t("booking.confirmCompleteYes")}
            onPress={() => advance.mutate("COMPLETED", { onSuccess: () => setConfirmingFinish(false) })}
            loading={advance.isPending}
            style={styles.flex}
          />
        </View>
      </View>
    );
  }

  return (
    <>
      {error}
      <Button
        testID="advance-job"
        label={t(`booking.actions.${step}`)}
        onPress={() => (step === "COMPLETED" ? setConfirmingFinish(true) : advance.mutate(step))}
        loading={advance.isPending}
      />
    </>
  );
}

const styles = StyleSheet.create({
  hero: { borderRadius: radius.lg, padding: space.lg, gap: space.xs },
  panel: { gap: space.md },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  buttons: { flexDirection: "row", gap: space.sm },
  flex: { flex: 1 },
});
