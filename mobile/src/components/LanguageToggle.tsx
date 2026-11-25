import { Pressable, StyleSheet } from "react-native";
import { useLocale } from "@/i18n/locale";
import { color, radius, space } from "@/theme";
import { AppText } from "./AppText";

/** Shows the *other* language in its own script, so people who can't read the current one can still find it. */
export function LanguageToggle({ onDark, onChange }: { onDark?: boolean; onChange?: (lang: "ar" | "en") => void }) {
  const { lang, setLang } = useLocale();
  const next = lang === "ar" ? "en" : "ar";
  return (
    <Pressable
      onPress={() => {
        setLang(next);
        onChange?.(next);
      }}
      accessibilityRole="button"
      accessibilityLanguage={next}
      hitSlop={8}
      style={({ pressed }) => [styles.pill, onDark ? styles.dark : styles.light, pressed && styles.pressed]}
    >
      <AppText variant="label" color={onDark ? color.white : color.oasis}>
        {next === "ar" ? "العربية" : "English"}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: { paddingHorizontal: space.md, minHeight: 34, justifyContent: "center", borderRadius: radius.pill, borderWidth: 1 },
  dark: { borderColor: "rgba(255,255,255,0.35)" },
  light: { borderColor: color.line, backgroundColor: color.surface },
  pressed: { opacity: 0.7 },
});
