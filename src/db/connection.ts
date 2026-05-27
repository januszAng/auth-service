import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { logger } from "../lib/logger.js";
import * as schema from "./schema/index.js";

const dbLogger = logger.child({ component: "db" });

function buildDebugFn() {
  const enabled =
    process.env.LOG_LEVEL === "debug" || process.env.LOG_LEVEL === "trace";
  if (!enabled) return undefined;

  return (connection: number, query: string, parameters: unknown[]) => {
    dbLogger.debug("query", {
      connection,
      query: query.replace(/\s+/g, " ").trim(),
      params: parameters,
    });
  };
}

function safeInt(env: string | undefined, fallback: number): number {
  if (!env) return fallback;
  const n = Number.parseInt(env, 10);
  return Number.isNaN(n) ? fallback : n;
}

const client = postgres(process.env.DATABASE_URL!, {
  debug: buildDebugFn(),
  max: safeInt(process.env.DB_POOL_MAX, 5),
  connect_timeout: safeInt(process.env.DB_CONNECT_TIMEOUT, 10),
  idle_timeout: safeInt(process.env.DB_IDLE_TIMEOUT, 30),
  connection: {
    application_name: "auth-service",
  },
});

let connected = false;

client
  .unsafe("SELECT 1")
  .then(() => {
    connected = true;
    dbLogger.info("database connected");
  })
  .catch((err) => {
    dbLogger.error("database connection failed", { error: String(err) });
  });

export async function ping(): Promise<boolean> {
  try {
    await client.unsafe("SELECT 1");
    return true;
  } catch {
    return false;
  }
}

export function isConnected(): boolean {
  return connected;
}

export { client };
export const db = drizzle({ client, schema });
