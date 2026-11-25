import { createServer } from "node:http";
import { createApp } from "./app";
import { config } from "./config";
import { prisma } from "./db";
import { EventBus } from "./lib/events";
import { ConsoleSmsProvider } from "./modules/auth/sms";
import { ExpoPushProvider, LogPushProvider } from "./modules/notifications/push";
import type { PaymentGateway } from "./modules/payments/gateway";
import { MoyasarGateway } from "./modules/payments/moyasar";
import { SimulatedGateway } from "./modules/payments/simulated";
import { attachRealtime } from "./realtime/socket";

function paymentGateway(): PaymentGateway {
  if (config.MOYASAR_SECRET_KEY) {
    const mode = config.MOYASAR_SECRET_KEY.startsWith("sk_live_") ? "LIVE" : "test";
    console.log(`Payments: Moyasar (${mode} mode)`);
    return new MoyasarGateway(config.MOYASAR_SECRET_KEY, config.MOYASAR_API_URL);
  }
  console.log("Payments: simulated checkout (set MOYASAR_SECRET_KEY to use Moyasar)");
  return new SimulatedGateway();
}

const events = new EventBus();
const app = createApp({
  sms: new ConsoleSmsProvider(),
  push: config.PUSH_ENABLED ? new ExpoPushProvider(config.EXPO_ACCESS_TOKEN) : new LogPushProvider(),
  payments: paymentGateway(),
  events,
});

// One HTTP server for both the REST API and Socket.IO, on the same port.
const server = createServer(app);
const io = attachRealtime(server, { events, corsOrigins: config.CORS_ORIGINS });

server.listen(config.PORT, () => {
  console.log(`Khidma API listening on http://localhost:${config.PORT} (REST + Socket.IO)`);
});

async function shutdown(signal: string) {
  console.log(`${signal} received, shutting down`);
  await io.close(); // also closes the HTTP server
  await prisma.$disconnect();
  process.exit(0);
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
