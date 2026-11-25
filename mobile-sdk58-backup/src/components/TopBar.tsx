import { useRouter } from "expo-router";
import type { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import { color, space } from "@/theme";
import { AppText } from "./AppText";
import { Icon } from "./Icon";

interface TopBarProps {
  title: string;
  /** Hide the back button on screens that are the first in their stack. */
  back?: boolean;
  end?: ReactNode;
}

export function TopBar({ title, back = true, end }: TopBarProps) {
  const router = useRouter();
  const { t } = useTranslation();

  return (
    <View style={styles.bar}>
      {back && (
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}
          accessibilityRole="button"
          accessibilityLabel={t("common.back")}
          hitSlop={12}
          style={({ pressed }) => [styles.back, pressed && styles.pressed]}
        >
          <Icon name="chevron-back" size={24} directional />
        </Pressable>
      )}
      <AppText variant="heading" numberOfLines={1} style={styles.title} accessibilityRole="header">
        {title}
      </AppText>
      {end}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: space.sm,
    gap: space.xs,
    backgroundColor: color.ground,
  },
  back: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  pressed: { backgroundColor: color.oasisTint },
  title: { flex: 1, paddingHorizontal: space.sm },
});
