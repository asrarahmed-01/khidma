import { Router, type Request } from "express";
import { z } from "zod";
import { config } from "../../config";
import { currentUser, requireAuth, requireRole } from "../../middleware/auth";
import { MAX_MESSAGE_LENGTH, type ChatService } from "../chat/chat.service";
import type { PaymentsService } from "../payments/payments.service";
import { validateReturnUrl } from "../payments/return-url";
import type { BookingsService } from "./bookings.service";

const CreateBookingBody = z.object({
  serviceId: z.string().min(1),
  scheduledAt: z.coerce.date(),
  addressLine: z.string().trim().min(5).max(200),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  notes: z.string().trim().max(500).optional(),
});

const ListQuery = z.object({ scope: z.enum(["active", "past"]).default("active") });
const AdvanceBody = z.object({ status: z.enum(["EN_ROUTE", "IN_PROGRESS", "COMPLETED"]) });
const CancelBody = z.object({ reason: z.string().trim().max(300).optional() });
const IdParams = z.object({ id: z.string().min(1).max(64) });
const MessagesQuery = z.object({
  before: z.string().min(1).max(64).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
export const MessageBody = z.object({ body: z.string().trim().min(1).max(MAX_MESSAGE_LENGTH) });
const PayBody = z.object({ returnUrl: z.string().max(500).optional() });

/** The address the provider should send the customer back to: this API, as the app reached it. */
function apiBaseUrl(req: Request) {
  return config.PUBLIC_API_URL?.replace(/\/$/, "") ?? `${req.protocol}://${req.get("host")}`;
}

interface Deps {
  bookings: BookingsService;
  chat: ChatService;
  payments: PaymentsService;
}

export function bookingsRouter({ bookings, chat, payments }: Deps) {
  const router = Router();
  router.use(requireAuth);
  const id = (req: Request) => IdParams.parse(req.params).id;

  router.post("/", requireRole("CUSTOMER"), async (req, res) => {
    const input = CreateBookingBody.parse(req.body);
    res.status(201).json({ booking: await bookings.create(currentUser(req), input) });
  });

  router.get("/", async (req, res) => {
    const { scope } = ListQuery.parse(req.query);
    res.json({ bookings: await bookings.listMine(currentUser(req), scope) });
  });

  // Registered before "/:id" so "open" isn't treated as a booking id.
  router.get("/open", requireRole("TECHNICIAN"), async (req, res) => {
    res.json({ jobs: await bookings.listOpenJobs(currentUser(req)) });
  });

  router.get("/:id", async (req, res) => {
    res.json({ booking: await bookings.get(id(req), currentUser(req)) });
  });

  router.post("/:id/accept", requireRole("TECHNICIAN"), async (req, res) => {
    res.json({ booking: await bookings.accept(id(req), currentUser(req)) });
  });

  router.post("/:id/status", requireRole("TECHNICIAN"), async (req, res) => {
    const { status } = AdvanceBody.parse(req.body);
    res.json({ booking: await bookings.advance(id(req), currentUser(req), status) });
  });

  router.post("/:id/cancel", requireRole("CUSTOMER", "ADMIN"), async (req, res) => {
    const { reason } = CancelBody.parse(req.body ?? {});
    res.json({ booking: await bookings.cancel(id(req), currentUser(req), reason) });
  });

  // Chat
  router.get("/:id/messages", async (req, res) => {
    const query = MessagesQuery.parse(req.query);
    res.json(await chat.list(id(req), currentUser(req), query));
  });

  router.post("/:id/messages", async (req, res) => {
    const { body } = MessageBody.parse(req.body);
    res.status(201).json({ message: await chat.send(id(req), currentUser(req), body) });
  });

  // Payment, after the job is complete
  router.post("/:id/payment", requireRole("CUSTOMER"), async (req, res) => {
    const { returnUrl } = PayBody.parse(req.body ?? {});
    const result = await payments.start(id(req), currentUser(req), {
      returnUrl: returnUrl === undefined ? undefined : validateReturnUrl(returnUrl),
      apiBaseUrl: apiBaseUrl(req),
    });
    res.status(201).json(result);
  });

  router.post("/:id/payment/verify", requireRole("CUSTOMER"), async (req, res) => {
    res.json({ booking: await payments.verify(id(req), currentUser(req)) });
  });

  return router;
}
