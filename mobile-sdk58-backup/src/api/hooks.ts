import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useRealtime } from "@/realtime/store";
import { meQueryKey } from "@/session/store";
import { api } from "./index";
import type {
  Booking,
  BookingStatus,
  CreateBookingInput,
  LiveLocation,
  MeResponse,
  Message,
  MessagesPage,
  TechnicianStep,
} from "./types";

export const queryKeys = {
  me: meQueryKey,
  services: ["services"] as const,
  serviceAreas: ["service-areas"] as const,
  bookings: (scope: "active" | "past") => ["bookings", scope] as const,
  allBookings: ["bookings"] as const,
  booking: (id: string) => ["booking", id] as const,
  openJobs: ["open-jobs"] as const,
  messages: (bookingId: string) => ["messages", bookingId] as const,
  location: (bookingId: string) => ["location", bookingId] as const,
};

/**
 * Socket.IO pushes changes as they happen; polling stays on as a safety net in case an
 * event is missed, but much slower while the socket is connected.
 */
function usePollInterval(whenOffline: number) {
  const connected = useRealtime((s) => s.connected);
  return connected ? 60_000 : whenOffline;
}

const ACTIVE: BookingStatus[] = ["PENDING", "ACCEPTED", "EN_ROUTE", "IN_PROGRESS"];
export const isActive = (status: BookingStatus) => ACTIVE.includes(status);

/** After any change to a booking: update its cached copy and refresh the lists that show it. */
export function storeBooking(client: QueryClient, booking: Booking) {
  client.setQueryData(queryKeys.booking(booking.id), { booking });
  void client.invalidateQueries({ queryKey: queryKeys.allBookings });
}

// Profile ------------------------------------------------------------------

export function useMe(enabled = true) {
  return useQuery({ queryKey: queryKeys.me, queryFn: api.me, enabled });
}

export function useUpdateMe() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: api.updateMe,
    onSuccess: ({ user }) => {
      client.setQueryData<MeResponse>(queryKeys.me, (old) => (old ? { ...old, user } : old));
    },
  });
}

// Catalog ------------------------------------------------------------------

export function useServices() {
  return useQuery({ queryKey: queryKeys.services, queryFn: api.services, select: (d) => d.services, staleTime: 5 * 60_000 });
}

export function useServiceAreas() {
  return useQuery({
    queryKey: queryKeys.serviceAreas,
    queryFn: api.serviceAreas,
    select: (d) => d.areas,
    staleTime: 60 * 60_000,
  });
}

// Bookings -----------------------------------------------------------------

export function useBookings(scope: "active" | "past") {
  const interval = usePollInterval(20_000);
  return useQuery({
    queryKey: queryKeys.bookings(scope),
    queryFn: () => api.bookings(scope),
    select: (d) => d.bookings,
    refetchInterval: scope === "active" ? interval : false,
  });
}

export function useBooking(id: string) {
  const interval = usePollInterval(15_000);
  return useQuery({
    queryKey: queryKeys.booking(id),
    queryFn: () => api.booking(id),
    select: (d) => d.booking,
    refetchInterval: (query) => {
      const booking = query.state.data?.booking;
      // A completed but unpaid job may still change (the payment lands).
      const unpaid = booking?.status === "COMPLETED" && booking.payment?.status !== "PAID";
      return booking && (isActive(booking.status) || unpaid) ? interval : false;
    },
  });
}

/**
 * The technician's newest known position: whichever is more recent of the one in the
 * booking (from the last fetch) and the last one pushed over the socket.
 */
export function useTechnicianLocation(booking: Booking): { lat: number; lng: number; heading: number | null; at: string } | null {
  const { data: pushed } = useQuery<LiveLocation | null>({
    queryKey: queryKeys.location(booking.id),
    queryFn: () => null,
    enabled: false,
  });
  if (booking.status !== "EN_ROUTE") return null;
  const fetched = booking.technicianLocation && { ...booking.technicianLocation, heading: null };
  if (!pushed) return fetched;
  if (!fetched) return pushed;
  return new Date(pushed.at) >= new Date(fetched.at) ? pushed : fetched;
}

export function useCreateBooking() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateBookingInput) => api.createBooking(input),
    onSuccess: ({ booking }) => storeBooking(client, booking),
  });
}

export function useCancelBooking(id: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (reason?: string) => api.cancelBooking(id, reason),
    onSuccess: ({ booking }) => storeBooking(client, booking),
  });
}

// Technician ---------------------------------------------------------------

export function useApplyAsTechnician() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ serviceIds, bio }: { serviceIds: string[]; bio?: string }) => api.applyAsTechnician(serviceIds, bio),
    // The role changes to TECHNICIAN; reloading /me makes the route guards switch the app over.
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.me }),
  });
}

export function useSetAvailability() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (isAvailable: boolean) => api.updateTechnician({ isAvailable }),
    // Optimistic: flip the switch immediately, roll back if the server refuses.
    onMutate: async (isAvailable) => {
      await client.cancelQueries({ queryKey: queryKeys.me });
      const previous = client.getQueryData<MeResponse>(queryKeys.me);
      client.setQueryData<MeResponse>(queryKeys.me, (old) =>
        old?.technician ? { ...old, technician: { ...old.technician, isAvailable } } : old,
      );
      return { previous };
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) client.setQueryData(queryKeys.me, context.previous);
    },
    onSettled: () => {
      void client.invalidateQueries({ queryKey: queryKeys.me });
      void client.invalidateQueries({ queryKey: queryKeys.openJobs });
    },
  });
}

export function useOpenJobs(enabled: boolean) {
  const interval = usePollInterval(20_000);
  return useQuery({
    queryKey: queryKeys.openJobs,
    queryFn: api.openJobs,
    select: (d) => d.jobs,
    enabled,
    refetchInterval: enabled ? interval : false,
  });
}

export function useAcceptJob() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.acceptJob(id),
    onSuccess: ({ booking }) => storeBooking(client, booking),
    // Whether we won or lost the job, the open list has changed.
    onSettled: () => client.invalidateQueries({ queryKey: queryKeys.openJobs }),
  });
}

export function useAdvanceJob(id: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (status: TechnicianStep) => api.advanceJob(id, status),
    onSuccess: ({ booking }) => storeBooking(client, booking),
  });
}

// Chat ---------------------------------------------------------------------

/** Adds a message to a loaded conversation once, whether it came from the socket or the POST. */
export function addMessage(client: QueryClient, message: Message) {
  client.setQueryData<MessagesPage>(queryKeys.messages(message.bookingId), (page) => {
    if (!page || page.messages.some((m) => m.id === message.id)) return page;
    return { ...page, messages: [...page.messages, message] };
  });
}

export function useMessages(bookingId: string) {
  // New messages arrive over the socket; polling is only a fallback for when it's down.
  const interval = usePollInterval(10_000);
  return useQuery<MessagesPage>({
    queryKey: queryKeys.messages(bookingId),
    queryFn: () => api.messages(bookingId),
    refetchInterval: interval,
  });
}

export function useSendMessage(bookingId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: string) => api.sendMessage(bookingId, body),
    onSuccess: ({ message }) => addMessage(client, message),
  });
}
