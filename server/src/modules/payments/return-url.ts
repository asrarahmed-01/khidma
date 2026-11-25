import { config } from "../../config";
import { badRequest } from "../../lib/errors";

/** The app's own URL scheme (app.json → expo.scheme). */
const APP_SCHEME = "khidma:";
/** Expo Go and the dev server, only accepted outside production. */
const DEV_SCHEMES = ["exp:", "exps:"];

const PRIVATE_HOST = /^(localhost|127\.0\.0\.1|\[::1\]|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)$/;

/**
 * After paying, the customer's browser is sent back to the app. The app tells us where that
 * is, so the address must be checked: otherwise this endpoint would redirect to any site an
 * attacker chooses (an open redirect, useful for phishing).
 */
export function validateReturnUrl(raw: string): string {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw invalid();
  }

  const isProduction = config.NODE_ENV === "production";
  if (url.protocol === APP_SCHEME) return url.toString();
  if (!isProduction && DEV_SCHEMES.includes(url.protocol)) return url.toString();

  if (url.protocol === "https:" || url.protocol === "http:") {
    const allowedOrigins = config.CORS_ORIGINS === "*" ? [] : config.CORS_ORIGINS.split(",").map((o) => o.trim());
    if (allowedOrigins.includes(url.origin)) return url.toString();
    // The web build on the developer's machine or Wi-Fi (e.g. http://localhost:8081).
    if (!isProduction && PRIVATE_HOST.test(url.hostname)) return url.toString();
  }
  throw invalid();
}

/** A CSP source matching the return address, so a checkout form may redirect there. */
export function cspSourceFor(returnUrl: string): string {
  const url = new URL(returnUrl);
  return url.protocol === "http:" || url.protocol === "https:" ? url.origin : url.protocol;
}

const invalid = () => badRequest("INVALID_RETURN_URL", "returnUrl must point back to the Khidma app");
