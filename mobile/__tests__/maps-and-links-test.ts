import { textDirection } from "@/lib/bidi";
import { formatDistance, secondsSince } from "@/lib/format";
import { bearingDeg } from "@/lib/geo";
import { staticMapUrl } from "@/lib/static-map";
import { notificationTarget } from "@/notifications/links";

describe("distances", () => {
  it("rounds straight-line distances sensibly in both languages", () => {
    expect(formatDistance(0.012, "en")).toBe("50 m");
    expect(formatDistance(0.43, "en")).toBe("450 m");
    expect(formatDistance(2.437, "en")).toBe("2.4 km");
    expect(formatDistance(2.437, "ar")).toBe("2.4 كم");
  });

  it("never reports a negative age when the phone's clock is ahead", () => {
    const now = Date.parse("2026-10-20T08:00:30Z");
    expect(secondsSince("2026-10-20T08:00:00Z", now)).toBe(30);
    expect(secondsSince("2026-10-20T08:01:00Z", now)).toBe(0);
  });

  it("computes compass bearings", () => {
    expect(bearingDeg(24.7, 46.6, 24.8, 46.6)).toBeCloseTo(0, 0); // north
    expect(bearingDeg(24.7, 46.6, 24.7, 46.7)).toBeCloseTo(90, 0); // east
    expect(bearingDeg(24.7, 46.6, 24.6, 46.6)).toBeCloseTo(180, 0); // south
  });
});

describe("static Mapbox map", () => {
  const colors = { home: "#0B5D4B", technician: "#E8A33D" };
  const home = { lat: 24.6948, lng: 46.6855 };

  it("fits the view around both pins once the technician is known", () => {
    const url = staticMapUrl({ home, technician: { lat: 24.71, lng: 46.67 }, width: 358, height: 220, token: "pk.test", colors });
    expect(url).toContain("/styles/v1/mapbox/streets-v12/static/");
    expect(url).toContain("pin-l-home+0b5d4b(46.68550,24.69480),pin-l-car+e8a33d(46.67000,24.71000)/auto/358x220@2x");
    expect(url).toContain("access_token=pk.test");
    expect(url).toContain("padding=60");
  });

  it("centres on the home before the first position arrives", () => {
    const url = staticMapUrl({ home, technician: null, width: 358, height: 220, token: "pk.test", colors });
    expect(url).toContain("pin-l-home+0b5d4b(46.68550,24.69480)/46.68550,24.69480,14/358x220@2x");
  });
});

describe("notification links", () => {
  it("opens only the app's own booking, chat and jobs screens", () => {
    expect(notificationTarget({ url: "/booking/cmv123" })).toBe("/booking/cmv123");
    expect(notificationTarget({ url: "/chat/cmv123" })).toBe("/chat/cmv123");
    expect(notificationTarget({ url: "/jobs" })).toBe("/jobs");
    expect(notificationTarget({ url: "https://evil.example" })).toBeNull();
    expect(notificationTarget({ url: "/booking/../admin" })).toBeNull();
    expect(notificationTarget({ url: 42 })).toBeNull();
    expect(notificationTarget(null)).toBeNull();
  });
});

describe("message direction", () => {
  it("follows the first strong letter, like dir=auto", () => {
    expect(textDirection("Building 12, second floor.")).toBe("ltr");
    expect(textDirection("وصلت تقريبًا")).toBe("rtl");
    expect(textDirection("12 وصلت")).toBe("rtl"); // digits are neutral
    expect(textDirection("👍")).toBe("ltr");
  });
});
