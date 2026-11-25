import cors from "cors";
import express from "express";
import { rateLimit } from "express-rate-limit";
import helmet from "helmet";
import { config } from "./config";
import { errorHandler, notFoundHandler } from "./middleware/error-handler";
import { adminRouter } from "./modules/admin/admin.routes";
import { authRouter } from "./modules/auth/auth.routes";
import { createOtpService } from "./modules/auth/otp.service";
import type { SmsProvider } from "./modules/auth/sms";
import { bookingsRouter } from "./modules/bookings/bookings.routes";
import { createBookingsService } from "./modules/bookings/bookings.service";
import { createChatService } from "./modules/chat/chat.service";
import { meRouter } from "./modules/me/me.routes";
import { registerNotifications } from "./modules/notifications/notifier";
import type { PushProvider } from "./modules/notifications/push";
import type { PaymentGateway } from "./modules/payments/gateway";
import { paymentsRouter } from "./modules/payments/payments.routes";
import { createPaymentsService } from "./modules/payments/payments.service";
import { servicesRouter } from "./modules/services/services.routes";
import type { EventBus } from "./lib/events";
import { SERVICE_AREAS } from "./lib/service-areas";
import { techniciansRouter } from "./modules/technicians/technicians.routes";

export interface AppDeps {
  sms: SmsProvider;
  push: PushProvider;
  payments: PaymentGateway;
  /** Shared with the Socket.IO server (see realtime/socket.ts), which listens to the same events. */
  events: EventBus;
}

export function createApp({ sms, push, payments: gateway, events }: AppDeps) {
  const bookings = createBookingsService(events);
  const chat = createChatService(events);
  const payments = createPaymentsService({ gateway, events });
  registerNotifications(events, push);

  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", 1);

  app.use(helmet());
  app.use(cors({ origin: config.CORS_ORIGINS === "*" ? true : config.CORS_ORIGINS.split(",") }));
  app.use(express.json({ limit: "100kb" }));

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  // Per-IP limit on login endpoints, on top of the per-phone limit inside the OTP service.
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 30,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    skip: () => config.NODE_ENV === "test",
    handler: (_req, res) => {
      res.status(429).json({ error: { code: "RATE_LIMITED", message: "Too many requests, slow down" } });
    },
  });

  app.use("/auth", authLimiter, authRouter(createOtpService({ sms })));
  app.use("/me", meRouter());
  app.use("/services", servicesRouter());
  app.get("/service-areas", (_req, res) => {
    res.json({ areas: SERVICE_AREAS });
  });
  app.use("/technicians", techniciansRouter());
  app.use("/bookings", bookingsRouter({ bookings, chat, payments }));
  app.use("/payments", paymentsRouter({ payments, gateway }));
  app.use("/admin", adminRouter(events));

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
