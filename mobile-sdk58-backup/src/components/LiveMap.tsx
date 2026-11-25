import { useState } from "react";
import { Image, StyleSheet, View, type LayoutChangeEvent } from "react-native";
import Svg, { Circle, Line, Text as SvgText } from "react-native-svg";
import { useTranslation } from "react-i18next";
import { useLocale } from "@/i18n/locale";
import { bearingDeg, distanceKm } from "@/lib/geo";
import { loadNativeMapbox, MAPBOX_TOKEN, staticMapUrl } from "@/lib/mapbox";
import { formatDistance } from "@/lib/format";
import { color, font, radius } from "@/theme";
import { MapPin, type MapPoint } from "./MapPin";
import { NativeLiveMap } from "./NativeLiveMap";

export const MAP_HEIGHT = 220;

interface LiveMapProps {
  home: MapPoint;
  technician: (MapPoint & { heading: number | null }) | null;
}

/**
 * The tracking map, in the best form available:
 * 1. the interactive Mapbox map in development/store builds (with a token),
 * 2. a static Mapbox image in Expo Go and on the web (with a token),
 * 3. without a token, a simple diagram: home in the middle, the technician by direction
 *    and distance. Good enough to try the feature before setting up Mapbox.
 */
export function LiveMap({ home, technician }: LiveMapProps) {
  const { lang } = useLocale();
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);
  const native = loadNativeMapbox();

  return (
    <View style={styles.frame} onLayout={onLayout} testID="live-map">
      {native ? (
        <NativeLiveMap mapbox={native} home={home} technician={technician} lang={lang} />
      ) : width === 0 ? null : MAPBOX_TOKEN ? (
        <StaticMap home={home} technician={technician} width={width} />
      ) : (
        <MapDiagram home={home} technician={technician} width={width} />
      )}
    </View>
  );
}

/** Positions are snapped to ~50 m, so the image is only re-requested when the car really moved. */
const snap = (v: number) => Math.round(v * 2000) / 2000;

function StaticMap({ home, technician, width }: LiveMapProps & { width: number }) {
  const uri = staticMapUrl({
    home,
    technician: technician && { lat: snap(technician.lat), lng: snap(technician.lng) },
    width,
    height: MAP_HEIGHT,
    token: MAPBOX_TOKEN,
    colors: { home: color.oasis, technician: color.saffron },
  });
  return <Image source={{ uri }} style={StyleSheet.absoluteFill} resizeMode="cover" accessibilityIgnoresInvertColors />;
}

/** Rings at "nice" distances, picked so the technician always lands inside the outer ring. */
const SCALES_KM = [0.5, 1, 2, 5, 10, 20, 50];

function MapDiagram({ home, technician, width }: LiveMapProps & { width: number }) {
  const { t } = useTranslation();
  const { lang } = useLocale();
  const cx = width / 2;
  const cy = MAP_HEIGHT / 2;
  const outer = MAP_HEIGHT / 2 - 18;

  const km = technician ? distanceKm(home.lat, home.lng, technician.lat, technician.lng) : 0;
  const scale = SCALES_KM.find((s) => s >= km) ?? SCALES_KM[SCALES_KM.length - 1];
  let carX = cx;
  let carY = cy;
  if (technician) {
    const r = Math.min(1, km / scale) * outer;
    const angle = (bearingDeg(home.lat, home.lng, technician.lat, technician.lng) * Math.PI) / 180;
    carX = cx + r * Math.sin(angle);
    carY = cy - r * Math.cos(angle);
  }

  return (
    <View style={StyleSheet.absoluteFill} accessible accessibilityLabel={t("tracking.diagramLabel")}>
      <Svg width={width} height={MAP_HEIGHT}>
        {[1, 2 / 3, 1 / 3].map((f) => (
          <Circle key={f} cx={cx} cy={cy} r={outer * f} stroke={color.oasis} strokeOpacity={0.18} fill="none" />
        ))}
        <Line x1={cx} y1={cy - outer} x2={cx} y2={cy + outer} stroke={color.oasis} strokeOpacity={0.1} />
        <Line x1={cx - outer} y1={cy} x2={cx + outer} y2={cy} stroke={color.oasis} strokeOpacity={0.1} />
        {technician && (
          <Line x1={cx} y1={cy} x2={carX} y2={carY} stroke={color.saffron} strokeWidth={2} strokeDasharray="4 5" />
        )}
        {/* Geography doesn't flip in Arabic: north stays up, east stays right. */}
        <SvgText x={cx} y={12} fontSize={11} fontFamily={font.semibold} fill={color.inkMuted} textAnchor="middle">
          {lang === "ar" ? "ش" : "N"}
        </SvgText>
        <SvgText
          x={cx + outer * 0.71 + 4}
          y={cy - outer * 0.71}
          fontSize={11}
          fontFamily={font.regular}
          fill={color.inkMuted}
        >
          {formatDistance(scale, lang)}
        </SvgText>
      </Svg>
      <View style={[styles.marker, { left: cx - 16, top: cy - 16 }]}>
        <MapPin kind="home" />
      </View>
      {technician && (
        <View style={[styles.marker, { left: carX - 16, top: carY - 16 }]} testID="map-technician">
          <MapPin kind="technician" heading={technician.heading} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    height: MAP_HEIGHT,
    borderRadius: radius.md,
    overflow: "hidden",
    backgroundColor: color.oasisTint,
    // Coordinates are geographic, so the map is laid out left-to-right in both languages.
    direction: "ltr",
  },
  marker: { position: "absolute" },
});
