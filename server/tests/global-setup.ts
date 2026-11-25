import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Client } from "pg";

/**
 * Rebuilds the test database from the migration files once per test run, so tests always
 * run against exactly the schema that production gets from `prisma migrate deploy`.
 */
export default async function globalSetup() {
  const url = process.env.TEST_DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/khidma_test";
  const dbName = new URL(url).pathname.slice(1);
  if (!dbName.endsWith("_test")) {
    throw new Error(`Refusing to wipe "${dbName}": the test database name must end with _test`);
  }

  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    await client.query("DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;");
    const migrationsDir = join(__dirname, "..", "prisma", "migrations");
    const migrations = readdirSync(migrationsDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
    for (const name of migrations) {
      await client.query(readFileSync(join(migrationsDir, name, "migration.sql"), "utf8"));
    }
  } finally {
    await client.end();
  }
}
