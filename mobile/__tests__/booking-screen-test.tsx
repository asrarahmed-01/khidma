import { fireEvent, renderRouter, screen, waitFor } from "expo-router/testing-library";
import * as WebBrowser from "expo-web-browser";
import { useLocalSearchParams } from "expo-router";
import { Text } from "react-native";
import BookingScreen from "@/app/booking/[id]";
import { createWrapper, makeBooking, meResponse, mockFetch } from "@/test-utils";

function ChatStub() {
  const { bookingId } = useLocalSearchParams<{ bookingId?: string }>();

  return <Text testID="chat-booking-id">{bookingId ?? ""}</Text>;
}

const routes = {
  "booking/[id]": BookingScreen,
  "chat/[bookingId]": ChatStub,
};

const open = () =>
  renderRouter(routes, {
    initialUrl: "/booking/bk_1",
    wrapper: createWrapper(),
  });

const completed = (
  payment: ReturnType<typeof makeBooking>["payment"] = null
) =>
  makeBooking({
    status: "COMPLETED",
    payment,
    timeline: {
      ...makeBooking().timeline,
      completedAt: "2026-10-20T09:00:00.000Z",
    },
  });

describe("booking screen: payment", () => {
  it("asks the customer to pay a completed job, then confirms with the server", async () => {
    const paid = completed({
      status: "PAID",
      amountHalalas: 15000,
      method: "mada",
      paidAt: "2026-10-20T09:10:00.000Z",
      failureMessage: null,
    });

    const { calls } = mockFetch({
      "GET /me": [200, meResponse("CUSTOMER")],
      "GET /bookings/bk_1": [200, { booking: completed() }],
      "POST /bookings/bk_1/payment": [
        201,
        {
          checkoutUrl: "https://checkout.moyasar.com/x",
          booking: completed(),
        },
      ],
      "POST /bookings/bk_1/payment/verify": [200, { booking: paid }],
    });

    await open();

    expect(await screen.findByTestId("amount-due")).toHaveTextContent("150 SAR");
    expect(screen.getByText("mada, Visa, Mastercard or Apple Pay")).toBeTruthy();

    await fireEvent.press(screen.getByTestId("pay"));

    // Checkout opens in the in-app browser, then returns to this booking.
    await waitFor(() =>
      expect(WebBrowser.openAuthSessionAsync).toHaveBeenCalled()
    );

    const [checkoutUrl, returnUrl] = (
      WebBrowser.openAuthSessionAsync as jest.Mock
    ).mock.calls[0];

    expect(checkoutUrl).toBe("https://checkout.moyasar.com/x");
    expect(returnUrl).toMatch(/booking\/bk_1$/);

    expect(
      calls.find((call) => call.path === "/bookings/bk_1/payment")?.body
    ).toEqual({ returnUrl });

    // The app asks the server to confirm payment.
    expect(await screen.findByText("Paid with mada")).toBeTruthy();
    expect(screen.queryByTestId("pay")).toBeNull();
  });

  it("explains a declined card", async () => {
    mockFetch({
      "GET /me": [200, meResponse("CUSTOMER")],
      "GET /bookings/bk_1": [
        200,
        {
          booking: completed({
            status: "INITIATED",
            amountHalalas: 15000,
            method: null,
            paidAt: null,
            failureMessage: "INSUFFICIENT FUNDS",
          }),
        },
      ],
    });

    await open();

    expect(
      await screen.findByText(
        "Your card was declined. Try again, or use another card."
      )
    ).toBeTruthy();
    expect(screen.getByTestId("pay")).toBeTruthy();
  });

  it("shows the technician whether they've been paid, without a Pay button", async () => {
    mockFetch({
      "GET /me": [200, meResponse("TECHNICIAN")],
      "GET /bookings/bk_1": [200, { booking: completed() }],
    });

    await open();

    expect(
      await screen.findByText("Waiting for the customer to pay")
    ).toBeTruthy();
    expect(screen.queryByTestId("pay")).toBeNull();
  });
});

describe("booking screen: on the way", () => {
  it("shows the customer how far away the technician is", async () => {
    mockFetch({
      "GET /me": [200, meResponse("CUSTOMER")],
      "GET /bookings/bk_1": [
        200,
        {
          booking: makeBooking({
            status: "EN_ROUTE",
            technicianLocation: {
              lat: 24.7166,
              lng: 46.6855,
              at: new Date().toISOString(),
            },
          }),
        },
      ],
    });

    await open();

    expect(await screen.findByText("Live tracking")).toBeTruthy();
    expect(screen.getByText("2.4 km away")).toBeTruthy();
    expect(screen.getByText("Updated just now")).toBeTruthy();
  });

  it("waits for the first position", async () => {
    mockFetch({
      "GET /me": [200, meResponse("CUSTOMER")],
      "GET /bookings/bk_1": [
        200,
        { booking: makeBooking({ status: "EN_ROUTE" }) },
      ],
    });

    await open();

    expect(
      await screen.findByText("Waiting for Fahd's location…")
    ).toBeTruthy();
  });

  it("opens the chat with the other person", async () => {
    mockFetch({
      "GET /me": [200, meResponse("CUSTOMER")],
      "GET /bookings/bk_1": [
        200,
        { booking: makeBooking({ status: "ACCEPTED" }) },
      ],
    });

    await open();

    await fireEvent.press(await screen.findByTestId("open-chat"));

    expect(await screen.findByTestId("chat-booking-id")).toHaveTextContent(
      "bk_1"
    );
  });
});