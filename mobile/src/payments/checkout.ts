import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { Platform } from "react-native";
import { ApiError } from "@/api/client";
import { api } from "@/api";
import { queryKeys, storeBooking } from "@/api/hooks";
import type { Booking } from "@/api/types";

/**
 * Where checkout sends the customer afterwards: this booking's screen in the app.
 * Expo Go → exp://192.168.1.5:8081/--/booking/<id>, a build → khidma://booking/<id>,
 * the web → http://localhost:8081/booking/<id>. The server only accepts these shapes.
 */
export function paymentReturnUrl(bookingId: string): string {
  const path = `/booking/${encodeURIComponent(bookingId)}`;
  if (Platform.OS === "web" && typeof window !== "undefined") return `${window.location.origin}${path}`;
  return Linking.createURL(path);
}

/**
 * Pays for a completed booking on Moyasar's hosted checkout (mada, Visa, Mastercard,
 * Apple Pay). Card details are entered on Moyasar's page, never in the app.
 *
 * On a phone the checkout opens in an in-app browser that closes itself when Moyasar
 * redirects back to the app. However the browser was closed, we then ask the server,
 * which asks Moyasar: the app never decides on its own that a payment succeeded.
 */
export function usePayBooking(bookingId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<Booking> => {
      const returnUrl = paymentReturnUrl(bookingId);
      const { checkoutUrl } = await api.startPayment(bookingId, returnUrl);

      if (Platform.OS === "web") {
        // A full-page redirect: popups opened after an await are blocked by browsers.
        // The booking screen verifies the payment when the browser comes back.
        window.location.assign(checkoutUrl);
        return new Promise<Booking>(() => undefined);
      }

      await WebBrowser.openAuthSessionAsync(checkoutUrl, returnUrl);
      return (await api.verifyPayment(bookingId)).booking;
    },
    onSuccess: (booking) => storeBooking(client, booking),
    onError: (error) => {
      // Paid in the meantime (another device, or the webhook got there first).
      if (error instanceof ApiError && error.code === "ALREADY_PAID") {
        void client.invalidateQueries({ queryKey: queryKeys.booking(bookingId) });
      }
    },
  });
}

/** Re-checks a payment with the server, e.g. when the web app is reopened after checkout. */
export function useVerifyPayment(bookingId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async () => (await api.verifyPayment(bookingId)).booking,
    onSuccess: (booking) => storeBooking(client, booking),
  });
}
