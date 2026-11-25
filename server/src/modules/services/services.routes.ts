import { Router } from "express";
import { prisma } from "../../db";

export function servicesRouter() {
  const router = Router();

  // Public: the catalog shown on the home screen. Both languages are returned so the app
  // can switch between Arabic and English without another request.
  router.get("/", async (_req, res) => {
    const services = await prisma.service.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { basePriceHalalas: "asc" }],
      select: {
        id: true,
        slug: true,
        nameEn: true,
        nameAr: true,
        descriptionEn: true,
        descriptionAr: true,
        icon: true,
        basePriceHalalas: true,
      },
    });
    res.json({ services });
  });

  return router;
}
