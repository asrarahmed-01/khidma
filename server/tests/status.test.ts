import { canTransition, requiredStatusFor } from "../src/modules/bookings/status";

describe("booking state machine", () => {
  it("moves forward one step at a time", () => {
    expect(canTransition("ACCEPTED", "EN_ROUTE")).toBe(true);
    expect(canTransition("EN_ROUTE", "IN_PROGRESS")).toBe(true);
    expect(canTransition("IN_PROGRESS", "COMPLETED")).toBe(true);
  });

  it("does not allow skipping or going back", () => {
    expect(canTransition("ACCEPTED", "COMPLETED")).toBe(false);
    expect(canTransition("PENDING", "EN_ROUTE")).toBe(false);
    expect(canTransition("COMPLETED", "IN_PROGRESS")).toBe(false);
    expect(canTransition("CANCELLED", "EN_ROUTE")).toBe(false);
  });

  it("knows the required previous status", () => {
    expect(requiredStatusFor("EN_ROUTE")).toBe("ACCEPTED");
    expect(requiredStatusFor("COMPLETED")).toBe("IN_PROGRESS");
  });
});
