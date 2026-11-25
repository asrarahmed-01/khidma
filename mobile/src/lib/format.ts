import type { Lang } from "@/i18n";

/**
 * Locale tags for Intl. Two deliberate choices for Arabic:
 * - `ca-gregory`: ar-SA defaults to the Hijri (Umm al-Qura) calendar. Appointments are
 *   scheduled on Gregorian dates, so we force it to avoid showing a different date.
 * - `nu-latn`: Latin digits, matching phone numbers and the 6-digit codes people type.
 */
export function intlLocale(lang: Lang): string {
  return lang === "ar" ? "ar-SA-u-ca-gregory-nu-latn" : "en-GB";
}

export const SLOT_HOURS = 2;

/** 15000 halalas → "150 SAR" / "150 ر.س" (whole riyals shown without decimals). */
export function formatPrice(halalas: number, lang: Lang): string {
  const riyals = halalas / 100;
  const number = new Intl.NumberFormat(intlLocale(lang), {
    minimumFractionDigits: Number.isInteger(riyals) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(riyals);
  return lang === "ar" ? `${number} ر.س` : `${number} SAR`;
}

/** "Sun 19 Oct" / "الأحد 19 أكتوبر" */
export function formatDay(date: Date, lang: Lang): string {
  return new Intl.DateTimeFormat(intlLocale(lang), { weekday: "short", day: "numeric", month: "short" }).format(date);
}

/** "10:00 am" / "10:00 ص" */
export function formatTime(date: Date, lang: Lang): string {
  return new Intl.DateTimeFormat(intlLocale(lang), { hour: "numeric", minute: "2-digit", hour12: true }).format(date);
}

/** A booking is a 2-hour arrival window: "Sun 19 Oct, 10:00 am – 12:00 pm". */
export function formatSlot(start: Date | string, lang: Lang): string {
  const from = typeof start === "string" ? new Date(start) : start;
  const to = new Date(from.getTime() + SLOT_HOURS * 60 * 60 * 1000);
  const separator = lang === "ar" ? "، " : ", ";
  return `${formatDay(from, lang)}${separator}${formatTime(from, lang)} – ${formatTime(to, lang)}`;
}

/**
 * Compact label for a slot chip: "8–10 am", "10 am–12 pm" / "8 ص – 10 ص".
 * Arabic keeps the period after each hour: with letters between them, the two numbers
 * can't be reordered by the bidi algorithm (a bare "8–10" can display as "10–8" in RTL).
 */
export function formatWindow(start: Date, lang: Lang): string {
  const end = new Date(start.getTime() + SLOT_HOURS * 60 * 60 * 1000);
  const formatter = new Intl.DateTimeFormat(intlLocale(lang), { hour: "numeric", hour12: true });
  if (typeof formatter.formatToParts !== "function") {
    return `${formatTime(start, lang)} – ${formatTime(end, lang)}`;
  }
  const split = (d: Date) => {
    const parts = formatter.formatToParts(d);
    return {
      hour: parts.find((p) => p.type === "hour")?.value ?? "",
      period: parts.find((p) => p.type === "dayPeriod")?.value ?? "",
    };
  };
  const a = split(start);
  const b = split(end);
  if (lang === "en" && a.period === b.period) return `${a.hour}–${b.hour} ${b.period}`;
  return lang === "ar" ? `${a.hour} ${a.period} – ${b.hour} ${b.period}` : `${a.hour} ${a.period}–${b.hour} ${b.period}`;
}

/** Short timestamp for the status timeline: "19 Oct, 10:42 am". */
export function formatStamp(iso: string, lang: Lang): string {
  return new Intl.DateTimeFormat(intlLocale(lang), {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(iso));
}

/** Booking reference shown to people: the last 6 characters of the id, e.g. "#7QX2KD". */
export function bookingRef(id: string): string {
  return `#${id.slice(-6).toUpperCase()}`;
}

/** "850 m" / "2.4 km", in the app's digits. Straight-line distance, so rounded generously. */
export function formatDistance(km: number, lang: Lang): string {
  const metres = km < 1;
  const value = metres ? Math.max(50, Math.round((km * 1000) / 50) * 50) : Math.round(km * 10) / 10;
  const number = new Intl.NumberFormat(intlLocale(lang), { maximumFractionDigits: 1 }).format(value);
  if (lang === "ar") return `${number} ${metres ? "م" : "كم"}`;
  return `${number} ${metres ? "m" : "km"}`;
}

/** Whole seconds between a timestamp and now (never negative, so clock skew can't show "-3 s"). */
export function secondsSince(iso: string, now: number = Date.now()): number {
  return Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
}

/** "10:42 am" for today, otherwise "19 Oct, 10:42 am": the time under a chat message. */
export function formatMessageTime(iso: string, lang: Lang, now: Date = new Date()): string {
  const date = new Date(iso);
  const sameDay = date.toDateString() === now.toDateString();
  return sameDay ? formatTime(date, lang) : formatStamp(iso, lang);
}
