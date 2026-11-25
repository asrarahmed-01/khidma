import request from "supertest";
import { prisma } from "../src/db";
import { auth, login, makeApp, resetDb } from "./helpers";

const PHONE = "0512345678";
const E164 = "+966512345678";

describe("OTP login", () => {
  let ctx: ReturnType<typeof makeApp>;

  beforeEach(async () => {
    await resetDb();
    ctx = makeApp();
  });

  afterAll(() => prisma.$disconnect());

  it("sends a 6-digit code by SMS and stores only its hash", async () => {
    const res = await request(ctx.app).post("/auth/otp/request").send({ phone: PHONE }).expect(202);
    expect(res.body).toEqual({ phone: E164, expiresInSeconds: 300 });

    const code = ctx.sms.lastCodeFor(E164);
    expect(code).toMatch(/^\d{6}$/);
    expect(ctx.sms.sent[0].message).toContain("رمز التحقق");

    const stored = await prisma.otpCode.findFirstOrThrow({ where: { phone: E164 } });
    expect(stored.codeHash).not.toContain(code!);
    expect(stored.codeHash).toHaveLength(64);
  });

  it("creates the account on first login and returns a working token", async () => {
    await request(ctx.app).post("/auth/otp/request").send({ phone: PHONE });
    const code = ctx.sms.lastCodeFor(E164);

    const res = await request(ctx.app).post("/auth/otp/verify").send({ phone: PHONE, code }).expect(200);
    expect(res.body.isNewUser).toBe(true);
    expect(res.body.user).toMatchObject({ phone: E164, role: "CUSTOMER", locale: "AR" });

    const me = await request(ctx.app).get("/me").set(auth(res.body.token)).expect(200);
    expect(me.body.user.phone).toBe(E164);
  });

  it("logs an existing user back in instead of creating a duplicate", async () => {
    await login(ctx.app, ctx.sms, PHONE);
    await request(ctx.app).post("/auth/otp/request").send({ phone: "+966 51 234 5678" });
    const code = ctx.sms.lastCodeFor(E164);
    const res = await request(ctx.app).post("/auth/otp/verify").send({ phone: PHONE, code }).expect(200);
    expect(res.body.isNewUser).toBe(false);
    expect(await prisma.user.count()).toBe(1);
  });

  it("rejects a wrong code and reports attempts left", async () => {
    await request(ctx.app).post("/auth/otp/request").send({ phone: PHONE });
    const wrong = ctx.sms.lastCodeFor(E164) === "000000" ? "111111" : "000000";

    const res = await request(ctx.app).post("/auth/otp/verify").send({ phone: PHONE, code: wrong }).expect(400);
    expect(res.body.error).toMatchObject({ code: "OTP_INVALID", details: { attemptsLeft: 4 } });
  });

  it("locks the code after 5 wrong attempts, even if the 6th guess is right", async () => {
    await request(ctx.app).post("/auth/otp/request").send({ phone: PHONE });
    const code = ctx.sms.lastCodeFor(E164)!;
    const wrong = code === "000000" ? "111111" : "000000";

    for (let i = 0; i < 5; i++) {
      await request(ctx.app).post("/auth/otp/verify").send({ phone: PHONE, code: wrong }).expect(400);
    }
    const res = await request(ctx.app).post("/auth/otp/verify").send({ phone: PHONE, code }).expect(429);
    expect(res.body.error.code).toBe("OTP_TOO_MANY_ATTEMPTS");
  });

  it("rejects an expired code", async () => {
    await request(ctx.app).post("/auth/otp/request").send({ phone: PHONE });
    const code = ctx.sms.lastCodeFor(E164);
    await prisma.otpCode.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });

    const res = await request(ctx.app).post("/auth/otp/verify").send({ phone: PHONE, code }).expect(400);
    expect(res.body.error.code).toBe("OTP_INVALID");
  });

  it("only accepts the newest code", async () => {
    await request(ctx.app).post("/auth/otp/request").send({ phone: PHONE });
    const first = ctx.sms.lastCodeFor(E164)!;
    await request(ctx.app).post("/auth/otp/request").send({ phone: PHONE });
    const second = ctx.sms.lastCodeFor(E164)!;

    if (first !== second) {
      await request(ctx.app).post("/auth/otp/verify").send({ phone: PHONE, code: first }).expect(400);
    }
    await request(ctx.app).post("/auth/otp/verify").send({ phone: PHONE, code: second }).expect(200);
  });

  it("limits each number to 3 codes per window", async () => {
    for (let i = 0; i < 3; i++) {
      await request(ctx.app).post("/auth/otp/request").send({ phone: PHONE }).expect(202);
    }
    const res = await request(ctx.app).post("/auth/otp/request").send({ phone: PHONE }).expect(429);
    expect(res.body.error.code).toBe("OTP_RATE_LIMITED");
    expect(ctx.sms.sent).toHaveLength(3);
  });

  it("rejects numbers that are not Saudi mobiles", async () => {
    const res = await request(ctx.app).post("/auth/otp/request").send({ phone: "+971501234567" }).expect(400);
    expect(res.body.error.code).toBe("INVALID_PHONE");
  });

  it("validates the request body", async () => {
    const res = await request(ctx.app).post("/auth/otp/verify").send({ phone: PHONE, code: "12" }).expect(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("protects routes that need a login", async () => {
    await request(ctx.app).get("/me").expect(401);
    await request(ctx.app).get("/me").set(auth("not-a-real-token")).expect(401);
  });

  it("lets a user update their name and language", async () => {
    const { token } = await login(ctx.app, ctx.sms, PHONE);
    const res = await request(ctx.app).patch("/me").set(auth(token)).send({ name: "Asrar", locale: "EN" }).expect(200);
    expect(res.body.user).toMatchObject({ name: "Asrar", locale: "EN" });

    await request(ctx.app).patch("/me").set(auth(token)).send({ role: "ADMIN" }).expect(400);
  });
});
