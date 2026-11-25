import { useRef, useState, type ComponentRef } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import { toLatinDigits } from "@/lib/phone";
import { color, font, radius, space } from "@/theme";
import { AppText } from "./AppText";

export const OTP_LENGTH = 6;

interface OtpInputProps {
  value: string;
  onChange: (code: string) => void;
  onComplete?: (code: string) => void;
  error?: boolean;
  label: string;
}

/**
 * Six boxes backed by one hidden TextInput, so paste and SMS autofill work
 * (iOS oneTimeCode, Android sms-otp). Codes are always left-to-right.
 */
export function OtpInput({ value, onChange, onComplete, error, label }: OtpInputProps) {
  const input = useRef<ComponentRef<typeof TextInput>>(null);
  const [focused, setFocused] = useState(true);

  const handleChange = (raw: string) => {
    const digits = toLatinDigits(raw).replace(/\D/g, "").slice(0, OTP_LENGTH);
    onChange(digits);
    if (digits.length === OTP_LENGTH) onComplete?.(digits);
  };

  return (
    <Pressable onPress={() => input.current?.focus()} accessible={false} style={styles.ltr}>
      <View style={styles.row}>
        {Array.from({ length: OTP_LENGTH }, (_, i) => {
          const active = focused && i === Math.min(value.length, OTP_LENGTH - 1);
          return (
            <View
              key={i}
              style={[styles.cell, active && styles.cellActive, error && styles.cellError]}
              testID={`otp-cell-${i}`}
            >
              <AppText variant="title" style={styles.digit}>
                {value[i] ?? ""}
              </AppText>
            </View>
          );
        })}
      </View>
      <TextInput
        ref={input}
        testID="otp-input"
        value={value}
        onChangeText={handleChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="sms-otp"
        maxLength={OTP_LENGTH}
        autoFocus
        caretHidden
        accessibilityLabel={label}
        style={styles.hidden}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  ltr: { direction: "ltr" },
  row: { flexDirection: "row", gap: space.sm, justifyContent: "space-between" },
  cell: {
    flex: 1,
    maxWidth: 56,
    aspectRatio: 0.85,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: color.line,
    backgroundColor: color.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  cellActive: { borderColor: color.oasis, borderWidth: 2 },
  cellError: { borderColor: color.danger },
  digit: { fontFamily: font.semibold },
  // Covers the boxes so taps focus it; invisible but still reachable by autofill and screen readers.
  hidden: { position: "absolute", top: 0, bottom: 0, start: 0, end: 0, opacity: 0.01, color: "transparent" },
});
