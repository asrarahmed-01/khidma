import * as Location from "expo-location";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useCreateBooking, useServiceAreas, useServices } from "@/api/hooks";
import type { ServiceArea } from "@/api/types";
import { AppText } from "@/components/AppText";
import { Button } from "@/components/Button";
import { Chip } from "@/components/Chip";
import { Icon } from "@/components/Icon";
import { Screen } from "@/components/Screen";
import { Section } from "@/components/Section";
import { SlotPicker } from "@/components/SlotPicker";
import { Banner, ErrorState, LoadingState } from "@/components/States";
import { TextField } from "@/components/TextField";
import { TopBar } from "@/components/TopBar";
import { useLocale } from "@/i18n/locale";
import { errorMessage } from "@/lib/errors";
import { formatPrice } from "@/lib/format";
import { findServiceArea } from "@/lib/geo";
import { serviceName } from "@/lib/service";
import { color, space } from "@/theme";

interface PickedLocation {
  lat: number;
  lng: number;
  areaId: string;
  source: "gps" | "city";
}

const MIN_ADDRESS_LENGTH = 5;

export default function BookServiceScreen() {
  const { t } = useTranslation();
  const { lang } = useLocale();
  const router = useRouter();
  const { serviceId } = useLocalSearchParams<{ serviceId: string }>();

  const services = useServices();
  const areas = useServiceAreas();
  const create = useCreateBooking();

  const [location, setLocation] = useState<PickedLocation | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [address, setAddress] = useState("");
  const [slot, setSlot] = useState<Date | null>(null);
  const [notes, setNotes] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const service = services.data?.find((s) => s.id === serviceId);

  if (services.isPending || areas.isPending) return <Screen header={<TopBar title="" />}><LoadingState /></Screen>;
  if (services.isError || areas.isError || !service) {
    return (
      <Screen header={<TopBar title="" />}>
        <ErrorState
          error={services.error ?? areas.error}
          onRetry={() => {
            void services.refetch();
            void areas.refetch();
          }}
        />
      </Screen>
    );
  }

  const cityList = areas.data.map((a) => serviceName(a, lang)).join(lang === "ar" ? "، " : ", ");

  const locateMe = async () => {
    setLocationError(null);
    setLocating(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== "granted") {
        setLocationError(t("book.locationDenied"));
        return;
      }
      const { coords } = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const area = findServiceArea(areas.data, coords.latitude, coords.longitude);
      if (!area) {
        setLocation(null);
        setLocationError(t("book.outsideArea", { cities: cityList }));
        return;
      }
      setLocation({ lat: coords.latitude, lng: coords.longitude, areaId: area.id, source: "gps" });
      await prefillAddress(coords.latitude, coords.longitude);
    } catch {
      setLocationError(t("book.locationDenied"));
    } finally {
      setLocating(false);
    }
  };

  // Suggest a street and district from the coordinates; the customer can still edit it.
  const prefillAddress = async (latitude: number, longitude: number) => {
    if (address.trim()) return;
    try {
      const [place] = await Location.reverseGeocodeAsync({ latitude, longitude });
      const parts = [place?.street, place?.district, place?.city].filter(Boolean);
      if (parts.length) setAddress(parts.join(lang === "ar" ? "، " : ", "));
    } catch {
      // Reverse geocoding isn't available everywhere (e.g. the web); typing the address still works.
    }
  };

  const chooseCity = (area: ServiceArea) => {
    setLocationError(null);
    setLocation({ lat: area.lat, lng: area.lng, areaId: area.id, source: "city" });
  };

  const addressError = address.trim().length < MIN_ADDRESS_LENGTH ? t("book.addressTooShort") : null;
  const missing = !location ? t("book.missingLocation") : !slot ? t("book.missingSlot") : addressError;

  const confirm = () => {
    setSubmitted(true);
    if (missing || !location || !slot) return;
    create.mutate(
      {
        serviceId: service.id,
        scheduledAt: slot.toISOString(),
        addressLine: address.trim(),
        lat: location.lat,
        lng: location.lng,
        notes: notes.trim() || undefined,
      },
      { onSuccess: ({ booking }) => router.replace({ pathname: "/booking/[id]", params: { id: booking.id } }) },
    );
  };

  const gpsArea = location?.source === "gps" ? areas.data.find((a) => a.id === location.areaId) : null;

  return (
    <Screen
      header={<TopBar title={serviceName(service, lang)} />}
      footer={
        <>
          <View style={styles.price}>
            <View style={styles.flex}>
              <AppText variant="label">{t("book.price")}</AppText>
              <AppText variant="caption" color={color.inkMuted}>
                {t("book.priceNote")}
              </AppText>
            </View>
            <AppText variant="heading">{formatPrice(service.basePriceHalalas, lang)}</AppText>
          </View>
          {submitted && missing && <Banner tone="error">{missing}</Banner>}
          {create.isError && <Banner tone="error">{errorMessage(t, create.error)}</Banner>}
          <Button testID="confirm-booking" label={t("book.confirm")} onPress={confirm} loading={create.isPending} />
        </>
      }
    >
      <Section title={t("book.whereTitle")}>
        <Button
          variant="secondary"
          icon="locate-outline"
          label={locating ? t("book.locating") : t("book.useMyLocation")}
          onPress={() => void locateMe()}
          loading={locating}
        />
        {gpsArea && (
          <View style={styles.located}>
            <Icon name="checkmark-circle" size={18} color={color.oasis} />
            <AppText variant="label" color={color.oasis}>
              {serviceName(gpsArea, lang)}
            </AppText>
          </View>
        )}
        {locationError && <Banner tone="error">{locationError}</Banner>}
        <AppText variant="caption" color={color.inkMuted}>
          {t("book.orPickCity")}
        </AppText>
        <View style={styles.wrap}>
          {areas.data.map((area) => (
            <Chip
              key={area.id}
              testID={`city-${area.id}`}
              label={serviceName(area, lang)}
              selected={location?.source === "city" && location.areaId === area.id}
              onPress={() => chooseCity(area)}
            />
          ))}
        </View>
        <TextField
          testID="address-input"
          label={t("book.addressLabel")}
          placeholder={t("book.addressPlaceholder")}
          value={address}
          onChangeText={setAddress}
          maxLength={200}
          error={submitted ? addressError : null}
        />
      </Section>

      <Section title={t("book.whenTitle")} hint={t("book.whenHint")}>
        <SlotPicker value={slot} onChange={setSlot} />
      </Section>

      <TextField
        label={t("book.notesLabel")}
        placeholder={t("book.notesPlaceholder")}
        value={notes}
        onChangeText={setNotes}
        multiline
        maxLength={500}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  located: { flexDirection: "row", alignItems: "center", gap: space.xs },
  price: { flexDirection: "row", alignItems: "center", gap: space.md },
});
