import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "../../env.js";
import { logger } from "../lib/logger.js";
import * as schema from "./schema/index.js";

const dbLogger = logger.child({ component: "db" });

function buildDebugFn() {
  const enabled = env.LOG_LEVEL === "debug" || env.LOG_LEVEL === "trace";
  if (!enabled) return undefined;

  return (connection: number, query: string, parameters: unknown[]) => {
    dbLogger.debug("query", {
      connection,
      query: query.replace(/\s+/g, " ").trim(),
      params: parameters,
    });
  };
}

const client = postgres(env.DATABASE_URL, {
  debug: buildDebugFn(),
  max: env.DB_POOL_MAX,
  connect_timeout: env.DB_CONNECT_TIMEOUT,
  idle_timeout: env.DB_IDLE_TIMEOUT,
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

// Optional: Add event listeners for connection errors or disconnections
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
