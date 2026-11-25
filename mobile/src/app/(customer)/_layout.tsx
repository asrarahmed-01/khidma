import { Tabs } from "expo-router/js-tabs";
import { useTranslation } from "react-i18next";
import { tabIcon, useTabScreenOptions } from "@/navigation/tabs";

export default function CustomerTabs() {
  const { t } = useTranslation();
  const screenOptions = useTabScreenOptions();
  return (
    <Tabs screenOptions={screenOptions}>
      <Tabs.Screen name="index" options={{ title: t("tabs.home"), tabBarIcon: tabIcon("home-outline", "home") }} />
      <Tabs.Screen
        name="bookings"
        options={{ title: t("tabs.bookings"), tabBarIcon: tabIcon("calendar-clear-outline", "calendar-clear") }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: t("tabs.account"), tabBarIcon: tabIcon("person-circle-outline", "person-circle") }}
      />
    </Tabs>
  );
}
