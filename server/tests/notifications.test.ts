import request from "supertest";
import { prisma } from "../src/db";
import { auth, bookingBody, login, makeApp, makeTechnician, resetDb, setupJob, type TestContext } from "./helpers";

const SARA = "ExponentPushToken[sara-phone]";
const FAHD = "ExponentPushToken[fahd-phone]";

describe("push notifications", () => {
  let ctx: TestContext;
  let job: Awaited<ReturnType<typeof setupJob>>;

  const registerPush = (token: string, pushToken: string | null) =>
    request(ctx.app).patch("/me").set(auth(token)).send({ pushToken });

  beforeEach(async () => {
    await resetDb();
    ctx = makeApp();
    job = await setupJob(ctx);
    await registerPush(job.customer.token, SARA).expect(200);
    await registerPush(job.technician.token, FAHD).expect(200);
    // New accounts default to Arabic; these two use the app in English unless a test says otherwise.
    await prisma.user.updateMany({ data: { locale: "EN" } });
    await ctx.events.settled();
    ctx.push.sent.length = 0;
  });

  afterAll(() => prisma.$disconnect());

  /** Waits for the notifier, then returns what each phone received. */
  const inbox = async (token: string) => {
    await ctx.events.settled();
    return ctx.push.to(token);
  };

  it("keeps the customer posted through the job, in their language", async () => {
    await prisma.user.update({ where: { id: job.customer.userId }, data: { locale: "AR" } });

    await job.moveTo("ACCEPTED");
    expect(await inbox(SARA)).toEqual([
      expect.objectContaining({ title: "قبل Fahd طلبك", data: { url: `/booking/${job.bookingId}` } }),
    ]);

    await job.moveTo("COMPLETED");
    const titles = (await inbox(SARA)).map((m) => m.title);
    expect(titles).toEqual(["قبل Fahd طلبك", "Fahd في الطريق إليك", "بدأ العمل", "اكتمل العمل"]);
    expect((await inbox(SARA)).at(-1)?.body).toContain("150 ر.س");
    // The technician caused every one of these, so they get none of them.
    expect(await inbox(FAHD)).toEqual([]);
  });

  it("announces new jobs to online technicians who offer the service", async () => {
    const offline = await makeTechnician(ctx.app, ctx.sms, "0533333333", [job.services.ac.id], job.admin.token);
    const plumber = await makeTechnician(ctx.app, ctx.sms, "0544444444", [job.services.plumbing.id], job.admin.token);
    await request(ctx.app).patch("/technicians/me").set(auth(offline.token)).send({ isAvailable: false }).expect(200);
    await registerPush(offline.token, "ExponentPushToken[offline]").expect(200);
    await registerPush(plumber.token, "ExponentPushToken[plumber]").expect(200);
    await ctx.events.settled();

    await request(ctx.app).post("/bookings").set(auth(job.customer.token)).send(bookingBody(job.services.ac.id)).expect(201);

    expect(await inbox(FAHD)).toEqual([
      expect.objectContaining({ title: "New job: AC repair", data: { url: "/jobs" } }),
    ]);
    expect((await inbox(FAHD))[0].body).toMatch(/^Riyadh · /);
    expect(await inbox("ExponentPushToken[offline]")).toEqual([]);
    expect(await inbox("ExponentPushToken[plumber]")).toEqual([]);
  });

  it("sends chat messages to the other person, opening the chat", async () => {
    await job.moveTo("ACCEPTED");
    await request(ctx.app)
      .post(`/bookings/${job.bookingId}/messages`)
      .set(auth(job.technician.token))
      .send({ body: "I'm outside, which floor?" })
      .expect(201);

    expect(await inbox(SARA)).toContainEqual({
      to: SARA,
      title: "Fahd",
      body: "I'm outside, which floor?",
      data: { url: `/chat/${job.bookingId}` },
    });
    expect((await inbox(FAHD)).some((m) => m.data?.url?.startsWith("/chat"))).toBe(false);
  });

  it("tells the technician when the job is cancelled or paid", async () => {
    await job.moveTo("ACCEPTED");
    await request(ctx.app).post(`/bookings/${job.bookingId}/cancel`).set(auth(job.customer.token)).send({}).expect(200);
    expect((await inbox(FAHD)).map((m) => m.title)).toEqual(["Booking cancelled"]);
    expect((await inbox(SARA)).map((m) => m.title)).not.toContain("Booking cancelled");
  });

  it("tells the technician when the customer pays", async () => {
    await job.moveTo("COMPLETED");
    const { checkoutUrl } = (
      await request(ctx.app).post(`/bookings/${job.bookingId}/payment`).set(auth(job.customer.token)).send({}).expect(201)
    ).body;
    ctx.payments.pay(checkoutUrl.split("/").pop(), "paid");
    await request(ctx.app).post(`/bookings/${job.bookingId}/payment/verify`).set(auth(job.customer.token)).expect(200);

    expect(await inbox(FAHD)).toContainEqual(expect.objectContaining({ title: "Payment received", body: "150 SAR · AC repair" }));
  });

  it("tells applicants when they're approved", async () => {
    const applicant = await login(ctx.app, ctx.sms, "0555555555");
    await request(ctx.app)
      .patch("/me")
      .set(auth(applicant.token))
      .send({ pushToken: "ExponentPushToken[applicant]", locale: "EN" })
      .expect(200);
    await request(ctx.app).post("/technicians/apply").set(auth(applicant.token)).send({ serviceIds: [job.services.ac.id] });
    await request(ctx.app).post(`/admin/technicians/${applicant.userId}/approve`).set(auth(job.admin.token)).expect(200);
    expect((await inbox("ExponentPushToken[applicant]")).map((m) => m.title)).toEqual(["You're approved"]);

    // Approving twice doesn't notify twice.
    await request(ctx.app).post(`/admin/technicians/${applicant.userId}/approve`).set(auth(job.admin.token)).expect(200);
    expect(await inbox("ExponentPushToken[applicant]")).toHaveLength(1);
  });

  it("forgets tokens of uninstalled apps", async () => {
    ctx.push.unregistered.add(SARA);
    await job.moveTo("ACCEPTED");
    await ctx.events.settled();
    const sara = await prisma.user.findUniqueOrThrow({ where: { id: job.customer.userId } });
    expect(sara.pushToken).toBeNull();
  });

  it("moves a device's token to whoever signed in on it last", async () => {
    // Sara signs out without clearing her token, and Fahd signs in on the same phone.
    await registerPush(job.technician.token, SARA).expect(200);
    const sara = await prisma.user.findUniqueOrThrow({ where: { id: job.customer.userId } });
    expect(sara.pushToken).toBeNull();
  });

  it("only accepts Expo push tokens", async () => {
    const res = await registerPush(job.customer.token, "not-a-token").expect(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    await registerPush(job.customer.token, null).expect(200);
  });
});
