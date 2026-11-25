import Ionicons from "@expo/vector-icons/Ionicons";
import type { ComponentProps } from "react";
import type { ColorValue } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { color, font } from "@/theme";

type IoniconName = ComponentProps<typeof Ionicons>["name"];

// IBM Plex Sans Arabic has tall ascenders and descenders, so the labels need a taller bar
// than React Navigation's default 49pt or they get clipped.
const TAB_BAR_HEIGHT = 62;

/** Shared look for both tab bars (customer and technician). */
export function useTabScreenOptions() {
  const insets = useSafeAreaInsets();
  return {
    headerShown: false,
    tabBarActiveTintColor: color.oasis,
    tabBarInactiveTintColor: color.inkFaint,
    tabBarLabelStyle: { fontFamily: font.medium, fontSize: 12, lineHeight: 18 },
    tabBarStyle: {
      backgroundColor: color.surface,
      borderTopColor: color.line,
      height: TAB_BAR_HEIGHT + insets.bottom,
      paddingTop: 6,
    },
    sceneStyle: { backgroundColor: color.ground },
  } as const;
}

/** Filled icon when the tab is active, outline otherwise. */
export function tabIcon(name: IoniconName, activeName: IoniconName) {
  return function TabIcon({ color: tint, focused, size }: { color: ColorValue; focused: boolean; size: number }) {
    return <Ionicons name={focused ? activeName : name} size={size} color={typeof tint === "string" ? tint : undefined} />;
  };
}
