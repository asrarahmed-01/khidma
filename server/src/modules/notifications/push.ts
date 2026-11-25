/**
 * Push delivery is behind an interface, like SMS: the Expo push service in development and
 * production (it forwards to Firebase Cloud Messaging on Android and APNs on iOS), a log
 * when PUSH_ENABLED=false, and an in-memory outbox in tests.
 */
export interface PushMessage {
  to: string; // Expo push token
  title: string;
  body: string;
  data?: Record<string, string>;
}

export interface PushResult {
  token: string;
  ok: boolean;
  /** Expo's error code, e.g. DeviceNotRegistered (the app was uninstalled: forget the token). */
  error?: string;
}

export interface PushProvider {
  send(messages: PushMessage[]): Promise<PushResult[]>;
}

const EXPO_TOKEN = /^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]+\]$/;

export function isExpoPushToken(token: string): boolean {
  return EXPO_TOKEN.test(token);
}

interface ExpoTicket {
  status: "ok" | "error";
  id?: string;
  message?: string;
  details?: { error?: string };
}

/** https://docs.expo.dev/push-notifications/sending-notifications/ */
export class ExpoPushProvider implements PushProvider {
  private static readonly ENDPOINT = "https://exp.host/--/api/v2/push/send";
  private static readonly BATCH = 100; // Expo's limit per request

  constructor(
    private readonly accessToken?: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async send(messages: PushMessage[]): Promise<PushResult[]> {
    const results: PushResult[] = [];
    for (let i = 0; i < messages.length; i += ExpoPushProvider.BATCH) {
      results.push(...(await this.sendBatch(messages.slice(i, i + ExpoPushProvider.BATCH))));
    }
    return results;
  }

  private async sendBatch(batch: PushMessage[]): Promise<PushResult[]> {
    const failed = (error: string) => batch.map((m) => ({ token: m.to, ok: false, error }));
    try {
      const res = await this.fetchImpl(ExpoPushProvider.ENDPOINT, {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
          ...(this.accessToken && { authorization: `Bearer ${this.accessToken}` }),
        },
        body: JSON.stringify(
          batch.map((m) => ({ ...m, sound: "default", channelId: "default", priority: "high" })),
        ),
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) {
        console.error(`[push] Expo responded ${res.status}`, await res.text().catch(() => ""));
        return failed(`HTTP_${res.status}`);
      }
      const { data } = (await res.json()) as { data: ExpoTicket[] };
      return batch.map((m, i) => {
        const ticket = data[i];
        if (ticket?.status === "ok") return { token: m.to, ok: true };
        return { token: m.to, ok: false, error: ticket?.details?.error ?? ticket?.message ?? "UNKNOWN" };
      });
    } catch (err) {
      console.error("[push] could not reach Expo", err);
      return failed("NETWORK_ERROR");
    }
  }
}

export class LogPushProvider implements PushProvider {
  async send(messages: PushMessage[]): Promise<PushResult[]> {
    for (const m of messages) console.log(`[push] to ${m.to}: ${m.title} — ${m.body}`, m.data ?? "");
    return messages.map((m) => ({ token: m.to, ok: true }));
  }
}

/** Records messages for tests. Tokens in `unregistered` behave like an uninstalled app. */
export class MemoryPushProvider implements PushProvider {
  readonly sent: PushMessage[] = [];
  readonly unregistered = new Set<string>();

  async send(messages: PushMessage[]): Promise<PushResult[]> {
    return messages.map((m) => {
      if (this.unregistered.has(m.to)) return { token: m.to, ok: false, error: "DeviceNotRegistered" };
      this.sent.push(m);
      return { token: m.to, ok: true };
    });
  }

  to(token: string) {
    return this.sent.filter((m) => m.to === token);
  }
}
