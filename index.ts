import { logger } from "./src/lib/logger.js";
import { setupGracefulShutdown, startServer } from "./src/server.js";

logger.info("starting auth-service", {
  nodeVersion: process.version,
  bunVersion: process.env.BUN_VERSION,
  port: process.env.PORT || "50051",
  logLevel: process.env.LOG_LEVEL || "info",
});

const server = startServer();
setupGracefulShutdown(server);
