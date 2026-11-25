import request from "supertest";
import { prisma } from "../src/db";
import { auth, login, makeApp, resetDb, setupJob, type TestContext } from "./helpers";

describe("chat", () => {
  let ctx: TestContext;
  let job: Awaited<ReturnType<typeof setupJob>>;

  beforeEach(async () => {
    await resetDb();
    ctx = makeApp();
    job = await setupJob(ctx);
  });

  afterEach(() => ctx.events.settled());
  afterAll(() => prisma.$disconnect());

  const send = (token: string, body: object) =>
    request(ctx.app).post(`/bookings/${job.bookingId}/messages`).set(auth(token)).send(body);
  const list = (token: string, query = "") =>
    request(ctx.app).get(`/bookings/${job.bookingId}/messages${query}`).set(auth(token));

  it("opens when a technician accepts the job", async () => {
    const early = await send(job.customer.token, { body: "Hello?" }).expect(409);
    expect(early.body.error.code).toBe("CHAT_CLOSED");

    await job.moveTo("ACCEPTED");
    await send(job.customer.token, { body: "  The gate code is 4512  " }).expect(201);
    await send(job.technician.token, { body: "Thanks, see you at 10" }).expect(201);

    const res = await list(job.technician.token).expect(200);
    expect(res.body.hasMore).toBe(false);
    expect(res.body.messages.map((m: { body: string; senderId: string }) => [m.senderId, m.body])).toEqual([
      [job.customer.userId, "The gate code is 4512"], // trimmed
      [job.technician.userId, "Thanks, see you at 10"],
    ]);
  });

  it("becomes read-only when the job is done", async () => {
    await job.moveTo("ACCEPTED");
    await send(job.customer.token, { body: "On my way down" }).expect(201);
    await job.moveTo("COMPLETED");

    expect((await send(job.customer.token, { body: "Thanks!" }).expect(409)).body.error.code).toBe("CHAT_CLOSED");
    expect((await list(job.customer.token).expect(200)).body.messages).toHaveLength(1);
  });

  it("is private to the customer and technician on the job", async () => {
    await job.moveTo("ACCEPTED");
    const stranger = await login(ctx.app, ctx.sms, "0533333333");
    await list(stranger.token).expect(404);
    await send(stranger.token, { body: "hi" }).expect(404);

    // Admins can read a conversation (for disputes) but not post in it.
    await list(job.admin.token).expect(200);
    await send(job.admin.token, { body: "hi" }).expect(403);
  });

  it("rejects empty and oversized messages", async () => {
    await job.moveTo("ACCEPTED");
    await send(job.customer.token, { body: "   " }).expect(400);
    await send(job.customer.token, { body: "x".repeat(1001) }).expect(400);
    await send(job.customer.token, {}).expect(400);
  });

  it("pages back through older messages", async () => {
    await job.moveTo("ACCEPTED");
    for (let i = 1; i <= 5; i++) await send(job.customer.token, { body: `message ${i}` }).expect(201);

    const page1 = (await list(job.customer.token, "?limit=2").expect(200)).body;
    expect(page1.messages.map((m: { body: string }) => m.body)).toEqual(["message 4", "message 5"]);
    expect(page1.hasMore).toBe(true);

    const page2 = (await list(job.customer.token, `?limit=2&before=${page1.messages[0].id}`).expect(200)).body;
    expect(page2.messages.map((m: { body: string }) => m.body)).toEqual(["message 2", "message 3"]);

    const page3 = (await list(job.customer.token, `?limit=2&before=${page2.messages[0].id}`).expect(200)).body;
    expect(page3.messages.map((m: { body: string }) => m.body)).toEqual(["message 1"]);
    expect(page3.hasMore).toBe(false);

    expect((await list(job.customer.token, "?before=nope").expect(400)).body.error.code).toBe("INVALID_CURSOR");
  });

  it("slows down anyone sending more than 30 messages a minute", async () => {
    await job.moveTo("ACCEPTED");
    await prisma.message.createMany({
      data: Array.from({ length: 30 }, (_, i) => ({ bookingId: job.bookingId, senderId: job.customer.userId, body: `${i}` })),
    });
    const res = await send(job.customer.token, { body: "one more" }).expect(429);
    expect(res.body.error.code).toBe("MESSAGE_RATE_LIMITED");
    // The limit is per sender: the technician can still reply.
    await send(job.technician.token, { body: "Got it" }).expect(201);
  });
});
