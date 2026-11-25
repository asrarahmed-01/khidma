import Constants, { ExecutionEnvironment } from "expo-constants";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { color } from "@/theme";

/**
 * Remote push needs a development or store build: Expo Go and the web can't receive them
 * (https://docs.expo.dev/push-notifications/what-you-need-to-know/).
 */
export function pushSupported(): boolean {
  return Platform.OS !== "web" && Constants.executionEnvironment !== ExecutionEnvironment.StoreClient;
}

/** The EAS project id, written to app.json by `eas init`. Expo push tokens are tied to it. */
function projectId(): string | undefined {
  return Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
}

/**
 * Asks for permission and returns this device's Expo push token, or null if push isn't
 * possible here (Expo Go, web, permission refused, or no EAS project configured yet).
 */
export async function registerForPushNotifications(): Promise<string | null> {
  if (!pushSupported()) return null;

  if (Platform.OS === "android") {
    // Android 8+ shows notifications through channels; the server sends to "default".
    await Notifications.setNotificationChannelAsync("default", {
      name: "Bookings and messages",
      // eslint-disable-next-line import/namespace -- a re-exported enum the lint plugin can't follow
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: color.oasis,
    });
  }

  const current = await Notifications.getPermissionsAsync();
  const status = current.status === "granted" ? current.status : (await Notifications.requestPermissionsAsync()).status;
  if (status !== "granted") return null;

  const id = projectId();
  if (!id) {
    console.warn("Push notifications: run `eas init` to add an EAS project id to app.json.");
    return null;
  }
  try {
    return (await Notifications.getExpoPushTokenAsync({ projectId: id })).data;
  } catch (error) {
    console.warn("Push notifications: couldn't get a push token", error);
    return null;
  }
}
