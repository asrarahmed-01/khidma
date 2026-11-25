import { AppError } from "../../lib/errors";
import type { CreateInvoiceInput, Invoice, PaymentGateway } from "./gateway";

/**
 * Moyasar's Invoices API (https://docs.moyasar.com/api/invoices/01-create-invoice).
 * Authenticated with the secret key as the Basic-auth username and an empty password,
 * so this class must only ever run on the server.
 */
export class MoyasarGateway implements PaymentGateway {
  readonly provider = "moyasar" as const;
  private readonly authorization: string;

  constructor(
    secretKey: string,
    private readonly baseUrl = "https://api.moyasar.com/v1",
    private readonly fetchImpl: typeof fetch = fetch,
  ) {
    this.authorization = `Basic ${Buffer.from(`${secretKey}:`).toString("base64")}`;
  }

  createInvoice(input: CreateInvoiceInput): Promise<Invoice> {
    return this.request("POST", "/invoices", {
      amount: input.amountHalalas,
      currency: "SAR",
      description: input.description,
      success_url: input.successUrl,
      back_url: input.backUrl,
      expired_at: input.expiresAt.toISOString(),
    });
  }

  fetchInvoice(id: string): Promise<Invoice> {
    return this.request("GET", `/invoices/${encodeURIComponent(id)}`);
  }

  private async request(method: "GET" | "POST", path: string, body?: unknown): Promise<Invoice> {
    let res: Response;
    try {
      res = await this.fetchImpl(`${this.baseUrl}${path}`, {
        method,
        headers: {
          authorization: this.authorization,
          accept: "application/json",
          ...(body !== undefined && { "content-type": "application/json" }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(15_000),
      });
    } catch (err) {
      console.error(`[moyasar] ${method} ${path} failed to connect`, err);
      throw providerError();
    }

    if (!res.ok) {
      // Moyasar errors look like { type, message, errors }. Log them; never show them to customers.
      console.error(`[moyasar] ${method} ${path} → ${res.status}`, await res.text().catch(() => ""));
      throw providerError();
    }
    return (await res.json()) as Invoice;
  }
}

const providerError = () =>
  new AppError(502, "PAYMENT_PROVIDER_ERROR", "The payment provider didn't respond, try again");
