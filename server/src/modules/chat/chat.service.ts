import { prisma } from "../../db";
import type { Message, Prisma, User } from "../../generated/prisma/client";
import { badRequest, conflict, forbidden, tooManyRequests } from "../../lib/errors";
import type { EventBus, MessageView } from "../../lib/events";
import { loadForParticipant } from "../bookings/bookings.service";
import { CHAT_OPEN_STATUSES } from "../bookings/status";

export const MAX_MESSAGE_LENGTH = 1000;
const MAX_MESSAGES_PER_MINUTE = 30;

export function toMessageView(m: Message): MessageView {
  return { id: m.id, bookingId: m.bookingId, senderId: m.senderId, body: m.body, createdAt: m.createdAt };
}

/**
 * Chat between a customer and their technician, scoped to one booking. It opens when a
 * technician accepts the job and becomes read-only once the job is completed or cancelled,
 * so phone numbers and conversations don't outlive the job they were for.
 */
export function createChatService(events: EventBus) {
  return {
    /** Newest `limit` messages (oldest first), or the page before message `before`. */
    async list(bookingId: string, user: User, { before, limit }: { before?: string; limit: number }) {
      await loadForParticipant(bookingId, user);

      const where: Prisma.MessageWhereInput = { bookingId };
      if (before) {
        const cursor = await prisma.message.findFirst({ where: { id: before, bookingId } });
        if (!cursor) throw badRequest("INVALID_CURSOR", "Unknown message id in `before`");
        where.OR = [
          { createdAt: { lt: cursor.createdAt } },
          { createdAt: cursor.createdAt, id: { lt: cursor.id } },
        ];
      }

      const rows = await prisma.message.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: limit + 1,
      });
      return {
        messages: rows.slice(0, limit).reverse().map(toMessageView),
        hasMore: rows.length > limit,
      };
    },

    async send(bookingId: string, user: User, body: string) {
      const booking = await loadForParticipant(bookingId, user);
      if (booking.customerId !== user.id && booking.technicianId !== user.id) {
        throw forbidden("Only the customer and the technician on this job can send messages");
      }
      if (!booking.technicianId || !CHAT_OPEN_STATUSES.includes(booking.status)) {
        throw conflict("CHAT_CLOSED", "Messages can be sent from when a technician accepts until the job is done");
      }

      const sentLastMinute = await prisma.message.count({
        where: { senderId: user.id, createdAt: { gte: new Date(Date.now() - 60 * 1000) } },
      });
      if (sentLastMinute >= MAX_MESSAGES_PER_MINUTE) {
        throw tooManyRequests("MESSAGE_RATE_LIMITED", "You're sending messages too quickly");
      }

      const message = toMessageView(await prisma.message.create({ data: { bookingId, senderId: user.id, body } }));
      events.emit("message.created", {
        message,
        customerId: booking.customerId,
        technicianId: booking.technicianId,
      });
      return message;
    },
  };
}

export type ChatService = ReturnType<typeof createChatService>;
