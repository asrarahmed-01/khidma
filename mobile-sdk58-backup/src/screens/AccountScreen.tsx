import { useRouter } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useMe } from "@/api/hooks";
import { AppText } from "@/components/AppText";
import { Button } from "@/components/Button";
import { Chip } from "@/components/Chip";
import { Icon } from "@/components/Icon";
import { Screen } from "@/components/Screen";
import { Section } from "@/components/Section";
import { API_URL } from "@/config";
import type { Lang } from "@/i18n";
import { useLocale } from "@/i18n/locale";
import { ltr } from "@/lib/bidi";
import { formatSaudiMobile } from "@/lib/phone";
import { serviceName } from "@/lib/service";
import { signOutOfThisDevice } from "@/session/sign-out";
import { color, radius, space } from "@/theme";

/** The Account tab for both customers and technicians. */
export function AccountScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { lang, setLang } = useLocale();
  const { data: me } = useMe();

  if (!me) return null;
  const { user, technician } = me;

  // The root layout copies the new language to the server, so notifications match it.
  const chooseLang = (next: Lang) => setLang(next);

  return (
    <Screen inTabs>
      <View style={styles.identity}>
        <View style={styles.avatar}>
          <AppText variant="title" color={color.oasis}>
            {(user.name ?? "?").trim().charAt(0).toUpperCase()}
          </AppText>
        </View>
        <View style={styles.flex}>
          <AppText variant="title">{user.name}</AppText>
          <AppText color={color.inkMuted}>
            {ltr(formatSaudiMobile(user.phone))}
          </AppText>
        </View>
      </View>

      {technician && (
        <Section title={technician.isApproved ? t("profile.approved") : t("profile.underReview")}>
          <AppText variant="caption" color={color.inkMuted}>
            {t("profile.yourServices")}
          </AppText>
          <View style={styles.wrap}>
            {technician.services.map((s) => (
              <View key={s.id} style={styles.tag}>
                <AppText variant="label">{serviceName(s, lang)}</AppText>
              </View>
            ))}
          </View>
        </Section>
      )}

      <Section title={t("profile.language")}>
        <View style={styles.wrap}>
          <Chip label="العربية" selected={lang === "ar"} onPress={() => chooseLang("ar")} />
          <Chip label="English" selected={lang === "en"} onPress={() => chooseLang("en")} />
        </View>
      </Section>

      {user.role === "CUSTOMER" && (
        <Pressable
          onPress={() => router.push("/become-technician")}
          accessibilityRole="button"
          style={({ pressed }) => [styles.link, pressed && styles.linkPressed]}
        >
          <Icon name="construct-outline" size={22} color={color.oasis} />
          <View style={styles.flex}>
            <AppText variant="bodyStrong">{t("profile.becomeTechnician")}</AppText>
            <AppText variant="caption" color={color.inkMuted}>
              {t("profile.becomeTechnicianHint")}
            </AppText>
          </View>
          <Icon name="chevron-forward" size={18} color={color.inkFaint} directional />
        </Pressable>
      )}

      <Button variant="secondary" icon="log-out-outline" label={t("common.signOut")} onPress={() => void signOutOfThisDevice()} />

      {__DEV__ && (
        <AppText variant="caption" color={color.inkFaint} center>
          {t("profile.server", { url: ltr(API_URL) })}
        </AppText>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  identity: { flexDirection: "row", alignItems: "center", gap: space.md, paddingVertical: space.sm },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: color.oasisTint,
    alignItems: "center",
    justifyContent: "center",
  },
  flex: { flex: 1 },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  tag: { backgroundColor: color.oasisTint, borderRadius: radius.pill, paddingHorizontal: space.md, paddingVertical: 4 },
  link: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    padding: space.lg,
    backgroundColor: color.surface,
    borderRadius: radius.lg,
  },
  linkPressed: { backgroundColor: color.oasisTint },
});
