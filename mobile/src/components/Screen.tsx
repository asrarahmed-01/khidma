import type { ReactNode } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocale } from "@/i18n/locale";
import { color, space } from "@/theme";

interface ScreenProps {
  children: ReactNode;
  /** Rendered above the content, outside the scroll view. */
  header?: ReactNode;
  /** Pinned to the bottom (primary actions), above the home indicator. */
  footer?: ReactNode;
  scroll?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  /** Screens inside the tab bar don't need bottom padding for the home indicator. */
  inTabs?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
  background?: string;
  /** Set to false when the header already pads for the status bar (BrandHeader). */
  topInset?: boolean;
}

export function Screen({
  children,
  header,
  footer,
  scroll = true,
  refreshing = false,
  onRefresh,
  inTabs,
  contentStyle,
  background = color.ground,
  topInset = true,
}: ScreenProps) {
  const { dir } = useLocale();
  const insets = useSafeAreaInsets();

  const body = scroll ? (
    <ScrollView
      contentContainerStyle={[styles.content, contentStyle]}
      keyboardShouldPersistTaps="handled"
      contentInsetAdjustmentBehavior="never"
      refreshControl={
        onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={color.oasis} /> : undefined
      }
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.content, styles.fill, contentStyle]}>{children}</View>
  );

  return (
    <View style={[styles.fill, { backgroundColor: background, direction: dir }]}>
      <SafeAreaView edges={topInset ? ["top"] : []} style={styles.fill}>
        <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          {header}
          {body}
          {footer && (
            <View style={[styles.footer, { paddingBottom: (inTabs ? 0 : insets.bottom) + space.md }]}>{footer}</View>
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { padding: space.lg, paddingBottom: space.xxl, gap: space.lg },
  footer: {
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    backgroundColor: color.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: color.line,
    gap: space.sm,
  },
});
