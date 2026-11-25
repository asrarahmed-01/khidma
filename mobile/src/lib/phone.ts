// Mirrors server/src/lib/phone.ts so the app can validate before sending a request.

export function toLatinDigits(input: string): string {
  return input.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660)).replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0));
}

/** Normalizes a Saudi mobile number to +9665XXXXXXXX, or returns null. */
export function normalizeSaudiMobile(input: string): string | null {
  const compact = toLatinDigits(input).replace(/[\s\-()]/g, "");
  const match = compact.match(/^(?:\+966|00966|966|0)?(5\d{8})$/);
  return match ? `+966${match[1]}` : null;
}

/** +966512345678 → "+966 51 234 5678" */
export function formatSaudiMobile(e164: string): string {
  const match = e164.match(/^\+966(5\d)(\d{3})(\d{4})$/);
  return match ? `+966 ${match[1]} ${match[2]} ${match[3]}` : e164;
}
