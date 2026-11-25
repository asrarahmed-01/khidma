import { prisma } from "../src/db";

// Prices are in halalas: 15000 = 150.00 SAR
const services = [
  {
    slug: "ac-repair",
    nameEn: "AC repair",
    nameAr: "صيانة المكيفات",
    descriptionEn: "Cleaning, gas refill and repair for split and window units",
    descriptionAr: "تنظيف وتعبئة فريون وإصلاح المكيفات السبليت والشباك",
    icon: "snowflake",
    basePriceHalalas: 15000,
    sortOrder: 1, // most-booked in a Saudi summer, so it leads the list
  },
  {
    slug: "plumbing",
    nameEn: "Plumbing",
    nameAr: "سباكة",
    descriptionEn: "Leaks, blocked drains, water heaters and fittings",
    descriptionAr: "تسربات وانسداد المجاري والسخانات والتمديدات",
    icon: "droplet",
    basePriceHalalas: 12000,
    sortOrder: 2,
  },
  {
    slug: "electrical",
    nameEn: "Electrical",
    nameAr: "كهرباء",
    descriptionEn: "Wiring, sockets, lighting and breaker faults",
    descriptionAr: "تمديدات وأفياش وإنارة وأعطال القواطع",
    icon: "zap",
    basePriceHalalas: 12000,
    sortOrder: 3,
  },
  {
    slug: "home-cleaning",
    nameEn: "Home cleaning",
    nameAr: "تنظيف المنازل",
    descriptionEn: "Deep cleaning for apartments and villas",
    descriptionAr: "تنظيف شامل للشقق والفلل",
    icon: "sparkles",
    basePriceHalalas: 25000,
    sortOrder: 5,
  },
  {
    slug: "appliance-repair",
    nameEn: "Appliance repair",
    nameAr: "صيانة الأجهزة المنزلية",
    descriptionEn: "Washing machines, fridges, ovens and dishwashers",
    descriptionAr: "الغسالات والثلاجات والأفران وغسالات الصحون",
    icon: "wrench",
    basePriceHalalas: 14000,
    sortOrder: 4,
  },
  {
    slug: "pest-control",
    nameEn: "Pest control",
    nameAr: "مكافحة الحشرات",
    descriptionEn: "Cockroaches, termites, bed bugs and rodents",
    descriptionAr: "الصراصير والنمل الأبيض وبق الفراش والقوارض",
    icon: "bug",
    basePriceHalalas: 20000,
    sortOrder: 6,
  },
];

// Demo accounts for trying the app locally. Log in with these numbers; the OTP prints in the server console.
const ADMIN_PHONE = process.env.SEED_ADMIN_PHONE ?? "+966500000001";
const TECHNICIAN_PHONE = "+966500000002";
const CUSTOMER_PHONE = "+966500000003";

async function main() {
  for (const service of services) {
    await prisma.service.upsert({ where: { slug: service.slug }, update: service, create: service });
  }
  const allServices = await prisma.service.findMany({ select: { id: true } });

  await prisma.user.upsert({
    where: { phone: ADMIN_PHONE },
    update: { role: "ADMIN" },
    create: { phone: ADMIN_PHONE, name: "Khidma Admin", role: "ADMIN", locale: "EN" },
  });

  const technician = await prisma.user.upsert({
    where: { phone: TECHNICIAN_PHONE },
    update: { role: "TECHNICIAN" },
    create: { phone: TECHNICIAN_PHONE, name: "فهد العتيبي", role: "TECHNICIAN" },
  });
  await prisma.technicianProfile.upsert({
    where: { userId: technician.id },
    update: { isApproved: true, isAvailable: true, services: { set: allServices } },
    create: {
      userId: technician.id,
      bio: "فني معتمد بخبرة 8 سنوات في التكييف والسباكة",
      isApproved: true,
      isAvailable: true,
      services: { connect: allServices },
    },
  });

  const customer = await prisma.user.upsert({
    where: { phone: CUSTOMER_PHONE },
    update: {},
    create: { phone: CUSTOMER_PHONE, name: "Sara Al-Qahtani", locale: "EN" },
  });

  // One finished, unpaid job so payments can be tried straight away (only on a fresh database).
  if ((await prisma.booking.count({ where: { customerId: customer.id } })) === 0) {
    const ac = await prisma.service.findUniqueOrThrow({ where: { slug: "ac-repair" } });
    const hoursAgo = (h: number) => new Date(Date.now() - h * 60 * 60 * 1000);
    const booking = await prisma.booking.create({
      data: {
        customerId: customer.id,
        technicianId: technician.id,
        serviceId: ac.id,
        status: "COMPLETED",
        scheduledAt: hoursAgo(3),
        addressLine: "Building 12, Olaya St, Al Olaya, Riyadh",
        lat: 24.6948,
        lng: 46.6855,
        serviceArea: "riyadh",
        notes: "The living room AC is leaking water",
        priceHalalas: ac.basePriceHalalas,
        createdAt: hoursAgo(26),
        acceptedAt: hoursAgo(25),
        enRouteAt: hoursAgo(3.2),
        startedAt: hoursAgo(2.8),
        completedAt: hoursAgo(1.5),
      },
    });
    await prisma.message.createMany({
      data: [
        { bookingId: booking.id, senderId: technician.id, body: "السلام عليكم، أنا في الطريق. بعد 15 دقيقة تقريبًا", createdAt: hoursAgo(3.1) },
        { bookingId: booking.id, senderId: customer.id, body: "Thanks! Building 12, second floor.", createdAt: hoursAgo(3.05) },
      ],
    });
  }

  console.log(`Seeded ${services.length} services and demo accounts:`);
  console.log(`  admin      ${ADMIN_PHONE}`);
  console.log(`  technician ${TECHNICIAN_PHONE}`);
  console.log(`  customer   ${CUSTOMER_PHONE} (has a completed job waiting for payment)`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
