/**
 * Wraps text in a Unicode left-to-right isolate (U+2066 … U+2069).
 *
 * Inside Arabic (right-to-left) text, phone numbers and references like "#7QX2KD" get
 * reordered by the bidi algorithm ("+966 55 123 4567" can come out as "4567 123 55 +966").
 * An isolate keeps them in one left-to-right piece wherever they appear.
 */
export function ltr(text: string): string {
  return `⁦${text}⁩`;
}

const RTL_CHAR = /[\u0590-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFF]/;
const LTR_CHAR = /[A-Za-z\u00C0-\u024F]/;

/**
 * The direction of a piece of user text, from its first strong character (the same rule
 * browsers use for dir="auto"): an English message in an Arabic chat still reads left to right.
 */
export function textDirection(text: string): "ltr" | "rtl" {
  for (const ch of text) {
    if (RTL_CHAR.test(ch)) return "rtl";
    if (LTR_CHAR.test(ch)) return "ltr";
  }
  return "ltr";
}
