import { prisma } from "../../db";
import type { Booking, Prisma, User } from "../../generated/prisma/client";
import { badRequest, conflict, forbidden, notFound } from "../../lib/errors";
import type { EventBus } from "../../lib/events";
import { toContact } from "../../lib/serialize";
import { findServiceArea, SERVICE_AREAS } from "../../lib/service-areas";
import {
  ACTIVE_STATUSES,
  CUSTOMER_CANCELLABLE,
  requiredStatusFor,
  timestampFieldFor,
  type TechnicianStep,
} from "./status";

const MAX_DAYS_AHEAD = 30;
const CLOCK_SKEW_MS = 5 * 60 * 1000;

export interface CreateBookingInput {
  serviceId: string;
  scheduledAt: Date;
  addressLine: string;
  lat: number;
  lng: number;
  notes?: string;
}

const serviceSelect = { id: true, slug: true, nameEn: true, nameAr: true, icon: true } as const;

export const bookingInclude = {
  service: { select: serviceSelect },
  customer: { select: { id: true, name: true, phone: true } },
  technician: {
    select: {
      id: true,
      name: true,
      phone: true,
      technician: { select: { lastLat: true, lastLng: true, lastLocationAt: true } },
    },
  },
  payment: { select: { status: true, amountHalalas: true, method: true, paidAt: true, failureMessage: true } },
} satisfies Prisma.BookingInclude;

export type BookingWithRelations = Prisma.BookingGetPayload<{ include: typeof bookingInclude }>;

/**
 * Where the technician is, but only while they're on the way and only if the position was
 * reported after they set off (so a location left over from an earlier job is never shown).
 */
function liveLocation(b: BookingWithRelations) {
  const profile = b.technician?.technician;
  if (b.status !== "EN_ROUTE" || !b.enRouteAt || !profile?.lastLocationAt) return null;
  if (profile.lastLat == null || profile.lastLng == null) return null;
  if (profile.lastLocationAt < b.enRouteAt) return null;
  return { lat: profile.lastLat, lng: profile.lastLng, at: profile.lastLocationAt };
}

/** Full booking details, for the customer, the assigned technician, or an admin. */
export function toBookingView(b: BookingWithRelations) {
  return {
    id: b.id,
    status: b.status,
    service: b.service,
    scheduledAt: b.scheduledAt,
    serviceArea: b.serviceArea,
    address: { line: b.addressLine, lat: b.lat, lng: b.lng },
    notes: b.notes,
    priceHalalas: b.priceHalalas,
    customer: toContact(b.customer),
    technician: b.technician && toContact(b.technician),
    technicianLocation: liveLocation(b),
    payment: b.payment && {
      status: b.payment.status,
      amountHalalas: b.payment.amountHalalas,
      method: b.payment.method,
      paidAt: b.payment.paidAt,
      // The provider's reason for the last declined attempt (e.g. "INSUFFICIENT FUNDS").
      failureMessage: b.payment.failureMessage,
    },
    cancelReason: b.cancelReason,
    timeline: {
      createdAt: b.createdAt,
      acceptedAt: b.acceptedAt,
      enRouteAt: b.enRouteAt,
      startedAt: b.startedAt,
      completedAt: b.completedAt,
      cancelledAt: b.cancelledAt,
    },
  };
}

/**
 * What a technician sees before accepting a job: the area (coordinates rounded to ~1 km)
 * but not the street address or the customer's name and phone.
 */
function toOpenJobView(b: Booking & { service: BookingWithRelations["service"] }) {
  return {
    id: b.id,
    service: b.service,
    scheduledAt: b.scheduledAt,
    serviceArea: b.serviceArea,
    approxLocation: { lat: Math.round(b.lat * 100) / 100, lng: Math.round(b.lng * 100) / 100 },
    notes: b.notes,
    priceHalalas: b.priceHalalas,
  };
}

/** Loads a booking the user takes part in (or any booking, for admins). */
export async function loadForParticipant(bookingId: string, user: User) {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId }, include: bookingInclude });
  const isParticipant = booking && (booking.customerId === user.id || booking.technicianId === user.id);
  // Return 404 rather than 403 so outsiders can't probe which booking ids exist.
  if (!booking || (!isParticipant && user.role !== "ADMIN")) throw notFound("Booking");
  return booking;
}

async function requireApprovedTechnician(user: User) {
  const profile = await prisma.technicianProfile.findUnique({
    where: { userId: user.id },
    include: { services: { select: { id: true } } },
  });
  if (!profile?.isApproved) throw forbidden("Your technician account is waiting for approval");
  return profile;
}

/** Only technicians who switched themselves online see and take new jobs. */
async function requireOnlineTechnician(user: User) {
  const profile = await requireApprovedTechnician(user);
  if (!profile.isAvailable) throw conflict("TECHNICIAN_OFFLINE", "Go online to see and accept jobs");
  return profile;
}

async function getView(bookingId: string, user: User) {
  return toBookingView(await loadForParticipant(bookingId, user));
}

export function createBookingsService(events: EventBus) {
  return {
    get: getView,

    async create(customer: User, input: CreateBookingInput) {
      const now = Date.now();
      if (input.scheduledAt.getTime() < now - CLOCK_SKEW_MS) {
        throw badRequest("SCHEDULED_IN_PAST", "Pick a time in the future");
      }
      if (input.scheduledAt.getTime() > now + MAX_DAYS_AHEAD * 24 * 60 * 60 * 1000) {
        throw badRequest("SCHEDULED_TOO_FAR", `Bookings can be made up to ${MAX_DAYS_AHEAD} days ahead`);
      }

      const area = findServiceArea(input.lat, input.lng);
      if (!area) {
        throw badRequest("OUTSIDE_SERVICE_AREA", "Khidma doesn't serve this location yet", {
          areas: SERVICE_AREAS.map((a) => ({ id: a.id, nameEn: a.nameEn, nameAr: a.nameAr })),
        });
      }

      const service = await prisma.service.findFirst({ where: { id: input.serviceId, isActive: true } });
      if (!service) throw badRequest("UNKNOWN_SERVICE", "This service is not available");

      const booking = await prisma.booking.create({
        data: {
          customerId: customer.id,
          serviceId: service.id,
          scheduledAt: input.scheduledAt,
          addressLine: input.addressLine,
          lat: input.lat,
          lng: input.lng,
          serviceArea: area.id,
          notes: input.notes,
          priceHalalas: service.basePriceHalalas, // snapshot: later price changes don't affect this booking
        },
        include: bookingInclude,
      });
      events.emit("booking.status", { bookingId: booking.id, from: null, to: "PENDING", actorId: customer.id });
      return toBookingView(booking);
    },

    async listMine(user: User, scope: "active" | "past") {
      const statusFilter = scope === "active" ? { in: ACTIVE_STATUSES } : { notIn: ACTIVE_STATUSES };
      const owner = user.role === "TECHNICIAN" ? { technicianId: user.id } : { customerId: user.id };
      const bookings = await prisma.booking.findMany({
        where: { ...owner, status: statusFilter },
        include: bookingInclude,
        orderBy: { scheduledAt: scope === "active" ? "asc" : "desc" },
        take: 50,
      });
      return bookings.map(toBookingView);
    },

    async listOpenJobs(technician: User) {
      const profile = await requireOnlineTechnician(technician);
      const jobs = await prisma.booking.findMany({
        where: {
          status: "PENDING",
          technicianId: null,
          serviceId: { in: profile.services.map((s) => s.id) },
          scheduledAt: { gte: new Date(Date.now() - 60 * 60 * 1000) },
        },
        include: { service: { select: serviceSelect } },
        orderBy: { scheduledAt: "asc" },
        take: 50,
      });
      return jobs.map(toOpenJobView);
    },

    /**
     * Claims a pending job. The update only matches while the booking is still PENDING and
     * unassigned, so if two technicians tap "Accept" at the same moment exactly one wins and
     * the other gets 409 — no double booking, no locks needed.
     */
    async accept(bookingId: string, technician: User) {
      const profile = await requireOnlineTechnician(technician);
      const serviceIds = profile.services.map((s) => s.id);

      const claimed = await prisma.booking.updateMany({
        where: { id: bookingId, status: "PENDING", technicianId: null, serviceId: { in: serviceIds } },
        data: { status: "ACCEPTED", technicianId: technician.id, acceptedAt: new Date() },
      });

      if (claimed.count === 0) {
        const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
        if (!booking) throw notFound("Booking");
        if (!serviceIds.includes(booking.serviceId)) throw forbidden("You don't offer this service");
        throw conflict("BOOKING_UNAVAILABLE", "Another technician already took this job, or it was cancelled");
      }
      events.emit("booking.status", { bookingId, from: "PENDING", to: "ACCEPTED", actorId: technician.id });
      return getView(bookingId, technician);
    },

    async advance(bookingId: string, technician: User, step: TechnicianStep) {
      const from = requiredStatusFor(step);
      const moved = await prisma.booking.updateMany({
        where: { id: bookingId, technicianId: technician.id, status: from },
        data: { status: step, [timestampFieldFor(step)]: new Date() },
      });

      if (moved.count === 0) {
        const booking = await loadForParticipant(bookingId, technician);
        if (booking.technicianId !== technician.id) throw forbidden("This job is not assigned to you");
        throw conflict("INVALID_TRANSITION", `Can't change status from ${booking.status} to ${step}`);
      }
      events.emit("booking.status", { bookingId, from, to: step, actorId: technician.id });
      return getView(bookingId, technician);
    },

    async cancel(bookingId: string, user: User, reason?: string) {
      const booking = await loadForParticipant(bookingId, user);

      let allowed: typeof ACTIVE_STATUSES;
      if (user.role === "ADMIN") allowed = ACTIVE_STATUSES;
      else if (booking.customerId === user.id) allowed = CUSTOMER_CANCELLABLE;
      else throw forbidden("Only the customer or an admin can cancel a booking");

      const cannotCancel = () => conflict("CANNOT_CANCEL", "This booking can no longer be cancelled");
      if (!allowed.includes(booking.status)) throw cannotCancel();

      // Matching on the status we just read means a booking that moved on in the meantime
      // isn't cancelled from a stale view, and `from` in the event is exactly right.
      const cancelled = await prisma.booking.updateMany({
        where: { id: bookingId, status: booking.status },
        data: { status: "CANCELLED", cancelledAt: new Date(), cancelReason: reason },
      });
      if (cancelled.count === 0) throw cannotCancel();

      events.emit("booking.status", { bookingId, from: booking.status, to: "CANCELLED", actorId: user.id });
      return getView(bookingId, user);
    },
  };
}

export type BookingsService = ReturnType<typeof createBookingsService>;
