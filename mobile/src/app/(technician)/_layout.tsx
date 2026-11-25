import { Tabs } from "expo-router/js-tabs";
import { useTranslation } from "react-i18next";
import { tabIcon, useTabScreenOptions } from "@/navigation/tabs";

export default function TechnicianTabs() {
  const { t } = useTranslation();
  const screenOptions = useTabScreenOptions();
  return (
    <Tabs screenOptions={screenOptions}>
      <Tabs.Screen name="jobs" options={{ title: t("jobs.tabNew"), tabBarIcon: tabIcon("flash-outline", "flash") }} />
      <Tabs.Screen
        name="my-jobs"
        options={{ title: t("jobs.tabMine"), tabBarIcon: tabIcon("briefcase-outline", "briefcase") }}
      />
      <Tabs.Screen
        name="account"
        options={{ title: t("tabs.account"), tabBarIcon: tabIcon("person-circle-outline", "person-circle") }}
      />
    </Tabs>
  );
}
