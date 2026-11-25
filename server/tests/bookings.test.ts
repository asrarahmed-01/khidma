import request from "supertest";
import { prisma } from "../src/db";
import {
  auth,
  bookingBody,
  login,
  makeAdmin,
  makeApp,
  makeTechnician,
  resetDb,
  seedServices,
} from "./helpers";

describe("bookings", () => {
  let ctx: ReturnType<typeof makeApp>;
  let services: Awaited<ReturnType<typeof seedServices>>;
  let admin: { token: string };
  let customer: { token: string; userId: string };

  beforeEach(async () => {
    await resetDb();
    ctx = makeApp();
    services = await seedServices();
    admin = await makeAdmin(ctx.app, ctx.sms, "0500000001");
    customer = await login(ctx.app, ctx.sms, "0511111111");
  });

  afterEach(() => ctx.events.settled());
  afterAll(() => prisma.$disconnect());

  const createBooking = async (overrides: Record<string, unknown> = {}) => {
    const res = await request(ctx.app)
      .post("/bookings")
      .set(auth(customer.token))
      .send(bookingBody(services.ac.id, overrides))
      .expect(201);
    return res.body.booking;
  };

  it("lists the service catalog in both languages without a login", async () => {
    const res = await request(ctx.app).get("/services").expect(200);
    expect(res.body.services).toHaveLength(2);
    expect(res.body.services[0]).toMatchObject({ slug: "plumbing", nameAr: "سباكة", basePriceHalalas: 12000 });
  });

  it("creates a booking with a price snapshot", async () => {
    const booking = await createBooking();
    expect(booking).toMatchObject({ status: "PENDING", priceHalalas: 15000, serviceArea: "riyadh", technician: null });

    // Raising the price later must not change existing bookings.
    await prisma.service.update({ where: { id: services.ac.id }, data: { basePriceHalalas: 99900 } });
    const res = await request(ctx.app).get(`/bookings/${booking.id}`).set(auth(customer.token)).expect(200);
    expect(res.body.booking.priceHalalas).toBe(15000);
  });

  it("only accepts addresses inside a city Khidma serves", async () => {
    const send = (lat: number, lng: number) =>
      request(ctx.app).post("/bookings").set(auth(customer.token)).send(bookingBody(services.ac.id, { lat, lng }));

    const khobar = await send(26.2794, 50.2083);
    expect(khobar.status).toBe(201);
    expect(khobar.body.booking.serviceArea).toBe("dammam-khobar");

    const jeddah = await send(21.5433, 39.1728);
    expect(jeddah.body.booking.serviceArea).toBe("jeddah");

    for (const [lat, lng] of [
      [26.2235, 50.5876], // Manama, Bahrain: just across the causeway from Khobar
      [25.2048, 55.2708], // Dubai
      [27.0046, 49.6603], // Jubail: in Saudi Arabia, but not served yet
    ]) {
      const res = await send(lat, lng);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("OUTSIDE_SERVICE_AREA");
    }
  });

  it("rejects bookings in the past or too far ahead", async () => {
    const send = (overrides: Record<string, unknown>) =>
      request(ctx.app).post("/bookings").set(auth(customer.token)).send(bookingBody(services.ac.id, overrides));

    expect((await send({ scheduledAt: new Date(Date.now() - 3_600_000).toISOString() })).body.error.code).toBe(
      "SCHEDULED_IN_PAST",
    );
    expect((await send({ scheduledAt: new Date(Date.now() + 40 * 86_400_000).toISOString() })).body.error.code).toBe(
      "SCHEDULED_TOO_FAR",
    );
  });

  it("runs the full job lifecycle from booking to completion", async () => {
    const booking = await createBooking();
    const tech = await makeTechnician(ctx.app, ctx.sms, "0522222222", [services.ac.id], admin.token);

    // The open-jobs list hides the exact address and the customer's details until accepted.
    const open = await request(ctx.app).get("/bookings/open").set(auth(tech.token)).expect(200);
    expect(open.body.jobs).toHaveLength(1);
    expect(open.body.jobs[0]).toMatchObject({ id: booking.id, approxLocation: { lat: 24.71, lng: 46.68 } });
    expect(open.body.jobs[0]).not.toHaveProperty("address");
    expect(open.body.jobs[0]).not.toHaveProperty("customer");

    const accepted = await request(ctx.app).post(`/bookings/${booking.id}/accept`).set(auth(tech.token)).expect(200);
    expect(accepted.body.booking).toMatchObject({
      status: "ACCEPTED",
      address: { line: "King Fahd Rd, Al Olaya, Riyadh" },
      customer: { phone: "+966511111111" },
    });

    for (const status of ["EN_ROUTE", "IN_PROGRESS", "COMPLETED"]) {
      const res = await request(ctx.app)
        .post(`/bookings/${booking.id}/status`)
        .set(auth(tech.token))
        .send({ status })
        .expect(200);
      expect(res.body.booking.status).toBe(status);
    }

    const final = await request(ctx.app).get(`/bookings/${booking.id}`).set(auth(customer.token)).expect(200);
    expect(final.body.booking.technician.phone).toBe("+966522222222");
    expect(final.body.booking.timeline.completedAt).not.toBeNull();

    const past = await request(ctx.app).get("/bookings?scope=past").set(auth(customer.token)).expect(200);
    expect(past.body.bookings).toHaveLength(1);
  });

  it("gives a job to exactly one technician when two accept at the same moment", async () => {
    const booking = await createBooking();
    const techA = await makeTechnician(ctx.app, ctx.sms, "0533333333", [services.ac.id], admin.token);
    const techB = await makeTechnician(ctx.app, ctx.sms, "0544444444", [services.ac.id], admin.token);

    const results = await Promise.all([
      request(ctx.app).post(`/bookings/${booking.id}/accept`).set(auth(techA.token)),
      request(ctx.app).post(`/bookings/${booking.id}/accept`).set(auth(techB.token)),
    ]);

    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(results.find((r) => r.status === 409)!.body.error.code).toBe("BOOKING_UNAVAILABLE");
  });

  it("does not let technicians skip steps or move someone else's job", async () => {
    const booking = await createBooking();
    const tech = await makeTechnician(ctx.app, ctx.sms, "0522222222", [services.ac.id], admin.token);
    const other = await makeTechnician(ctx.app, ctx.sms, "0533333333", [services.ac.id], admin.token);
    await request(ctx.app).post(`/bookings/${booking.id}/accept`).set(auth(tech.token)).expect(200);

    const skip = await request(ctx.app)
      .post(`/bookings/${booking.id}/status`)
      .set(auth(tech.token))
      .send({ status: "COMPLETED" })
      .expect(409);
    expect(skip.body.error.code).toBe("INVALID_TRANSITION");

    await request(ctx.app)
      .post(`/bookings/${booking.id}/status`)
      .set(auth(other.token))
      .send({ status: "EN_ROUTE" })
      .expect(404);

    // Customers can't move a job forward at all.
    await request(ctx.app)
      .post(`/bookings/${booking.id}/status`)
      .set(auth(customer.token))
      .send({ status: "EN_ROUTE" })
      .expect(403);
  });

  it("keeps unapproved technicians and other services away from jobs", async () => {
    const booking = await createBooking();

    const applicant = await login(ctx.app, ctx.sms, "0555555555");
    await request(ctx.app)
      .post("/technicians/apply")
      .set(auth(applicant.token))
      .send({ serviceIds: [services.ac.id] })
      .expect(201);
    await request(ctx.app).get("/bookings/open").set(auth(applicant.token)).expect(403);
    await request(ctx.app).post(`/bookings/${booking.id}/accept`).set(auth(applicant.token)).expect(403);

    const plumber = await makeTechnician(ctx.app, ctx.sms, "0566666666", [services.plumbing.id], admin.token);
    const open = await request(ctx.app).get("/bookings/open").set(auth(plumber.token)).expect(200);
    expect(open.body.jobs).toHaveLength(0);
    await request(ctx.app).post(`/bookings/${booking.id}/accept`).set(auth(plumber.token)).expect(403);
  });

  it("hides jobs from technicians who are offline", async () => {
    const booking = await createBooking();
    const tech = await makeTechnician(ctx.app, ctx.sms, "0522222222", [services.ac.id], admin.token);
    await request(ctx.app).patch("/technicians/me").set(auth(tech.token)).send({ isAvailable: false }).expect(200);

    const open = await request(ctx.app).get("/bookings/open").set(auth(tech.token)).expect(409);
    expect(open.body.error.code).toBe("TECHNICIAN_OFFLINE");
    await request(ctx.app).post(`/bookings/${booking.id}/accept`).set(auth(tech.token)).expect(409);

    await request(ctx.app).patch("/technicians/me").set(auth(tech.token)).send({ isAvailable: true }).expect(200);
    await request(ctx.app).post(`/bookings/${booking.id}/accept`).set(auth(tech.token)).expect(200);
  });

  it("lets the customer cancel only before the technician sets off", async () => {
    const first = await createBooking();
    const cancelled = await request(ctx.app)
      .post(`/bookings/${first.id}/cancel`)
      .set(auth(customer.token))
      .send({ reason: "Fixed it myself" })
      .expect(200);
    expect(cancelled.body.booking).toMatchObject({ status: "CANCELLED", cancelReason: "Fixed it myself" });

    const second = await createBooking();
    const tech = await makeTechnician(ctx.app, ctx.sms, "0522222222", [services.ac.id], admin.token);
    await request(ctx.app).post(`/bookings/${second.id}/accept`).set(auth(tech.token)).expect(200);
    await request(ctx.app)
      .post(`/bookings/${second.id}/status`)
      .set(auth(tech.token))
      .send({ status: "EN_ROUTE" })
      .expect(200);

    const late = await request(ctx.app).post(`/bookings/${second.id}/cancel`).set(auth(customer.token)).expect(409);
    expect(late.body.error.code).toBe("CANNOT_CANCEL");

    // An admin can still cancel it.
    await request(ctx.app).post(`/bookings/${second.id}/cancel`).set(auth(admin.token)).expect(200);
  });

  it("hides bookings from people who are not part of them", async () => {
    const booking = await createBooking();
    const stranger = await login(ctx.app, ctx.sms, "0577777777");
    await request(ctx.app).get(`/bookings/${booking.id}`).set(auth(stranger.token)).expect(404);
    await request(ctx.app).get(`/bookings/${booking.id}`).set(auth(admin.token)).expect(200);
  });

  it("restricts admin routes to admins", async () => {
    await request(ctx.app).get("/admin/bookings").set(auth(customer.token)).expect(403);
    await createBooking();
    const res = await request(ctx.app).get("/admin/bookings").set(auth(admin.token)).expect(200);
    expect(res.body).toMatchObject({ total: 1, page: 1 });
  });
});
