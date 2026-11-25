import { io, type Socket } from "socket.io-client";

/**
 * One Socket.IO connection per signed-in session, authenticated with the same JWT as the
 * REST API. WebSocket only: React Native has no use for the long-polling fallback.
 */
export function connectSocket(baseUrl: string, token: string): Socket {
  return io(baseUrl, {
    auth: { token },
    transports: ["websocket"],
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10_000,
  });
}
