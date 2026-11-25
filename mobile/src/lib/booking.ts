import type { BookingStatus, TechnicianStep } from "@/api/types";

// The same lifecycle the server enforces (server/src/modules/bookings/status.ts).
// The app only uses this to decide which button to show; the server still has the final say.

const NEXT_STEP: Partial<Record<BookingStatus, TechnicianStep>> = {
  ACCEPTED: "EN_ROUTE",
  EN_ROUTE: "IN_PROGRESS",
  IN_PROGRESS: "COMPLETED",
};

export function nextTechnicianStep(status: BookingStatus): TechnicianStep | null {
  return NEXT_STEP[status] ?? null;
}

/** Customers can cancel until the technician sets off. */
export function canCustomerCancel(status: BookingStatus): boolean {
  return status === "PENDING" || status === "ACCEPTED";
}

/** Contact details are only useful while the job is happening (or just finished). */
export function showsContact(status: BookingStatus): boolean {
  return status === "ACCEPTED" || status === "EN_ROUTE" || status === "IN_PROGRESS" || status === "COMPLETED";
}
