import { createServer } from "node:http2";
import { connectNodeAdapter } from "@connectrpc/connect-node";
import { runMigrations } from "./db/migrate.js";
import { AuthService } from "./gen/auth_pb.js";
import { logger } from "./lib/logger.js";
import { authServiceImpl } from "./services/auth.js";

export async function startServer(port = Number(process.env.PORT) || 50051) {
  await runMigrations();
  const handler = connectNodeAdapter({
    routes(router) {
      router.service(AuthService, authServiceImpl);
    },
  });

  const server = createServer(handler);

  server.on("error", (err) => {
    logger.fatal("server error", { error: String(err), port });
    process.exit(1);
  });

  server.listen(port, () => {
    logger.info("server started", { port, pid: process.pid });
  });

  return server;
}

export function setupGracefulShutdown(server: ReturnType<typeof createServer>) {
  const shutdown = (signal: string) => {
    logger.info("shutting down", { signal });
    server.close(() => {
      logger.info("server closed");
      process.exit(0);
    });
    setTimeout(() => {
      logger.warn("forced shutdown after timeout");
      process.exit(1);
    }, 5000).unref();
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}
