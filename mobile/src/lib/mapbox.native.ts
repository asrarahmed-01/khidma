import Constants, { ExecutionEnvironment } from "expo-constants";
import { MAPBOX_TOKEN, type MapboxModule } from "./static-map";

export { MAPBOX_TOKEN, staticMapUrl, type MapboxModule } from "./static-map";

let cached: MapboxModule | null | undefined;

/**
 * The native Mapbox SDK, or null where it isn't available: in Expo Go (it isn't part of
 * the Expo Go app) or without a token. It's required lazily so Expo Go never loads it.
 */
export function loadNativeMapbox(): MapboxModule | null {
  if (cached !== undefined) return cached;
  cached = null;
  if (!MAPBOX_TOKEN || Constants.executionEnvironment === ExecutionEnvironment.StoreClient) return cached;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mapbox = require("@rnmapbox/maps") as MapboxModule;
    mapbox.default.setAccessToken(MAPBOX_TOKEN);
    cached = mapbox;
  } catch {
    cached = null;
  }
  return cached;
}
