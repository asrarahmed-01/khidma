import { useIsFocused } from "expo-router";
import { StatusBar } from "expo-status-bar";
import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { color, space } from "@/theme";
import { Crenellation } from "./Crenellation";

/**
 * The green band at the top of the sign-in and home screens. It runs under the status bar
 * and ends in the crenellated edge; content below sits on the light ground.
 */
export function BrandHeader({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const focused = useIsFocused();
  return (
    <View style={styles.band}>
      {focused && <StatusBar style="light" />}
      <View style={[styles.inner, { paddingTop: insets.top + space.md }]}>{children}</View>
      <Crenellation fill={color.ground} />
    </View>
  );
}

const styles = StyleSheet.create({
  band: { backgroundColor: color.oasis },
  inner: { paddingHorizontal: space.lg, paddingBottom: space.lg, gap: space.sm },
});
