import { useRouter } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useBookings } from "@/api/hooks";
import { AppText } from "@/components/AppText";
import { BookingRow } from "@/components/BookingRow";
import { Screen } from "@/components/Screen";
import { Segmented } from "@/components/Segmented";
import { EmptyState, ErrorState, LoadingState } from "@/components/States";

type Scope = "active" | "past";

export default function BookingsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [scope, setScope] = useState<Scope>("active");
  const bookings = useBookings(scope);

  return (
    <Screen inTabs refreshing={bookings.isRefetching} onRefresh={() => void bookings.refetch()}>
      <AppText variant="title" accessibilityRole="header">
        {t("bookings.title")}
      </AppText>
      <Segmented<Scope>
        value={scope}
        onChange={setScope}
        options={[
          { value: "active", label: t("bookings.active") },
          { value: "past", label: t("bookings.past") },
        ]}
      />

      {bookings.isPending ? (
        <LoadingState />
      ) : bookings.isError ? (
        <ErrorState error={bookings.error} onRetry={() => void bookings.refetch()} />
      ) : bookings.data.length === 0 ? (
        scope === "active" ? (
          <EmptyState
            icon="calendar-clear-outline"
            title={t("bookings.emptyActive")}
            hint={t("bookings.emptyActiveHint")}
            action={{ label: t("bookings.bookService"), onPress: () => router.navigate("/") }}
          />
        ) : (
          <EmptyState icon="time-outline" title={t("bookings.emptyPast")} />
        )
      ) : (
        bookings.data.map((booking) => (
          <BookingRow
            key={booking.id}
            booking={booking}
            onPress={() => router.push({ pathname: "/booking/[id]", params: { id: booking.id } })}
          />
        ))
      )}
    </Screen>
  );
}
