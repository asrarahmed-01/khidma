import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useUpdateMe } from "@/api/hooks";
import { AppText } from "@/components/AppText";
import { Button } from "@/components/Button";
import { Screen } from "@/components/Screen";
import { Banner } from "@/components/States";
import { TextField } from "@/components/TextField";
import { useLocale } from "@/i18n/locale";
import { errorMessage } from "@/lib/errors";
import { color, space } from "@/theme";

export default function OnboardingScreen() {
  const { t } = useTranslation();
  const { lang } = useLocale();
  const [name, setName] = useState("");
  const [touched, setTouched] = useState(false);
  const updateMe = useUpdateMe();

  const tooShort = name.trim().length < 2;

  const submit = () => {
    setTouched(true);
    if (tooShort) return;
    // Saving the name (and the language they chose) lets the route guard move on to the app.
    updateMe.mutate({ name: name.trim(), locale: lang === "ar" ? "AR" : "EN" });
  };

  return (
    <Screen
      footer={<Button label={t("common.continue")} onPress={submit} loading={updateMe.isPending} />}
      contentStyle={styles.content}
    >
      <View style={styles.intro}>
        <AppText variant="display">{t("onboarding.title")}</AppText>
        <AppText color={color.inkMuted}>{t("onboarding.subtitle")}</AppText>
      </View>
      <TextField
        label={t("onboarding.nameLabel")}
        value={name}
        onChangeText={setName}
        autoFocus
        autoCapitalize="words"
        textContentType="name"
        autoComplete="name"
        maxLength={80}
        returnKeyType="done"
        onSubmitEditing={submit}
        error={touched && tooShort ? t("onboarding.nameTooShort") : null}
      />
      {updateMe.isError && <Banner tone="error">{errorMessage(t, updateMe.error)}</Banner>}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: space.xxl },
  intro: { gap: space.xs },
});
