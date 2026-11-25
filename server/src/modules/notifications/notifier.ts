import { prisma } from "../../db";
import type { Locale } from "../../generated/prisma/client";
import type { DomainEvents, EventBus } from "../../lib/events";
import { isExpoPushToken, type PushProvider } from "./push";
import { templates, type Text } from "./templates";

interface Recipient {
  id: string;
  pushToken: string | null;
  locale: Locale;
}

const recipientSelect = { id: true, pushToken: true, locale: true } as const;

/**
 * Turns domain events into push notifications, each in the recipient's own language, with
 * the screen to open in `data.url`. Never notifies the person who caused the event.
 */
export function registerNotifications(events: EventBus, push: PushProvider) {
  // Handlers run concurrently, so "Work has started" could overtake "On the way" when a
  // technician taps through quickly. Notifications for the same booking queue up instead.
  const queues = new Map<string, Promise<void>>();
  function inOrder(key: string, task: () => Promise<void>): Promise<void> {
    const run = (queues.get(key) ?? Promise.resolve()).then(task, task);
    const tail = run.catch(() => undefined);
    queues.set(key, tail);
    void tail.then(() => {
      if (queues.get(key) === tail) queues.delete(key);
    });
    return run;
  }

  async function deliver(recipients: (Recipient | null | undefined)[], build: (locale: Locale) => Text, url: string) {
    const messages = recipients
      .filter((r): r is Recipient & { pushToken: string } => !!r?.pushToken && isExpoPushToken(r.pushToken))
      .map((r) => ({ to: r.pushToken, ...build(r.locale), data: { url } }));
    if (messages.length === 0) return;

    const results = await push.send(messages);
    // An uninstalled app answers DeviceNotRegistered: stop sending to that token.
    const dead = results.filter((r) => r.error === "DeviceNotRegistered").map((r) => r.token);
    if (dead.length > 0) {
      await prisma.user.updateMany({ where: { pushToken: { in: dead } }, data: { pushToken: null } });
    }
  }

  async function loadBooking(bookingId: string) {
    return prisma.booking.findUniqueOrThrow({
      where: { id: bookingId },
      include: {
        service: { select: { nameEn: true, nameAr: true } },
        customer: { select: recipientSelect },
        technician: { select: { ...recipientSelect, name: true } },
      },
    });
  }

  async function onBookingStatus({ bookingId, from, to, actorId }: DomainEvents["booking.status"]): Promise<void> {
    const booking = await loadBooking(bookingId);
    const facts = { ...booking, technicianName: booking.technician?.name ?? null };
    const bookingUrl = `/booking/${bookingId}`;
    const notActor = (r: Recipient | null) => (r && r.id !== actorId ? r : null);

    switch (to) {
      case "PENDING": {
        // A new job: tell every approved, online technician who offers this service.
        const technicians = await prisma.user.findMany({
          where: {
            id: { not: actorId },
            pushToken: { not: null },
            technician: { isApproved: true, isAvailable: true, services: { some: { id: booking.serviceId } } },
          },
          select: recipientSelect,
          take: 500,
        });
        return deliver(technicians, (l) => templates.newJob(facts, l), "/jobs");
      }
      case "ACCEPTED":
        return deliver([booking.customer], (l) => templates.accepted(facts, l), bookingUrl);
      case "EN_ROUTE":
        return deliver([booking.customer], (l) => templates.enRoute(facts, l), bookingUrl);
      case "IN_PROGRESS":
        return deliver([booking.customer], (l) => templates.started(facts, l), bookingUrl);
      case "COMPLETED":
        return deliver([booking.customer], (l) => templates.completed(facts, l), bookingUrl);
      case "CANCELLED":
        // A job still waiting for a technician has nobody else to tell.
        if (from === "PENDING") return deliver([notActor(booking.customer)], (l) => templates.cancelled(facts, l), bookingUrl);
        return deliver(
          [notActor(booking.customer), notActor(booking.technician)],
          (l) => templates.cancelled(facts, l),
          bookingUrl,
        );
    }
  }

  async function onMessage({ message, customerId, technicianId }: DomainEvents["message.created"]) {
    const fromCustomer = message.senderId === customerId;
    const [sender, recipient] = await Promise.all([
      prisma.user.findUniqueOrThrow({ where: { id: message.senderId }, select: { name: true } }),
      prisma.user.findUniqueOrThrow({
        where: { id: fromCustomer ? technicianId : customerId },
        select: recipientSelect,
      }),
    ]);
    const role = fromCustomer ? "customer" : "technician";
    await deliver(
      [recipient],
      (l) => templates.message(sender.name, role, message.body, l),
      `/chat/${message.bookingId}`,
    );
  }

  async function onPayment({ bookingId, to }: DomainEvents["payment.status"]) {
    if (to !== "PAID") return;
    const booking = await loadBooking(bookingId);
    const facts = { ...booking, technicianName: booking.technician?.name ?? null };
    await deliver([booking.technician], (l) => templates.paid(facts, l), `/booking/${bookingId}`);
  }

  async function onApproved({ userId }: DomainEvents["technician.approved"]) {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: recipientSelect });
    await deliver([user], (l) => templates.approved(l), "/jobs");
  }

  events.on("booking.status", (e) => inOrder(e.bookingId, () => onBookingStatus(e)));
  events.on("message.created", (e) => inOrder(e.message.bookingId, () => onMessage(e)));
  events.on("payment.status", (e) => inOrder(e.bookingId, () => onPayment(e)));
  events.on("technician.approved", onApproved);
}
