import dotenv from "dotenv";
import { defineConfig } from "prisma/config";

dotenv.config({ quiet: true });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // Falls back to the docker-compose database so `npm install` works before .env exists.
    url: process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/khidma",
  },
});
