import { StyleSheet } from "react-native";
import type { MapboxModule } from "@/lib/mapbox";
import { MapPin, type MapPoint } from "./MapPin";

interface NativeLiveMapProps {
  mapbox: MapboxModule;
  home: MapPoint;
  technician: (MapPoint & { heading: number | null }) | null;
  lang: "ar" | "en";
}

/**
 * The interactive Mapbox map (development and store builds only). The SDK module is passed
 * in rather than imported, so this file never makes Expo Go or the web load native code.
 */
export function NativeLiveMap({ mapbox, home, technician, lang }: NativeLiveMapProps) {
  const { MapView, Camera, MarkerView, StyleURL } = mapbox;
  const homeCoord: [number, number] = [home.lng, home.lat];

  return (
    <MapView
      style={StyleSheet.absoluteFill}
      styleURL={StyleURL.Street}
      localizeLabels={{ locale: lang }}
      scaleBarEnabled={false}
      compassEnabled={false}
      pitchEnabled={false}
      rotateEnabled={false}
    >
      {technician ? (
        <Camera
          bounds={{
            ne: [Math.max(home.lng, technician.lng), Math.max(home.lat, technician.lat)],
            sw: [Math.min(home.lng, technician.lng), Math.min(home.lat, technician.lat)],
          }}
          padding={{ paddingTop: 56, paddingBottom: 56, paddingLeft: 56, paddingRight: 56 }}
          animationDuration={700}
        />
      ) : (
        <Camera centerCoordinate={homeCoord} zoomLevel={14} animationDuration={0} />
      )}
      <MarkerView coordinate={homeCoord} allowOverlap>
        <MapPin kind="home" />
      </MarkerView>
      {technician && (
        <MarkerView coordinate={[technician.lng, technician.lat]} allowOverlap>
          <MapPin kind="technician" heading={technician.heading} />
        </MarkerView>
      )}
    </MapView>
  );
}
