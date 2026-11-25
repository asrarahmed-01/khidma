import type { MapboxModule } from "./static-map";

export { MAPBOX_TOKEN, staticMapUrl, type MapboxModule } from "./static-map";

/** On the web there is no native Mapbox module. (See mapbox.native.ts for iOS and Android.) */
export function loadNativeMapbox(): MapboxModule | null {
  return null;
}
