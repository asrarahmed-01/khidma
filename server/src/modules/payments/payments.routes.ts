import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { z } from "zod";
import { config } from "../../config";
import { AppError } from "../../lib/errors";
import type { PaymentGateway } from "./gateway";
import type { PaymentsService } from "./payments.service";
import { cspSourceFor } from "./return-url";
import { SimulatedGateway } from "./simulated";

const WebhookBody = z.looseObject({
  id: z.string().optional(),
  type: z.string().optional(),
  secret_token: z.string().optional(),
  data: z.looseObject({ invoice_id: z.string().nullish() }).optional(),
});
const PaymentParams = z.object({ paymentId: z.string().min(1).max(64) });

/** Public payment endpoints: the provider's webhook and the browser's way back to the app. */
export function paymentsRouter({ payments, gateway }: { payments: PaymentsService; gateway: PaymentGateway }) {
  const router = Router();
  router.use(
    rateLimit({
      windowMs: 60 * 1000,
      limit: 60,
      standardHeaders: "draft-8",
      legacyHeaders: false,
      skip: () => config.NODE_ENV === "test",
    }),
  );

  router.post("/moyasar/webhook", async (req, res) => {
    const secret = config.MOYASAR_WEBHOOK_SECRET;
    if (!secret) throw new AppError(503, "WEBHOOK_NOT_CONFIGURED", "Set MOYASAR_WEBHOOK_SECRET to receive webhooks");
    res.json(await payments.handleWebhook(WebhookBody.parse(req.body), secret));
  });

  // Moyasar sends the customer's browser here after checkout (success_url and back_url).
  router.get("/return/:paymentId", async (req, res) => {
    const { outcome, redirect } = await payments.returnTarget(PaymentParams.parse(req.params).paymentId);
    if (redirect) {
      res.redirect(302, redirect);
      return;
    }
    res.type("html").send(resultPage(outcome));
  });

  if (gateway instanceof SimulatedGateway) {
    router.use(
      "/simulated",
      gateway.router(async (invoiceId) => {
        const returnUrl = await payments.returnUrlForInvoice(invoiceId);
        return returnUrl && cspSourceFor(returnUrl);
      }),
    );
  }
  return router;
}

function resultPage(outcome: "paid" | "failed" | "pending") {
  const text = {
    paid: ["Payment received", "تم استلام الدفع"],
    failed: ["Payment didn't go through", "لم تتم عملية الدفع"],
    pending: ["Payment not finished", "لم تكتمل عملية الدفع"],
  }[outcome];
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${text[0]} · Khidma</title></head>
<body style="font:18px/1.5 system-ui,sans-serif;text-align:center;padding:48px 16px;background:#f4f1ea;color:#1c2b28">
<h1 style="font-size:24px">${text[0]}</h1><p lang="ar" dir="rtl">${text[1]}</p><p>You can close this page and return to the Khidma app.</p></body></html>`;
}
