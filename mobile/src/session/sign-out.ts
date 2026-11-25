import { api } from "@/api";
import { pushSupported } from "@/notifications/push";
import { useSession } from "./store";

/**
 * Signing out from the account screen: first tell the API to stop sending this device
 * notifications for this account, then forget the session. (A 401 sign-out skips the first
 * step, since the token no longer works; the next account to sign in here takes the
 * device's push token over anyway.)
 */
export async function signOutOfThisDevice() {
  if (pushSupported()) await api.updateMe({ pushToken: null }).catch(() => undefined);
  await useSession.getState().signOut();
}
