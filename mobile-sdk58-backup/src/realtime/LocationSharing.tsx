import * as Location from "expo-location";
import { useEffect } from "react";
import type { Socket } from "socket.io-client";
import { useBookings } from "@/api/hooks";
import { watchLocation, type Coords } from "@/lib/watch-location";
import { realtime } from "./store";

/** How often the technician's phone reports its position on the way to a job. */
export const SHARE_EVERY_MS = 5000;
const SHARE_EVERY_METRES = 15;

/**
 * While the technician has a job in EN_ROUTE, watch the phone's position and send it to
 * the server, which forwards it to that job's customer. It starts when they tap "I'm on my
 * way" and stops as soon as they start the job (or the app closes: foreground only).
 *
 * Renders nothing; the booking screen shows the sharing state from the realtime store.
 */
export function LocationSharing({ socket }: { socket: Socket }) {
  const { data: active } = useBookings("active");
  const tripId = active?.find((b) => b.status === "EN_ROUTE")?.id;

  useEffect(() => {
    if (!tripId) {
      realtime.setSharing(null);
      return;
    }

    let stopped = false;
    let unwatch: (() => void) | null = null;
    realtime.setSharing({ bookingId: tripId, state: "starting" });

    // At most one update per SHARE_EVERY_MS, always ending with the newest position.
    let lastSentAt = 0;
    let pending: Coords | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const send = (coords: Coords) => {
      // While reconnecting, skip the update: Socket.IO would otherwise queue it and replay
      // stale positions later. The next position after reconnecting goes out as normal.
      if (!socket.connected) return;
      lastSentAt = Date.now();
      socket.emit("location:update", { lat: coords.latitude, lng: coords.longitude, heading: coords.heading });
    };
    const report = (coords: Coords) => {
      const wait = SHARE_EVERY_MS - (Date.now() - lastSentAt);
      if (wait <= 0) return send(coords);
      pending = coords;
      timer ??= setTimeout(() => {
        timer = null;
        if (pending && !stopped) send(pending);
        pending = null;
      }, wait);
    };

    void (async () => {
      try {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (stopped) return;
        if (permission.status !== "granted") {
          realtime.setSharing({ bookingId: tripId, state: "denied" });
          return;
        }
        const stop = await watchLocation(report, { intervalMs: SHARE_EVERY_MS, distanceMetres: SHARE_EVERY_METRES });
        if (stopped) return stop();
        unwatch = stop;
        realtime.setSharing({ bookingId: tripId, state: "sharing" });
      } catch {
        if (!stopped) realtime.setSharing({ bookingId: tripId, state: "error" });
      }
    })();

    return () => {
      stopped = true;
      unwatch?.();
      if (timer) clearTimeout(timer);
      realtime.setSharing(null);
    };
  }, [socket, tripId]);

  return null;
}
