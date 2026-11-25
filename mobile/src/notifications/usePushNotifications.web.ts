/**
 * No push notifications on the web. Having this file keeps expo-notifications out of the
 * web bundle entirely (see usePushNotifications.ts for iOS and Android).
 */
export function usePushNotifications(_signedIn: boolean) {}
