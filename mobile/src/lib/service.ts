import type { Lang } from "@/i18n";

/** Services and areas carry both languages from the server; pick the right one. */
export function serviceName(s: { nameEn: string; nameAr: string }, lang: Lang): string {
  return lang === "ar" ? s.nameAr : s.nameEn;
}

export function serviceDescription(s: { descriptionEn: string; descriptionAr: string }, lang: Lang): string {
  return lang === "ar" ? s.descriptionAr : s.descriptionEn;
}

export function areaName(
  areas: { id: string; nameEn: string; nameAr: string }[] | undefined,
  id: string,
  lang: Lang,
): string {
  const area = areas?.find((a) => a.id === id);
  return area ? serviceName(area, lang) : id;
}
