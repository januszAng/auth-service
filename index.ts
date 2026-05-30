import { env } from "./env.js";
import { logger } from "./src/lib/logger.js";
import { setupGracefulShutdown, startServer } from "./src/server.js";

logger.info("starting auth-service", {
  nodeVersion: process.version,
  bunVersion: process.env.BUN_VERSION,
  port: env.PORT,
  logLevel: env.LOG_LEVEL,
});

const server = await startServer();
setupGracefulShutdown(server);
