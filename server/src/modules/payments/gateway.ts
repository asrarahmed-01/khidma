/**
 * The slice of a payment provider Khidma needs: create a hosted checkout (a Moyasar
 * invoice) and read it back. The customer enters card details on the provider's page,
 * never in our app or API, which keeps card data out of our systems entirely.
 */

/** Invoice statuses, as Moyasar names them. */
export type InvoiceStatus =
  | "initiated"
  | "paid"
  | "failed"
  | "refunded"
  | "canceled"
  | "on_hold"
  | "expired"
  | "voided";

export interface InvoicePayment {
  id: string;
  status: string; // initiated, paid, failed, authorized, captured, refunded, voided, verified
  source?: {
    type?: string; // creditcard, applepay, stcpay, samsungpay
    company?: string; // mada, visa, master, amex (cards and Apple Pay)
    message?: string | null; // e.g. "APPROVED", "INSUFFICIENT FUNDS"
  };
}

export interface Invoice {
  id: string;
  status: InvoiceStatus;
  amount: number; // halalas
  currency: string;
  url: string; // the checkout page to send the customer to
  payments: InvoicePayment[];
}

export interface CreateInvoiceInput {
  amountHalalas: number;
  description: string;
  successUrl: string;
  backUrl: string;
  expiresAt: Date;
}

export interface PaymentGateway {
  readonly provider: "moyasar" | "simulated";
  createInvoice(input: CreateInvoiceInput): Promise<Invoice>;
  fetchInvoice(id: string): Promise<Invoice>;
}

/** How the customer paid, in the app's vocabulary: mada, visa, mastercard, amex, applepay, stcpay. */
export function paymentMethodOf(payment: InvoicePayment | undefined): string | null {
  const source = payment?.source;
  if (!source?.type) return null;
  if (source.type === "creditcard") {
    if (!source.company) return "card";
    return source.company === "master" ? "mastercard" : source.company;
  }
  return source.type;
}
