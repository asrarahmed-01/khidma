import { normalizeSaudiMobile, toLatinDigits } from "../src/lib/phone";

describe("normalizeSaudiMobile", () => {
  it.each([
    ["0512345678", "+966512345678"],
    ["512345678", "+966512345678"],
    ["966512345678", "+966512345678"],
    ["+966512345678", "+966512345678"],
    ["00966512345678", "+966512345678"],
    ["+966 51 234 5678", "+966512345678"],
    ["051-234-5678", "+966512345678"],
    ["٠٥١٢٣٤٥٦٧٨", "+966512345678"], // Arabic-Indic digits from an Arabic keyboard
  ])("normalizes %s", (input, expected) => {
    expect(normalizeSaudiMobile(input)).toBe(expected);
  });

  it.each([
    "0112345678", // landline
    "05123456", // too short
    "05123456789", // too long
    "+971501234567", // UAE number
    "hello",
    "",
  ])("rejects %s", (input) => {
    expect(normalizeSaudiMobile(input)).toBeNull();
  });
});

describe("toLatinDigits", () => {
  it("converts both Arabic-Indic digit sets", () => {
    expect(toLatinDigits("٠١٢٣٤٥٦٧٨٩")).toBe("0123456789");
    expect(toLatinDigits("۰۱۲۳۴۵۶۷۸۹")).toBe("0123456789");
  });
});
