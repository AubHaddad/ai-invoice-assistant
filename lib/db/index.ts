import "server-only";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { EXTERNAL_TIMEOUT } from "@/lib/timeout";
import { relations } from "./relations";

const globalForDb = globalThis as unknown as {
  pool: Pool | undefined;
};

function getDatabaseUrl() {
  // Dynamic lookup so Next does not inline a build-time empty value.
  const databaseUrl = process.env["DATABASE_URL"];

  if (databaseUrl) {
    return databaseUrl;
  }

  // `next build` imports route modules to collect page data and has no secrets.
  if (process.env.NEXT_PHASE === "phase-production-build") {
    return "postgresql://127.0.0.1/build";
  }

  throw new Error("DATABASE_URL is not set");
}

function createPool() {
  const isProd = process.env.NODE_ENV === "production";

  return new Pool({
    connectionString: getDatabaseUrl(),
    connectionTimeoutMillis: EXTERNAL_TIMEOUT.dbConnectionMs,
    query_timeout: EXTERNAL_TIMEOUT.dbQueryMs,
    // Cloud SQL db-f1-micro has a very small max_connections budget.
    max: isProd ? 5 : 10,
  });
}

function getPool() {
  if (!globalForDb.pool) {
    globalForDb.pool = createPool();
  }

  return globalForDb.pool;
}

const pool = new Proxy({} as Pool, {
  get(_target, property) {
    const client = getPool();
    const value = Reflect.get(client, property, client);
    return typeof value === "function" ? value.bind(client) : value;
  },
});

export const db = drizzle({ client: pool, relations });

export * from "./schema";
