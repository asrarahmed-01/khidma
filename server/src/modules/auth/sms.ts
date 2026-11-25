/**
 * SMS delivery is behind an interface so the provider can be swapped without touching
 * the OTP logic: console output in development, an in-memory inbox in tests, and a real
 * gateway (for example Unifonic or Twilio) in production.
 */
export interface SmsProvider {
  send(to: string, message: string): Promise<void>;
}

export class ConsoleSmsProvider implements SmsProvider {
  async send(to: string, message: string): Promise<void> {
    console.log(`[sms] to ${to}:\n${message}`);
  }
}

/** Keeps sent messages in memory so tests can read the OTP. */
export class MemorySmsProvider implements SmsProvider {
  readonly sent: { to: string; message: string }[] = [];

  async send(to: string, message: string): Promise<void> {
    this.sent.push({ to, message });
  }

  lastCodeFor(phone: string): string | undefined {
    const last = [...this.sent].reverse().find((m) => m.to === phone);
    return last?.message.match(/\d{6}/)?.[0];
  }
}
