import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import type { ComponentProps } from "react";
import { StyleSheet, View } from "react-native";
import { color, radius } from "@/theme";

type GlyphName = ComponentProps<typeof MaterialCommunityIcons>["name"];

// The server stores a neutral icon key per service; the app decides how to draw it.
const GLYPHS: Record<string, GlyphName> = {
  snowflake: "snowflake",
  droplet: "water-outline",
  zap: "flash-outline",
  sparkles: "broom",
  wrench: "washing-machine",
  bug: "bug-outline",
};

export function ServiceIcon({ icon, size = 48 }: { icon: string; size?: number }) {
  return (
    <View style={[styles.tile, { width: size, height: size, borderRadius: size > 40 ? radius.md : radius.sm }]}>
      <MaterialCommunityIcons name={GLYPHS[icon] ?? "tools"} size={size * 0.5} color={color.oasis} />
    </View>
  );
}

const styles = StyleSheet.create({
  tile: { backgroundColor: color.oasisTint, alignItems: "center", justifyContent: "center" },
});
