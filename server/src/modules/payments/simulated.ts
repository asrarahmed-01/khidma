import { randomUUID } from "node:crypto";
import express, { Router } from "express";
import { z } from "zod";
import { notFound } from "../../lib/errors";
import type { CreateInvoiceInput, Invoice, PaymentGateway } from "./gateway";

interface SimulatedInvoice extends Invoice {
  description: string;
  successUrl: string;
  backUrl: string;
}

/**
 * Stands in for Moyasar when no secret key is configured, so the whole payment flow can be
 * tried locally: the "checkout" is a page served by this API with Pay and Decline buttons.
 * Invoices live in memory. `config.ts` refuses to start production without a real key.
 */
export class SimulatedGateway implements PaymentGateway {
  readonly provider = "simulated" as const;
  private readonly invoices = new Map<string, SimulatedInvoice>();

  async createInvoice(input: CreateInvoiceInput): Promise<Invoice> {
    const id = randomUUID();
    // The checkout page is served by this same API, so it lives next to the success URL.
    const url = `${new URL(input.successUrl).origin}/payments/simulated/${id}`;
    const invoice: SimulatedInvoice = {
      id,
      status: "initiated",
      amount: input.amountHalalas,
      currency: "SAR",
      url,
      payments: [],
      description: input.description,
      successUrl: input.successUrl,
      backUrl: input.backUrl,
    };
    this.invoices.set(id, invoice);
    return snapshot(invoice);
  }

  async fetchInvoice(id: string): Promise<Invoice> {
    const invoice = this.invoices.get(id);
    // Matches a restarted dev server: the old invoice is simply gone, as if it had expired.
    if (!invoice) return { id, status: "expired", amount: 0, currency: "SAR", url: "", payments: [] };
    return snapshot(invoice);
  }

  /** What the checkout page's buttons do. Tests call it directly. */
  pay(id: string, outcome: "paid" | "declined") {
    const invoice = this.invoices.get(id);
    if (!invoice) throw notFound("Invoice");
    if (invoice.status !== "initiated") return invoice;
    invoice.payments.push({
      id: randomUUID(),
      status: outcome === "paid" ? "paid" : "failed",
      source: {
        type: "creditcard",
        company: "mada",
        message: outcome === "paid" ? "APPROVED" : "INSUFFICIENT FUNDS",
      },
    });
    // Like Moyasar's hosted invoices, a declined card leaves the invoice open for another try.
    if (outcome === "paid") invoice.status = "paid";
    return invoice;
  }

  get(id: string) {
    return this.invoices.get(id);
  }

  /** The checkout pages. `formTarget` adds the app's return address to the page's CSP. */
  router(formTarget: (invoiceId: string) => Promise<string | null>) {
    const router = Router();
    const Params = z.object({ invoiceId: z.uuid() });
    const PayBody = z.object({ outcome: z.enum(["paid", "declined"]) });

    router.get("/:invoiceId", async (req, res) => {
      const { invoiceId } = Params.parse(req.params);
      const invoice = this.invoices.get(invoiceId);
      if (!invoice) throw notFound("Invoice");

      const target = await formTarget(invoiceId);
      res.setHeader(
        "Content-Security-Policy",
        `default-src 'none'; style-src 'unsafe-inline'; form-action 'self'${target ? ` ${target}` : ""}; base-uri 'none'; frame-ancestors 'none'`,
      );
      res.type("html").send(checkoutPage(invoice, req.query.declined === "1"));
    });

    router.post("/:invoiceId", express.urlencoded({ extended: false, limit: "1kb" }), (req, res) => {
      const { invoiceId } = Params.parse(req.params);
      const { outcome } = PayBody.parse(req.body);
      const invoice = this.pay(invoiceId, outcome);
      if (invoice.status === "paid") res.redirect(303, invoice.successUrl);
      else res.redirect(303, `${req.baseUrl}/${invoiceId}?declined=1`);
    });

    return router;
  }
}

function snapshot(invoice: SimulatedInvoice): Invoice {
  return {
    id: invoice.id,
    status: invoice.status,
    amount: invoice.amount,
    currency: invoice.currency,
    url: invoice.url,
    payments: invoice.payments.map((p) => ({ ...p, source: p.source && { ...p.source } })),
  };
}

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function checkoutPage(invoice: SimulatedInvoice, declined: boolean) {
  const amount = (invoice.amount / 100).toFixed(2);
  const paid = invoice.status === "paid";
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Test checkout · Khidma</title>
<style>
  :root { color-scheme: light; }
  body { margin: 0; font: 16px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif; background: #f4f1ea; color: #1c2b28; }
  main { max-width: 420px; margin: 0 auto; padding: 24px 16px 40px; }
  .warn { background: #fff4d6; border: 1px solid #e9c46a; border-radius: 10px; padding: 10px 12px; font-size: 14px; }
  .card { background: #fff; border-radius: 14px; padding: 20px; margin-top: 16px; box-shadow: 0 1px 2px rgba(0,0,0,.06); }
  .muted { color: #5b6b67; font-size: 14px; }
  .amount { font-size: 32px; font-weight: 700; margin: 4px 0 0; }
  .test-card { display: flex; justify-content: space-between; border: 1px dashed #b9c4c1; border-radius: 10px; padding: 12px; margin: 16px 0; font-size: 15px; }
  button { width: 100%; border: 0; border-radius: 12px; padding: 14px; font: inherit; font-weight: 600; cursor: pointer; }
  .pay { background: #0f5c4d; color: #fff; }
  .decline { background: transparent; color: #a33a2b; margin-top: 8px; }
  .error { color: #a33a2b; font-weight: 600; }
  a { color: #0f5c4d; }
</style>
</head>
<body>
<main>
  <p class="warn"><strong>Simulated checkout.</strong> No money moves. Set <code>MOYASAR_SECRET_KEY</code> on the server to use Moyasar's real test checkout.</p>
  <div class="card">
    <div class="muted">${escapeHtml(invoice.description)}</div>
    <p class="amount">SAR ${amount}</p>
    ${paid ? `<p>This invoice is already paid.</p><p><a href="${escapeHtml(invoice.successUrl)}">Return to Khidma</a></p>` : `
    ${declined ? `<p class="error" role="alert">Card declined: insufficient funds. Try again.</p>` : ""}
    <div class="test-card"><span>mada test card</span><span>•••• 1010</span></div>
    <form method="post">
      <button class="pay" name="outcome" value="paid" type="submit">Pay SAR ${amount}</button>
      <button class="decline" name="outcome" value="declined" type="submit">Decline (insufficient funds)</button>
    </form>
    <p class="muted"><a href="${escapeHtml(invoice.backUrl)}">Cancel and return to Khidma</a></p>`}
  </div>
</main>
</body>
</html>`;
}
