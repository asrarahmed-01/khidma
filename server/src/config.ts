import dotenv from "dotenv";
import { z } from "zod";

dotenv.config({ quiet: true });

/** Treats `KEY=""` in .env the same as leaving the key out. */
const optional = <T extends z.ZodType>(schema: T) =>
  z.preprocess((value) => (value === "" ? undefined : value), schema.optional());

const ConfigSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PORT: z.coerce.number().int().positive().default(4000),
    DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
    JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
    JWT_EXPIRES_IN: z.string().default("7d"),
    OTP_SECRET: z.string().min(32, "OTP_SECRET must be at least 32 characters"),
    OTP_TTL_SECONDS: z.coerce.number().int().positive().default(300),
    OTP_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),
    OTP_MAX_REQUESTS: z.coerce.number().int().positive().default(3),
    OTP_REQUEST_WINDOW_SECONDS: z.coerce.number().int().positive().default(600),
    CORS_ORIGINS: z.string().default("*"),

    // Public address of this API, used in payment return links. When unset, links use the
    // host the app called (e.g. http://192.168.1.5:4000), which is what you want on Wi-Fi.
    PUBLIC_API_URL: optional(z.url()),

    // Moyasar (https://dashboard.moyasar.com → Settings → API keys). Without a secret key the
    // API uses a simulated checkout page instead, which is only allowed outside production.
    MOYASAR_SECRET_KEY: optional(z.string().regex(/^sk_(test|live)_/, "must start with sk_test_ or sk_live_")),
    MOYASAR_WEBHOOK_SECRET: optional(z.string().min(16, "MOYASAR_WEBHOOK_SECRET must be at least 16 characters")),
    MOYASAR_API_URL: z.url().default("https://api.moyasar.com/v1"),

    // Only needed if "Enhanced security for push notifications" is on in the Expo dashboard.
    EXPO_ACCESS_TOKEN: optional(z.string()),
    // Set to "false" to log push notifications instead of sending them.
    PUSH_ENABLED: z
      .enum(["true", "false"])
      .default("true")
      .transform((v) => v === "true"),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV === "production" && !env.MOYASAR_SECRET_KEY) {
      ctx.addIssue({ code: "custom", path: ["MOYASAR_SECRET_KEY"], message: "is required in production" });
    }
    if (env.NODE_ENV === "production" && env.MOYASAR_SECRET_KEY && !env.MOYASAR_WEBHOOK_SECRET) {
      ctx.addIssue({ code: "custom", path: ["MOYASAR_WEBHOOK_SECRET"], message: "is required in production" });
    }
  });

export type Config = z.infer<typeof ConfigSchema>;

const parsed = ConfigSchema.safeParse(process.env);
if (!parsed.success) {
  const problems = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
  throw new Error(`Invalid environment configuration:\n${problems}\nCopy .env.example to .env and fill it in.`);
}

export const config: Config = parsed.data;
