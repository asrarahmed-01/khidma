import { Router } from "express";
import { z } from "zod";
import { toSelf } from "../../lib/serialize";
import type { OtpService } from "./otp.service";

const RequestOtpBody = z.object({ phone: z.string().min(1).max(32) });
const VerifyOtpBody = z.object({
  phone: z.string().min(1).max(32),
  code: z.string().regex(/^\d{6}$/, "The code must be 6 digits"),
});

export function authRouter(otp: OtpService) {
  const router = Router();

  router.post("/otp/request", async (req, res) => {
    const { phone } = RequestOtpBody.parse(req.body);
    res.status(202).json(await otp.request(phone));
  });

  router.post("/otp/verify", async (req, res) => {
    const { phone, code } = VerifyOtpBody.parse(req.body);
    const { user, token, isNewUser } = await otp.verify(phone, code);
    res.json({ token, user: toSelf(user), isNewUser });
  });

  return router;
}
