import type { Coords } from "./watch-location";

export type { Coords } from "./watch-location";

/**
 * The browser's own geolocation watch. expo-location's web version keys its callbacks by
 * its own counter but reports positions under the browser's watch id, so once the two
 * drift apart it silently stops delivering updates; calling the browser API avoids that.
 */
export async function watchLocation(
  onChange: (coords: Coords) => void,
  options: { intervalMs: number; distanceMetres: number },
): Promise<() => void> {
  const id = navigator.geolocation.watchPosition(
    ({ coords }) =>
      onChange({
        latitude: coords.latitude,
        longitude: coords.longitude,
        heading: coords.heading != null && !Number.isNaN(coords.heading) ? coords.heading : null,
      }),
    () => undefined, // transient errors (a timeout, a lost fix): keep watching
    { enableHighAccuracy: true, maximumAge: options.intervalMs },
  );
  return () => navigator.geolocation.clearWatch(id);
}
