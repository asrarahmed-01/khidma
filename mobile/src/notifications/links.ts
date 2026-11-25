import type { Href } from "expo-router";

/**
 * Screens a push notification may open. The server puts the path in `data.url`; anything
 * else is ignored, so a notification can never send the app to an arbitrary screen or site.
 */
const ALLOWED = [/^\/booking\/[A-Za-z0-9_-]{1,64}$/, /^\/chat\/[A-Za-z0-9_-]{1,64}$/, /^\/jobs$/];

export function notificationTarget(data: unknown): Href | null {
  if (typeof data !== "object" || data === null) return null;
  const url = (data as { url?: unknown }).url;
  if (typeof url !== "string" || !ALLOWED.some((pattern) => pattern.test(url))) return null;
  return url as Href;
}
