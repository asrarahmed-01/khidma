import Ionicons from "@expo/vector-icons/Ionicons";
import type { ComponentProps } from "react";
import { useLocale } from "@/i18n/locale";
import { color as palette } from "@/theme";

export type IconName = ComponentProps<typeof Ionicons>["name"];

interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
  /** Arrows and chevrons point the other way in Arabic. */
  directional?: boolean;
}

export function Icon({ name, size = 20, color = palette.ink, directional }: IconProps) {
  const { isRTL } = useLocale();
  return (
    <Ionicons
      name={name}
      size={size}
      color={color}
      style={directional && isRTL ? { transform: [{ scaleX: -1 }] } : undefined}
      accessibilityElementsHidden
      importantForAccessibility="no"
    />
  );
}
