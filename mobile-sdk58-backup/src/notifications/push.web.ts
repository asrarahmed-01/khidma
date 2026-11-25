/** Remote push isn't available in the web build (see push.ts for iOS and Android). */
export function pushSupported(): boolean {
  return false;
}

export async function registerForPushNotifications(): Promise<string | null> {
  return null;
}
