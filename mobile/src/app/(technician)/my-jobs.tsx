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

export default function MyJobsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [scope, setScope] = useState<Scope>("active");
  // The server returns the technician's assigned jobs for the same endpoint customers use.
  const jobs = useBookings(scope);

  return (
    <Screen inTabs refreshing={jobs.isRefetching} onRefresh={() => void jobs.refetch()}>
      <AppText variant="title" accessibilityRole="header">
        {t("jobs.mineTitle")}
      </AppText>
      <Segmented<Scope>
        value={scope}
        onChange={setScope}
        options={[
          { value: "active", label: t("bookings.active") },
          { value: "past", label: t("bookings.past") },
        ]}
      />
      {jobs.isPending ? (
        <LoadingState />
      ) : jobs.isError ? (
        <ErrorState error={jobs.error} onRetry={() => void jobs.refetch()} />
      ) : jobs.data.length === 0 ? (
        scope === "active" ? (
          <EmptyState icon="briefcase-outline" title={t("jobs.emptyMineActive")} hint={t("jobs.emptyMineActiveHint")} />
        ) : (
          <EmptyState icon="time-outline" title={t("jobs.emptyMinePast")} />
        )
      ) : (
        jobs.data.map((booking) => (
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
