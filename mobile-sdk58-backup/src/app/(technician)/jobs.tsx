import { useRouter } from "expo-router";
import { useState } from "react";
import { Platform, StyleSheet, Switch, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useAcceptJob, useMe, useOpenJobs, useServiceAreas, useSetAvailability } from "@/api/hooks";
import type { OpenJob } from "@/api/types";
import { AppText } from "@/components/AppText";
import { Button } from "@/components/Button";
import { Icon } from "@/components/Icon";
import { Screen } from "@/components/Screen";
import { ServiceIcon } from "@/components/ServiceIcon";
import { Banner, EmptyState, ErrorState, LoadingState } from "@/components/States";
import { useLocale } from "@/i18n/locale";
import { errorMessage } from "@/lib/errors";
import { formatPrice, formatSlot } from "@/lib/format";
import { areaName, serviceName } from "@/lib/service";
import { color, radius, space } from "@/theme";

export default function OpenJobsScreen() {
  const { t } = useTranslation();
  const { data: me } = useMe();
  const technician = me?.technician;
  const approved = !!technician?.isApproved;
  const online = approved && !!technician?.isAvailable;

  const setAvailability = useSetAvailability();
  const jobs = useOpenJobs(online);

  return (
    <Screen
      inTabs
      refreshing={jobs.isRefetching}
      onRefresh={online ? () => void jobs.refetch() : undefined}
    >
      <View style={styles.head}>
        <AppText variant="title" accessibilityRole="header" style={styles.flex}>
          {t("jobs.title")}
        </AppText>
        {approved && (
          <View style={styles.toggle}>
            <AppText variant="label" color={online ? color.oasis : color.inkMuted}>
              {online ? t("jobs.online") : t("jobs.offline")}
            </AppText>
            {/* react-native-web positions the thumb with absolute offsets that break under
                dir="rtl" (it slides over the label), so the web switch stays left-to-right. */}
            <View {...(Platform.OS === "web" ? ({ dir: "ltr" } as object) : null)}>
              <Switch
                testID="availability"
                value={online}
                onValueChange={(value) => setAvailability.mutate(value)}
                trackColor={{ true: color.oasis, false: color.line }}
                thumbColor={color.white}
                accessibilityLabel={online ? t("jobs.online") : t("jobs.offline")}
              />
            </View>
          </View>
        )}
      </View>

      {setAvailability.isError && <Banner tone="error">{errorMessage(t, setAvailability.error)}</Banner>}

      {!approved ? (
        <EmptyState icon="hourglass-outline" title={t("jobs.pendingTitle")} hint={t("jobs.pendingHint")} />
      ) : !online ? (
        <EmptyState icon="moon-outline" title={t("jobs.offlineTitle")} hint={t("jobs.offlineHint")} />
      ) : jobs.isPending ? (
        <LoadingState />
      ) : jobs.isError ? (
        <ErrorState error={jobs.error} onRetry={() => void jobs.refetch()} />
      ) : jobs.data.length === 0 ? (
        <EmptyState icon="radio-outline" title={t("jobs.emptyTitle")} hint={t("jobs.emptyHint")} />
      ) : (
        jobs.data.map((job) => <OpenJobCard key={job.id} job={job} />)
      )}
    </Screen>
  );
}

function OpenJobCard({ job }: { job: OpenJob }) {
  const { t } = useTranslation();
  const { lang } = useLocale();
  const router = useRouter();
  const areas = useServiceAreas();
  const accept = useAcceptJob();
  const [failed, setFailed] = useState<unknown>(null);

  const onAccept = () => {
    setFailed(null);
    accept.mutate(job.id, {
      onSuccess: ({ booking }) => router.push({ pathname: "/booking/[id]", params: { id: booking.id } }),
      // e.g. BOOKING_UNAVAILABLE when another technician was faster; the list refreshes on its own.
      onError: (error) => setFailed(error),
    });
  };

  return (
    <View style={styles.card} testID={`job-${job.id}`}>
      <View style={styles.cardHead}>
        <ServiceIcon icon={job.service.icon} size={44} />
        <View style={styles.flex}>
          <AppText variant="bodyStrong">{serviceName(job.service, lang)}</AppText>
          <AppText variant="caption" color={color.inkMuted}>
            {formatSlot(job.scheduledAt, lang)}
          </AppText>
        </View>
      </View>
      <View style={styles.meta}>
        <Icon name="location-outline" size={16} color={color.inkMuted} />
        <AppText variant="label" color={color.inkMuted} style={styles.flex}>
          {areaName(areas.data, job.serviceArea, lang)}
        </AppText>
        <AppText variant="heading">{formatPrice(job.priceHalalas, lang)}</AppText>
      </View>
      {job.notes && (
        <AppText variant="caption" color={color.ink} numberOfLines={3} style={styles.notes}>
          {job.notes}
        </AppText>
      )}
      {failed != null && <Banner tone="error">{errorMessage(t, failed)}</Banner>}
      <Button label={t("jobs.accept")} onPress={onAccept} loading={accept.isPending} />
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "center", gap: space.md },
  flex: { flex: 1 },
  toggle: { flexDirection: "row", alignItems: "center", gap: space.sm },
  card: { backgroundColor: color.surface, borderRadius: radius.lg, padding: space.lg, gap: space.md },
  cardHead: { flexDirection: "row", alignItems: "center", gap: space.md },
  meta: { flexDirection: "row", alignItems: "center", gap: space.xs },
  notes: { backgroundColor: color.ground, borderRadius: radius.sm, padding: space.sm },
});
