import { ltr } from "@/lib/bidi";
import { formatSaudiMobile, normalizeSaudiMobile } from "@/lib/phone";

describe("Saudi mobile numbers", () => {
  it.each([
    ["0512345678", "+966512345678"],
    ["512345678", "+966512345678"],
    ["+966 51 234 5678", "+966512345678"],
    ["00966512345678", "+966512345678"],
    ["٠٥١٢٣٤٥٦٧٨", "+966512345678"],
  ])("normalizes %s", (input, expected) => {
    expect(normalizeSaudiMobile(input)).toBe(expected);
  });

  it.each(["0112345678", "12345", "+971501234567", ""])("rejects %s", (input) => {
    expect(normalizeSaudiMobile(input)).toBeNull();
  });

  it("formats for display", () => {
    expect(formatSaudiMobile("+966512345678")).toBe("+966 51 234 5678");
  });

  it("wraps numbers in a left-to-right isolate for Arabic text", () => {
    expect(ltr("+966 51 234 5678")).toBe("⁦+966 51 234 5678⁩");
  });
});
