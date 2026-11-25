import type { Server as HttpServer } from "node:http";
import { Server, type Socket } from "socket.io";
import { z } from "zod";
import { prisma } from "../db";
import type { BookingStatus, User } from "../generated/prisma/client";
import type { EventBus, MessageView } from "../lib/events";
import { verifyAccessToken } from "../lib/tokens";

/**
 * Socket.IO pushes changes to the app as they happen, instead of the app polling.
 *
 * Every socket joins a room for its user (`user:<id>`), plus `technicians` or `admins` by
 * role. The server decides who receives what from the booking in the database, so the
 * client never chooses a room and can't listen in on someone else's booking.
 *
 * Events carry ids, not data: on `booking:changed` the app refetches the booking through
 * the REST API, which applies the usual permission checks. Location and chat messages are
 * the exception, because they are the data, and only go to the people on that booking.
 */

export interface LocationPayload {
  bookingId: string;
  lat: number;
  lng: number;
  heading: number | null;
  at: Date;
}

export interface ServerToClientEvents {
  "booking:changed": (payload: { bookingId: string; status: BookingStatus }) => void;
  "jobs:changed": () => void;
  "message:new": (payload: { message: MessageView }) => void;
  location: (payload: LocationPayload) => void;
  "profile:changed": () => void;
}

type Ack = { ok: true; delivered: number } | { ok: false; error: { code: string; message: string } };

export interface ClientToServerEvents {
  "location:update": (payload: unknown, ack?: (result: Ack) => void) => void;
}

interface SocketData {
  user: User;
  lastLocationAt: number;
}

export type RealtimeServer = Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;
type RealtimeSocket = Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;

const LocationUpdate = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  heading: z.number().min(0).max(360).nullish(),
});

const userRoom = (id: string) => `user:${id}`;

export interface RealtimeOptions {
  events: EventBus;
  corsOrigins: string;
  /** Ignore location updates that arrive faster than this (the app sends one every few seconds). */
  minLocationIntervalMs?: number;
}

export function attachRealtime(httpServer: HttpServer, options: RealtimeOptions): RealtimeServer {
  const { events, corsOrigins, minLocationIntervalMs = 2000 } = options;
  const io: RealtimeServer = new Server(httpServer, {
    cors: { origin: corsOrigins === "*" ? true : corsOrigins.split(",") },
    serveClient: false,
  });

  // Same rule as the REST API: a valid token, and the user is loaded fresh from the database.
  io.use(async (socket, next) => {
    const token: unknown = socket.handshake.auth?.token;
    if (typeof token !== "string") return next(new Error("UNAUTHORIZED"));
    try {
      const user = await prisma.user.findUnique({ where: { id: verifyAccessToken(token).sub } });
      if (!user) return next(new Error("UNAUTHORIZED"));
      socket.data.user = user;
      socket.data.lastLocationAt = 0;
      next();
    } catch {
      next(new Error("UNAUTHORIZED"));
    }
  });

  io.on("connection", (socket: RealtimeSocket) => {
    const { user } = socket.data;
    void socket.join(userRoom(user.id));
    if (user.role === "TECHNICIAN") void socket.join("technicians");
    if (user.role === "ADMIN") void socket.join("admins");

    socket.on("location:update", async (payload, ack) => {
      const reply = typeof ack === "function" ? ack : () => undefined;
      try {
        reply(await shareLocation(socket, payload));
      } catch (err) {
        console.error("[realtime] location update failed", err);
        reply({ ok: false, error: { code: "INTERNAL_ERROR", message: "Something went wrong" } });
      }
    });
  });

  /**
   * A technician's position goes to the customer of each job they're driving to, and is
   * saved so the booking screen can show it straight away. Outside EN_ROUTE it's dropped:
   * customers see where the technician is on the way to them, never at any other time.
   */
  async function shareLocation(socket: RealtimeSocket, payload: unknown): Promise<Ack> {
    const { user } = socket.data;
    if (user.role !== "TECHNICIAN") {
      return { ok: false, error: { code: "FORBIDDEN", message: "Only technicians share their location" } };
    }
    const now = Date.now();
    if (now - socket.data.lastLocationAt < minLocationIntervalMs) {
      return { ok: false, error: { code: "LOCATION_TOO_FREQUENT", message: "Location updates are limited" } };
    }
    const parsed = LocationUpdate.safeParse(payload);
    if (!parsed.success) {
      return { ok: false, error: { code: "VALIDATION_ERROR", message: "Send { lat, lng, heading? }" } };
    }

    const trips = await prisma.booking.findMany({
      where: { technicianId: user.id, status: "EN_ROUTE" },
      select: { id: true, customerId: true },
    });
    if (trips.length === 0) {
      return { ok: false, error: { code: "NOT_EN_ROUTE", message: "Location is only shared on the way to a job" } };
    }

    socket.data.lastLocationAt = now;
    const { lat, lng } = parsed.data;
    const at = new Date(now);
    await prisma.technicianProfile.update({
      where: { userId: user.id },
      data: { lastLat: lat, lastLng: lng, lastLocationAt: at },
    });
    for (const trip of trips) {
      io.to(userRoom(trip.customerId)).emit("location", {
        bookingId: trip.id,
        lat,
        lng,
        heading: parsed.data.heading ?? null,
        at,
      });
    }
    return { ok: true, delivered: trips.length };
  }

  async function participants(bookingId: string) {
    const booking = await prisma.booking.findUniqueOrThrow({
      where: { id: bookingId },
      select: { status: true, customerId: true, technicianId: true },
    });
    const rooms = [userRoom(booking.customerId), "admins"];
    if (booking.technicianId) rooms.push(userRoom(booking.technicianId));
    return { booking, rooms };
  }

  events.on("booking.status", async ({ bookingId, from, to }) => {
    const { rooms } = await participants(bookingId);
    io.to(rooms).emit("booking:changed", { bookingId, status: to });
    // The list of open jobs changes when a job is created or leaves PENDING.
    if (from === null || from === "PENDING") io.to("technicians").emit("jobs:changed");
  });

  events.on("payment.status", async ({ bookingId }) => {
    const { booking, rooms } = await participants(bookingId);
    io.to(rooms).emit("booking:changed", { bookingId, status: booking.status });
  });

  events.on("message.created", ({ message, customerId, technicianId }) => {
    io.to([userRoom(customerId), userRoom(technicianId)]).emit("message:new", { message });
  });

  events.on("technician.approved", ({ userId }) => {
    io.to(userRoom(userId)).emit("profile:changed");
  });

  return io;
}
