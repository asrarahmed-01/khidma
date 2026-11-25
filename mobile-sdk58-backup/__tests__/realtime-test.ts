import { QueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/api/hooks";
import type { MessagesPage } from "@/api/types";
import { applyRealtimeEvent } from "@/realtime/events";
import { realtime, useRealtime } from "@/realtime/store";

const message = (id: string, senderId = "u_tech") => ({
  id,
  bookingId: "bk_1",
  senderId,
  body: `hello ${id}`,
  createdAt: "2026-10-20T08:00:00.000Z",
});

describe("realtime events", () => {
  let client: QueryClient;
  beforeEach(() => {
    // No garbage-collection timers, so Jest can exit as soon as the tests finish.
    client = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } });
    realtime.reset();
  });
  afterEach(() => client.clear());

  it("refetches a booking (and the lists) when it changes, instead of trusting the push", () => {
    const invalidate = jest.spyOn(client, "invalidateQueries");
    applyRealtimeEvent(client, { type: "booking:changed", bookingId: "bk_1", status: "EN_ROUTE" }, "u_customer");
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["booking", "bk_1"] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["bookings"] });
  });

  it("adds a new chat message once, even if the POST response already added it", () => {
    client.setQueryData<MessagesPage>(queryKeys.messages("bk_1"), { messages: [message("m1")], hasMore: false });
    applyRealtimeEvent(client, { type: "message:new", message: message("m2") }, "u_customer");
    applyRealtimeEvent(client, { type: "message:new", message: message("m2") }, "u_customer");
    const page = client.getQueryData<MessagesPage>(queryKeys.messages("bk_1"));
    expect(page?.messages.map((m) => m.id)).toEqual(["m1", "m2"]);
  });

  it("counts unread messages from the other person, unless their chat is open", () => {
    applyRealtimeEvent(client, { type: "message:new", message: message("m1") }, "u_customer");
    applyRealtimeEvent(client, { type: "message:new", message: message("m2", "u_customer") }, "u_customer");
    expect(useRealtime.getState().unread.bk_1).toBe(1); // my own message doesn't count

    realtime.openChat("bk_1");
    expect(useRealtime.getState().unread.bk_1).toBe(0);
    applyRealtimeEvent(client, { type: "message:new", message: message("m3") }, "u_customer");
    expect(useRealtime.getState().unread.bk_1).toBe(0);
  });

  it("stores the technician's live position for the booking", () => {
    const location = { bookingId: "bk_1", lat: 24.7, lng: 46.68, heading: 90, at: "2026-10-20T08:00:00.000Z" };
    applyRealtimeEvent(client, { type: "location", location }, "u_customer");
    expect(client.getQueryData(queryKeys.location("bk_1"))).toEqual(location);
  });

  it("refreshes everything after reconnecting, since events may have been missed", () => {
    const invalidate = jest.spyOn(client, "invalidateQueries");
    applyRealtimeEvent(client, { type: "reconnected" }, "u_customer");
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["messages"] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["open-jobs"] });
  });
});
