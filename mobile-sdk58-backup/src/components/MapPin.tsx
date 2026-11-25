import { StyleSheet, View } from "react-native";
import { color } from "@/theme";
import { Icon } from "./Icon";

export interface MapPoint {
  lat: number;
  lng: number;
}

/** The two markers on the tracking map: the customer's home, and the technician's car. */
export function MapPin({ kind, heading }: { kind: "home" | "technician"; heading?: number | null }) {
  const isHome = kind === "home";
  return (
    <View
      style={[styles.pin, { backgroundColor: isHome ? color.oasis : color.saffron }]}
      accessibilityElementsHidden
      importantForAccessibility="no"
    >
      <Icon name={isHome ? "home" : "car"} size={16} color={isHome ? color.white : color.ink} />
      {!isHome && heading != null && (
        <View style={[styles.headingWrap, { transform: [{ rotate: `${heading}deg` }] }]}>
          <View style={styles.heading} />
        </View>
      )}
    </View>
  );
}

const SIZE = 32;

const styles = StyleSheet.create({
  pin: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: color.white,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 3,
  },
  // A small notch on the rim pointing where the car is heading.
  headingWrap: { position: "absolute", width: SIZE + 12, height: SIZE + 12, alignItems: "center" },
  heading: {
    width: 0,
    height: 0,
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderBottomWidth: 7,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderBottomColor: color.saffron,
  },
});
