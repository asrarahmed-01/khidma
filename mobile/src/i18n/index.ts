import { getLocales } from "expo-localization";
import { createInstance } from "i18next";
import { initReactI18next } from "react-i18next";
import { ar } from "./ar";
import { en } from "./en";

export type Lang = "ar" | "en";
export type Direction = "rtl" | "ltr";

export const LANGS: Lang[] = ["ar", "en"];

export const directionOf = (lang: Lang): Direction => (lang === "ar" ? "rtl" : "ltr");

/** First launch: Arabic if the phone is set to Arabic, English otherwise. */
export function deviceLang(): Lang {
  try {
    return getLocales()[0]?.languageCode === "ar" ? "ar" : "en";
  } catch {
    return "en";
  }
}

export const resources = { en: { translation: en }, ar: { translation: ar } } as const;

// A dedicated instance (rather than i18next's global default) keeps tests and the app isolated.
const i18n = createInstance();

void i18n.use(initReactI18next).init({
  resources,
  lng: deviceLang(),
  fallbackLng: "en",
  interpolation: { escapeValue: false }, // React already escapes output
  initAsync: false, // resources are bundled, so initialise synchronously
  returnNull: false,
});

export default i18n;
