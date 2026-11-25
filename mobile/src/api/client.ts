/**
 * A small fetch wrapper. Every failure becomes an ApiError with a stable `code`, so screens
 * can show a translated message without parsing HTTP details:
 * - server errors keep the server's code (e.g. BOOKING_UNAVAILABLE)
 * - no connection becomes NETWORK_ERROR, a slow response becomes TIMEOUT
 */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  signal?: AbortSignal;
}

export interface ApiClientOptions {
  baseUrl: string;
  getToken: () => string | null;
  /** Called when the server rejects our token, so the app can sign out. */
  onUnauthorized?: () => void;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

export type ApiClient = <T>(path: string, options?: RequestOptions) => Promise<T>;

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export function createApiClient({
  baseUrl,
  getToken,
  onUnauthorized,
  timeoutMs = 15_000,
  fetchImpl = (...args) => fetch(...args),
}: ApiClientOptions): ApiClient {
  return async function request<T>(path: string, { method = "GET", body, signal }: RequestOptions = {}) {
    const headers: Record<string, string> = { Accept: "application/json" };
    if (body !== undefined) headers["Content-Type"] = "application/json";
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;

    // Abort if the caller cancels (e.g. the screen unmounts) or the request takes too long.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const onCallerAbort = () => controller.abort();
    signal?.addEventListener("abort", onCallerAbort);

    let response: Response;
    try {
      response = await fetchImpl(`${baseUrl}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (error) {
      if (signal?.aborted) throw error;
      if (controller.signal.aborted) throw new ApiError(0, "TIMEOUT", "The server took too long to respond");
      throw new ApiError(0, "NETWORK_ERROR", "Could not reach the server");
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onCallerAbort);
    }

    const text = await response.text();
    const data = text ? parseJson(text) : null;

    if (!response.ok) {
      const envelope = (data as { error?: { code?: string; message?: string; details?: Record<string, unknown> } })
        ?.error;
      if (response.status === 401 && token) onUnauthorized?.();
      throw new ApiError(
        response.status,
        envelope?.code ?? `HTTP_${response.status}`,
        envelope?.message ?? `Request failed with status ${response.status}`,
        envelope?.details,
      );
    }

    return data as T;
  };
}
