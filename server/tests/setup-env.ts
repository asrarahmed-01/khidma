// Runs before every test file, before any app module (and therefore config.ts) is loaded.
process.env.NODE_ENV = "test";
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/khidma_test";
process.env.JWT_SECRET = "test-jwt-secret-test-jwt-secret-test-jwt-secret";
process.env.OTP_SECRET = "test-otp-secret-test-otp-secret-test-otp-secret";
process.env.OTP_MAX_REQUESTS = "3";
process.env.OTP_MAX_ATTEMPTS = "5";
process.env.MOYASAR_WEBHOOK_SECRET = "test-webhook-secret-0123456789";
process.env.PUSH_ENABLED = "false";
