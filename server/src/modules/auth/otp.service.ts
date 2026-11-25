import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { config } from "../../config";
import { prisma } from "../../db";
import { badRequest, tooManyRequests } from "../../lib/errors";
import { normalizeSaudiMobile } from "../../lib/phone";
import { signAccessToken } from "../../lib/tokens";
import type { SmsProvider } from "./sms";

function hashCode(phone: string, code: string): string {
  // Binding the phone into the hash means a code is only valid for the number it was sent to.
  return createHmac("sha256", config.OTP_SECRET).update(`${phone}:${code}`).digest("hex");
}

function sameHash(a: string, b: string): boolean {
  const left = Buffer.from(a, "hex");
  const right = Buffer.from(b, "hex");
  return left.length === right.length && timingSafeEqual(left, right);
}

function requirePhone(raw: string): string {
  const phone = normalizeSaudiMobile(raw);
  if (!phone) throw badRequest("INVALID_PHONE", "Enter a valid Saudi mobile number, for example 05XXXXXXXX");
  return phone;
}

export interface OtpServiceDeps {
  sms: SmsProvider;
  now?: () => Date;
  generateCode?: () => string;
}

export function createOtpService({
  sms,
  now = () => new Date(),
  generateCode = () => randomInt(0, 1_000_000).toString().padStart(6, "0"),
}: OtpServiceDeps) {
  return {
    async request(rawPhone: string) {
      const phone = requirePhone(rawPhone);
      const current = now();

      // Per-number limit, so nobody can flood one person with SMS (or run up our SMS bill).
      const windowStart = new Date(current.getTime() - config.OTP_REQUEST_WINDOW_SECONDS * 1000);
      const recent = await prisma.otpCode.count({ where: { phone, createdAt: { gte: windowStart } } });
      if (recent >= config.OTP_MAX_REQUESTS) {
        throw tooManyRequests("OTP_RATE_LIMITED", "Too many codes requested. Try again in a few minutes.", {
          retryAfterSeconds: config.OTP_REQUEST_WINDOW_SECONDS,
        });
      }

      const code = generateCode();
      await prisma.$transaction([
        // Only the newest code is valid: retire any earlier unused ones.
        prisma.otpCode.updateMany({ where: { phone, consumedAt: null }, data: { consumedAt: current } }),
        prisma.otpCode.create({
          data: {
            phone,
            codeHash: hashCode(phone, code),
            expiresAt: new Date(current.getTime() + config.OTP_TTL_SECONDS * 1000),
            createdAt: current,
          },
        }),
      ]);

      await sms.send(phone, `رمز التحقق في خدمة: ${code}\nYour Khidma verification code: ${code}`);
      return { phone, expiresInSeconds: config.OTP_TTL_SECONDS };
    },

    async verify(rawPhone: string, code: string) {
      const phone = requirePhone(rawPhone);
      const current = now();

      const otp = await prisma.otpCode.findFirst({
        where: { phone, consumedAt: null, expiresAt: { gt: current } },
        orderBy: { createdAt: "desc" },
      });
      if (!otp) throw badRequest("OTP_INVALID", "The code is wrong or has expired");

      // Count the attempt atomically before comparing, so parallel guesses can't exceed the limit.
      const counted = await prisma.otpCode.updateMany({
        where: { id: otp.id, attempts: { lt: config.OTP_MAX_ATTEMPTS } },
        data: { attempts: { increment: 1 } },
      });
      if (counted.count === 0) {
        throw tooManyRequests("OTP_TOO_MANY_ATTEMPTS", "Too many wrong attempts. Request a new code.");
      }

      if (!sameHash(hashCode(phone, code), otp.codeHash)) {
        throw badRequest("OTP_INVALID", "The code is wrong or has expired", {
          attemptsLeft: config.OTP_MAX_ATTEMPTS - (otp.attempts + 1),
        });
      }

      await prisma.otpCode.update({ where: { id: otp.id }, data: { consumedAt: current } });

      const existing = await prisma.user.findUnique({ where: { phone } });
      const user = existing ?? (await prisma.user.create({ data: { phone } }));
      return { user, token: signAccessToken(user), isNewUser: !existing };
    },
  };
}

export type OtpService = ReturnType<typeof createOtpService>;
