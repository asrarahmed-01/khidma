import { useMutation } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import { api } from "@/api";
import { ApiError } from "@/api/client";
import { AppText } from "@/components/AppText";
import { Button } from "@/components/Button";
import { OTP_LENGTH, OtpInput } from "@/components/OtpInput";
import { Screen } from "@/components/Screen";
import { Banner } from "@/components/States";
import { TopBar } from "@/components/TopBar";
import { errorMessage } from "@/lib/errors";
import { ltr } from "@/lib/bidi";
import { formatSaudiMobile } from "@/lib/phone";
import { useSession } from "@/session/store";
import { color, space } from "@/theme";

const RESEND_SECONDS = 60;

export default function VerifyScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { phone = "" } = useLocalSearchParams<{ phone: string }>();
  const signIn = useSession((s) => s.signIn);

  const [code, setCode] = useState("");
  const [secondsLeft, setSecondsLeft] = useState(RESEND_SECONDS);
  const [resent, setResent] = useState(false);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft]);

  // Verifying and signing in are one step for the person: the route guards take over once it succeeds.
  const verify = useMutation({
    mutationFn: async (value: string) => {
      const { token } = await api.verifyOtp(phone, value);
      await signIn(token, api.me);
    },
    onError: () => setCode(""),
  });

  const resend = useMutation({
    mutationFn: () => api.requestOtp(phone),
    onSuccess: () => {
      setSecondsLeft(RESEND_SECONDS);
      setResent(true);
      verify.reset();
    },
  });

  const submit = (value = code) => {
    if (value.length === OTP_LENGTH && !verify.isPending) verify.mutate(value);
  };

  const verifyError = (() => {
    const error = verify.error;
    if (!error) return null;
    const attemptsLeft = error instanceof ApiError ? error.details?.attemptsLeft : undefined;
    if (error instanceof ApiError && error.code === "OTP_INVALID" && typeof attemptsLeft === "number") {
      return t("auth.attemptsLeft", { count: attemptsLeft });
    }
    return errorMessage(t, error);
  })();

  return (
    <Screen
      header={<TopBar title="" />}
      footer={
        <Button
          testID="verify"
          label={t("auth.verify")}
          onPress={() => submit()}
          disabled={code.length < OTP_LENGTH}
          loading={verify.isPending}
        />
      }
    >
      <View style={styles.intro}>
        <AppText variant="display">{t("auth.verifyTitle")}</AppText>
        <AppText color={color.inkMuted}>
          {t("auth.verifySubtitle", { phone: ltr(formatSaudiMobile(phone)) })}
        </AppText>
        <Pressable onPress={() => router.back()} accessibilityRole="link" hitSlop={8}>
          <AppText variant="label" color={color.oasis}>
            {t("auth.changeNumber")}
          </AppText>
        </Pressable>
      </View>

      <OtpInput
        label={t("auth.verifyTitle")}
        value={code}
        onChange={(value) => {
          setCode(value);
          if (verify.isError) verify.reset();
        }}
        onComplete={submit}
        error={!!verifyError}
      />

      {verifyError && <Banner tone="error">{verifyError}</Banner>}
      {resend.isError && <Banner tone="error">{errorMessage(t, resend.error)}</Banner>}
      {resent && !verifyError && !resend.isError && <Banner tone="success">{t("auth.codeSent")}</Banner>}

      {secondsLeft > 0 ? (
        <AppText variant="label" color={color.inkMuted}>
          {t("auth.resendIn", { seconds: secondsLeft })}
        </AppText>
      ) : (
        <Button
          variant="quiet"
          compact
          label={t("auth.resend")}
          onPress={() => resend.mutate()}
          loading={resend.isPending}
          style={styles.resend}
        />
      )}

      {__DEV__ && <Banner tone="info">{t("auth.devHint")}</Banner>}
    </Screen>
  );
}

const styles = StyleSheet.create({
  intro: { gap: space.xs, marginBottom: space.sm },
  resend: { alignSelf: "flex-start" },
});
