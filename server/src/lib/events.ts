import type { BookingStatus, PaymentStatus } from "../generated/prisma/client";

/** A chat message as the API returns it. */
export interface MessageView {
  id: string;
  bookingId: string;
  senderId: string;
  body: string;
  createdAt: Date;
}

/**
 * Things that happened in the domain. Routes and services publish these; the realtime
 * layer (Socket.IO) and push notifications subscribe. Neither side knows about the other,
 * so a booking can change without the bookings code knowing who needs to hear about it.
 */
export interface DomainEvents {
  /** A booking was created (from = null) or moved to another status. */
  "booking.status": { bookingId: string; from: BookingStatus | null; to: BookingStatus; actorId: string };
  "message.created": { message: MessageView; customerId: string; technicianId: string };
  "payment.status": { bookingId: string; from: PaymentStatus | null; to: PaymentStatus };
  "technician.approved": { userId: string };
}

type Handler<K extends keyof DomainEvents> = (payload: DomainEvents[K]) => unknown;

/**
 * A small typed event bus. Handlers run after the current request finishes (on a later
 * tick), and a failing handler is logged instead of breaking the request that emitted it.
 * `settled()` lets tests wait for every handler to finish before asserting.
 */
export class EventBus {
  private readonly handlers = new Map<keyof DomainEvents, Handler<never>[]>();
  private readonly running = new Set<Promise<void>>();

  on<K extends keyof DomainEvents>(name: K, handler: Handler<K>): () => void {
    const list = this.handlers.get(name) ?? [];
    list.push(handler as Handler<never>);
    this.handlers.set(name, list);
    return () => {
      const current = this.handlers.get(name) ?? [];
      this.handlers.set(
        name,
        current.filter((h) => h !== handler),
      );
    };
  }

  emit<K extends keyof DomainEvents>(name: K, payload: DomainEvents[K]): void {
    for (const handler of this.handlers.get(name) ?? []) {
      const run = Promise.resolve()
        .then(() => (handler as Handler<K>)(payload))
        .then(
          () => undefined,
          (err: unknown) => {
            console.error(`[events] ${name} handler failed`, err);
          },
        );
      this.running.add(run);
      void run.finally(() => this.running.delete(run));
    }
  }

  /** Resolves once every handler started so far (and any they triggered) has finished. */
  async settled(): Promise<void> {
    while (this.running.size > 0) {
      await Promise.all([...this.running]);
    }
  }
}
