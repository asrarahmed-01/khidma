/**
 * Mapbox access. The public token (pk.…) comes from EXPO_PUBLIC_MAPBOX_TOKEN in mobile/.env;
 * public tokens are meant to ship inside apps, so this is safe to bundle.
 *
 * The interactive map (@rnmapbox/maps) is native code: it exists in development and store
 * builds, not in Expo Go or on the web. There the app shows a static Mapbox image instead.
 */
export const MAPBOX_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? "";

export type MapboxModule = typeof import("@rnmapbox/maps");

interface Point {
  lat: number;
  lng: number;
}

const pin = (icon: string, colorHex: string, p: Point) =>
  `pin-l-${icon}+${colorHex.replace("#", "").toLowerCase()}(${p.lng.toFixed(5)},${p.lat.toFixed(5)})`;

/**
 * A Mapbox Static Images API URL showing the customer's home and, once known, the
 * technician. With both, `auto` fits the view around the two pins.
 * https://docs.mapbox.com/api/maps/static-images/
 */
export function staticMapUrl(opts: {
  home: Point;
  technician: Point | null;
  width: number;
  height: number;
  token: string;
  colors: { home: string; technician: string };
}): string {
  const overlays = [pin("home", opts.colors.home, opts.home)];
  if (opts.technician) overlays.push(pin("car", opts.colors.technician, opts.technician));
  const view = opts.technician ? "auto" : `${opts.home.lng.toFixed(5)},${opts.home.lat.toFixed(5)},14`;
  const size = `${Math.min(1280, Math.round(opts.width))}x${Math.min(1280, Math.round(opts.height))}@2x`;
  const params = new URLSearchParams({ access_token: opts.token, attribution: "true", logo: "true" });
  if (opts.technician) params.set("padding", "60");
  return `https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/${overlays.join(",")}/${view}/${size}?${params}`;
}
