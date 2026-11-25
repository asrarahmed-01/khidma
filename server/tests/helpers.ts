import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { io as connect, type Socket } from "socket.io-client";
import request from "supertest";
import { createApp } from "../src/app";
import { prisma } from "../src/db";
import { EventBus } from "../src/lib/events";
import { normalizeSaudiMobile } from "../src/lib/phone";
import { MemorySmsProvider } from "../src/modules/auth/sms";
import { MemoryPushProvider } from "../src/modules/notifications/push";
import { SimulatedGateway } from "../src/modules/payments/simulated";
import { attachRealtime } from "../src/realtime/socket";

export type TestApp = ReturnType<typeof createApp>;

/** The app with in-memory SMS, push and payments; `events.settled()` waits for side effects. */
export function makeApp() {
  const sms = new MemorySmsProvider();
  const push = new MemoryPushProvider();
  const payments = new SimulatedGateway();
  const events = new EventBus();
  return { app: createApp({ sms, push, payments, events }), sms, push, payments, events };
}

export type TestContext = ReturnType<typeof makeApp>;

/** Runs the app on a real port with Socket.IO attached, like server.ts does. */
export async function startServer(ctx: TestContext, minLocationIntervalMs = 0) {
  const server = createServer(ctx.app);
  const io = attachRealtime(server, { events: ctx.events, corsOrigins: "*", minLocationIntervalMs });
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const sockets: Socket[] = [];

  return {
    url,
    /** Connects a socket.io client the way the app does, and waits until it's connected. */
    async connect(token: string | undefined) {
      const socket = connect(url, { auth: token ? { token } : {}, transports: ["websocket"], reconnection: false });
      sockets.push(socket);
      await new Promise<void>((resolve, reject) => {
        socket.once("connect", () => resolve());
        socket.once("connect_error", reject);
      });
      return socket;
    },
    async close() {
      sockets.forEach((s) => s.disconnect());
      await io.close();
    },
  };
}

/** Resolves with the next `event` this socket receives (or fails after `ms`). */
export function nextEvent<T = unknown>(socket: Socket, event: string, ms = 3000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`No "${event}" within ${ms} ms`)), ms);
    socket.once(event, (payload: T) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });
}

/** Resolves true if `event` arrives within `ms`, false otherwise. */
export function receives(socket: Socket, event: string, ms = 300): Promise<boolean> {
  return nextEvent(socket, event, ms).then(
    () => true,
    () => false,
  );
}

/** Empties every table between tests (keeps the schema). */
export async function resetDb() {
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'`;
  if (tables.length === 0) return;
  const list = tables.map((t) => `"public"."${t.tablename}"`).join(", ");
  await prisma.$executeRawUnsafe(`TRUNCATE ${list} RESTART IDENTITY CASCADE`);
}

/** Logs in through the real OTP flow and returns the bearer token. */
export async function login(app: TestApp, sms: MemorySmsProvider, phone: string) {
  await request(app).post("/auth/otp/request").send({ phone }).expect(202);
  const code = sms.lastCodeFor(normalizeSaudiMobile(phone)!);
  const res = await request(app).post("/auth/otp/verify").send({ phone, code }).expect(200);
  return { token: res.body.token as string, userId: res.body.user.id as string };
}

export async function seedServices() {
  const ac = await prisma.service.create({
    data: {
      slug: "ac-repair",
      nameEn: "AC repair",
      nameAr: "صيانة المكيفات",
      descriptionEn: "AC",
      descriptionAr: "مكيفات",
      icon: "snowflake",
      basePriceHalalas: 15000,
    },
  });
  const plumbing = await prisma.service.create({
    data: {
      slug: "plumbing",
      nameEn: "Plumbing",
      nameAr: "سباكة",
      descriptionEn: "Pipes",
      descriptionAr: "سباكة",
      icon: "droplet",
      basePriceHalalas: 12000,
    },
  });
  return { ac, plumbing };
}

export async function makeAdmin(app: TestApp, sms: MemorySmsProvider, phone: string) {
  const session = await login(app, sms, phone);
  await prisma.user.update({ where: { id: session.userId }, data: { role: "ADMIN" } });
  return session;
}

/** A technician who applied through the API, was approved by an admin, and went online. */
export async function makeTechnician(
  app: TestApp,
  sms: MemorySmsProvider,
  phone: string,
  serviceIds: string[],
  adminToken: string,
) {
  const session = await login(app, sms, phone);
  await request(app).post("/technicians/apply").set(auth(session.token)).send({ serviceIds }).expect(201);
  await request(app).post(`/admin/technicians/${session.userId}/approve`).set(auth(adminToken)).expect(200);
  await request(app).patch("/technicians/me").set(auth(session.token)).send({ isAvailable: true }).expect(200);
  return session;
}

export const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

/** A valid booking body: tomorrow, in Riyadh. */
export function bookingBody(serviceId: string, overrides: Record<string, unknown> = {}) {
  return {
    serviceId,
    scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    addressLine: "King Fahd Rd, Al Olaya, Riyadh",
    lat: 24.7136,
    lng: 46.6753,
    notes: "AC is leaking water",
    ...overrides,
  };
}

/**
 * The usual cast: an admin, a customer (Sara) and an approved, online technician (Fahd) who
 * offers AC repair, plus a booking by Sara. `moveTo` walks the booking through its lifecycle.
 */
export async function setupJob(ctx: TestContext) {
  const services = await seedServices();
  const admin = await makeAdmin(ctx.app, ctx.sms, "0500000001");
  const customer = await login(ctx.app, ctx.sms, "0511111111");
  const technician = await makeTechnician(ctx.app, ctx.sms, "0522222222", [services.ac.id], admin.token);
  await prisma.user.update({ where: { id: customer.userId }, data: { name: "Sara" } });
  await prisma.user.update({ where: { id: technician.userId }, data: { name: "Fahd" } });

  const res = await request(ctx.app)
    .post("/bookings")
    .set(auth(customer.token))
    .send(bookingBody(services.ac.id))
    .expect(201);
  const bookingId: string = res.body.booking.id;

  const steps = ["ACCEPTED", "EN_ROUTE", "IN_PROGRESS", "COMPLETED"] as const;
  async function moveTo(status: (typeof steps)[number]) {
    const current = (await prisma.booking.findUniqueOrThrow({ where: { id: bookingId } })).status;
    for (const step of steps.slice(steps.indexOf(current as never) + 1, steps.indexOf(status) + 1)) {
      if (step === "ACCEPTED") {
        await request(ctx.app).post(`/bookings/${bookingId}/accept`).set(auth(technician.token)).expect(200);
      } else {
        await request(ctx.app)
          .post(`/bookings/${bookingId}/status`)
          .set(auth(technician.token))
          .send({ status: step })
          .expect(200);
      }
    }
  }

  return { services, admin, customer, technician, bookingId, moveTo };
}
