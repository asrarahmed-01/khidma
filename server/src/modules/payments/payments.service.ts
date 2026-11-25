import { timingSafeEqual } from "node:crypto";
import { prisma } from "../../db";
import type { Payment, PaymentStatus, User } from "../../generated/prisma/client";
import { conflict, forbidden, notFound, unauthorized } from "../../lib/errors";
import type { EventBus } from "../../lib/events";
import { loadForParticipant, toBookingView } from "../bookings/bookings.service";
import { type Invoice, type PaymentGateway, paymentMethodOf } from "./gateway";

/** Moyasar invoices expire after this long; an unpaid one younger than REUSE_FOR is reused. */
const INVOICE_TTL_MS = 60 * 60 * 1000;
const REUSE_FOR_MS = 50 * 60 * 1000;

interface StartInput {
  /** Validated address to send the customer back to the app. */
  returnUrl?: string;
  /** Public base URL of this API, for the provider's redirect after checkout. */
  apiBaseUrl: string;
}

interface Synced {
  status: PaymentStatus;
  method: string | null;
  providerPaymentId: string | null;
  failureMessage: string | null;
  paidAt: Date | null;
}

/** Reads our payment status off the provider's invoice, refusing anything that doesn't add up. */
function readInvoice(payment: Payment, invoice: Invoice): Synced {
  const lastAttempt = invoice.payments.at(-1);
  const paidAttempt = invoice.payments.find((p) => p.status === "paid" || p.status === "captured");
  const base = { method: null, providerPaymentId: null, failureMessage: null, paidAt: null };

  if (invoice.amount !== payment.amountHalalas || invoice.currency !== payment.currency) {
    console.error(
      `[payments] invoice ${invoice.id} is for ${invoice.amount} ${invoice.currency}, expected ${payment.amountHalalas} ${payment.currency}`,
    );
    return { ...base, status: "FAILED", failureMessage: "Amount mismatch" };
  }

  switch (invoice.status) {
    case "paid":
      return {
        status: "PAID",
        method: paymentMethodOf(paidAttempt),
        providerPaymentId: paidAttempt?.id ?? null,
        failureMessage: null,
        paidAt: payment.paidAt ?? new Date(),
      };
    case "refunded":
      return {
        ...base,
        status: "REFUNDED",
        method: payment.method,
        providerPaymentId: payment.providerPaymentId,
        paidAt: payment.paidAt,
      };
    case "failed":
    case "canceled":
    case "expired":
    case "voided":
      return { ...base, status: "FAILED", failureMessage: lastAttempt?.source?.message ?? invoice.status };
    default:
      // initiated / on_hold: still open. A declined card leaves the invoice open for another try.
      return {
        ...base,
        status: "INITIATED",
        failureMessage: lastAttempt?.status === "failed" ? (lastAttempt.source?.message ?? "Declined") : null,
      };
  }
}

/** A paid payment can only move to refunded; everything else may move freely. */
function canMove(from: PaymentStatus, to: PaymentStatus) {
  return from !== "PAID" || to === "REFUNDED";
}

const bookingRef = (id: string) => `#${id.slice(-6).toUpperCase()}`;

export function createPaymentsService({ gateway, events }: { gateway: PaymentGateway; events: EventBus }) {
  /**
   * Brings our row in line with the provider. Safe to call from the webhook, the return page
   * and the app at the same time: the update only applies if the row hasn't changed since we
   * read it, so the "payment received" event fires exactly once.
   */
  async function sync(payment: Payment): Promise<Payment> {
    if (!payment.providerInvoiceId) return payment;
    const next = readInvoice(payment, await gateway.fetchInvoice(payment.providerInvoiceId));

    const unchanged = next.status === payment.status && next.failureMessage === payment.failureMessage;
    if (unchanged || !canMove(payment.status, next.status)) return payment;

    const updated = await prisma.payment.updateMany({
      where: { id: payment.id, status: payment.status, providerInvoiceId: payment.providerInvoiceId },
      data: next,
    });
    if (updated.count === 1 && next.status !== payment.status) {
      events.emit("payment.status", { bookingId: payment.bookingId, from: payment.status, to: next.status });
    }
    return prisma.payment.findUniqueOrThrow({ where: { id: payment.id } });
  }

  async function view(bookingId: string, user: User) {
    return toBookingView(await loadForParticipant(bookingId, user));
  }

  async function loadCustomerBooking(bookingId: string, user: User) {
    const booking = await loadForParticipant(bookingId, user);
    if (booking.customerId !== user.id) throw forbidden("Only the customer can pay for this booking");
    return booking;
  }

  return {
    sync,

    /** Opens (or reuses) a hosted checkout for a completed job and returns its URL. */
    async start(bookingId: string, user: User, { returnUrl, apiBaseUrl }: StartInput) {
      const booking = await loadCustomerBooking(bookingId, user);
      if (booking.status !== "COMPLETED") {
        throw conflict("PAYMENT_NOT_DUE", "You can pay once the technician marks the job complete");
      }

      let payment = await prisma.payment.findUnique({ where: { bookingId } });
      if (payment) payment = await sync(payment); // it may have been paid in another tab
      if (payment?.status === "PAID" || payment?.status === "REFUNDED") {
        throw conflict("ALREADY_PAID", "This booking is already paid");
      }

      const fresh =
        payment?.status === "INITIATED" &&
        payment.checkoutUrl &&
        Date.now() - payment.updatedAt.getTime() < REUSE_FOR_MS;
      if (payment && fresh) {
        payment = await prisma.payment.update({ where: { id: payment.id }, data: { returnUrl: returnUrl ?? null } });
        return { checkoutUrl: payment.checkoutUrl!, booking: await view(bookingId, user) };
      }

      payment = await prisma.payment.upsert({
        where: { bookingId },
        create: { bookingId, amountHalalas: booking.priceHalalas, provider: gateway.provider, returnUrl },
        update: {
          status: "INITIATED",
          amountHalalas: booking.priceHalalas,
          provider: gateway.provider,
          returnUrl: returnUrl ?? null,
          providerInvoiceId: null,
          checkoutUrl: null,
          failureMessage: null,
        },
      });

      const returnPage = `${apiBaseUrl}/payments/return/${payment.id}`;
      const invoice = await gateway.createInvoice({
        amountHalalas: booking.priceHalalas,
        // Shown to the payer on the checkout page. The Arabic name goes last so the bidi
        // algorithm can't pull the reference number into the Arabic text.
        description: `Khidma ${bookingRef(booking.id)} · ${booking.service.nameEn} · ${booking.service.nameAr}`,
        successUrl: returnPage,
        backUrl: returnPage,
        expiresAt: new Date(Date.now() + INVOICE_TTL_MS),
      });
      payment = await prisma.payment.update({
        where: { id: payment.id },
        data: { providerInvoiceId: invoice.id, checkoutUrl: invoice.url },
      });
      return { checkoutUrl: invoice.url, booking: await view(bookingId, user) };
    },

    /** The app calls this when the customer comes back from checkout. */
    async verify(bookingId: string, user: User) {
      await loadCustomerBooking(bookingId, user);
      const payment = await prisma.payment.findUnique({ where: { bookingId } });
      if (!payment) throw notFound("Payment");
      await sync(payment);
      return view(bookingId, user);
    },

    /** Where the browser goes after checkout: back into the app, with the outcome. */
    async returnTarget(paymentId: string) {
      const found = await prisma.payment.findUnique({ where: { id: paymentId } });
      if (!found) throw notFound("Payment");
      const payment = await sync(found);
      const outcome: "paid" | "failed" | "pending" =
        payment.status === "PAID" ? "paid" : payment.status === "FAILED" ? "failed" : "pending";
      if (!payment.returnUrl) return { outcome, redirect: null };
      const target = new URL(payment.returnUrl);
      target.searchParams.set("payment", outcome);
      return { outcome, redirect: target.toString() };
    },

    /**
     * Moyasar webhook (Dashboard → Settings → Webhooks). The shared secret proves it's from
     * Moyasar; even so, the payload isn't trusted: we re-read the invoice from the API.
     */
    async handleWebhook(body: { secret_token?: string; type?: string; data?: { invoice_id?: string | null } }, secret: string) {
      const given = Buffer.from(body.secret_token ?? "");
      const expected = Buffer.from(secret);
      if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
        throw unauthorized("Invalid webhook secret");
      }

      const invoiceId = body.data?.invoice_id;
      if (!invoiceId) return { handled: false }; // not a payment made through one of our invoices
      const payment = await prisma.payment.findUnique({ where: { providerInvoiceId: invoiceId } });
      if (!payment) {
        console.warn(`[payments] webhook ${body.type} for unknown invoice ${invoiceId}`);
        return { handled: false };
      }
      const synced = await sync(payment);
      return { handled: true, status: synced.status };
    },

    /** For the simulated checkout's CSP: where the app wants the customer sent afterwards. */
    async returnUrlForInvoice(invoiceId: string) {
      const payment = await prisma.payment.findUnique({ where: { providerInvoiceId: invoiceId } });
      return payment?.returnUrl ?? null;
    },
  };
}

export type PaymentsService = ReturnType<typeof createPaymentsService>;
