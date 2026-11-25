import { fireEvent, renderRouter, screen, waitFor } from "expo-router/testing-library";
import SignInScreen from "@/app/(auth)/sign-in";
import { createWrapper, mockFetch } from "@/test-utils";

function Verify() {
  return null;
}

describe("sign-in screen", () => {
  it("asks for a valid Saudi number before calling the API", async () => {
    const { fn } = mockFetch({});
    await renderRouter({ "(auth)/sign-in": SignInScreen, "(auth)/verify": Verify }, {
      initialUrl: "/sign-in",
      wrapper: createWrapper(),
    });

    await fireEvent.changeText(screen.getByTestId("phone-input"), "12345");
    await fireEvent.press(screen.getByTestId("send-code"));

    expect(await screen.findByText("Enter a Saudi mobile number starting with 5.")).toBeTruthy();
    expect(fn).not.toHaveBeenCalled();
  });

  it("requests a code for the normalized number and opens the verify screen", async () => {
    const { calls } = mockFetch({ "POST /auth/otp/request": [202, { phone: "+966512345678", expiresInSeconds: 300 }] });
    const router = await renderRouter({ "(auth)/sign-in": SignInScreen, "(auth)/verify": Verify }, {
      initialUrl: "/sign-in",
      wrapper: createWrapper(),
    });

    await fireEvent.changeText(screen.getByTestId("phone-input"), "051 234 5678");
    await fireEvent.press(screen.getByTestId("send-code"));

    await waitFor(() => expect(router.getPathname()).toBe("/verify"));
    expect(calls[0]).toEqual({ method: "POST", path: "/auth/otp/request", body: { phone: "+966512345678" } });
    expect(router.getSearchParams()).toEqual({ phone: "+966512345678" });
  });

  it("shows the server's reason when it refuses", async () => {
    mockFetch({
      "POST /auth/otp/request": [429, { error: { code: "OTP_RATE_LIMITED", message: "Too many codes requested" } }],
    });
    await renderRouter({ "(auth)/sign-in": SignInScreen, "(auth)/verify": Verify }, {
      initialUrl: "/sign-in",
      wrapper: createWrapper(),
    });

    await fireEvent.changeText(screen.getByTestId("phone-input"), "0512345678");
    await fireEvent.press(screen.getByTestId("send-code"));

    expect(await screen.findByText("Too many codes requested. Wait a few minutes, then try again.")).toBeTruthy();
  });
});
