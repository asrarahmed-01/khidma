import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { PropsWithChildren } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import "@/i18n";
import { AppLocaleProvider } from "@/i18n/locale";

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

/** The same providers the root layout sets up, with a fresh query cache per test. */
export function createWrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return function Providers({ children }: PropsWithChildren) {
    return (
      <SafeAreaProvider initialMetrics={metrics}>
        <QueryClientProvider client={client}>
          <AppLocaleProvider>{children}</AppLocaleProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    );
  };
}

/** A fetch stand-in that answers from a table of "METHOD /path" → [status, body]. */
export function mockFetch(routes: Record<string, [number, unknown]>) {
  const calls: { method: string; path: string; body: unknown }[] = [];
  const fn = jest.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? "GET";
    const path = new URL(url).pathname;
    calls.push({ method, path, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    const match = routes[`${method} ${path}`];
    if (!match) throw new TypeError("Network request failed");
    const [status, body] = match;
    return { ok: status < 400, status, text: async () => JSON.stringify(body) } as Response;
  });
  global.fetch = fn as unknown as typeof fetch;
  return { fn, calls };
}

/** A booking as the API returns it, for screens under test. */
export function makeBooking(overrides: Partial<import("@/api/types").Booking> = {}): import("@/api/types").Booking {
  return {
    id: "bk_1",
    status: "ACCEPTED",
    service: { id: "s1", slug: "ac-repair", nameEn: "AC repair", nameAr: "صيانة المكيفات", icon: "snowflake" },
    scheduledAt: "2026-10-21T07:00:00.000Z",
    serviceArea: "riyadh",
    address: { line: "Building 12, Olaya St, Riyadh", lat: 24.6948, lng: 46.6855 },
    notes: null,
    priceHalalas: 15000,
    customer: { id: "u_customer", name: "Sara", phone: "+966500000003" },
    technician: { id: "u_tech", name: "Fahd", phone: "+966500000002" },
    technicianLocation: null,
    payment: null,
    cancelReason: null,
    timeline: {
      createdAt: "2026-10-20T07:00:00.000Z",
      acceptedAt: "2026-10-20T07:05:00.000Z",
      enRouteAt: null,
      startedAt: null,
      completedAt: null,
      cancelledAt: null,
    },
    ...overrides,
  };
}

/** GET /me for a signed-in customer (or technician). */
export function meResponse(role: "CUSTOMER" | "TECHNICIAN" = "CUSTOMER") {
  const id = role === "CUSTOMER" ? "u_customer" : "u_tech";
  return {
    user: { id, phone: "+966500000003", name: role === "CUSTOMER" ? "Sara" : "Fahd", role, locale: "EN", createdAt: "" },
    technician: role === "TECHNICIAN" ? { bio: null, isApproved: true, isAvailable: true, services: [] } : null,
  };
}
