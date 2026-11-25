import type { Socket } from "socket.io-client";
import { create } from "zustand";

export type SharingState = "starting" | "sharing" | "denied" | "error";

interface RealtimeState {
  /** The open Socket.IO connection while signed in (see RealtimeProvider). */
  socket: Socket | null;
  /** Whether the Socket.IO connection is up. While it is, polling slows right down. */
  connected: boolean;
  /** New chat messages per booking that the user hasn't seen yet. */
  unread: Record<string, number>;
  /** The booking whose chat is on screen, so its messages don't count as unread. */
  viewingChat: string | null;
  /** The technician's location sharing for the job they're driving to. */
  sharing: { bookingId: string; state: SharingState } | null;
}

export const useRealtime = create<RealtimeState>(() => ({
  socket: null,
  connected: false,
  unread: {},
  viewingChat: null,
  sharing: null,
}));

export const realtime = {
  setConnected: (connected: boolean) => useRealtime.setState({ connected }),
  bumpUnread: (bookingId: string) =>
    useRealtime.setState((s) => ({ unread: { ...s.unread, [bookingId]: (s.unread[bookingId] ?? 0) + 1 } })),
  openChat: (bookingId: string) =>
    useRealtime.setState((s) => ({ viewingChat: bookingId, unread: { ...s.unread, [bookingId]: 0 } })),
  closeChat: (bookingId: string) =>
    useRealtime.setState((s) => (s.viewingChat === bookingId ? { viewingChat: null } : s)),
  setSharing: (sharing: RealtimeState["sharing"]) => useRealtime.setState({ sharing }),
  setSocket: (socket: Socket | null) => useRealtime.setState({ socket }),
  reset: () => useRealtime.setState({ socket: null, connected: false, unread: {}, viewingChat: null, sharing: null }),
};
