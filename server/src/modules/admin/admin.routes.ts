import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../db";
import { notFound } from "../../lib/errors";
import type { EventBus } from "../../lib/events";
import { requireAuth, requireRole } from "../../middleware/auth";
import { bookingInclude, toBookingView } from "../bookings/bookings.service";

const TechnicianQuery = z.object({ status: z.enum(["pending", "approved"]).default("pending") });
const BookingQuery = z.object({
  status: z.enum(["PENDING", "ACCEPTED", "EN_ROUTE", "IN_PROGRESS", "COMPLETED", "CANCELLED"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
});
const PAGE_SIZE = 20;
const UserIdParams = z.object({ userId: z.string().min(1).max(64) });

export function adminRouter(events: EventBus) {
  const router = Router();
  router.use(requireAuth, requireRole("ADMIN"));

  router.get("/technicians", async (req, res) => {
    const { status } = TechnicianQuery.parse(req.query);
    const technicians = await prisma.technicianProfile.findMany({
      where: { isApproved: status === "approved" },
      include: {
        user: { select: { id: true, name: true, phone: true } },
        services: { select: { id: true, slug: true, nameEn: true } },
      },
      orderBy: { createdAt: "asc" },
    });
    res.json({ technicians });
  });

  router.post("/technicians/:userId/approve", async (req, res) => {
    const { userId } = UserIdParams.parse(req.params);
    const profile = await prisma.technicianProfile.findUnique({ where: { userId } });
    if (!profile) throw notFound("Technician");
    const updated = await prisma.technicianProfile.update({
      where: { userId: profile.userId },
      data: { isApproved: true },
    });
    if (!profile.isApproved) events.emit("technician.approved", { userId });
    res.json({ technician: updated });
  });

  router.get("/bookings", async (req, res) => {
    const { status, page } = BookingQuery.parse(req.query);
    const where = status ? { status } : {};
    const [total, bookings] = await prisma.$transaction([
      prisma.booking.count({ where }),
      prisma.booking.findMany({
        where,
        include: bookingInclude,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
      }),
    ]);
    res.json({ bookings: bookings.map(toBookingView), page, pageSize: PAGE_SIZE, total });
  });

  return router;
}
