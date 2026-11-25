import { ApiError, createApiClient } from "@/api/client";

function respond(status: number, body: unknown) {
  return jest.fn(async () => ({ ok: status < 400, status, text: async () => JSON.stringify(body) }) as Response);
}

describe("API client", () => {
  it("sends JSON with the bearer token and returns the parsed body", async () => {
    const fetchImpl = respond(200, { ok: true });
    const client = createApiClient({ baseUrl: "http://api", getToken: () => "abc", fetchImpl });

    await expect(client("/bookings", { method: "POST", body: { a: 1 } })).resolves.toEqual({ ok: true });

    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("http://api/bookings");
    expect(init.headers).toMatchObject({ Authorization: "Bearer abc", "Content-Type": "application/json" });
    expect(init.body).toBe('{"a":1}');
  });

  it("turns the server's error envelope into an ApiError with the same code", async () => {
    const client = createApiClient({
      baseUrl: "http://api",
      getToken: () => null,
      fetchImpl: respond(409, { error: { code: "BOOKING_UNAVAILABLE", message: "Taken", details: { x: 1 } } }),
    });

    const error = await client("/bookings/1/accept").catch((e) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 409, code: "BOOKING_UNAVAILABLE", details: { x: 1 } });
  });

  it("reports a network failure as NETWORK_ERROR", async () => {
    const client = createApiClient({
      baseUrl: "http://api",
      getToken: () => null,
      fetchImpl: jest.fn(async () => {
        throw new TypeError("Network request failed");
      }),
    });
    await expect(client("/me")).rejects.toMatchObject({ code: "NETWORK_ERROR", status: 0 });
  });

  it("gives up on slow responses with TIMEOUT", async () => {
    const hang = jest.fn(
      (_url: string, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(new Error("aborted")));
        }),
    );
    const client = createApiClient({
      baseUrl: "http://api",
      getToken: () => null,
      fetchImpl: hang as unknown as typeof fetch,
      timeoutMs: 20,
    });
    await expect(client("/me")).rejects.toMatchObject({ code: "TIMEOUT" });
  });

  it("signs out when the server rejects our token", async () => {
    const onUnauthorized = jest.fn();
    const client = createApiClient({
      baseUrl: "http://api",
      getToken: () => "expired",
      onUnauthorized,
      fetchImpl: respond(401, { error: { code: "UNAUTHORIZED", message: "Invalid or expired token" } }),
    });
    await expect(client("/me")).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });
});
