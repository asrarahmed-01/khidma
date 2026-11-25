import { bookingRef, formatDay, formatPrice, formatSlot, formatWindow } from "@/lib/format";

describe("formatPrice", () => {
  it("shows whole riyals without decimals", () => {
    expect(formatPrice(15000, "en")).toBe("150 SAR");
    expect(formatPrice(15000, "ar")).toBe("150 ر.س");
  });

  it("keeps halalas when there are any", () => {
    expect(formatPrice(15050, "en")).toBe("150.50 SAR");
  });

  it("uses Latin digits in Arabic, matching phone numbers and codes", () => {
    expect(formatPrice(250000, "ar")).toMatch(/^2[,٬]500 ر\.س$/);
  });
});

describe("dates", () => {
  // 19 Oct 2026, 10:00 local time
  const slot = new Date(2026, 9, 19, 10, 0);

  it("formats a 2-hour arrival window", () => {
    expect(formatSlot(slot, "en")).toBe("Mon 19 Oct, 10:00 am – 12:00 pm");
  });

  it("uses the Gregorian calendar in Arabic, not Hijri", () => {
    // ar-SA defaults to the Umm al-Qura calendar, which would show a Hijri month (e.g. جمادى).
    const day = formatDay(slot, "ar");
    expect(day).toContain("أكتوبر");
    expect(day).toContain("19");
  });

  it("builds compact slot labels", () => {
    expect(formatWindow(new Date(2026, 9, 19, 8), "en")).toBe("8–10 am");
    expect(formatWindow(new Date(2026, 9, 19, 10), "en")).toBe("10 am–12 pm");
    // Arabic keeps the period after each hour so the numbers can't be reordered in RTL.
    expect(formatWindow(new Date(2026, 9, 19, 8), "ar")).toBe("8 ص – 10 ص");
  });
});

describe("bookingRef", () => {
  it("uses the last 6 characters of the id", () => {
    expect(bookingRef("cmvcqou600001137dqwn9gw0t")).toBe("#N9GW0T");
  });
});
