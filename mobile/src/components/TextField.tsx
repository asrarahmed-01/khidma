import { useState } from "react";
import { Platform, StyleSheet, TextInput, View, type TextInputProps } from "react-native";
import { useLocale } from "@/i18n/locale";
import { color, font, radius, space } from "@/theme";
import { AppText } from "./AppText";

interface TextFieldProps extends Omit<TextInputProps, "style"> {
  label: string;
  error?: string | null;
  hint?: string;
  /** Fixed text before the input, e.g. the +966 country code. Always shown left-to-right. */
  prefix?: string;
}

export function TextField({ label, error, hint, prefix, multiline, onFocus, onBlur, ...input }: TextFieldProps) {
  const [focused, setFocused] = useState(false);
  const { dir } = useLocale();
  // The web build guesses input direction from the typed text; use the app direction instead.
  const webDir = Platform.OS === "web" ? ({ dir: prefix ? "ltr" : dir } as object) : null;
  const borderColor = error ? color.danger : focused ? color.oasis : color.line;

  return (
    <View style={styles.wrap}>
      <AppText variant="label" color={color.inkMuted}>
        {label}
      </AppText>
      <View style={[styles.field, multiline && styles.multiline, { borderColor }, prefix ? styles.ltr : null]}>
        {prefix && (
          <AppText variant="bodyStrong" color={color.inkMuted} style={styles.prefix} ltr>
            {prefix}
          </AppText>
        )}
        <TextInput
          {...webDir}
          {...input}
          multiline={multiline}
          accessibilityLabel={label}
          placeholderTextColor={color.inkFaint}
          selectionColor={color.oasis}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          style={[styles.input, multiline && styles.inputMultiline]}
        />
      </View>
      {error ? (
        <AppText variant="caption" color={color.danger} accessibilityLiveRegion="polite">
          {error}
        </AppText>
      ) : hint ? (
        <AppText variant="caption" color={color.inkMuted}>
          {hint}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.xs + 2 },
  field: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderRadius: radius.md,
    backgroundColor: color.surface,
    paddingHorizontal: space.md,
  },
  // Phone numbers read left-to-right even in Arabic.
  ltr: { direction: "ltr" },
  multiline: { alignItems: "flex-start", paddingVertical: space.sm },
  prefix: { marginEnd: space.sm, paddingEnd: space.sm, borderEndWidth: 1, borderColor: color.line },
  input: {
    flex: 1,
    fontFamily: font.regular,
    fontSize: 16,
    color: color.ink,
    paddingVertical: space.sm,
    minWidth: 0,
    // The field border already shows focus; drop the browser's outline on web.
    outlineWidth: 0,
  },
  inputMultiline: { minHeight: 88, textAlignVertical: "top" },
});
