import { useMutation } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import { api } from "@/api";
import { AppText } from "@/components/AppText";
import { BrandHeader } from "@/components/BrandHeader";
import { Button } from "@/components/Button";
import { LanguageToggle } from "@/components/LanguageToggle";
import { Screen } from "@/components/Screen";
import { Banner } from "@/components/States";
import { TextField } from "@/components/TextField";
import { Wordmark } from "@/components/Wordmark";
import { errorMessage } from "@/lib/errors";
import { normalizeSaudiMobile } from "@/lib/phone";
import { color, space } from "@/theme";

export default function SignInScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);

  const requestCode = useMutation({ mutationFn: api.requestOtp });

  const submit = () => {
    const normalized = normalizeSaudiMobile(phone);
    if (!normalized) {
      setFieldError(t("auth.invalidPhone"));
      return;
    }
    setFieldError(null);
    requestCode.mutate(normalized, {
      onSuccess: () => router.push({ pathname: "/verify", params: { phone: normalized } }),
    });
  };

  return (
    <Screen
      topInset={false}
      header={
        <BrandHeader>
          <View style={styles.topRow}>
            <Wordmark onDark />
            <LanguageToggle onDark />
          </View>
          <AppText variant="title" color={color.white} style={styles.tagline}>
            {t("auth.tagline")}
          </AppText>
        </BrandHeader>
      }
      footer={
        <Button testID="send-code" label={t("auth.sendCode")} onPress={submit} loading={requestCode.isPending} />
      }
    >
      <TextField
        testID="phone-input"
        label={t("auth.phoneLabel")}
        prefix="+966"
        placeholder="5X XXX XXXX"
        value={phone}
        onChangeText={(value) => {
          setPhone(value);
          if (fieldError) setFieldError(null);
        }}
        keyboardType="phone-pad"
        textContentType="telephoneNumber"
        autoComplete="tel"
        maxLength={16}
        returnKeyType="send"
        onSubmitEditing={submit}
        error={fieldError}
        hint={t("auth.phoneHint")}
      />
      {requestCode.isError && <Banner tone="error">{errorMessage(t, requestCode.error)}</Banner>}
    </Screen>
  );
}

const styles = StyleSheet.create({
  topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  tagline: { marginTop: space.lg, maxWidth: 320 },
});
