import * as Location from "expo-location";

export interface Coords {
  latitude: number;
  longitude: number;
  /** Degrees from north, or null when the phone doesn't know (e.g. standing still). */
  heading: number | null;
}

/** Follows the phone's position with GPS accuracy. Returns a function that stops watching. */
export async function watchLocation(
  onChange: (coords: Coords) => void,
  options: { intervalMs: number; distanceMetres: number },
): Promise<() => void> {
  const subscription = await Location.watchPositionAsync(
    { accuracy: Location.Accuracy.High, timeInterval: options.intervalMs, distanceInterval: options.distanceMetres },
    ({ coords }) =>
      onChange({
        latitude: coords.latitude,
        longitude: coords.longitude,
        heading: coords.heading != null && coords.heading >= 0 ? coords.heading : null,
      }),
  );
  return () => subscription.remove();
}
