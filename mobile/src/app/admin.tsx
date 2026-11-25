import { useTranslation } from "react-i18next";
import { Button } from "@/components/Button";
import { Screen } from "@/components/Screen";
import { EmptyState } from "@/components/States";
import { useSession } from "@/session/store";

/** Admins work in the Next.js dashboard (milestone 5); the mobile app just points them there. */
export default function AdminNoticeScreen() {
  const { t } = useTranslation();
  const signOut = useSession((s) => s.signOut);
  return (
    <Screen scroll={false}>
      <EmptyState icon="desktop-outline" title={t("admin.title")} hint={t("admin.body")} />
      <Button variant="secondary" label={t("common.signOut")} onPress={() => void signOut()} />
    </Screen>
  );
}
