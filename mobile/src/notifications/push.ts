import Constants, { ExecutionEnvironment } from "expo-constants";
import { Platform } from "react-native";
import { color } from "@/theme";

/**
 * Remote push requires a development or store build.
 * Skip native notification imports in Expo Go and on web.
 */
export function pushSupported(): boolean {
  return (
    Platform.OS !== "web" &&
    Constants.executionEnvironment !== ExecutionEnvironment.StoreClient
  );
}

/** The EAS project id, written to app.json by `eas init`. */
function projectId(): string | undefined {
  return Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
}

/**
 * Returns this device's Expo push token when native push is supported.
 * Returns null in Expo Go, on web, or when permission/configuration is missing.
 */
export async function registerForPushNotifications(): Promise<string | null> {
  if (!pushSupported()) return null;

  // Load the native module only after confirming this is a supported environment.
  const Notifications = await import("expo-notifications");

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "Bookings and messages",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: color.oasis,
    });
  }

  const current = await Notifications.getPermissionsAsync();
  const status =
    current.status === "granted"
      ? current.status
      : (await Notifications.requestPermissionsAsync()).status;

  if (status !== "granted") return null;

  const id = projectId();

  if (!id) {
    console.warn(
      "Push notifications: run `eas init` to add an EAS project id to app.json."
    );
    return null;
  }

  try {
    return (await Notifications.getExpoPushTokenAsync({ projectId: id })).data;
  } catch (error) {
    console.warn("Push notifications: couldn't get a push token", error);
    return null;
  }
}