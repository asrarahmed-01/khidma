import { useRouter } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useBookings, useMe, useServices } from "@/api/hooks";
import type { Service } from "@/api/types";
import { AppText } from "@/components/AppText";
import { BookingRow } from "@/components/BookingRow";
import { BrandHeader } from "@/components/BrandHeader";
import { Icon } from "@/components/Icon";
import { Screen } from "@/components/Screen";
import { ServiceIcon } from "@/components/ServiceIcon";
import { ErrorState, LoadingState } from "@/components/States";
import { useLocale } from "@/i18n/locale";
import { formatPrice } from "@/lib/format";
import { serviceDescription, serviceName } from "@/lib/service";
import { color, radius, space } from "@/theme";

export default function HomeScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { data: me } = useMe();
  const services = useServices();
  const active = useBookings("active");

  const refreshing = services.isRefetching || active.isRefetching;
  const refresh = () => {
    void services.refetch();
    void active.refetch();
  };
  const firstName = me?.user.name?.split(" ")[0] ?? "";

  return (
    <Screen
      inTabs
      topInset={false}
      refreshing={refreshing}
      onRefresh={refresh}
      header={
        <BrandHeader>
          <AppText variant="label" color={color.oasisOnDark}>
            {t("home.greeting", { name: firstName })}
          </AppText>
          <AppText variant="display" color={color.white}>
            {t("home.prompt")}
          </AppText>
        </BrandHeader>
      }
    >
      {active.data?.slice(0, 2).map((booking) => (
        <BookingRow
          key={booking.id}
          booking={booking}
          onPress={() => router.push({ pathname: "/booking/[id]", params: { id: booking.id } })}
        />
      ))}

      <AppText variant="heading" accessibilityRole="header">
        {t("home.servicesTitle")}
      </AppText>

      {services.isPending ? (
        <LoadingState />
      ) : services.isError ? (
        <ErrorState error={services.error} onRetry={() => void services.refetch()} />
      ) : (
        <View style={styles.list}>
          {services.data.map((service, index) => (
            <ServiceRow
              key={service.id}
              service={service}
              first={index === 0}
              onPress={() => router.push({ pathname: "/book/[serviceId]", params: { serviceId: service.id } })}
            />
          ))}
        </View>
      )}
    </Screen>
  );
}

function ServiceRow({ service, first, onPress }: { service: Service; first: boolean; onPress: () => void }) {
  const { t } = useTranslation();
  const { lang } = useLocale();
  return (
    <Pressable
      testID={`service-${service.slug}`}
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.row, !first && styles.divider, pressed && styles.pressed]}
    >
      <ServiceIcon icon={service.icon} />
      <View style={styles.text}>
        <AppText variant="bodyStrong">{serviceName(service, lang)}</AppText>
        <AppText variant="caption" color={color.inkMuted} numberOfLines={2}>
          {serviceDescription(service, lang)}
        </AppText>
        <AppText variant="label" color={color.oasis}>
          {t("home.fromPrice", { price: formatPrice(service.basePriceHalalas, lang) })}
        </AppText>
      </View>
      <Icon name="chevron-forward" size={18} color={color.inkFaint} directional />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  list: { backgroundColor: color.surface, borderRadius: radius.lg, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", gap: space.md, padding: space.lg },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderColor: color.line },
  pressed: { backgroundColor: color.oasisTint },
  text: { flex: 1, gap: 2 },
});
