import { bookableDays, isSlotAvailable, slotStart } from "@/lib/slots";

describe("booking slots", () => {
  it("offers the next 7 days, starting today while today still has a slot", () => {
    const now = new Date(2026, 9, 19, 9, 0); // 9:00 am
    const days = bookableDays(now);
    expect(days).toHaveLength(7);
    expect(days[0].getDate()).toBe(19);
  });

  it("drops today once the last slot is less than an hour away", () => {
    const now = new Date(2026, 9, 19, 19, 30); // last slot starts 8 pm
    const days = bookableDays(now);
    expect(days[0].getDate()).toBe(20);
    expect(days).toHaveLength(7);
  });

  it("needs at least an hour's notice", () => {
    const now = new Date(2026, 9, 19, 13, 30);
    expect(isSlotAvailable(slotStart(now, 14), now)).toBe(false);
    expect(isSlotAvailable(slotStart(now, 16), now)).toBe(true);
  });
});
