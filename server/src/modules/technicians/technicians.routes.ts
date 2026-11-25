import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../db";
import { badRequest, conflict, forbidden } from "../../lib/errors";
import { currentUser, requireAuth, requireRole } from "../../middleware/auth";

const ServiceIds = z.array(z.string().min(1)).min(1, "Choose at least one service").max(20);

const ApplyBody = z.object({
  bio: z.string().trim().max(500).optional(),
  serviceIds: ServiceIds,
});

const UpdateProfileBody = z
  .object({
    bio: z.string().trim().max(500),
    isAvailable: z.boolean(),
    serviceIds: ServiceIds,
  })
  .partial()
  .strict();

async function assertServicesExist(ids: string[]) {
  const unique = [...new Set(ids)];
  const found = await prisma.service.count({ where: { id: { in: unique }, isActive: true } });
  if (found !== unique.length) throw badRequest("UNKNOWN_SERVICE", "One or more services do not exist");
  return unique;
}

export function techniciansRouter() {
  const router = Router();
  router.use(requireAuth);

  // A customer applies to become a technician. They can't take jobs until an admin approves them.
  router.post("/apply", requireRole("CUSTOMER"), async (req, res) => {
    const user = currentUser(req);
    const { bio, serviceIds } = ApplyBody.parse(req.body);
    const ids = await assertServicesExist(serviceIds);

    const existing = await prisma.technicianProfile.findUnique({ where: { userId: user.id } });
    if (existing) throw conflict("ALREADY_APPLIED", "You have already applied");

    const [, profile] = await prisma.$transaction([
      prisma.user.update({ where: { id: user.id }, data: { role: "TECHNICIAN" } }),
      prisma.technicianProfile.create({
        data: { userId: user.id, bio, services: { connect: ids.map((id) => ({ id })) } },
        include: { services: { select: { id: true, slug: true } } },
      }),
    ]);
    res.status(201).json({ technician: profile });
  });

  router.patch("/me", requireRole("TECHNICIAN"), async (req, res) => {
    const user = currentUser(req);
    const { bio, isAvailable, serviceIds } = UpdateProfileBody.parse(req.body);

    const profile = await prisma.technicianProfile.findUniqueOrThrow({ where: { userId: user.id } });
    if (isAvailable && !profile.isApproved) {
      throw forbidden("Your account is waiting for approval");
    }
    const ids = serviceIds ? await assertServicesExist(serviceIds) : undefined;

    const updated = await prisma.technicianProfile.update({
      where: { userId: user.id },
      data: {
        bio,
        isAvailable,
        ...(ids && { services: { set: ids.map((id) => ({ id })) } }),
      },
      include: { services: { select: { id: true, slug: true } } },
    });
    res.json({ technician: updated });
  });

  return router;
}
