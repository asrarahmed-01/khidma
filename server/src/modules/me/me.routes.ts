import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../db";
import { currentUser, requireAuth } from "../../middleware/auth";
import { toSelf } from "../../lib/serialize";
import { isExpoPushToken } from "../notifications/push";

const UpdateMeBody = z
  .object({
    name: z.string().trim().min(2).max(80),
    locale: z.enum(["AR", "EN"]),
    pushToken: z.string().max(512).refine(isExpoPushToken, "Not an Expo push token").nullable(),
  })
  .partial()
  .strict();

export function meRouter() {
  const router = Router();
  router.use(requireAuth);

  router.get("/", async (req, res) => {
    const user = currentUser(req);
    const technician = await prisma.technicianProfile.findUnique({
      where: { userId: user.id },
      include: { services: { select: { id: true, slug: true, nameEn: true, nameAr: true } } },
    });
    res.json({
      user: toSelf(user),
      technician: technician && {
        bio: technician.bio,
        isApproved: technician.isApproved,
        isAvailable: technician.isAvailable,
        services: technician.services,
      },
    });
  });

  router.patch("/", async (req, res) => {
    const data = UpdateMeBody.parse(req.body);
    const me = currentUser(req);
    const { pushToken } = data;
    const user = await prisma.$transaction(async (tx) => {
      if (pushToken) {
        // A phone belongs to whoever signed in on it last: anyone who used this device
        // before must stop receiving its notifications.
        await tx.user.updateMany({ where: { pushToken, id: { not: me.id } }, data: { pushToken: null } });
      }
      return tx.user.update({ where: { id: me.id }, data });
    });
    res.json({ user: toSelf(user) });
  });

  return router;
}
