import { API_URL } from "@/config";
import { useSession } from "@/session/store";
import { createApiClient } from "./client";
import type {
  Booking,
  CreateBookingInput,
  MeResponse,
  Message,
  MessagesPage,
  OpenJob,
  Service,
  ServiceArea,
  TechnicianStep,
  User,
  VerifyOtpResponse,
} from "./types";

export const request = createApiClient({
  baseUrl: API_URL,
  getToken: () => useSession.getState().token,
  onUnauthorized: () => {
    void useSession.getState().signOut();
  },
});

/** Every endpoint the app uses, in one typed object. */
export const api = {
  requestOtp: (phone: string) =>
    request<{ phone: string; expiresInSeconds: number }>("/auth/otp/request", { method: "POST", body: { phone } }),
  verifyOtp: (phone: string, code: string) =>
    request<VerifyOtpResponse>("/auth/otp/verify", { method: "POST", body: { phone, code } }),

  me: () => request<MeResponse>("/me"),
  updateMe: (data: Partial<Pick<User, "name" | "locale"> & { pushToken: string | null }>) =>
    request<{ user: User }>("/me", { method: "PATCH", body: data }),

  services: () => request<{ services: Service[] }>("/services"),
  serviceAreas: () => request<{ areas: ServiceArea[] }>("/service-areas"),

  createBooking: (input: CreateBookingInput) =>
    request<{ booking: Booking }>("/bookings", { method: "POST", body: input }),
  bookings: (scope: "active" | "past") => request<{ bookings: Booking[] }>(`/bookings?scope=${scope}`),
  booking: (id: string) => request<{ booking: Booking }>(`/bookings/${encodeURIComponent(id)}`),
  cancelBooking: (id: string, reason?: string) =>
    request<{ booking: Booking }>(`/bookings/${encodeURIComponent(id)}/cancel`, {
      method: "POST",
      body: reason ? { reason } : {},
    }),

  messages: (bookingId: string) =>
    request<MessagesPage>(`/bookings/${encodeURIComponent(bookingId)}/messages?limit=100`),
  sendMessage: (bookingId: string, body: string) =>
    request<{ message: Message }>(`/bookings/${encodeURIComponent(bookingId)}/messages`, {
      method: "POST",
      body: { body },
    }),

  startPayment: (bookingId: string, returnUrl: string) =>
    request<{ checkoutUrl: string; booking: Booking }>(`/bookings/${encodeURIComponent(bookingId)}/payment`, {
      method: "POST",
      body: { returnUrl },
    }),
  verifyPayment: (bookingId: string) =>
    request<{ booking: Booking }>(`/bookings/${encodeURIComponent(bookingId)}/payment/verify`, { method: "POST" }),

  applyAsTechnician: (serviceIds: string[], bio?: string) =>
    request<unknown>("/technicians/apply", { method: "POST", body: { serviceIds, bio: bio || undefined } }),
  updateTechnician: (data: { isAvailable?: boolean; bio?: string; serviceIds?: string[] }) =>
    request<unknown>("/technicians/me", { method: "PATCH", body: data }),
  openJobs: () => request<{ jobs: OpenJob[] }>("/bookings/open"),
  acceptJob: (id: string) =>
    request<{ booking: Booking }>(`/bookings/${encodeURIComponent(id)}/accept`, { method: "POST" }),
  advanceJob: (id: string, status: TechnicianStep) =>
    request<{ booking: Booking }>(`/bookings/${encodeURIComponent(id)}/status`, { method: "POST", body: { status } }),
};
