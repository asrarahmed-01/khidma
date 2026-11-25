import * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";
import { useEffect } from "react";
import { api } from "@/api";
import { useRealtime } from "@/realtime/store";
import { notificationTarget } from "./links";
import { pushSupported, registerForPushNotifications } from "./push";

// In the foreground, show notifications as banners, except chat messages for the
// conversation that's already on screen.
Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const target = notificationTarget(notification.request.content.data);
    const viewing = useRealtime.getState().viewingChat;
    const alreadyOnScreen = !!viewing && target === `/chat/${viewing}`;
    return {
      shouldShowBanner: !alreadyOnScreen,
      shouldShowList: true,
      shouldPlaySound: !alreadyOnScreen,
      shouldSetBadge: false,
    };
  },
});

// Notification taps already acted on, so remounting doesn't open the same screen twice.
const handled = new Set<string>();

/**
 * While signed in: registers this device's push token with the API (each launch, so a
 * changed token is picked up), and opens the right screen when a notification is tapped,
 * including the one that launched the app.
 */
export function usePushNotifications(signedIn: boolean) {
  const router = useRouter();

  useEffect(() => {
    if (!signedIn || !pushSupported()) return;
    let cancelled = false;
    void registerForPushNotifications().then((pushToken) => {
      if (pushToken && !cancelled) void api.updateMe({ pushToken }).catch(() => undefined);
    });
    return () => {
      cancelled = true;
    };
  }, [signedIn]);

  useEffect(() => {
    if (!signedIn || !pushSupported()) return;
    const open = (response: Notifications.NotificationResponse | null) => {
      if (!response) return;
      const id = `${response.notification.request.identifier}:${response.actionIdentifier}`;
      if (handled.has(id)) return;
      handled.add(id);
      const target = notificationTarget(response.notification.request.content.data);
      if (target) router.push(target);
    };
    open(Notifications.getLastNotificationResponse());
    const subscription = Notifications.addNotificationResponseReceivedListener(open);
    return () => subscription.remove();
  }, [signedIn, router]);
}
