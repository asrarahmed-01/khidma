import { ActivityIndicator, StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import { errorMessage } from "@/lib/errors";
import { color, space } from "@/theme";
import { AppText } from "./AppText";
import { Button } from "./Button";
import { Icon, type IconName } from "./Icon";

export function LoadingState() {
  return (
    <View style={styles.center}>
      <ActivityIndicator color={color.oasis} size="large" />
    </View>
  );
}

interface EmptyStateProps {
  icon: IconName;
  title: string;
  hint?: string;
  action?: { label: string; onPress: () => void };
}

/** An empty screen tells people what will appear here and how to get it there. */
export function EmptyState({ icon, title, hint, action }: EmptyStateProps) {
  return (
    <View style={styles.center}>
      <View style={styles.iconRing}>
        <Icon name={icon} size={28} color={color.oasis} />
      </View>
      <AppText variant="heading" center>
        {title}
      </AppText>
      {hint && (
        <AppText color={color.inkMuted} center style={styles.hint}>
          {hint}
        </AppText>
      )}
      {action && <Button label={action.label} onPress={action.onPress} style={styles.action} />}
    </View>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const { t } = useTranslation();
  return (
    <EmptyState
      icon="cloud-offline-outline"
      title={errorMessage(t, error)}
      action={{ label: t("common.retry"), onPress: onRetry }}
    />
  );
}

type BannerTone = "info" | "error" | "success";

const TONES: Record<BannerTone, { bg: string; fg: string; icon: IconName }> = {
  info: { bg: color.saffronTint, fg: "#7A4E0E", icon: "information-circle-outline" },
  error: { bg: color.dangerTint, fg: color.danger, icon: "alert-circle-outline" },
  success: { bg: color.oasisTint, fg: color.oasis, icon: "checkmark-circle-outline" },
};

export function Banner({ tone = "info", children }: { tone?: BannerTone; children: string }) {
  const t = TONES[tone];
  return (
    <View style={[styles.banner, { backgroundColor: t.bg }]} accessibilityLiveRegion="polite" accessibilityRole="alert">
      <Icon name={t.icon} size={20} color={t.fg} />
      <AppText variant="label" color={t.fg} style={styles.bannerText}>
        {children}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: space.xl, gap: space.sm, minHeight: 320 },
  iconRing: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: color.oasisTint,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: space.sm,
  },
  hint: { maxWidth: 300 },
  action: { marginTop: space.md, alignSelf: "stretch" },
  banner: { flexDirection: "row", gap: space.sm, padding: space.md, borderRadius: 12, alignItems: "flex-start" },
  bannerText: { flex: 1 },
});
