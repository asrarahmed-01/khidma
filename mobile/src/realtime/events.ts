import type { QueryClient } from "@tanstack/react-query";
import { addMessage, queryKeys } from "@/api/hooks";
import type { BookingStatus, LiveLocation, Message } from "@/api/types";
import { realtime, useRealtime } from "./store";

/** Everything the server pushes over Socket.IO (server/src/realtime/socket.ts). */
export type RealtimeEvent =
  | { type: "booking:changed"; bookingId: string; status: BookingStatus }
  | { type: "jobs:changed" }
  | { type: "message:new"; message: Message }
  | { type: "location"; location: LiveLocation }
  | { type: "profile:changed" }
  | { type: "reconnected" };

/**
 * Applies a pushed event to the query cache. Booking changes only carry an id, so the
 * affected queries are refetched through the REST API (which checks permissions); chat
 * messages and locations are the data itself and go straight into the cache.
 */
export function applyRealtimeEvent(client: QueryClient, event: RealtimeEvent, myUserId: string | undefined) {
  switch (event.type) {
    case "booking:changed":
      void client.invalidateQueries({ queryKey: queryKeys.booking(event.bookingId) });
      void client.invalidateQueries({ queryKey: queryKeys.allBookings });
      return;

    case "jobs:changed":
      void client.invalidateQueries({ queryKey: queryKeys.openJobs });
      return;

    case "message:new": {
      const { message } = event;
      addMessage(client, message);
      const onScreen = useRealtime.getState().viewingChat === message.bookingId;
      if (message.senderId !== myUserId && !onScreen) realtime.bumpUnread(message.bookingId);
      return;
    }

    case "location":
      client.setQueryData(queryKeys.location(event.location.bookingId), event.location);
      return;

    case "profile:changed":
      void client.invalidateQueries({ queryKey: queryKeys.me });
      return;

    case "reconnected":
      // Anything could have happened while we were offline.
      void client.invalidateQueries({ queryKey: queryKeys.allBookings });
      void client.invalidateQueries({ queryKey: ["booking"] });
      void client.invalidateQueries({ queryKey: ["messages"] });
      void client.invalidateQueries({ queryKey: queryKeys.openJobs });
      return;
  }
}
