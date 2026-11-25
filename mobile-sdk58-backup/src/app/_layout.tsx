import {
  IBMPlexSansArabic_400Regular,
  IBMPlexSansArabic_500Medium,
  IBMPlexSansArabic_600SemiBold,
  IBMPlexSansArabic_700Bold,
  useFonts,
} from "@expo-google-fonts/ibm-plex-sans-arabic";
import { QueryClientProvider } from "@tanstack/react-query";
import { SplashScreen, Stack, type Href } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { api } from "@/api";
import { useMe, useUpdateMe } from "@/api/hooks";
import { queryClient } from "@/api/query-client";
import { Button } from "@/components/Button";
import { Screen } from "@/components/Screen";
import { EmptyState, LoadingState } from "@/components/States";
import "@/i18n";
import { AppLocaleProvider, useLocale } from "@/i18n/locale";
import { usePushNotifications } from "@/notifications/usePushNotifications";
import { RealtimeProvider } from "@/realtime/RealtimeProvider";
import { useSession } from "@/session/store";
import { color } from "@/theme";

void SplashScreen.preventAutoHideAsync();

const restoreSession = () => useSession.getState().restore(api.me).catch(() => undefined);

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    IBMPlexSansArabic_400Regular,
    IBMPlexSansArabic_500Medium,
    IBMPlexSansArabic_600SemiBold,
    IBMPlexSansArabic_700Bold,
  });
  const status = useSession((s) => s.status);

  useEffect(() => {
    void restoreSession();
  }, []);

  const ready = fontsLoaded && status !== "loading";
  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);

  if (!fontsLoaded) return null;

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <AppLocaleProvider>
          <StatusBar style="dark" />
          {status === "loading" ? (
            <LoadingState />
          ) : status === "error" ? (
            <StartupError />
          ) : (
            <RealtimeProvider>
              <RootStack />
            </RealtimeProvider>
          )}
        </AppLocaleProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

/**
 * Which screens exist depends on who is signed in. Expo Router's protected routes redirect
 * automatically when a guard changes: signing in moves you out of the auth screens, and
 * applying as a technician switches you from the customer tabs to the technician tabs.
 * (The server still checks every request; these guards only shape the UI.)
 */
function RootStack() {
  const status = useSession((s) => s.status);
  const { data: me } = useMe(status === "signedIn");

  const signedIn = status === "signedIn" && !!me;
  const hasName = !!me?.user.name;
  const role = me?.user.role;

  usePushNotifications(signedIn);
  useServerLocale(signedIn ? me.user.locale : undefined);

  // Where a person belongs right now. Every guard redirects here when it denies access, so a
  // signed-out visit to "/" lands on sign-in and a technician opening "/" lands on their jobs.
  const home: Href = !signedIn
    ? "/sign-in"
    : !hasName
      ? "/onboarding"
      : role === "TECHNICIAN"
        ? "/jobs"
        : role === "ADMIN"
          ? "/admin"
          : "/";

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: color.ground } }}>
      <Stack.Protected guard={!signedIn} redirectTo={home}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>

      <Stack.Protected guard={signedIn && !hasName} redirectTo={home}>
        <Stack.Screen name="onboarding" />
      </Stack.Protected>

      <Stack.Protected guard={signedIn && hasName} redirectTo={home}>
        <Stack.Protected guard={role === "CUSTOMER"} redirectTo={home}>
          <Stack.Screen name="(customer)" />
          <Stack.Screen name="book/[serviceId]" />
          <Stack.Screen name="become-technician" />
        </Stack.Protected>

        <Stack.Protected guard={role === "TECHNICIAN"} redirectTo={home}>
          <Stack.Screen name="(technician)" />
        </Stack.Protected>

        <Stack.Protected guard={role === "ADMIN"} redirectTo={home}>
          <Stack.Screen name="admin" />
        </Stack.Protected>

        <Stack.Screen name="booking/[id]" />
        <Stack.Screen name="chat/[bookingId]" />
      </Stack.Protected>
    </Stack>
  );
}

/**
 * Keeps the account's language on the server in step with the app, so push notifications
 * arrive in the language the person actually uses (it can also be switched before sign-in).
 */
function useServerLocale(serverLocale: "AR" | "EN" | undefined) {
  const { lang } = useLocale();
  const { mutate } = useUpdateMe();
  useEffect(() => {
    const wanted = lang === "ar" ? "AR" : "EN";
    if (serverLocale && serverLocale !== wanted) mutate({ locale: wanted });
  }, [lang, serverLocale, mutate]);
}

function StartupError() {
  const { t } = useTranslation();
  return (
    <Screen scroll={false}>
      <EmptyState
        icon="cloud-offline-outline"
        title={t("startup.offlineTitle")}
        hint={t("startup.offlineHint")}
        action={{ label: t("common.retry"), onPress: () => void restoreSession() }}
      />
      <Button variant="quiet" label={t("common.signOut")} onPress={() => void useSession.getState().signOut()} />
    </Screen>
  );
}
