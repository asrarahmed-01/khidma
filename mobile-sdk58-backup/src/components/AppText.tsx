import { Platform, Text, type TextProps } from "react-native";
import { useLocale } from "@/i18n/locale";
import { color as palette, type as typeScale, type TypeVariant } from "@/theme";

export interface AppTextProps extends TextProps {
  variant?: TypeVariant;
  color?: string;
  center?: boolean;
  /** Always left-to-right, e.g. the +966 prefix. */
  ltr?: boolean;
  /** For text people wrote (chat messages): its own direction, whatever the app language. */
  textDirection?: "ltr" | "rtl";
}

/**
 * All text goes through here so the font, size and line height come from the type scale.
 *
 * No textAlign is set: on iOS and Android, React Native aligns text to the start of the
 * layout direction, so the same component reads correctly in Arabic and English. The web
 * renders text with dir="auto" (direction guessed from the first letter), which would push
 * a Latin name to the left inside an Arabic screen, so there we pass the app's direction.
 */
export function AppText({
  variant = "body",
  color = palette.ink,
  center,
  ltr,
  textDirection,
  style,
  ...rest
}: AppTextProps) {
  const { dir } = useLocale();
  const own = textDirection ?? (ltr ? "ltr" : undefined);
  const webDir = Platform.OS === "web" ? ({ dir: own ?? dir } as object) : null;
  return (
    <Text
      maxFontSizeMultiplier={1.4}
      {...webDir}
      {...rest}
      style={[
        typeScale[variant],
        { color },
        center && { textAlign: "center" },
        own && { writingDirection: own },
        style,
      ]}
    />
  );
}
