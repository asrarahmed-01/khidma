import { fireEvent, renderRouter, screen, waitFor } from "expo-router/testing-library";
import ChatScreen from "@/app/chat/[bookingId]";
import { createWrapper, makeBooking, meResponse, mockFetch } from "@/test-utils";

const message = (id: string, senderId: string, body: string) => ({
  id,
  bookingId: "bk_1",
  senderId,
  body,
  createdAt: new Date().toISOString(),
});

const open = () =>
  renderRouter({ "chat/[bookingId]": ChatScreen }, { initialUrl: "/chat/bk_1", wrapper: createWrapper() });

describe("chat screen", () => {
  it("shows the conversation and sends a trimmed message", async () => {
    const { calls } = mockFetch({
      "GET /me": [200, meResponse("CUSTOMER")],
      "GET /bookings/bk_1": [200, { booking: makeBooking({ status: "EN_ROUTE" }) }],
      "GET /bookings/bk_1/messages": [
        200,
        { messages: [message("m1", "u_tech", "I'm 10 minutes away")], hasMore: false },
      ],
      "POST /bookings/bk_1/messages": [201, { message: message("m2", "u_customer", "Building 12, 2nd floor") }],
    });
    await open();

    expect(await screen.findByText("I'm 10 minutes away")).toBeTruthy();
    expect(screen.getByText("Fahd")).toBeTruthy(); // header: who you're talking to

    await fireEvent.changeText(screen.getByTestId("message-input"), "  Building 12, 2nd floor  ");
    await fireEvent.press(screen.getByTestId("send-message"));

    expect(await screen.findByText("Building 12, 2nd floor")).toBeTruthy();
    expect(calls.find((c) => c.method === "POST")?.body).toEqual({ body: "Building 12, 2nd floor" });
    await waitFor(() => expect(screen.getByTestId("message-input").props.value).toBe(""));
  });

  it("is read-only once the job is done", async () => {
    mockFetch({
      "GET /me": [200, meResponse("CUSTOMER")],
      "GET /bookings/bk_1": [200, { booking: makeBooking({ status: "COMPLETED" }) }],
      "GET /bookings/bk_1/messages": [200, { messages: [], hasMore: false }],
    });
    await open();
    expect(await screen.findByText("This job is finished, so the chat is read-only.")).toBeTruthy();
    expect(screen.queryByTestId("message-input")).toBeNull();
  });

  it("can't send an empty message", async () => {
    mockFetch({
      "GET /me": [200, meResponse("TECHNICIAN")],
      "GET /bookings/bk_1": [200, { booking: makeBooking({ status: "ACCEPTED" }) }],
      "GET /bookings/bk_1/messages": [200, { messages: [], hasMore: false }],
    });
    await open();
    expect(await screen.findByText("No messages yet")).toBeTruthy();
    expect(screen.getByText("Sara")).toBeTruthy(); // the technician talks to the customer
    await fireEvent.changeText(screen.getByTestId("message-input"), "   ");
    expect(screen.getByTestId("send-message")).toBeDisabled();
  });
});
