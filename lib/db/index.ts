import "server-only";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { EXTERNAL_TIMEOUT } from "@/lib/timeout";
import { relations } from "./relations";

const globalForDb = globalThis as unknown as {
  pool: Pool | undefined;
};

function getDatabaseUrl() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not set");
  }

  return databaseUrl;
}

function createPool() {
  return new Pool({
    connectionString: getDatabaseUrl(),
    connectionTimeoutMillis: EXTERNAL_TIMEOUT.dbConnectionMs,
    query_timeout: EXTERNAL_TIMEOUT.dbQueryMs,
  });
}

const pool = globalForDb.pool ?? createPool();

if (process.env.NODE_ENV !== "production") {
  globalForDb.pool = pool;
}

export const db = drizzle({ client: pool, relations });

export * from "./schema";
