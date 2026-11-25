import { AppError } from "../src/lib/errors";
import { ExpoPushProvider, isExpoPushToken } from "../src/modules/notifications/push";
import { paymentMethodOf } from "../src/modules/payments/gateway";
import { MoyasarGateway } from "../src/modules/payments/moyasar";

/** A fetch stand-in that records requests and answers from a queue. */
function fakeFetch(...responses: { status?: number; body: unknown }[]) {
  const calls: { url: string; init: RequestInit }[] = [];
  const impl = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    const next = responses.shift() ?? { body: {} };
    return new Response(JSON.stringify(next.body), {
      status: next.status ?? 200,
      headers: { "content-type": "application/json" },
    });
  }) as unknown as typeof fetch;
  return { impl, calls };
}

describe("MoyasarGateway", () => {
  const invoice = { id: "inv_1", status: "initiated", amount: 15000, currency: "SAR", url: "https://checkout", payments: [] };

  it("creates invoices with the secret key as Basic-auth username and amounts in halalas", async () => {
    const { impl, calls } = fakeFetch({ status: 201, body: invoice });
    const gateway = new MoyasarGateway("sk_test_abc", "https://api.moyasar.com/v1", impl);
    const expiresAt = new Date("2026-10-20T10:00:00Z");

    await expect(
      gateway.createInvoice({
        amountHalalas: 15000,
        description: "AC repair",
        successUrl: "https://api/return",
        backUrl: "https://api/return",
        expiresAt,
      }),
    ).resolves.toEqual(invoice);

    expect(calls[0].url).toBe("https://api.moyasar.com/v1/invoices");
    const headers = calls[0].init.headers as Record<string, string>;
    expect(headers.authorization).toBe(`Basic ${Buffer.from("sk_test_abc:").toString("base64")}`);
    expect(JSON.parse(calls[0].init.body as string)).toEqual({
      amount: 15000,
      currency: "SAR",
      description: "AC repair",
      success_url: "https://api/return",
      back_url: "https://api/return",
      expired_at: "2026-10-20T10:00:00.000Z",
    });
  });

  it("hides provider errors behind PAYMENT_PROVIDER_ERROR", async () => {
    const logged = jest.spyOn(console, "error").mockImplementation(() => undefined);
    const { impl } = fakeFetch({ status: 401, body: { type: "authentication_error" } });
    const gateway = new MoyasarGateway("sk_test_bad", "https://api.moyasar.com/v1", impl);

    const error = await gateway.fetchInvoice("inv_1").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(AppError);
    expect(error).toMatchObject({ status: 502, code: "PAYMENT_PROVIDER_ERROR" });
    logged.mockRestore();
  });

  it("names the payment method the way the app shows it", () => {
    expect(paymentMethodOf({ id: "p", status: "paid", source: { type: "creditcard", company: "mada" } })).toBe("mada");
    expect(paymentMethodOf({ id: "p", status: "paid", source: { type: "creditcard", company: "master" } })).toBe(
      "mastercard",
    );
    expect(paymentMethodOf({ id: "p", status: "paid", source: { type: "applepay", company: "visa" } })).toBe("applepay");
    expect(paymentMethodOf(undefined)).toBeNull();
  });
});

describe("ExpoPushProvider", () => {
  it("recognises Expo push tokens", () => {
    expect(isExpoPushToken("ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]")).toBe(true);
    expect(isExpoPushToken("ExpoPushToken[abc-DEF_123]")).toBe(true);
    expect(isExpoPushToken("fcm:abc")).toBe(false);
  });

  it("sends in batches of 100 and reports each ticket", async () => {
    const tokens = Array.from({ length: 101 }, (_, i) => `ExponentPushToken[t${i}]`);
    const { impl, calls } = fakeFetch(
      { body: { data: tokens.slice(0, 100).map((_, i) => (i === 3 ? deadTicket : { status: "ok", id: `r${i}` })) } },
      { body: { data: [{ status: "ok", id: "r100" }] } },
    );
    const provider = new ExpoPushProvider("expo-access-token", impl);

    const results = await provider.send(tokens.map((to) => ({ to, title: "Hi", body: "There", data: { url: "/jobs" } })));

    expect(calls).toHaveLength(2);
    expect(calls[0].url).toBe("https://exp.host/--/api/v2/push/send");
    expect((calls[0].init.headers as Record<string, string>).authorization).toBe("Bearer expo-access-token");
    const firstBatch = JSON.parse(calls[0].init.body as string);
    expect(firstBatch).toHaveLength(100);
    expect(firstBatch[0]).toMatchObject({ to: tokens[0], title: "Hi", channelId: "default", data: { url: "/jobs" } });
    expect(results).toHaveLength(101);
    expect(results[3]).toEqual({ token: tokens[3], ok: false, error: "DeviceNotRegistered" });
    expect(results.filter((r) => r.ok)).toHaveLength(100);
  });
});

const deadTicket = {
  status: "error",
  message: '"ExponentPushToken[t3]" is not a registered push notification recipient',
  details: { error: "DeviceNotRegistered" },
};
