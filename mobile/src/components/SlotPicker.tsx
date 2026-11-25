import { useMemo, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useLocale } from "@/i18n/locale";
import { formatDay, formatWindow } from "@/lib/format";
import { bookableDays, isSlotAvailable, sameDay, SLOT_START_HOURS, slotStart } from "@/lib/slots";
import { space } from "@/theme";
import { Chip } from "./Chip";

interface SlotPickerProps {
  value: Date | null;
  onChange: (start: Date) => void;
  /** Injected in tests; defaults to the current time. */
  now?: Date;
}

/** Pick a day, then a 2-hour arrival window. Windows less than an hour away are disabled. */
export function SlotPicker({ value, onChange, now: nowProp }: SlotPickerProps) {
  const { t } = useTranslation();
  const { lang } = useLocale();
  const now = useMemo(() => nowProp ?? new Date(), [nowProp]);
  const days = useMemo(() => bookableDays(now), [now]);
  const [day, setDay] = useState<Date>(() => (value ? days.find((d) => sameDay(d, value)) : undefined) ?? days[0]);

  const dayLabel = (d: Date, index: number) => {
    if (sameDay(d, now)) return t("common.today");
    if (index <= 1 && d.getTime() - now.getTime() < 2 * 86_400_000) return t("common.tomorrow");
    return formatDay(d, lang);
  };

  return (
    <View style={styles.wrap}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.days}>
        {days.map((d, index) => (
          <Chip
            key={d.toISOString()}
            testID={`day-${index}`}
            label={dayLabel(d, index)}
            selected={sameDay(d, day)}
            onPress={() => setDay(d)}
          />
        ))}
      </ScrollView>
      <View style={styles.slots}>
        {SLOT_START_HOURS.map((hour) => {
          const start = slotStart(day, hour);
          return (
            <View key={hour} style={styles.slot}>
              <Chip
                testID={`slot-${hour}`}
                dense
                label={formatWindow(start, lang)}
                selected={value?.getTime() === start.getTime()}
                disabled={!isSlotAvailable(start, now)}
                onPress={() => onChange(start)}
              />
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.md },
  days: { gap: space.sm, paddingEnd: space.lg },
  slots: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  // Three equal columns; seven windows leave the last one alone on its row, aligned to the start.
  slot: { width: "31%" },
});
