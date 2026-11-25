import request from "supertest";
import { prisma } from "../src/db";
import { auth, makeApp, resetDb, setupJob, type TestContext } from "./helpers";

const RETURN_URL = "khidma://booking/return";
const WEBHOOK_SECRET = process.env.MOYASAR_WEBHOOK_SECRET!;

describe("payments", () => {
  let ctx: TestContext;
  let job: Awaited<ReturnType<typeof setupJob>>;

  beforeEach(async () => {
    await resetDb();
    ctx = makeApp();
    job = await setupJob(ctx);
  });

  afterEach(() => ctx.events.settled());
  afterAll(() => prisma.$disconnect());

  const pay = (token = job.customer.token, body: object = { returnUrl: RETURN_URL }) =>
    request(ctx.app).post(`/bookings/${job.bookingId}/payment`).set(auth(token)).send(body);
  const verify = () =>
    request(ctx.app).post(`/bookings/${job.bookingId}/payment/verify`).set(auth(job.customer.token)).expect(200);
  const invoiceIdOf = (checkoutUrl: string) => checkoutUrl.split("/").pop()!;

  it("can only be paid by the customer once the job is complete", async () => {
    await job.moveTo("IN_PROGRESS");
    expect((await pay().expect(409)).body.error.code).toBe("PAYMENT_NOT_DUE");

    await job.moveTo("COMPLETED");
    await pay(job.technician.token).expect(403);
    await pay(job.admin.token).expect(403);
  });

  it("opens a checkout for the booking price and marks the booking paid", async () => {
    await job.moveTo("COMPLETED");
    const started = (await pay().expect(201)).body;
    expect(started.checkoutUrl).toMatch(/\/payments\/simulated\/[0-9a-f-]{36}$/);
    expect(started.booking.payment).toMatchObject({ status: "INITIATED", amountHalalas: 15000 });

    const invoice = ctx.payments.get(invoiceIdOf(started.checkoutUrl))!;
    expect(invoice).toMatchObject({ amount: 15000, currency: "SAR" });
    expect(invoice.description).toContain("AC repair");

    ctx.payments.pay(invoice.id, "paid");
    const { booking } = (await verify()).body;
    expect(booking.payment).toMatchObject({ status: "PAID", method: "mada", amountHalalas: 15000 });
    expect(booking.payment.paidAt).toEqual(expect.any(String));

    // The technician sees it too, and paying twice is refused.
    const asTechnician = await request(ctx.app).get(`/bookings/${job.bookingId}`).set(auth(job.technician.token));
    expect(asTechnician.body.booking.payment.status).toBe("PAID");
    expect((await pay().expect(409)).body.error.code).toBe("ALREADY_PAID");
  });

  it("walks the browser through checkout and back into the app", async () => {
    await job.moveTo("COMPLETED");
    const { checkoutUrl } = (await pay().expect(201)).body;
    const path = new URL(checkoutUrl).pathname;

    const page = await request(ctx.app).get(path).expect(200);
    expect(page.text).toContain("SAR 150.00");
    // The checkout form may redirect to the app, and nowhere else.
    expect(page.headers["content-security-policy"]).toContain("form-action 'self' khidma:");

    const submitted = await request(ctx.app).post(path).type("form").send({ outcome: "paid" }).expect(303);
    const back = await request(ctx.app).get(new URL(submitted.headers.location!).pathname).expect(302);
    expect(back.headers.location).toBe(`${RETURN_URL}?payment=paid`);

    const payment = await prisma.payment.findUniqueOrThrow({ where: { bookingId: job.bookingId } });
    expect(payment.status).toBe("PAID");
  });

  it("keeps the checkout open after a declined card, and says why", async () => {
    await job.moveTo("COMPLETED");
    const first = (await pay().expect(201)).body;
    const path = new URL(first.checkoutUrl).pathname;

    const declined = await request(ctx.app).post(path).type("form").send({ outcome: "declined" }).expect(303);
    expect(declined.headers.location).toContain("declined=1");

    const { booking } = (await verify()).body;
    expect(booking.payment.status).toBe("INITIATED");
    const row = await prisma.payment.findUniqueOrThrow({ where: { bookingId: job.bookingId } });
    expect(row.failureMessage).toBe("INSUFFICIENT FUNDS");

    // Tapping "Pay" again reuses the same open checkout instead of creating another.
    const again = (await pay().expect(201)).body;
    expect(again.checkoutUrl).toBe(first.checkoutUrl);
  });

  it("starts a new checkout when the previous one expired", async () => {
    await job.moveTo("COMPLETED");
    const first = (await pay().expect(201)).body;
    ctx.payments.get(invoiceIdOf(first.checkoutUrl))!.status = "expired";

    const second = (await pay().expect(201)).body;
    expect(second.checkoutUrl).not.toBe(first.checkoutUrl);
    expect(second.booking.payment.status).toBe("INITIATED");
  });

  it("never marks a payment for the wrong amount as paid", async () => {
    const logged = jest.spyOn(console, "error").mockImplementation(() => undefined);
    await job.moveTo("COMPLETED");
    const { checkoutUrl } = (await pay().expect(201)).body;
    const invoice = ctx.payments.get(invoiceIdOf(checkoutUrl))!;
    invoice.amount = 100; // someone paid 1 SAR on a tampered invoice
    ctx.payments.pay(invoice.id, "paid");

    const { booking } = (await verify()).body;
    expect(booking.payment.status).toBe("FAILED");
    expect(logged).toHaveBeenCalledWith(expect.stringContaining("is for 100 SAR, expected 15000 SAR"));
    logged.mockRestore();
  });

  it("only sends customers back to the app", async () => {
    await job.moveTo("COMPLETED");
    for (const returnUrl of ["https://evil.example/phish", "javascript:alert(1)", "not a url"]) {
      const res = await pay(job.customer.token, { returnUrl }).expect(400);
      expect(res.body.error.code).toBe("INVALID_RETURN_URL");
    }
    // Expo Go and the local web build are fine during development.
    await pay(job.customer.token, { returnUrl: "exp://192.168.1.5:8081/--/booking/x" }).expect(201);
    await pay(job.customer.token, { returnUrl: "http://localhost:8081/booking/x" }).expect(201);
  });

  describe("Moyasar webhook", () => {
    const webhook = (body: object) => request(ctx.app).post("/payments/moyasar/webhook").send(body);

    it("requires the shared secret", async () => {
      await webhook({ type: "payment_paid", secret_token: "wrong", data: {} }).expect(401);
      await webhook({ type: "payment_paid", data: {} }).expect(401);
    });

    it("re-reads the invoice instead of trusting the payload, and is safe to replay", async () => {
      await job.moveTo("COMPLETED");
      const { checkoutUrl } = (await pay().expect(201)).body;
      const invoiceId = invoiceIdOf(checkoutUrl);
      const event = { type: "payment_paid", secret_token: WEBHOOK_SECRET, data: { invoice_id: invoiceId, status: "paid" } };

      // The payload claims "paid", but the invoice isn't: nothing changes.
      expect((await webhook(event).expect(200)).body).toEqual({ handled: true, status: "INITIATED" });

      ctx.payments.pay(invoiceId, "paid");
      const paidEvents: unknown[] = [];
      ctx.events.on("payment.status", (e) => void paidEvents.push(e));
      expect((await webhook(event).expect(200)).body).toEqual({ handled: true, status: "PAID" });
      await webhook(event).expect(200); // Moyasar retries; replays are harmless
      await ctx.events.settled();
      expect(paidEvents).toEqual([{ bookingId: job.bookingId, from: "INITIATED", to: "PAID" }]);
    });

    it("counts a payment once when the webhook, the return page and the app all arrive together", async () => {
      await job.moveTo("COMPLETED");
      const { checkoutUrl } = (await pay().expect(201)).body;
      const invoiceId = invoiceIdOf(checkoutUrl);
      const paymentId = (await prisma.payment.findUniqueOrThrow({ where: { bookingId: job.bookingId } })).id;
      ctx.payments.pay(invoiceId, "paid");

      const paidEvents: unknown[] = [];
      ctx.events.on("payment.status", (e) => void paidEvents.push(e));
      await Promise.all([
        webhook({ type: "payment_paid", secret_token: WEBHOOK_SECRET, data: { invoice_id: invoiceId } }).expect(200),
        request(ctx.app).get(`/payments/return/${paymentId}`).expect(302),
        verify(),
        verify(),
      ]);
      await ctx.events.settled();
      expect(paidEvents).toHaveLength(1);
    });

    it("ignores payments that aren't ours", async () => {
      jest.spyOn(console, "warn").mockImplementationOnce(() => undefined);
      const res = await webhook({ type: "payment_paid", secret_token: WEBHOOK_SECRET, data: { invoice_id: "x" } });
      expect(res.body).toEqual({ handled: false });
    });
  });
});
