import "i18next";
import type { en } from "./en";

// Type-checked translation keys: t("booking.cancelBooking") autocompletes, a typo fails the build.
declare module "i18next" {
  interface CustomTypeOptions {
    defaultNS: "translation";
    resources: { translation: typeof en };
  }
}
