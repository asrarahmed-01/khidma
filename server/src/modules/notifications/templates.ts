import type { Locale } from "../../generated/prisma/client";
import { SERVICE_AREAS } from "../../lib/service-areas";

/**
 * Push notification texts, written in each recipient's language (User.locale). They match
 * the app's wording and formats: Gregorian dates with Latin digits, prices like "150 SAR".
 */

export interface Text {
  title: string;
  body: string;
}

interface ServiceNames {
  nameEn: string;
  nameAr: string;
}

const intlLocale = (locale: Locale) => (locale === "AR" ? "ar-SA-u-ca-gregory-nu-latn" : "en-GB");
const ar = (locale: Locale) => locale === "AR";

export const serviceName = (s: ServiceNames, locale: Locale) => (ar(locale) ? s.nameAr : s.nameEn);

export function formatPrice(halalas: number, locale: Locale) {
  const riyals = halalas / 100;
  const number = new Intl.NumberFormat(intlLocale(locale), {
    minimumFractionDigits: Number.isInteger(riyals) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(riyals);
  return ar(locale) ? `${number} ر.س` : `${number} SAR`;
}

/** Appointment time in Saudi time, whatever time zone the server runs in. */
export function formatWhen(date: Date, locale: Locale) {
  return new Intl.DateTimeFormat(intlLocale(locale), {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Riyadh",
  }).format(date);
}

const areaName = (id: string, locale: Locale) => {
  const area = SERVICE_AREAS.find((a) => a.id === id);
  return area ? (ar(locale) ? area.nameAr : area.nameEn) : id;
};

const someone = (name: string | null, locale: Locale, role: "technician" | "customer") =>
  name ?? (role === "technician" ? (ar(locale) ? "الفني" : "Your technician") : ar(locale) ? "العميل" : "Your customer");

interface BookingFacts {
  service: ServiceNames;
  scheduledAt: Date;
  serviceArea: string;
  priceHalalas: number;
  technicianName: string | null;
}

export const templates = {
  newJob(b: BookingFacts, locale: Locale): Text {
    const service = serviceName(b.service, locale);
    const where = `${areaName(b.serviceArea, locale)} · ${formatWhen(b.scheduledAt, locale)}`;
    return ar(locale)
      ? { title: `طلب جديد: ${service}`, body: `${where}. افتح خدمة لقبوله.` }
      : { title: `New job: ${service}`, body: `${where}. Open Khidma to accept it.` };
  },

  accepted(b: BookingFacts, locale: Locale): Text {
    const name = someone(b.technicianName, locale, "technician");
    const what = `${serviceName(b.service, locale)} · ${formatWhen(b.scheduledAt, locale)}`;
    return ar(locale)
      ? { title: `قبل ${name} طلبك`, body: what }
      : { title: `${name} accepted your booking`, body: what };
  },

  enRoute(b: BookingFacts, locale: Locale): Text {
    const name = someone(b.technicianName, locale, "technician");
    return ar(locale)
      ? { title: `${name} في الطريق إليك`, body: "تابع موقعه مباشرة في التطبيق." }
      : { title: `${name} is on the way`, body: "Follow them live on the map in the app." };
  },

  started(b: BookingFacts, locale: Locale): Text {
    const name = someone(b.technicianName, locale, "technician");
    const service = serviceName(b.service, locale);
    return ar(locale)
      ? { title: "بدأ العمل", body: `بدأ ${name} العمل على ${service}.` }
      : { title: "Work has started", body: `${name} has started your ${service.toLowerCase()}.` };
  },

  completed(b: BookingFacts, locale: Locale): Text {
    const price = formatPrice(b.priceHalalas, locale);
    return ar(locale)
      ? { title: "اكتمل العمل", body: `ادفع ${price} في التطبيق عبر مدى أو البطاقة أو Apple Pay.` }
      : { title: "Job complete", body: `Pay ${price} in the app with mada, card or Apple Pay.` };
  },

  cancelled(b: BookingFacts, locale: Locale): Text {
    const what = `${serviceName(b.service, locale)} · ${formatWhen(b.scheduledAt, locale)}`;
    return ar(locale) ? { title: "أُلغي الطلب", body: what } : { title: "Booking cancelled", body: what };
  },

  paid(b: BookingFacts, locale: Locale): Text {
    const what = `${formatPrice(b.priceHalalas, locale)} · ${serviceName(b.service, locale)}`;
    return ar(locale) ? { title: "تم استلام الدفع", body: what } : { title: "Payment received", body: what };
  },

  message(senderName: string | null, senderRole: "technician" | "customer", body: string, locale: Locale): Text {
    const preview = body.length > 140 ? `${body.slice(0, 139)}…` : body;
    return { title: someone(senderName, locale, senderRole), body: preview };
  },

  approved(locale: Locale): Text {
    return ar(locale)
      ? { title: "تمت الموافقة على حسابك", body: "بدّل حالتك إلى متصل في التطبيق لتبدأ باستقبال الطلبات." }
      : { title: "You're approved", body: "Go online in the app to start receiving jobs." };
  },
};
