import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useApplyAsTechnician, useServices } from "@/api/hooks";
import { AppText } from "@/components/AppText";
import { Button } from "@/components/Button";
import { Chip } from "@/components/Chip";
import { Screen } from "@/components/Screen";
import { Section } from "@/components/Section";
import { Banner, ErrorState, LoadingState } from "@/components/States";
import { TextField } from "@/components/TextField";
import { TopBar } from "@/components/TopBar";
import { useLocale } from "@/i18n/locale";
import { errorMessage } from "@/lib/errors";
import { serviceName } from "@/lib/service";
import { color, space } from "@/theme";

export default function BecomeTechnicianScreen() {
  const { t } = useTranslation();
  const { lang } = useLocale();
  const services = useServices();
  const apply = useApplyAsTechnician();
  const [selected, setSelected] = useState<string[]>([]);
  const [bio, setBio] = useState("");
  const [touched, setTouched] = useState(false);

  const toggle = (id: string) =>
    setSelected((current) => (current.includes(id) ? current.filter((x) => x !== id) : [...current, id]));

  const submit = () => {
    setTouched(true);
    if (selected.length === 0) return;
    // On success the role becomes TECHNICIAN and the route guard opens the technician tabs.
    apply.mutate({ serviceIds: selected, bio: bio.trim() });
  };

  return (
    <Screen
      header={<TopBar title={t("apply.title")} />}
      footer={<Button label={t("apply.submit")} onPress={submit} loading={apply.isPending} />}
    >
      <AppText color={color.inkMuted}>{t("apply.intro")}</AppText>

      <Section title={t("apply.servicesLabel")}>
        {services.isPending ? (
          <LoadingState />
        ) : services.isError ? (
          <ErrorState error={services.error} onRetry={() => void services.refetch()} />
        ) : (
          <View style={styles.wrap}>
            {services.data.map((s) => (
              <Chip
                key={s.id}
                label={serviceName(s, lang)}
                icon={selected.includes(s.id) ? "checkmark" : undefined}
                selected={selected.includes(s.id)}
                onPress={() => toggle(s.id)}
              />
            ))}
          </View>
        )}
        {touched && selected.length === 0 && (
          <AppText variant="caption" color={color.danger}>
            {t("apply.pickOne")}
          </AppText>
        )}
      </Section>

      <TextField
        label={t("apply.bioLabel")}
        placeholder={t("apply.bioPlaceholder")}
        value={bio}
        onChangeText={setBio}
        multiline
        maxLength={500}
      />

      {apply.isError && <Banner tone="error">{errorMessage(t, apply.error)}</Banner>}
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
});
