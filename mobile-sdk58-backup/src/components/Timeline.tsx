import { StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import type { Booking } from "@/api/types";
import { useLocale } from "@/i18n/locale";
import { formatStamp } from "@/lib/format";
import { color, space } from "@/theme";
import { AppText } from "./AppText";
import { Icon } from "./Icon";

type StepKey = "booked" | "accepted" | "enRoute" | "started" | "completed";

const STEPS: { key: StepKey; at: (b: Booking) => string | null }[] = [
  { key: "booked", at: (b) => b.timeline.createdAt },
  { key: "accepted", at: (b) => b.timeline.acceptedAt },
  { key: "enRoute", at: (b) => b.timeline.enRouteAt },
  { key: "started", at: (b) => b.timeline.startedAt },
  { key: "completed", at: (b) => b.timeline.completedAt },
];

/** The job's progress as numbered steps: these really are a sequence, so they're numbered. */
export function Timeline({ booking }: { booking: Booking }) {
  const { t } = useTranslation();
  const { lang } = useLocale();
  const cancelled = booking.status === "CANCELLED";
  const doneCount = STEPS.filter((s) => s.at(booking)).length;

  return (
    <View accessibilityRole="list">
      {STEPS.map((step, index) => {
        const at = step.at(booking);
        const done = !!at;
        const current = !cancelled && index === doneCount; // the next thing that will happen
        const last = index === STEPS.length - 1;
        return (
          <View key={step.key} style={styles.row} accessibilityRole="text">
            <View style={styles.rail}>
              <View style={[styles.node, done ? styles.nodeDone : current ? styles.nodeCurrent : styles.nodeIdle]}>
                {done ? (
                  <Icon name="checkmark" size={14} color={color.white} />
                ) : (
                  <AppText variant="caption" color={current ? color.oasis : color.inkFaint}>
                    {String(index + 1)}
                  </AppText>
                )}
              </View>
              {!last && <View style={[styles.line, done && index + 1 < doneCount && styles.lineDone]} />}
            </View>
            <View style={styles.text}>
              <AppText variant={current ? "bodyStrong" : "body"} color={done || current ? color.ink : color.inkFaint}>
                {t(`timeline.${step.key}`)}
              </AppText>
              {at && (
                <AppText variant="caption" color={color.inkMuted}>
                  {formatStamp(at, lang)}
                </AppText>
              )}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const NODE = 26;

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: space.md },
  rail: { alignItems: "center", width: NODE },
  node: { width: NODE, height: NODE, borderRadius: NODE / 2, alignItems: "center", justifyContent: "center" },
  nodeDone: { backgroundColor: color.oasis },
  nodeCurrent: { borderWidth: 2, borderColor: color.oasis, backgroundColor: color.surface },
  nodeIdle: { borderWidth: 1.5, borderColor: color.line, backgroundColor: color.surface },
  line: { width: 2, flex: 1, minHeight: 18, backgroundColor: color.line },
  lineDone: { backgroundColor: color.oasis },
  text: { flex: 1, paddingBottom: space.md, minHeight: NODE + space.md },
});
