import type { Socket } from "socket.io-client";
import request from "supertest";
import { prisma } from "../src/db";
import { auth, login, makeApp, nextEvent, receives, resetDb, setupJob, startServer, type TestContext } from "./helpers";

type Ack = { ok: boolean; delivered?: number; error?: { code: string } };
const sendLocation = (socket: Socket, payload: unknown) =>
  new Promise<Ack>((resolve) => socket.emit("location:update", payload, resolve));

describe("realtime (Socket.IO)", () => {
  let ctx: TestContext;
  let server: Awaited<ReturnType<typeof startServer>>;
  let job: Awaited<ReturnType<typeof setupJob>>;

  beforeEach(async () => {
    await resetDb();
    ctx = makeApp();
    job = await setupJob(ctx);
    await ctx.events.settled();
    server = await startServer(ctx);
  });

  afterEach(async () => {
    await ctx.events.settled();
    await server.close();
  });

  afterAll(() => prisma.$disconnect());

  it("refuses connections without a valid token", async () => {
    await expect(server.connect(undefined)).rejects.toThrow("UNAUTHORIZED");
    await expect(server.connect("not-a-jwt")).rejects.toThrow("UNAUTHORIZED");
  });

  it("tells both sides when the booking changes, and technicians when open jobs change", async () => {
    const customer = await server.connect(job.customer.token);
    const technician = await server.connect(job.technician.token);

    const customerHears = nextEvent(customer, "booking:changed");
    const jobsChanged = nextEvent(technician, "jobs:changed");
    await job.moveTo("ACCEPTED");

    expect(await customerHears).toEqual({ bookingId: job.bookingId, status: "ACCEPTED" });
    await expect(jobsChanged).resolves.toBeUndefined();

    // Later steps don't touch the open-jobs list.
    const technicianHears = nextEvent(technician, "booking:changed");
    const noJobsChange = receives(technician, "jobs:changed");
    await job.moveTo("EN_ROUTE");
    expect(await technicianHears).toEqual({ bookingId: job.bookingId, status: "EN_ROUTE" });
    expect(await noJobsChange).toBe(false);
  });

  it("never sends one customer's booking events to another customer", async () => {
    const stranger = await login(ctx.app, ctx.sms, "0533333333");
    const strangerSocket = await server.connect(stranger.token);
    const overheard = receives(strangerSocket, "booking:changed");
    await job.moveTo("ACCEPTED");
    expect(await overheard).toBe(false);
  });

  it("streams the technician's location to the customer while en route, and only then", async () => {
    const customer = await server.connect(job.customer.token);
    const technician = await server.connect(job.technician.token);

    await job.moveTo("ACCEPTED");
    expect(await sendLocation(technician, { lat: 24.72, lng: 46.68 })).toMatchObject({
      ok: false,
      error: { code: "NOT_EN_ROUTE" },
    });

    await job.moveTo("EN_ROUTE");
    const arrives = nextEvent<{ bookingId: string; lat: number; lng: number; heading: number | null }>(
      customer,
      "location",
    );
    expect(await sendLocation(technician, { lat: 24.72, lng: 46.68, heading: 90 })).toEqual({ ok: true, delivered: 1 });
    expect(await arrives).toMatchObject({ bookingId: job.bookingId, lat: 24.72, lng: 46.68, heading: 90 });

    // Opening the booking shows the last position straight away.
    const res = await request(ctx.app).get(`/bookings/${job.bookingId}`).set(auth(job.customer.token)).expect(200);
    expect(res.body.booking.technicianLocation).toMatchObject({ lat: 24.72, lng: 46.68 });

    // Once work starts, the location is no longer part of the booking.
    await job.moveTo("IN_PROGRESS");
    const after = await request(ctx.app).get(`/bookings/${job.bookingId}`).set(auth(job.customer.token)).expect(200);
    expect(after.body.booking.technicianLocation).toBeNull();
    expect((await sendLocation(technician, { lat: 24.73, lng: 46.69 })).error?.code).toBe("NOT_EN_ROUTE");
  });

  it("rejects bad coordinates, non-technicians and floods of updates", async () => {
    await server.close();
    server = await startServer(ctx, 60_000); // one update per minute, to test the limit
    await job.moveTo("EN_ROUTE");
    const technician = await server.connect(job.technician.token);
    const customer = await server.connect(job.customer.token);

    expect((await sendLocation(technician, { lat: 200, lng: 46 })).error?.code).toBe("VALIDATION_ERROR");
    expect((await sendLocation(customer, { lat: 24.7, lng: 46.6 })).error?.code).toBe("FORBIDDEN");
    expect((await sendLocation(technician, { lat: 24.7, lng: 46.6 })).ok).toBe(true);
    expect((await sendLocation(technician, { lat: 24.7, lng: 46.6 })).error?.code).toBe("LOCATION_TOO_FREQUENT");
  });

  it("delivers chat messages to both people on the job", async () => {
    await job.moveTo("ACCEPTED");
    const customer = await server.connect(job.customer.token);
    const technician = await server.connect(job.technician.token);

    const toTechnician = nextEvent<{ message: { body: string; senderId: string } }>(technician, "message:new");
    const toCustomer = nextEvent<{ message: { body: string } }>(customer, "message:new"); // the sender's other devices
    await request(ctx.app)
      .post(`/bookings/${job.bookingId}/messages`)
      .set(auth(job.customer.token))
      .send({ body: "The gate code is 4512" })
      .expect(201);

    expect((await toTechnician).message).toMatchObject({ body: "The gate code is 4512", senderId: job.customer.userId });
    expect((await toCustomer).message.body).toBe("The gate code is 4512");
  });

  it("tells a technician when their account is approved", async () => {
    const applicant = await login(ctx.app, ctx.sms, "0544444444");
    await request(ctx.app)
      .post("/technicians/apply")
      .set(auth(applicant.token))
      .send({ serviceIds: [job.services.ac.id] })
      .expect(201);
    const socket = await server.connect(applicant.token);

    const approved = nextEvent(socket, "profile:changed");
    await request(ctx.app).post(`/admin/technicians/${applicant.userId}/approve`).set(auth(job.admin.token)).expect(200);
    await expect(approved).resolves.toBeUndefined();
  });
});
