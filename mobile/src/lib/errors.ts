import type { TFunction } from "i18next";
import { ApiError } from "@/api/client";
import { en } from "@/i18n/en";

type ErrorCode = keyof typeof en.errors;

const isKnownCode = (code: string): code is ErrorCode => code in en.errors;

/** Turns any thrown error into a sentence in the current language, using the server's error code. */
export function errorMessage(t: TFunction, error: unknown): string {
  if (error instanceof ApiError && isKnownCode(error.code)) return t(`errors.${error.code}`);
  return t("errors.GENERIC");
}

export function errorCode(error: unknown): string | null {
  return error instanceof ApiError ? error.code : null;
}
