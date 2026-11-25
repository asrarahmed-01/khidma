import { useRouter } from "expo-router";
import { useEffect } from "react";
import { api } from "@/api";
import { useRealtime } from "@/realtime/store";
import { notificationTarget } from "./links";
import { pushSupported, registerForPushNotifications } from "./push";

// Avoid opening the same notification destination more than once.
const handled = new Set<string>();

/**
 * Registers push notifications and handles notification taps only in environments
 * that support the native notification module. Expo Go and web skip native imports.
 */
export function usePushNotifications(signedIn: boolean) {
  const router = useRouter();

  useEffect(() => {
    if (!signedIn || !pushSupported()) return;

    let cancelled = false;

    void registerForPushNotifications()
      .then((pushToken) => {
        if (pushToken && !cancelled) {
          void api.updateMe({ pushToken }).catch(() => undefined);
        }
      })
      .catch((error) => {
        console.warn("Push notification registration failed", error);
      });

    return () => {
      cancelled = true;
    };
  }, [signedIn]);

  useEffect(() => {
    if (!signedIn || !pushSupported()) return;

    let cancelled = false;
    let removeListener: (() => void) | undefined;

    void (async () => {
      try {
        // Dynamic import prevents Expo Go/web from loading the unavailable native module.
        const Notifications = await import("expo-notifications");

        if (cancelled) return;

        Notifications.setNotificationHandler({
          handleNotification: async (notification) => {
            const target = notificationTarget(
              notification.request.content.data
            );
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

        const open = (
          response: import("expo-notifications").NotificationResponse | null
        ) => {
          if (!response) return;

          const id = `${response.notification.request.identifier}:${response.actionIdentifier}`;

          if (handled.has(id)) return;
          handled.add(id);

          const target = notificationTarget(
            response.notification.request.content.data
          );

          if (target) router.push(target);
        };

        open(Notifications.getLastNotificationResponse());

        const subscription =
          Notifications.addNotificationResponseReceivedListener(open);

        removeListener = () => subscription.remove();

        if (cancelled) removeListener();
      } catch (error) {
        console.warn("Push notification listeners could not be initialized", error);
      }
    })();

    return () => {
      cancelled = true;
      removeListener?.();
    };
  }, [signedIn, router]);
}