import Constants from "expo-constants";
import { Platform } from "react-native";

const API_PORT = 4000;

/**
 * Where the API lives.
 * 1. EXPO_PUBLIC_API_URL wins if set (staging, production, or a tunnel).
 * 2. In development, the Expo dev server and the API both run on your computer, so the
 *    app reuses the dev server's host. This makes a real phone on the same Wi-Fi work
 *    with no configuration.
 * 3. Otherwise fall back to the emulator/simulator loopback address.
 */
export function resolveApiUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  if (fromEnv) return fromEnv.replace(/\/+$/, "");

  if (Platform.OS === "web") return `http://localhost:${API_PORT}`;

  const devHost = Constants.expoConfig?.hostUri?.split(":")[0];
  if (devHost) return `http://${devHost}:${API_PORT}`;

  return Platform.OS === "android" ? `http://10.0.2.2:${API_PORT}` : `http://localhost:${API_PORT}`;
}

export const API_URL = resolveApiUrl();
