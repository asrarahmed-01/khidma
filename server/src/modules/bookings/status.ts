import type { BookingStatus } from "../../generated/prisma/client";

/**
 * The booking lifecycle as a state machine:
 *
 *   PENDING ──accept──▶ ACCEPTED ──▶ EN_ROUTE ──▶ IN_PROGRESS ──▶ COMPLETED
 *      │                   │
 *      └──────cancel───────┴──▶ CANCELLED
 *
 * Technicians move a job forward one step at a time; nobody can skip a step or go back.
 */
export type TechnicianStep = "EN_ROUTE" | "IN_PROGRESS" | "COMPLETED";

const PREVIOUS: Record<TechnicianStep, BookingStatus> = {
  EN_ROUTE: "ACCEPTED",
  IN_PROGRESS: "EN_ROUTE",
  COMPLETED: "IN_PROGRESS",
};

const TIMESTAMP_FIELD = {
  EN_ROUTE: "enRouteAt",
  IN_PROGRESS: "startedAt",
  COMPLETED: "completedAt",
} as const satisfies Record<TechnicianStep, string>;

export const ACTIVE_STATUSES: BookingStatus[] = ["PENDING", "ACCEPTED", "EN_ROUTE", "IN_PROGRESS"];
export const CUSTOMER_CANCELLABLE: BookingStatus[] = ["PENDING", "ACCEPTED"];

/** Customer and technician can message each other from acceptance until the job is done. */
export const CHAT_OPEN_STATUSES: BookingStatus[] = ["ACCEPTED", "EN_ROUTE", "IN_PROGRESS"];

/** The status a booking must currently be in for a technician to move it to `step`. */
export function requiredStatusFor(step: TechnicianStep): BookingStatus {
  return PREVIOUS[step];
}

export function timestampFieldFor(step: TechnicianStep) {
  return TIMESTAMP_FIELD[step];
}

export function canTransition(from: BookingStatus, to: TechnicianStep): boolean {
  return PREVIOUS[to] === from;
}
