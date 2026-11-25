const ARABIC_INDIC = "٠١٢٣٤٥٦٧٨٩";
const EASTERN_ARABIC_INDIC = "۰۱۲۳۴۵۶۷۸۹";

/** Converts Arabic-Indic digits (٠-٩ and ۰-۹), which Arabic keyboards often produce, to 0-9. */
export function toLatinDigits(input: string): string {
  return input.replace(/[٠-٩۰-۹]/g, (d) => {
    const i = ARABIC_INDIC.indexOf(d);
    return String(i >= 0 ? i : EASTERN_ARABIC_INDIC.indexOf(d));
  });
}

/**
 * Normalizes a Saudi mobile number to E.164 (+9665XXXXXXXX).
 * Accepts 05XXXXXXXX, 5XXXXXXXX, 9665XXXXXXXX, +9665XXXXXXXX and 009665XXXXXXXX,
 * with spaces, dashes or brackets, in Latin or Arabic-Indic digits.
 * Returns null for anything that is not a Saudi mobile number.
 */
export function normalizeSaudiMobile(input: string): string | null {
  const compact = toLatinDigits(input).replace(/[\s\-()]/g, "");
  const match = compact.match(/^(?:\+966|00966|966|0)?(5\d{8})$/);
  return match ? `+966${match[1]}` : null;
}
