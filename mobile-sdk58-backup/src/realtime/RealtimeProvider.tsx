import { useQueryClient } from "@tanstack/react-query";
import { useEffect, type PropsWithChildren } from "react";
import { useMe } from "@/api/hooks";
import type { BookingStatus, LiveLocation, Message } from "@/api/types";
import { API_URL } from "@/config";
import { useSession } from "@/session/store";
import { applyRealtimeEvent, type RealtimeEvent } from "./events";
import { LocationSharing } from "./LocationSharing";
import { connectSocket } from "./socket";
import { realtime, useRealtime } from "./store";

/** The live connection, or null while signed out. */
export function useSocket() {
  return useRealtime((s) => s.socket);
}

/**
 * Keeps one Socket.IO connection open while someone is signed in, feeds what it receives
 * into the query cache, and (for technicians) runs location sharing. Reconnects with a new
 * token or role, and disconnects on sign-out.
 */
export function RealtimeProvider({ children }: PropsWithChildren) {
  const client = useQueryClient();
  const status = useSession((s) => s.status);
  const token = useSession((s) => s.token);
  const { data: me } = useMe(status === "signedIn");
  const userId = me?.user.id;
  const role = me?.user.role;
  const socket = useSocket();

  useEffect(() => {
    if (status !== "signedIn" || !token || !userId) return;

    const s = connectSocket(API_URL, token);
    const apply = (event: RealtimeEvent) => applyRealtimeEvent(client, event, userId);

    s.on("connect", () => realtime.setConnected(true));
    s.on("disconnect", () => realtime.setConnected(false));
    s.io.on("reconnect", () => apply({ type: "reconnected" }));
    s.on("booking:changed", (p: { bookingId: string; status: BookingStatus }) => apply({ type: "booking:changed", ...p }));
    s.on("jobs:changed", () => apply({ type: "jobs:changed" }));
    s.on("message:new", (p: { message: Message }) => apply({ type: "message:new", message: p.message }));
    s.on("location", (location: LiveLocation) => apply({ type: "location", location }));
    s.on("profile:changed", () => apply({ type: "profile:changed" }));
    realtime.setSocket(s);

    return () => {
      s.removeAllListeners();
      s.io.removeAllListeners();
      s.disconnect();
      realtime.reset();
    };
    // `role` is included so applying as a technician reconnects into the technicians room.
  }, [client, status, token, userId, role]);

  return (
    <>
      {children}
      {role === "TECHNICIAN" && socket && <LocationSharing socket={socket} />}
    </>
  );
}
